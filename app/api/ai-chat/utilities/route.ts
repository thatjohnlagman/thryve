// Code-aware AI Chat API specifically for utilities
import { GoogleGenerativeAI } from "@google/generative-ai"
import { NextRequest, NextResponse } from "next/server"

// Use higher-capacity model for code generation, can be overridden via env
const UTILITIES_MODEL = process.env.GEMINI_UTILITIES_MODEL || "gemini-2.5-pro"

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

// Sentinel to verify full code reception
const CODE_SENTINEL = "# END_OF_CODE" as const

function extractPythonBlocks(text: string): string[] {
  const blocks: string[] = []
  const regex = /```(?:python)?\s*\n([\s\S]*?)```/gi
  let match: RegExpExecArray | null
  while ((match = regex.exec(text)) !== null) {
    blocks.push(match[1].trim())
  }
  return blocks
}

function needsContinuation(code: string | null | undefined) {
  if (!code) return true
  if (!code.includes(CODE_SENTINEL)) return true
  return false
}

async function generateWithContinuation(modelName: string, prompt: string, existingCode?: string) {
  const model = genAI.getGenerativeModel({
    model: modelName,
    generationConfig: {
      temperature: 0.65,
    },
  })

  const fullResponses: string[] = []
  let attempt = 0
  let assembledCode: string | undefined

  while (attempt < 3) {
    attempt++
    const result = await model.generateContent(prompt)
    const response = result.response.text()
    fullResponses.push(response)

    // Try to extract latest python block (prefer the longest)
    const blocks = extractPythonBlocks(fullResponses.join("\n\n"))
    if (blocks.length) {
      assembledCode = blocks.sort((a, b) => b.length - a.length)[0]
    }

    if (!needsContinuation(assembledCode)) break

    // Build continuation prompt focusing on remaining code
    const partialTail = (assembledCode || "").slice(-1200)
    const continuationPrompt = `The previous response did not include the sentinel '${CODE_SENTINEL}'. Continue ONLY the remaining Python Streamlit dashboard code starting exactly where it left off. \nDo NOT repeat earlier lines already provided. \nOutput ONLY a single \n\n\`\`\`python\n...code...\n\`\`\` block that when concatenated to prior code forms the full program ending with '${CODE_SENTINEL}'. \nTail already have (DO NOT repeat):\n${partialTail}`
    prompt = continuationPrompt
  }

  const combined = fullResponses.join("\n\n")
  return { raw: combined, assembledCode }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { message, conversationHistory, utilityContext, action } = body

    console.log("[Utilities-AI] Processing code-aware request:", {
      action,
      message: message?.substring(0, 50) + "...",
      hasUtilityContext: !!utilityContext,
      utilityId: utilityContext?.id,
      fileName: utilityContext?.file_name
    })

    // Handle different actions (keeping backward compatibility)
    if (action === "create-chat" || action === "send-message") {
      // Legacy support - redirect to simple AI chat
      const response = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || ''}/api/ai-chat-simple`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      })
      return new NextResponse(response.body, {
        status: response.status,
        headers: response.headers
      })
    }

    // Handle deploy_version action
    if (action === "deploy_version") {
      const { utility_id, version_id, versionData, utilityData } = body
      
      if (!utility_id || !version_id || !versionData || !utilityData) {
        return NextResponse.json({ 
          error: "Missing required data. Please ensure version and utility data are provided." 
        }, { status: 400 })
      }

      try {
        console.log("[Utilities-AI] Deploying version:", { utility_id, version_id })

        if (!versionData.generated_code) {
          return NextResponse.json({ error: "No code found for this version" }, { status: 400 })
        }

        // Deploy using the generate-dashboard API
        const deployResponse = await fetch(`${process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'}/api/generate-dashboard`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            utilityId: utility_id,
            fileName: utilityData.file_name,
            generatedCode: versionData.generated_code,
            isRedeployment: true,
            versionId: version_id
          })
        })

        const deployResult = await deployResponse.json()

        if (deployResult.success) {
          console.log("[Utilities-AI] Version deployment successful:", {
            version_id,
            dashboardUrl: deployResult.dashboardUrl
          })

          // Return success - let client handle database updates
          return NextResponse.json({
            success: true,
            dashboardUrl: deployResult.dashboardUrl,
            sandboxId: deployResult.sandboxId,
            message: `Version ${versionData.version_number} deployed successfully`
          })
        } else {
          console.error("[Utilities-AI] Deployment failed:", deployResult.error)
          return NextResponse.json({
            success: false,
            error: deployResult.error || "Deployment failed"
          }, { status: 500 })
        }
      } catch (error) {
        console.error("[Utilities-AI] Error in deploy_version:", error)
        return NextResponse.json({
          success: false,
          error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 })
      }
    }

    // For code-aware functionality, we'll work with the data passed from the client
    // since client-side has proper authentication context
    let existingCode = utilityContext?.generated_code || null
    
    console.log("[Utilities-AI] Using client-provided context:", {
      hasGeneratedCode: !!existingCode,
      codeLength: existingCode?.length || 0,
      codePreview: existingCode ? existingCode.substring(0, 100) + "..." : "No code"
    })

    // Build conversation context
    const conversationContext = conversationHistory
      ?.slice(-10) // Last 10 messages for context
      ?.map((msg: any) => `${msg.message_type === "user" ? "User" : "Assistant"}: ${msg.content}`)
      ?.join("\n") || ""

    // Create code-aware system prompt
    const systemPrompt = `You are Yve, an expert data analysis and dashboard development assistant. You are helping users with their uploaded data files and Streamlit dashboard code.

CURRENT CONTEXT:
${utilityContext ? `
- Working with file: ${utilityContext.file_name}
- File size: ${utilityContext.file_size}
- Status: ${utilityContext.status}
- Charts generated: ${utilityContext.charts_count || 0}
- Has existing dashboard code: ${!!existingCode}
` : 'No specific utility context'}

${existingCode ? `
EXISTING DASHBOARD CODE (ANALYZE THIS FOR REVISIONS):
\`\`\`python
${existingCode}
\`\`\`

This is the current Streamlit dashboard code for the file "${utilityContext?.file_name}". When the user asks for modifications, you must:
1. ANALYZE the existing code above
2. UNDERSTAND what it currently does
3. MAKE the requested changes while preserving working functionality
4. PROVIDE the complete updated code
` : `
NO EXISTING CODE FOUND - This utility may not have generated dashboard code yet.
If the user asks for code modifications, explain that you need the dashboard to be generated first.
`}

CRITICAL INSTRUCTIONS (STRICT - NO EXCEPTIONS):
- You are analyzing dashboard code for data visualizations and can make improvements.
- When user asks for code modifications, FIRST analyze the EXISTING CODE above.
- For code revision requests, START response with exactly: "Your request has been revised! Here's the updated dashboard code:" (no extra text before it).
- RETURN the ENTIRE updated Streamlit script inside ONE single fenced code block like:
  (triple backticks)python
  ...full code...
  ${CODE_SENTINEL}
  (triple backticks)
- The code must end with the sentinel line: ${CODE_SENTINEL}
- Preserve working logic; modify only requested aspects (layout, visuals, metrics, etc.).
- Keep imports consolidated at top; remove unused imports.
- Avoid explanatory prose outside the single code block unless user explicitly asks for explanation.
- If the user request is NOT a code change, answer normally (no code block) but keep concise.
- NEVER output partial code; ensure final line includes ${CODE_SENTINEL}.

ANTI-LAZINESS REQUIREMENTS (ABSOLUTELY MANDATORY):
- NEVER be lazy or cut corners when providing code revisions
- ALWAYS provide the COMPLETE, FULL code even if it seems repetitive or duplicate
- NEVER use placeholders like "... (rest of code remains the same)" or "... (existing code continues)"
- NEVER omit any part of the code, no matter how large or repetitive it may seem
- If the existing code is 500 lines, your revised code should also be complete (not shortened)
- You MUST include every single line of code, every import, every function, every variable
- Even if only one small change was requested, provide the ENTIRE updated file
- The user expects to receive a complete, runnable Python file that they can use immediately
- Repetition and duplication of code is REQUIRED and EXPECTED - do not try to shorten it
- If you feel tempted to say "keep the existing code" or use ellipsis (...), DON'T - write it all out

ROBUSTNESS:
- If original code is very long and you must refactor, you may modularize but still provide one file.
- Ensure all variables referenced are defined.
- Prefer idempotent changes.

Previous conversation:
${conversationContext}

Current user message: ${message}`

        const { raw, assembledCode } = await generateWithContinuation(UTILITIES_MODEL, systemPrompt, existingCode)
    const response = raw

    console.log("[Utilities-AI] Generated response length:", response.length, {
      model: UTILITIES_MODEL,
      hasAssembledCode: !!assembledCode,
      assembledCodeLength: assembledCode?.length,
      hasSentinel: assembledCode?.includes(CODE_SENTINEL),
    })

    // Check if this is a code revision response
    const lowerMsg = (message || "").toLowerCase()
    const isCodeRevision =
      /your request has been revised/i.test(response) ||
      response.includes("```python") ||
      lowerMsg.includes("modify") ||
      lowerMsg.includes("change") ||
      lowerMsg.includes("improve") ||
      lowerMsg.includes("update") ||
      lowerMsg.includes("refactor")

    // If code revision but sentinel missing, append a warning (client may optionally request continuation)
    let finalMessage = response
    if (isCodeRevision && (!assembledCode || !assembledCode.includes(CODE_SENTINEL))) {
      finalMessage += `\n\n(Note: The code may have been truncated before the sentinel ${CODE_SENTINEL}. You can ask: 'Continue the missing tail of the code ending with ${CODE_SENTINEL}' to retrieve the remainder.)`
    }

    // For code updates, we'll let the client handle database updates
    // since it has proper authentication context
    if (isCodeRevision) {
      console.log("[Utilities-AI] Code revision detected - client will handle database update")
    }

    return NextResponse.json({
      message: finalMessage,
      isCodeRevision,
      hasUpdatedCode: isCodeRevision,
      model: UTILITIES_MODEL,
      sentinel: CODE_SENTINEL,
      complete: !needsContinuation(assembledCode),
    })

  } catch (error) {
    console.error("[Utilities-AI] Error:", error)
    return NextResponse.json(
      { error: "Failed to process your request. Please try again." },
      { status: 500 }
    )
  }
}

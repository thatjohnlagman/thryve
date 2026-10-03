import { GoogleGenerativeAI } from "@google/generative-ai"

export const maxDuration = 30

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!)

export async function POST(request: Request) {
  try {
    console.log("[AI-Chat-Simple] API called")
    const body = await request.json()
    console.log("[AI-Chat-Simple] Request body:", body)

    const { message, context_type, context_info, conversation_history } = body

    if (!process.env.GEMINI_API_KEY) {
      console.error("[AI-Chat-Simple] GEMINI_API_KEY not found")
      return Response.json({ error: "AI service not configured" }, { status: 500 })
    }

    console.log("[AI-Chat-Simple] Generating AI response...")

    let systemPrompt = `You are Yve, Thryve's Agentic AI Copilot. Your primary role is to provide expert analysis, strategic roadmaps, prototyping advice, and actionable product intelligence for modern creators, product teams, and end users.

**Core Directives:**
- Act as an elite product architect, UX designer, and technical strategist for Thryve.
- Guide users on transforming market opportunities and trends into concrete products.
- Provide data-driven analysis, architecture patterns, and UI/UX recommendations.
- Focus on practical, high-velocity implementation and user delight.

**Your personality:**
- Sharp, inspiring, and collaborative
- Data-driven and analytically rigorous
- Solution-oriented with an eye for exceptional UX

**Guidelines:**
- Keep responses concise, structured, and actionable
- Use clear markdown with bullet points and code snippets when helpful
- Prioritize real-world business value and intuitive user experiences`

    if (context_type === "trend" && context_info) {
      systemPrompt += `

**ACTIVE CONTEXT: TREND DISCUSSION**
You are specifically discussing the "${context_info.title}" trend in ${context_info.category}.

Key details:
- Summary: ${context_info.summary}
- Interpretation: ${context_info.interpretation}
- Impact Level: ${context_info.impact}

**Instruction:** You are specifically discussing this trend. Integrate the provided details into your responses to give specific, actionable insights on how to build, launch, or capitalize on this opportunity.`
    } else if (context_type === "utility" && context_info) {
      systemPrompt += `

**ACTIVE CONTEXT: UTILITY DISCUSSION**
The current discussion is about the "${context_info.title}" utility. Use this context to provide relevant insights on its functionality and applications.`
    } else if (context_type === "prototype" && context_info) {
      systemPrompt += `

**ACTIVE CONTEXT: PROTOTYPE DISCUSSION**
The current discussion is about the "${context_info.title}" prototype. Use this context to provide relevant insights on its development and use.`
    }

    const contents = []

    // Add system prompt as first message
    contents.push({
      role: "user",
      parts: [{ text: systemPrompt }],
    })

    // Add conversation history
    for (const historyMessage of conversation_history || []) {
      contents.push({
        role: historyMessage.message_type === "user" ? "user" : "model",
        parts: [{ text: historyMessage.content }],
      })
    }

    // Add current user message
    contents.push({
      role: "user",
      parts: [{ text: message }],
    })

    const activeModel = process.env.GEMINI_MODEL || "gemini-flash-latest"
    const model = genAI.getGenerativeModel({ model: activeModel })

    const result = await model.generateContent({
      contents: contents,
      generationConfig: {
        temperature: 0.7,
        topP: 0.9,
        maxOutputTokens: 1000,
      },
    })

    const response = await result.response
    const text = response.text()

    console.log("[AI-Chat-Simple] AI response generated successfully")

    return Response.json({
      response: text,
      success: true,
    })
  } catch (error) {
    console.error("[AI-Chat-Simple] API Error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { generateWithFallback } from "@/lib/gemini"
import { getClientIp, guardTextInput, rateLimit, sanitizeAndDetect } from "@/lib/security"

interface V0ChatMessage {
  id: string
  content: string
  role: "user" | "assistant"
  createdAt: string
  type?: string
  demoUrl?: string
}

interface V0ChatRequest {
  action: "getHistory" | "sendMessage" | "createProject" | "updateProject"
  chatId?: string
  message?: string
  projectFiles?: { [key: string]: string }
  projectName?: string
}

export async function POST(request: NextRequest) {
  try {
    let rawBody: V0ChatRequest
    try {
      rawBody = await request.json()
    } catch {
      return NextResponse.json({ error: "Invalid JSON" }, { status: 400 })
    }

    // Basic action allowlist
    if (!rawBody?.action) {
      return NextResponse.json({ error: "action is required" }, { status: 400 })
    }

    const action: V0ChatRequest["action"] = rawBody.action
    const clientIp = getClientIp(request)
    const rlKey = `v0-chat:${clientIp}:${action}`
    const rl = rateLimit(rlKey, { windowMs: 60_000, max: action === "sendMessage" ? 30 : 10 })
    if (rl.limited) {
      return NextResponse.json({ error: "Rate limit exceeded", retryInMs: rl.resetIn }, { status: 429 })
    }

    // Sanitize & detect injection on string fields
    const { data: body, issues } = sanitizeAndDetect(rawBody as any, ["message", "projectName"])
    if (Object.values(issues).some((list) => list.some((i) => i.startsWith("injection:")))) {
      return NextResponse.json({ error: "Potential prompt injection detected", issues }, { status: 400 })
    }

    const { chatId, message, projectFiles, projectName } = body

    // Guard message text for actions that require it
    if (["sendMessage", "createProject", "updateProject"].includes(action)) {
      const guarded = guardTextInput({ value: message, fieldName: "message", maxLength: 8000 })
      if (!guarded.ok) return NextResponse.json({ error: guarded.error }, { status: 400 })
      body.message = guarded.value
    }

    const now = new Date().toISOString()

    if (action === "getHistory") {
      const defaultMessages = [
        {
          id: "welcome-msg",
          content:
            "Hello! I am Yve, your Agentic AI Product and Prototyping Architect. How would you like to refine, test, or expand this prototype?",
          role: "assistant",
          createdAt: now,
        },
      ]

      return NextResponse.json({
        success: true,
        messages: defaultMessages,
        chat: {
          id: chatId || "chat-session",
          title: "Prototype Refinement",
        },
      })
    }

    if (action === "sendMessage") {
      const prompt = body.message || message || ""
      console.log(`[Ask-Yve] Processing message with Gemini: "${prompt.substring(0, 80)}..."`)
      const systemInstruction = `You are Yve, an elite agentic AI product architect and UI/UX engineering mentor for Thryve. You are collaborating with a product creator or developer on interactive application prototypes and user flows.
Provide clear, constructive, and actionable advice on user journeys, frontend components, state management, UI polish, micro-interactions, or feature expansions. Keep responses concise, inspiring, and technically precise.`

      const aiResponse = await generateWithFallback(prompt, systemInstruction, {
        temperature: 0.7,
        maxOutputTokens: 2048,
      })

      return NextResponse.json({
        success: true,
        message: {
          id: `msg-${Date.now()}`,
          content: aiResponse,
          role: "assistant",
          createdAt: new Date().toISOString(),
        },
        chat: {
          id: chatId || `chat-${Date.now()}`,
        },
      })
    }

    if (action === "createProject" || action === "updateProject") {
      return NextResponse.json({
        success: true,
        chatId: chatId || `proj-${Date.now()}`,
        message: {
          id: `msg-${Date.now()}`,
          content: `Prototype adjustments recorded. You can view the live interactive preview directly in the preview tab.`,
          role: "assistant",
          createdAt: now,
        },
      })
    }

    return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
  } catch (error: any) {
    console.error("[Ask-Yve] Error:", error)
    return NextResponse.json(
      { error: error?.message || "Internal server error" },
      { status: 500 }
    )
  }
}

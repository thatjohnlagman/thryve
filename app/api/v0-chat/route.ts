import { type NextRequest, NextResponse } from "next/server"
import { getClientIp, rateLimit, guardTextInput, sanitizeAndDetect } from "@/lib/security"

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
    console.log("[V0-CHAT-API] V0 CHAT API REQUEST")

    const rawBody: V0ChatRequest = await request.json()
    // Basic action allowlist
    if (!rawBody.action) {
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
    if (Object.values(issues).some(list => list.some(i => i.startsWith("injection:")))) {
      return NextResponse.json({ error: "Potential prompt injection detected", issues }, { status: 400 })
    }

    const { chatId, message, projectFiles, projectName } = body

    // Guard message text for actions that require it
    if (["sendMessage", "createProject", "updateProject"].includes(action)) {
      const guarded = guardTextInput({ value: message, fieldName: "message", maxLength: 8000 })
      if (!guarded.ok) return NextResponse.json({ error: guarded.error }, { status: 400 })
      body.message = guarded.value
    }

    console.log(`[V0-CHAT-API] Action: ${action}`)
    console.log(`[V0-CHAT-API] Chat ID: ${chatId}`)
    console.log(`[V0-CHAT-API] Message: ${message ? `"${message.substring(0, 100)}..."` : "None"}`)

    console.log("[V0-CHAT-API] Importing v0-sdk")
    const { v0 } = await import("v0-sdk")
    console.log("[V0-CHAT-API] v0-sdk imported successfully")

  if (action === "createProject") {
      if (!message || !projectName) {
        console.error("[V0-CHAT-API] Missing message or projectName for createProject")
        return NextResponse.json({ error: "message and projectName are required for createProject" }, { status: 400 })
      }

      console.log("[V0-CHAT-API] Creating new v0 project...")

      const chat = await v0.chats.create({
        message: `Create a project called "${projectName}": ${message}`,
        modelConfiguration: {
          modelId: "v0-1.5-lg",
          imageGenerations: true,
          thinking: true,
        },
      })

      console.log(`[V0-CHAT-API] Created new project with chat ID: ${chat.id}`)

      return NextResponse.json({
        success: true,
        chatId: chat.id,
        demoUrl: chat.demo || (chat.latestVersion as any)?.demoUrl,
        webUrl: chat.webUrl,
        files: chat.files || [],
        message: chat.messages?.[chat.messages.length - 1] || null,
      })
    }

  if (action === "updateProject") {
      if (!chatId || !message) {
        console.error("[V0-CHAT-API] Missing chatId or message for updateProject")
        return NextResponse.json({ error: "chatId and message are required for updateProject" }, { status: 400 })
      }

      console.log("[V0-CHAT-API] Updating existing v0 project with current files...")

      // Build context message with current project files
      let contextMessage = message
      if (projectFiles && Object.keys(projectFiles).length > 0) {
        contextMessage += "\n\nCurrent project files:\n"
        Object.entries(projectFiles).forEach(([filename, content]) => {
          contextMessage += `\n### ${filename}\n\`\`\`\n${content}\n\`\`\`\n`
        })
      }

      const response = await v0.chats.sendMessage({
        chatId,
        message: contextMessage,
        modelConfiguration: {
          modelId: "v0-1.5-lg",
          imageGenerations: true,
          thinking: true,
        },
      })

      console.log(`[V0-CHAT-API] Updated project successfully`)

      return NextResponse.json({
        success: true,
        newDemoUrl: response.demo || (response.latestVersion as any)?.demoUrl,
        files: response.files || [],
        message: response.messages?.[response.messages.length - 1] || null,
        chat: {
          id: response.id,
          webUrl: response.webUrl,
          demoUrl: response.demo || (response.latestVersion as any)?.demoUrl,
        },
      })
    }

  // chatId requirement is enforced implicitly in specific action branches below.

  if (action === "getHistory") {
      console.log("[V0-CHAT-API] Fetching chat history...")

      const chatResponse = await v0.chats.getById({ chatId })
      console.log(`[V0-CHAT-API] Found ${chatResponse.messages?.length || 0} messages`)

      // Transform messages to our format
      const messages: V0ChatMessage[] = (chatResponse.messages || []).map((msg) => ({
        id: msg.id,
        content: msg.content,
        role: msg.role,
        createdAt: msg.createdAt,
        type: msg.type,
        demoUrl: (msg as any).demoUrl || (msg as any).demo,
      }))

      console.log("[V0-CHAT-API] Chat history retrieved successfully")
      return NextResponse.json({
        success: true,
        messages,
        chat: {
          id: chatResponse.id,
          title: chatResponse.name || chatResponse.title,
          webUrl: chatResponse.webUrl,
          demoUrl: chatResponse.demo || (chatResponse.latestVersion as any)?.demoUrl,
        },
      })
  } else if (action === "sendMessage") {
      if (!message) {
        console.error("[V0-CHAT-API] Missing message for sendMessage action")
        return NextResponse.json({ error: "message is required for sendMessage" }, { status: 400 })
      }

      console.log("[V0-CHAT-API] Sending message to v0 chat...")

      const startTime = Date.now()
      const response = await v0.chats.sendMessage({
        chatId,
        message,
        modelConfiguration: {
          modelId: "v0-1.5-lg", // Use large model for quality
          imageGenerations: true,
          thinking: true,
        },
      })
      const endTime = Date.now()

      console.log(`[V0-CHAT-API] Message sent in ${endTime - startTime}ms`)
      console.log(`[V0-CHAT-API] Updated chat ID: ${response.id}`)

      // Get the latest message (should be the assistant's response)
      const latestMessage = response.messages?.[response.messages.length - 1]

      console.log("[V0-CHAT-API] Message sent successfully")
      return NextResponse.json({
        success: true,
        newDemoUrl: response.demo || (response.latestVersion as any)?.demoUrl,
        files: response.files || [],
        message: latestMessage
          ? {
              id: latestMessage.id,
              content: latestMessage.content,
              role: latestMessage.role,
              createdAt: latestMessage.createdAt,
              demoUrl: (latestMessage as any).demoUrl || response.demo,
            }
          : null,
        chat: {
          id: response.id,
          webUrl: response.webUrl,
          demoUrl: response.demo || (response.latestVersion as any)?.demoUrl,
        },
      })
    } else {
      console.error(`[V0-CHAT-API] Unknown action: ${action}`)
      return NextResponse.json({ error: `Unknown action: ${action}` }, { status: 400 })
    }
  } catch (error) {
    console.error("[V0-CHAT-API] =================================")
    console.error("[V0-CHAT-API] V0 CHAT API ERROR")
    console.error("[V0-CHAT-API] =================================")
    console.error(`[V0-CHAT-API] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
    console.error(`[V0-CHAT-API] Error message: ${error instanceof Error ? error.message : String(error)}`)

    if (error instanceof Error && error.stack) {
      console.error("[V0-CHAT-API] Stack trace:")
      error.stack.split("\n").forEach((line) => console.error(`   ${line}`))
    }

    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Unknown error occurred" },
      { status: 500 },
    )
  }
}

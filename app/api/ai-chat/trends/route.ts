import { createClient } from "@/lib/supabase"
import type { NextRequest } from "next/server"

export const maxDuration = 30

interface ChatMessage {
  content: string
  message_type: "user" | "bot"
  created_at: string
}

interface CreateChatRequest {
  context_type?: "trend" | "utility" | "prototype" | "general"
  context_id?: string
  first_message: string
}

interface SendMessageRequest {
  conversation_id: string
  message: string
}

export async function POST(request: NextRequest) {
  console.log("AI Chat API called")
  try {
    const body = await request.json()
    console.log("Request body:", body)
    const { action } = body

    const supabase = createClient()
    console.log("Supabase client created successfully")

    // Verbose debugging for Supabase configuration
    console.log("Environment check:", {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
      anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length
    })

    // Get current user
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log("Detailed auth check:", {
      userId: user?.id,
      userEmail: user?.email,
      userRole: user?.role,
      userAud: user?.aud,
      userAppMetadata: user?.app_metadata,
      userUserMetadata: user?.user_metadata,
      hasAuthError: !!authError,
      authErrorMessage: authError?.message,
      authErrorStatus: authError?.status,
      authErrorCode: authError?.code
    })

    if (authError || !user) {
      console.log("VERBOSE AUTH FAILURE:", {
        reason: !user ? "No user found" : "Auth error occurred",
        authError: authError,
        headers: Object.fromEntries(request.headers.entries()),
        cookies: request.headers.get('cookie')
      })
      return Response.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log("Processing action:", action)

    if (action === "create_chat") {
      return await createChat(supabase, user.id, body as CreateChatRequest)
    } else if (action === "send_message") {
      return await sendMessage(supabase, user.id, body as SendMessageRequest)
    } else if (action === "get_conversations") {
      return await getConversations(supabase, user.id)
    } else if (action === "get_messages") {
      return await getMessages(supabase, user.id, body.conversation_id)
    } else if (action === "delete_conversation") {
      return await deleteConversation(supabase, user.id, body.conversation_id)
    }

    console.log("Invalid action provided:", action)
    return Response.json({ error: "Invalid action" }, { status: 400 })
  } catch (error) {
    console.error("API Error:", error)
    return Response.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function createChat(supabase: any, userId: string, data: CreateChatRequest) {
  console.log("Creating new chat for user:", userId, "with data:", data)

  const conversationId = crypto.randomUUID()
  console.log("Generated conversation ID:", conversationId)

  let contextInfo = null
  if (data.context_type && data.context_id) {
    console.log("Fetching context info for type:", data.context_type, "id:", data.context_id)

    if (data.context_type === "trend") {
      const { data: trend, error: trendError } = await supabase
        .from("trends")
        .select("*")
        .eq("id", data.context_id)
        .single()
      console.log("Trend fetch result:", trend, "Error:", trendError)
      contextInfo = trend
    }
    // Add utility and prototype context fetching when those tables exist
  }

  // Add first user message
  console.log("Adding first user message to database")
  const { error: messageError } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    context_type: data.context_type || "general",
    context_id: data.context_id || null,
    content: data.first_message,
    message_type: "user",
  })

  if (messageError) {
    console.error("Error adding first message:", messageError)
    return Response.json({ error: "Failed to add message" }, { status: 500 })
  }

  console.log("Generating AI response")
  // Generate AI response
  const aiResponse = await generateAIResponseWithHistory(data.first_message, data.context_type, contextInfo, [])

  console.log("AI response generated:", aiResponse.substring(0, 100) + "...")

  // Add AI response to database
  const { error: aiMessageError } = await supabase.from("ai_messages").insert({
    conversation_id: conversationId,
    user_id: userId,
    context_type: data.context_type || "general",
    context_id: data.context_id || null,
    content: aiResponse,
    message_type: "bot",
  })

  if (aiMessageError) {
    console.error("Error adding AI message:", aiMessageError)
    return Response.json({ error: "Failed to add AI response" }, { status: 500 })
  }

  console.log("Chat created successfully")
  return Response.json({
    conversationId,
    response: aiResponse,
    success: true,
  })
}

async function sendMessage(supabase: any, userId: string, data: SendMessageRequest) {
  console.log("Sending message for user:", userId, "conversation:", data.conversation_id)

  const { data: contextMessage, error: contextError } = await supabase
    .from("ai_messages")
    .select("context_type, context_id")
    .eq("conversation_id", data.conversation_id)
    .eq("user_id", userId)
    .limit(1)
    .single()

  console.log("Context message fetch result:", contextMessage, "Error:", contextError)

  if (contextError || !contextMessage) {
    console.log("Conversation not found")
    return Response.json({ error: "Conversation not found" }, { status: 404 })
  }

  const { data: conversationHistory, error: historyError } = await supabase
    .from("ai_messages")
    .select("content, message_type, created_at")
    .eq("conversation_id", data.conversation_id)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  console.log("Conversation history loaded:", conversationHistory?.length, "messages")

  if (historyError) {
    console.error("Error getting conversation history:", historyError)
    return Response.json({ error: "Failed to get conversation history" }, { status: 500 })
  }

  // Get context information if available
  let contextInfo = null
  if (contextMessage.context_type === "trend" && contextMessage.context_id) {
    const { data: trend } = await supabase.from("trends").select("*").eq("id", contextMessage.context_id).single()
    contextInfo = trend
    console.log("Context info loaded:", contextInfo?.title)
  }

  // Add user message
  console.log("Adding user message to database")
  const { error: messageError } = await supabase.from("ai_messages").insert({
    conversation_id: data.conversation_id,
    user_id: userId,
    context_type: contextMessage.context_type,
    context_id: contextMessage.context_id,
    content: data.message,
    message_type: "user",
  })

  if (messageError) {
    console.error("Error adding user message:", messageError)
    return Response.json({ error: "Failed to add message" }, { status: 500 })
  }

  console.log("Generating AI response with history")
  // Generate AI response with history
  const aiResponse = await generateAIResponseWithHistory(
    data.message,
    contextMessage.context_type,
    contextInfo,
    conversationHistory,
  )

  console.log("AI response generated:", aiResponse.substring(0, 100) + "...")

  // Add AI response to database
  const { error: aiMessageError } = await supabase.from("ai_messages").insert({
    conversation_id: data.conversation_id,
    user_id: userId,
    context_type: contextMessage.context_type,
    context_id: contextMessage.context_id,
    content: aiResponse,
    message_type: "bot",
  })

  if (aiMessageError) {
    console.error("Error adding AI message:", aiMessageError)
    return Response.json({ error: "Failed to add AI response" }, { status: 500 })
  }

  console.log("Message sent successfully")
  return Response.json({
    response: aiResponse,
    success: true,
  })
}

async function streamAIResponse(
  supabase: any,
  userId: string,
  conversationId: string,
  userMessage: string,
  contextType?: string,
  contextInfo?: any,
  conversationHistory: ChatMessage[] = [],
) {
  const GEMINI_API_KEY = process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    return Response.json({ error: "AI service not configured" }, { status: 500 })
  }

  const encoder = new TextEncoder()
  const stream = new ReadableStream({
    async start(controller) {
      try {
        let systemPrompt = `You are Yve, BPI's AI innovation assistant. You help with banking innovation, fintech trends, and business opportunities in the Philippines.

Key context:
- You work for BPI (Bank of the Philippine Islands)
- Focus on Philippine banking, fintech, and financial services
- Consider BSP regulations and local market conditions
- Provide practical, actionable insights for innovation challenges

Your personality:
- Professional but approachable
- Data-driven and analytical
- Focused on practical implementation
- Knowledgeable about Philippine market dynamics`

        if (contextType === "trend" && contextInfo) {
          systemPrompt += `

CURRENT TREND CONTEXT:
You are discussing the "${contextInfo.title}" trend in ${contextInfo.category}.

Key Details:
- Summary: ${contextInfo.summary}
- Business Interpretation: ${contextInfo.interpretation}
- Impact Level: ${contextInfo.impact}
- Category: ${contextInfo.category}

${
  contextInfo.detailed_research
    ? `
Detailed Research Available:
- Market Validation: ${contextInfo.detailed_research.marketValidation?.targetMarketSize || "Available"}
- Competitive Analysis: ${contextInfo.detailed_research.competitiveAnalysis?.currentState || "Available"}
- Implementation Details: ${contextInfo.detailed_research.implementationDetails?.technicalRequirements || "Available"}
- Business Model: ${contextInfo.detailed_research.businessModel?.revenueModel || "Available"}
`
    : ""
}

IMPORTANT: You are specifically discussing this "${contextInfo.title}" trend. All your responses should be contextually relevant to this trend and its implications for BPI. Reference the trend details naturally in your responses and provide specific insights about how BPI can leverage or respond to this trend.`
        } else if (contextType === "utility" && contextInfo) {
          systemPrompt += `

CURRENT UTILITY CONTEXT:
You are discussing the "${contextInfo.title}" utility.
Use this context to provide relevant insights about this utility and its applications.`
        } else if (contextType === "prototype" && contextInfo) {
          systemPrompt += `

CURRENT PROTOTYPE CONTEXT:
You are discussing the "${contextInfo.title}" prototype.
Use this context to provide relevant insights about this prototype and its development.`
        }

        const contents = []

        // Add system prompt as first message
        contents.push({
          role: "user",
          parts: [{ text: systemPrompt }],
        })

        // Add conversation history
        for (const message of conversationHistory) {
          contents.push({
            role: message.message_type === "user" ? "user" : "model",
            parts: [{ text: message.content }],
          })
        }

        // Add current user message
        contents.push({
          role: "user",
          parts: [{ text: userMessage }],
        })

        const response = await fetch(
          `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:streamGenerateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
          {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              contents: contents,
              generationConfig: {
                temperature: 0.7,
                topP: 0.9,
                maxOutputTokens: 1000,
              },
            }),
          },
        )

        if (!response.ok) {
          throw new Error(`Gemini API error: ${response.status}`)
        }

        const reader = response.body?.getReader()
        if (!reader) {
          throw new Error("No response body")
        }

        let fullResponse = ""

        try {
          while (true) {
            const { done, value } = await reader.read()
            if (done) break

            const chunk = new TextDecoder().decode(value)
            const lines = chunk.split("\n")

            for (const line of lines) {
              if (line.startsWith("data: ")) {
                try {
                  const data = JSON.parse(line.slice(6))
                  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text
                  if (text) {
                    fullResponse += text
                    controller.enqueue(encoder.encode(`data: ${JSON.stringify({ text, fullResponse })}\n\n`))
                  }
                } catch (e) {
                  // Skip invalid JSON lines
                }
              }
            }
          }
        } finally {
          reader.releaseLock()
        }

        // Save the complete AI response to database
        if (fullResponse) {
          await supabase.from("ai_messages").insert({
            conversation_id: conversationId,
            user_id: userId,
            context_type: contextType || "general",
            context_id: contextInfo?.id || null,
            content: fullResponse,
            message_type: "bot",
          })
        }

        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ done: true, conversationId })}\n\n`))
        controller.close()
      } catch (error) {
        console.error("[streamAIResponse] Error:", error)
        controller.enqueue(
          encoder.encode(
            `data: ${JSON.stringify({ error: "I encountered an error while processing your request. Please try again." })}\n\n`,
          ),
        )
        controller.close()
      }
    },
  })

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      Connection: "keep-alive",
    },
  })
}

async function getConversations(supabase: any, userId: string) {
  const { data: conversations, error } = await supabase
    .from("ai_messages")
    .select(`
      conversation_id,
      context_type,
      context_id,
      content,
      created_at
    `)
    .eq("user_id", userId)
    .order("created_at", { ascending: false })

  if (error) {
    console.error("[getConversations] Error:", error)
    return Response.json({ error: "Failed to get conversations" }, { status: 500 })
  }

  // Group by conversation_id and get conversation metadata
  const conversationMap = new Map()

  for (const message of conversations) {
    const convId = message.conversation_id
    if (!conversationMap.has(convId)) {
      conversationMap.set(convId, {
        id: convId,
        context_type: message.context_type,
        context_id: message.context_id,
        title: message.content.slice(0, 50) + (message.content.length > 50 ? "..." : ""),
        lastMessage: message.content,
        timestamp: message.created_at,
        messageCount: 1,
      })
    } else {
      const conv = conversationMap.get(convId)
      conv.messageCount++
      if (new Date(message.created_at) > new Date(conv.timestamp)) {
        conv.lastMessage = message.content
        conv.timestamp = message.created_at
      }
    }
  }

  const formattedConversations = Array.from(conversationMap.values())

  return Response.json({ conversations: formattedConversations })
}

async function getMessages(supabase: any, userId: string, conversationId: string) {
  const { data: messages, error } = await supabase
    .from("ai_messages")
    .select("id, content, message_type, created_at")
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)
    .order("created_at", { ascending: true })

  if (error) {
    console.error("[getMessages] Error:", error)
    return Response.json({ error: "Failed to get messages" }, { status: 500 })
  }

  return Response.json({ messages })
}

async function generateAIResponseWithHistory(
  userMessage: string,
  contextType?: string,
  contextInfo?: any,
  conversationHistory: ChatMessage[] = [],
): Promise<string> {
  console.log(
    "Generating AI response with history. Context type:",
    contextType,
    "History length:",
    conversationHistory.length,
  )

  const GEMINI_API_KEY = process.env.GEMINI_API_KEY

  if (!GEMINI_API_KEY) {
    console.error("GEMINI_API_KEY not found")
    return "I can't process your request right now. Please try again later or contact support if the issue persists."
  }

  try {
    let systemPrompt = `You are Yve, BPI's AI innovation assistant. Your primary role is to provide expert analysis and actionable insights on banking innovation, fintech trends, and business opportunities specifically within the Philippines.

**Core Directives:**
- Act as an expert for BPI (Bank of the Philippine Islands).
- Focus on the Philippine financial services market, including banking, fintech, and digital payments.
- All advice must consider Bangko Sentral ng Pilipinas (BSP) regulations and local market conditions.
- Provide practical, data-driven, and implementation-focused insights.

**Persona:**
- **Professional and approachable:** Communicate clearly and confidently.
- **Analytical:** Base your responses on data and evidence.
- **Philippine Market Expert:** Demonstrate deep knowledge of the local landscape.`

    if (contextType === "trend" && contextInfo) {
      console.log("Adding trend context to prompt:", contextInfo.title)
      systemPrompt += `

**ACTIVE CONTEXT: TREND ANALYSIS**
The current discussion is focused on the "${contextInfo.title}" trend within the ${contextInfo.category} sector. Your responses must be directly relevant to this trend.

**Trend Details:**
- **Summary:** ${contextInfo.summary}
- **Interpretation:** ${contextInfo.interpretation}
- **Impact:** ${contextInfo.impact}

${
  contextInfo.detailed_research
    ? `**Available Research:**
- **Market Validation:** ${contextInfo.detailed_research.marketValidation?.targetMarketSize || "Available"}
- **Competitive Analysis:** ${contextInfo.detailed_research.competitiveAnalysis?.currentState || "Available"}
- **Implementation:** ${contextInfo.detailed_research.implementationDetails?.technicalRequirements || "Available"}
- **Business Model:** ${contextInfo.detailed_research.businessModel?.revenueModel || "Available"}`
    : ""
}

**Instruction:** You are specifically discussing this trend. Integrate the provided details into your responses to give specific, actionable insights for BPI on how to leverage or respond to this opportunity.`
    } else if (contextType === "utility" && contextInfo) {
      systemPrompt += `

**ACTIVE CONTEXT: UTILITY DISCUSSION**
The current discussion is about the "${contextInfo.title}" utility. Use this context to provide relevant insights on its functionality and applications.`
    } else if (contextType === "prototype" && contextInfo) {
      systemPrompt += `

**ACTIVE CONTEXT: PROTOTYPE DISCUSSION**
The current discussion is about the "${contextInfo.title}" prototype. Use this context to provide relevant insights on its development and use.`
    }

    const contents = []

    // Add system prompt as first message
    contents.push({
      role: "user",
      parts: [{ text: systemPrompt }],
    })

    // Add conversation history
    console.log("Adding conversation history to Gemini request")
    for (const message of conversationHistory) {
      contents.push({
        role: message.message_type === "user" ? "user" : "model",
        parts: [{ text: message.content }],
      })
    }

    // Add current user message
    contents.push({
      role: "user",
      parts: [{ text: userMessage }],
    })

    console.log("Making request to Gemini API with", contents.length, "messages")

    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: contents,
          generationConfig: {
            temperature: 0.7,
            topP: 0.9,
            maxOutputTokens: 1000,
          },
        }),
      },
    )

    console.log("Gemini API response status:", response.status)

    if (!response.ok) {
      const errorText = await response.text()
      console.error("Gemini API error:", response.status, errorText)
      return "I apologize, but I'm having trouble generating a response right now. Please try again in a moment."
    }

    const data = await response.json()
    console.log("Gemini API response received")

    const aiResponse = data?.candidates?.[0]?.content?.parts?.[0]?.text

    if (!aiResponse) {
      console.error("No response from Gemini")
      return "I'm sorry, I couldn't generate a proper response. Please try rephrasing your question."
    }

    console.log("AI response successfully generated")
    return aiResponse
  } catch (error) {
    console.error("Error in generateAIResponseWithHistory:", error)
    return "I encountered an error while processing your request. Please try again."
  }
}

async function generateAIResponse(userMessage: string, contextType?: string, contextInfo?: any): Promise<string> {
  // This function is now deprecated, use generateAIResponseWithHistory instead
  return generateAIResponseWithHistory(userMessage, contextType, contextInfo, [])
}

async function deleteConversation(supabase: any, userId: string, conversationId: string) {
  console.log("Deleting conversation:", conversationId, "for user:", userId)

  // Delete all messages for this conversation
  const { error } = await supabase
    .from("ai_messages")
    .delete()
    .eq("conversation_id", conversationId)
    .eq("user_id", userId)

  if (error) {
    console.error("[deleteConversation] Error:", error)
    return Response.json({ error: "Failed to delete conversation" }, { status: 500 })
  }

  console.log("Conversation deleted successfully")
  return Response.json({ success: true })
}

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

    let systemPrompt = `You are Yve, BPI's AI innovation assistant. Your primary role is to provide expert analysis and actionable insights on banking innovation, fintech trends, and business opportunities specifically within the Philippines.

**Core Directives:**
- Act as an expert for BPI (Bank of the Philippine Islands).
- Focus on Philippine banking, fintech, and financial services.
- Consider BSP regulations and local market conditions.
- Provide practical, actionable insights for innovation challenges.

**Your personality:**
- Professional but approachable
- Data-driven and analytical
- Focused on practical implementation
- Knowledgeable about Philippine market dynamics

**Guidelines:**
- Keep responses concise but comprehensive
- Use data and examples when available
- Consider regulatory compliance (BSP, SEC, etc.)
- Focus on customer impact and business value`

    if (context_type === "trend" && context_info) {
      systemPrompt += `

**ACTIVE CONTEXT: TREND DISCUSSION**
You are specifically discussing the "${context_info.title}" trend in ${context_info.category}.

Key details:
- Summary: ${context_info.summary}
- Interpretation: ${context_info.interpretation}
- Impact Level: ${context_info.impact}

**Instruction:** You are specifically discussing this trend. Integrate the provided details into your responses to give specific, actionable insights for BPI on how to leverage or respond to this opportunity.`
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

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" })

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

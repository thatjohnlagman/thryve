import { type NextRequest, NextResponse } from "next/server"
import { generateWithFallback } from "@/lib/gemini"

export const maxDuration = 60

interface ResearchResponse {
  detailed_research: {
    market_need: string
    key_metrics: string[]
    competitive_advantage: string
    regulatory_considerations: string
    implementation_complexity: string
    target_demographics: string[]
  }
  prototype_prompt: string
  sources: string[]
}

async function searchTavily(queries: string[], apiKey: string): Promise<{ text: string; sources: string[] }> {
  const endpoint = "https://api.tavily.com/search"
  const fetches = queries.map(async (q) => {
    try {
      const res = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          query: q,
          search_depth: "advanced",
          max_results: 5,
        }),
      })
      if (!res.ok) return { results: [] }
      return await res.json()
    } catch {
      return { results: [] }
    }
  })

  const results = await Promise.all(fetches)
  const snippets: string[] = []
  const sources: string[] = []
  const seen = new Set<string>()

  for (const r of results) {
    for (const item of r?.results || []) {
      const url = (item.url || "").trim()
      if (url && /^https?:\/\//i.test(url) && !seen.has(url)) {
        seen.add(url)
        sources.push(url)
        const title = (item.title || "").trim()
        const content = (item.content || item.snippet || "").trim().slice(0, 500)
        snippets.push(`Source: ${title} (${url})\n${content}`)
      }
    }
  }

  return { text: snippets.join("\n\n").slice(0, 10000), sources }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}))

    const GEMINI_API_KEY = process.env.GEMINI_API_KEY
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY

    if (!GEMINI_API_KEY) {
      return NextResponse.json({ error: "Missing GEMINI_API_KEY in .env.local" }, { status: 400 })
    }

    // 1. BOOTSTRAP SEEDS ONLY (Progressive trend generation)
    if ("bootstrap" in body && body.bootstrap && body.mode === "seeds") {
      const existingTrends = body.existingTrends || []
      const requestedCount = body.count || 3
      const searchTopic = body.searchTopic
      const isAutomatic = !searchTopic

      const queries = searchTopic
        ? [
            `${searchTopic} product innovation market trends user adoption 2025 OR 2026`,
            `${searchTopic} technology architecture competitive landscape case studies`,
          ]
        : [
            "AI agents SaaS autonomous workflows product innovation trends 2025 2026",
            "fintech digital platforms data analytics market opportunities user growth",
          ]

      console.log("[/api/research seeds] Searching Tavily for topic:", searchTopic || "General Technology")
      let searchContext = ""
      if (TAVILY_API_KEY) {
        const tavilyData = await searchTavily(queries, TAVILY_API_KEY)
        searchContext = tavilyData.text
      }

      const existingList =
        existingTrends.length > 0
          ? `\nAvoid duplicating these existing trends:\n${existingTrends.map((t: string, i: number) => `${i + 1}. ${t}`).join("\n")}`
          : ""

      const prompt = `Based on the latest market research, technology trends, and user demand:

${searchContext || "Focus on modern software products, AI agents, digital services, data analytics, and user adoption."}
${existingList}

Generate exactly ${requestedCount} innovative, actionable product/service opportunity trends for modern end users, founders, and product teams.
${searchTopic ? `Prioritize intersection with focus area: "${searchTopic}".` : ""}

Return ONLY a clean JSON object with this exact schema:
{
  "trends": [
    {
      "title": "string (crisp, professional headline)",
      "category": "string (e.g. AI Agents, Fintech, SaaS, Developer Tools, Analytics, HealthTech, ClimateTech)",
      "impact": "High" | "Medium" | "Low",
      "summary": "string (1-2 sentence executive summary of the opportunity)",
      "interpretation": "string (Strategic moat, user value proposition, and growth potential)"
    }
  ]
}`

      const rawJson = await generateWithFallback(prompt, undefined, {
        temperature: 0.4,
        responseMimeType: "application/json",
      })

      let seeds: any[] = []
      try {
        const parsed = JSON.parse(
          rawJson.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim()
        )
        seeds = parsed.trends || []
      } catch (err) {
        console.warn("[/api/research] Failed to parse seeds JSON:", err)
      }

      return NextResponse.json({
        seeds,
        generationType: isAutomatic ? "automatic" : "manual",
      })
    }

    // 2. DETAILED SINGLE-TREND ANALYSIS
    const { title, category } = body as { title?: string; category?: string }
    if (!title || !category) {
      return NextResponse.json({ error: "Missing 'title' or 'category'." }, { status: 400 })
    }

    console.log(`[/api/research detail] Deep research for: "${title}" (${category})`)
    const queries = [
      `${title} ${category} market analysis competitive landscape 2025 OR 2026`,
      `${title} implementation architecture technical requirements case study`,
      `${title} user behavior market size growth metrics`,
    ]

    let searchContext = ""
    let sources: string[] = []

    if (TAVILY_API_KEY) {
      const tavilyData = await searchTavily(queries, TAVILY_API_KEY)
      searchContext = tavilyData.text
      sources = tavilyData.sources.slice(0, 6)
    }

    const detailPrompt = `Conduct a comprehensive strategic and market analysis regarding this innovation trend:
Trend Title: ${title}
Category: ${category}

Research context & sources:
${searchContext || "Analyze based on modern product architecture, user demand, and market dynamics."}

Return ONLY a clean JSON object strictly conforming to:
{
  "detailed_research": {
    "market_need": "string (in-depth description of user pain points and market demand)",
    "key_metrics": ["string", "string", "string", "string"],
    "competitive_advantage": "string (key differentiators and competitive moat)",
    "regulatory_considerations": "string (compliance, privacy, data governance, and security standards)",
    "implementation_complexity": "High" | "Medium" | "Low",
    "target_demographics": ["string", "string", "string"]
  },
  "prototype_prompt": "string (A detailed specification prompt for building a modern web/mobile prototype application that addresses this trend)"
}`

    const rawDetail = await generateWithFallback(detailPrompt, undefined, {
      temperature: 0.3,
      responseMimeType: "application/json",
    })

    let parsedDetail: any = {}
    try {
      parsedDetail = JSON.parse(
        rawDetail.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim()
      )
    } catch (err) {
      console.warn("[/api/research] Detail parse error:", err)
    }

    const resp: ResearchResponse = {
      detailed_research: parsedDetail.detailed_research || {
        market_need: "Expanding demand for automated, intelligent digital solutions.",
        key_metrics: ["Expected 30% YoY adoption", "40% efficiency improvement"],
        competitive_advantage: "High user engagement, intuitive UX, and proprietary data workflows.",
        regulatory_considerations: "Compliant with international data privacy and security standards.",
        implementation_complexity: "Medium",
        target_demographics: ["End users & professionals", "Growing business teams"],
      },
      prototype_prompt:
        parsedDetail.prototype_prompt ||
        `Design a modern, intuitive, responsive user interface for ${title} with real-time interactivity, analytics dashboards, and frictionless workflows.`,
      sources,
    }

    return NextResponse.json(resp)
  } catch (err: any) {
    console.error("[/api/research] Error:", err)
    return NextResponse.json({ error: err?.message || "Research generation failed" }, { status: 500 })
  }
}

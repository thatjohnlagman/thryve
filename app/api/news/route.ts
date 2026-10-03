// News aggregation powered by Tavily Search + Gemini Intelligence
import { NextResponse } from "next/server"
import { generateWithFallback } from "@/lib/gemini"

export const maxDuration = 45

interface NewsItem {
  title: string
  summary: string
  source: string
  url: string
  imageUrl: string
  publishedAt: string
}

export async function GET() {
  try {
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY

    if (!TAVILY_API_KEY || !GEMINI_API_KEY) {
      return NextResponse.json({
        items: [],
        error: "Missing TAVILY_API_KEY or GEMINI_API_KEY in .env.local",
      })
    }

    const queries = [
      "AI agents autonomous workflows product innovation technology 2025 OR 2026",
      "fintech digital banking open finance payments innovation 2025 OR 2026",
      "generative AI data analytics SaaS product development news",
      "site:business.inquirer.net technology fintech business Philippines 2025 OR 2026",
      "site:bworldonline.com technology finance innovation Philippines",
    ]

    console.log("[/api/news] Querying live news with Tavily Search API...")
    const tavilyResults = await conductTavilySearch(queries, TAVILY_API_KEY, {
      perQueryMaxResults: 4,
      totalCharsLimit: 14000,
    })

    console.log("[/api/news] Tavily returned authentic sources:", tavilyResults.sources.length)

    if (tavilyResults.sources.length === 0) {
      return NextResponse.json({
        items: [],
        error: "No news sources found via search",
      })
    }

    const formatPrompt = `You are a product and market intelligence curator for "Thryve", an autonomous agentic AI platform for prototyping and data analysis.

Analyze the real crawled news articles and verified sources below:

[VERIFIED SOURCES & URLS]
${tavilyResults.articles.map((a, i) => `${i + 1}. Title: ${a.title}\nURL: ${a.url}\nSnippet: ${a.snippet}`).join("\n\n")}

Select the top 6 to 10 most relevant, high-impact developments in AI, digital technology, fintech, and product innovation.
Return a clean JSON array matching this exact TypeScript structure:
Array<{
  "title": string,
  "summary": string,
  "source": string,
  "url": string,
  "imageUrl": string,
  "publishedAt": string
}>

CRITICAL REQUIREMENTS:
- "url": You MUST use the EXACT verified URLs from the [VERIFIED SOURCES & URLS] above. Never invent, alter, or use root domains.
- "title": Compelling news headline from the article
- "summary": 2-3 sentence executive summary explaining the development, innovation, and strategic industry impact
- "source": Name of the publication (e.g. Inquirer, BusinessWorld, Rappler, Philstar, BSP)
- "imageUrl": Leave empty string "" (thumbnails will be enriched)
- "publishedAt": "Recently", "Today", or date string if mentioned

Return ONLY the raw JSON array without markdown formatting.`

    const formattedRaw = await generateWithFallback(formatPrompt, undefined, {
      temperature: 0.2,
      responseMimeType: "application/json",
    })

    let items: NewsItem[] = []
    try {
      const cleanJson = formattedRaw
        .replace(/^```json\s*/i, "")
        .replace(/^```\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim()
      items = JSON.parse(cleanJson)
      if (!Array.isArray(items)) {
        items = (items as any).items || []
      }
    } catch (parseErr) {
      console.warn("[/api/news] Failed to parse JSON response:", parseErr)
    }

    // Curated high-res banking/fintech thumbnails
    const fallbackThumbnails = [
      "https://images.unsplash.com/photo-1559526324-4b87b5e36e44?w=500&auto=format&fit=crop&q=60",
      "https://images.unsplash.com/photo-1563986768609-322da13575f3?w=500&auto=format&fit=crop&q=60",
      "https://images.unsplash.com/photo-1611974789855-9c2a0a7236a3?w=500&auto=format&fit=crop&q=60",
      "https://images.unsplash.com/photo-1526304640581-d334cdbbf45e?w=500&auto=format&fit=crop&q=60",
      "https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=500&auto=format&fit=crop&q=60",
      "https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=500&auto=format&fit=crop&q=60",
    ]

    // Ensure valid authentic URLs and enrich images
    const validItems: NewsItem[] = items
      .filter((item) => item.title && item.url && /^https?:\/\//i.test(item.url))
      .map((item, idx) => ({
        title: item.title,
        summary: item.summary,
        source: item.source || "Financial News",
        url: item.url,
        imageUrl:
          item.imageUrl && item.imageUrl.startsWith("http")
            ? item.imageUrl
            : fallbackThumbnails[idx % fallbackThumbnails.length],
        publishedAt: item.publishedAt || "Recently",
      }))

    return NextResponse.json({ items: validItems })
  } catch (error: any) {
    console.error("[/api/news] Error fetching news:", error)
    return NextResponse.json({ items: [], error: error.message || "Failed to load news" })
  }
}

async function conductTavilySearch(
  queries: string[],
  apiKey: string,
  opts?: { perQueryMaxResults?: number; totalCharsLimit?: number }
): Promise<{ articles: Array<{ title: string; url: string; snippet: string }>; sources: string[] }> {
  const endpoint = "https://api.tavily.com/search"
  const perQueryMaxResults = opts?.perQueryMaxResults ?? 4
  const totalCharsLimit = opts?.totalCharsLimit ?? 14000

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
          include_answer: false,
          include_raw_content: false,
          max_results: perQueryMaxResults,
        }),
      })

      if (!res.ok) {
        console.warn(`[Tavily News] Query "${q}" returned status ${res.status}`)
        return { results: [] }
      }

      return await res.json()
    } catch (err) {
      console.warn(`[Tavily News] Fetch error for query "${q}":`, err)
      return { results: [] }
    }
  })

  const results = await Promise.all(fetches)
  const articles: Array<{ title: string; url: string; snippet: string }> = []
  const sources: string[] = []
  const seenUrls = new Set<string>()

  let totalChars = 0

  for (const r of results) {
    const list = r?.results || []
    for (const item of list) {
      const url = (item.url || "").trim()
      if (!url || !/^https?:\/\//i.test(url) || seenUrls.has(url)) continue

      seenUrls.add(url)
      sources.push(url)

      const title = (item.title || "").trim()
      const snippet = (item.content || item.snippet || "").trim().slice(0, 400)

      articles.push({ title, url, snippet })
      totalChars += title.length + snippet.length

      if (totalChars >= totalCharsLimit) break
    }
    if (totalChars >= totalCharsLimit) break
  }

  return { articles, sources }
}

// News aggregation via Tavily + Gemini REST with OG image enrichment
import { z } from "zod"

export const maxDuration = 45

// Coalesce null/undefined to empty string for fields that may come back as null
const emptyIfNil = (v: unknown) => (v == null ? "" : v)

const NewsItemSchema = z.object({
  title: z.string(),
  summary: z.string(),
  source: z.string(),
  url: z.string().url(),
  imageUrl: z.preprocess(emptyIfNil, z.string()),
  publishedAt: z.preprocess(emptyIfNil, z.string()),
})

const NewsListSchema = z.object({ items: z.array(NewsItemSchema).min(0).max(30) })

type TavilyOpts = { perQueryMaxResults?: number; totalCharsLimit?: number }

export async function GET() {
  try {
    const TAVILY_API_KEY = process.env.TAVILY_API_KEY
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY

    if (!TAVILY_API_KEY || !GEMINI_API_KEY) {
      const response = {
        items: [],
        error: "Missing TAVILY_API_KEY or GEMINI_API_KEY. Add them to your project settings.",
      }
      return json(response)
    }

    const queries = [
      "site:inquirer.net BPI OR banking OR fintech Philippines 2025",
      "site:businessworld-online.com BPI OR banking OR fintech Philippines 2025",
      "site:rappler.com business BPI OR banking OR fintech Philippines 2025",
      "site:news.abs-cbn.com business BPI OR bank Philippines 2025",
      "BSP regulation banking fintech Philippines 2025",
      "digital bank Philippines 2025 news",
      "fintech Philippines funding 2025",
      "e-wallet Philippines GCash Maya BPI 2025 news",
    ]

    const tavily = await tavilyResearch(queries, TAVILY_API_KEY, { perQueryMaxResults: 6, totalCharsLimit: 14000 })

    const itemsRaw = await geminiSelectAndShape(GEMINI_API_KEY, tavily).catch((e) => {
      console.error("[/api/news] geminiSelectAndShape error", e)
      return [] as z.infer<typeof NewsItemSchema>[]
    })

    const enriched = await enrichNewsImages(itemsRaw, 8).catch((e) => {
      console.error("[/api/news] enrichNewsImages error", e)
      return itemsRaw
    })

    const withFallback = enriched.map((n) => ({
      ...n,
      imageUrl:
        n.imageUrl && /^https?:\/\//i.test(n.imageUrl)
          ? n.imageUrl
          : `/placeholder.svg?height=160&width=280&query=philippine%20banking%20news%20thumbnail`,
      publishedAt: typeof n.publishedAt === "string" ? n.publishedAt : "",
    }))

    const finalResponse = { items: withFallback.slice(0, 18) }
    return json(finalResponse)
  } catch (e: any) {
    console.error("[/api/news] unhandled error", e)
    const errorResponse = { items: [], error: e?.message || "Unexpected error" }
    return json(errorResponse)
  }
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json; charset=utf-8" } })
}

async function tavilyResearch(queries: string[], apiKey: string, opts?: TavilyOpts) {
  const endpoint = "https://api.tavily.com/search"
  const perQueryMaxResults = opts?.perQueryMaxResults ?? 6
  const totalCharsLimit = opts?.totalCharsLimit ?? 14000

  const fetches = queries.map(async (q) => {
    const res = await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({
        query: q,
        search_depth: "advanced",
        include_answer: false,
        include_raw_content: true,
        max_results: perQueryMaxResults,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error("[tavily-news] request failed", { status: res.status, q, text: text.slice(0, 200) })
      return { results: [] as any[] }
    }
    return (await res.json()) as {
      results?: Array<{ url?: string; title?: string; raw_content?: string; content?: string; snippet?: string }>
    }
  })

  const results = await Promise.all(fetches)
  const pieces: string[] = []
  const sources: string[] = []
  let charCount = 0

  for (const r of results) {
    const arr = r?.results || []
    for (const it of arr) {
      const url = (it.url || "").trim()
      if (!url || !/^https?:\/\//i.test(url)) continue
      sources.push(url)

      if (charCount >= totalCharsLimit) continue
      const txt = [it.title, it.raw_content || it.content || it.snippet].filter(Boolean).join(" — ")
      if (txt) {
        const cleaned = txt.replace(/\s+/g, " ").slice(0, 1200)
        if (charCount + cleaned.length + 2 <= totalCharsLimit) {
          pieces.push(`- ${cleaned} [${url}]`)
          charCount += cleaned.length + 2
        }
      }
    }
  }

  return {
    mergedText: pieces.join("\n"),
    sources: Array.from(new Set(sources)).slice(0, 100),
  }
}

async function geminiSelectAndShape(
  apiKey: string,
  tavily: { mergedText: string; sources: string[] },
): Promise<z.infer<typeof NewsItemSchema>[]> {
  const prompt = `
You are a news curator for the Philippines banking sector (BPI, BSP, banks, fintech).
From the following aggregated snippets and links, return a JSON object with this EXACT structure:

{
  "items": [
    {
      "title": "short headline",
      "summary": "concise 1-2 sentence summary", 
      "source": "publisher name (e.g., Inquirer, BusinessWorld)",
      "url": "canonical URL",
      "imageUrl": "image URL if available, otherwise empty string",
      "publishedAt": "ISO string or date string if available, otherwise empty string"
    }
  ]
}

Include up to 6 articles ONLY about BPI, banking, fintech, or BSP in the Philippines.
PREFER the most recent news available - prioritize articles from this week, this month, then recent months.

IMPORTANT: You MUST return the exact JSON structure shown above with an "items" array containing the news objects. Do not return a single object or array without the "items" wrapper.

Return ONLY JSON, no commentary.

[SOURCES]
${tavily.sources.slice(0, 40).join("\n")}

[SNIPPETS]
${tavily.mergedText.slice(0, 12000)}
`.trim()

  const text = await geminiGenerateText(apiKey, prompt, { temperature: 0.2 })

  const raw = extractJson(text)

  if (!raw || typeof raw !== "object") {
    return []
  }

  let itemsToProcess: any[] = []

  if ("items" in raw && Array.isArray((raw as any).items)) {
    itemsToProcess = (raw as any).items
  } else if ("title" in raw && "summary" in raw && "source" in raw) {
    itemsToProcess = [raw]
  } else if (Array.isArray(raw)) {
    itemsToProcess = raw
  } else {
    itemsToProcess = []
  }

  const wrappedData = { items: itemsToProcess }
  const strict = NewsListSchema.safeParse(wrappedData)
  if (strict.success) {
    const seen = new Set<string>()
    return strict.data.items.filter((n) => {
      if (seen.has(n.url)) return false
      seen.add(n.url)
      return true
    })
  }

  const cleaned = itemsToProcess
    .map((n: any) => ({
      title: typeof n?.title === "string" ? n.title : "",
      summary: typeof n?.summary === "string" ? n.summary : "",
      source: typeof n?.source === "string" ? n.source : "",
      url: typeof n?.url === "string" ? n.url : "",
      imageUrl: typeof n?.imageUrl === "string" ? n.imageUrl : "",
      publishedAt: typeof n?.publishedAt === "string" ? n.publishedAt : "",
    }))
    .filter((n: any) => n.title && n.summary && n.source && /^https?:\/\//i.test(n.url))

  const final = NewsListSchema.safeParse({ items: cleaned })
  if (final.success) {
    const seen = new Set<string>()
    return final.data.items.filter((n) => {
      if (seen.has(n.url)) return false
      seen.add(n.url)
      return true
    })
  }

  return []
}

async function enrichNewsImages(items: z.infer<typeof NewsItemSchema>[], maxToFetch = 8) {
  const toFetch = items
    .map((n, idx) => ({ ...n, idx }))
    .filter((n) => !n.imageUrl || !/^https?:\/\//i.test(n.imageUrl))
    .slice(0, maxToFetch)

  const results = await Promise.allSettled(
    toFetch.map(async (n) => {
      const img = await fetchOgImage(n.url)
      return { idx: n.idx, imageUrl: img || "" }
    }),
  )

  const byIdx = new Map<number, string>()
  for (const r of results) {
    if (r.status === "fulfilled") {
      byIdx.set(r.value.idx, r.value.imageUrl)
    }
  }

  return items.map((n, i) => {
    const candidate = byIdx.get(i)
    return candidate ? { ...n, imageUrl: candidate } : n
  })
}

async function fetchOgImage(url: string): Promise<string | null> {
  try {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), 8000)
    const res = await fetch(url, {
      method: "GET",
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; BPI-Innovate-NewsFetcher/1.0; +https://vercel.com/) AppleWebKit/537.36 Safari/537.36",
        Accept: "text/html,application/xhtml+xml",
      },
      signal: controller.signal,
    }).catch((e) => {
      throw e
    })
    clearTimeout(t)
    if (!res.ok) {
      return null
    }
    const html = await res.text()
    const meta = extractMetaContent(html, [
      'meta[property="og:image"]',
      'meta[name="og:image"]',
      'meta[name="twitter:image"]',
      'meta[property="twitter:image"]',
      'meta[property="og:image:url"]',
    ])
    const jsonLdImage = extractJsonLdImage(html)
    const candidate = meta || jsonLdImage
    if (!candidate) return null

    try {
      const u = new URL(candidate, url)
      return u.toString()
    } catch {
      return candidate
    }
  } catch {
    return null
  }
}

function extractMetaContent(html: string, selectors: string[]): string | null {
  const metas = html.match(/<meta[^>]+>/gi) || []
  for (const tag of metas) {
    const prop = (tag.match(/(?:property|name)=["']([^"']+)["']/i) || [, ""])[1]
    const content = (tag.match(/content=["']([^"']+)["']/i) || [, ""])[1]
    if (!prop || !content) continue
    if (selectors.some((sel) => sel.includes(prop))) {
      return content
    }
  }
  return null
}

function extractJsonLdImage(html: string): string | null {
  const scripts = html.match(/<script[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi) || []
  for (const s of scripts) {
    const bodyMatch = s.match(/<script[^>]*>([\s\S]*?)<\/script>/i)
    const body = bodyMatch?.[1] || ""
    try {
      const data = JSON.parse(body.trim())
      const image =
        (Array.isArray(data) ? data.find(Boolean)?.image : (data as any)?.image) ||
        (Array.isArray(data) ? (data.find(Boolean) as any)?.image?.url : (data as any)?.image?.url)
      if (typeof image === "string" && image) return image
      if (Array.isArray(image) && image[0]) return String(image[0])
    } catch {
      // ignore
    }
  }
  return null
}

async function geminiGenerateText(
  apiKey: string,
  prompt: string,
  cfg?: { temperature?: number; topP?: number },
): Promise<string> {
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=" +
    encodeURIComponent(apiKey)
  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      contents: [{ role: "user", parts: [{ text: prompt }] }],
      generationConfig: { temperature: cfg?.temperature ?? 0.2, topP: cfg?.topP ?? 0.9 },
    }),
  })
  if (!res.ok) {
    const t = await res.text().catch(() => "")
    console.error("[gemini-news] error", res.status, t.slice(0, 200))
    throw new Error(`Gemini error ${res.status}`)
  }
  const j = (await res.json()) as any
  const parts = j?.candidates?.[0]?.content?.parts
  const out = Array.isArray(parts) ? parts.map((p: any) => p?.text || "").join("\n") : ""
  return out
}

function extractJson(s: string): unknown | null {
  const fence = s.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const raw = fence ? fence[1] : s

  let braceCount = 0
  let start = -1
  let end = -1

  for (let i = 0; i < raw.length; i++) {
    const char = raw[i]
    if (char === "{") {
      if (start === -1) start = i
      braceCount++
    } else if (char === "}") {
      braceCount--
      if (braceCount === 0 && start !== -1) {
        end = i
        break
      }
    }
  }

  if (start === -1 || end === -1 || end <= start) {
    const first = raw.indexOf("{")
    const last = raw.lastIndexOf("}")
    if (first === -1 || last === -1 || last <= first) return null
    try {
      return JSON.parse(raw.slice(first, last + 1))
    } catch (e) {
      console.error("[extractJson-news] fallback parse error", e)
      return null
    }
  }

  try {
    const jsonStr = raw.slice(start, end + 1)
    return JSON.parse(jsonStr)
  } catch (e) {
    console.error("[extractJson-news] parse error", e)
    try {
      const itemsMatch = raw.match(/"items"\s*:\s*\[([\s\S]*?)\]/i)
      if (itemsMatch) {
        const itemsJson = `{"items":[${itemsMatch[1]}]}`
        return JSON.parse(itemsJson)
      }
    } catch (fallbackError) {
      console.error("[extractJson-news] fallback items parse error", fallbackError)
    }
    return null
  }
}

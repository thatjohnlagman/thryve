// Further optimized research API to target 35 total credits per refresh
import { z } from "zod"

// Optional: increase max duration for longer research
export const maxDuration = 45 // Reduced timeout

// Schemas
const DetailedResearchSchema = z.object({
  keyInsights: z.object({
    summary: z.string(),
    interpretation: z.string(),
  }),
  marketValidation: z.object({
    targetMarketSize: z.string(),
    adoptionRate: z.string(),
    revenueOpportunity: z.string(),
  }),
  competitiveAnalysis: z.object({
    currentState: z.string(),
    bpiPosition: z.string(),
    marketWindow: z.string(),
    competitors: z.array(z.string()),
  }),
  implementationDetails: z.object({
    technicalRequirements: z.string(),
    developmentTime: z.string(),
    investmentNeeded: z.string(),
    riskFactors: z.array(z.string()),
  }),
  successMetrics: z.object({
    targetKPIs: z.array(z.string()),
    pilotStrategy: z.string(),
    roiTimeline: z.string(),
  }),
  supportingEvidence: z.object({
    caseStudies: z.array(z.string()),
    localContext: z.string(),
    regulatory: z.string(),
  }),
  businessModel: z.object({
    revenueModel: z.string(),
    keyCustomers: z.array(z.string()),
    valuePropositions: z.array(z.string()),
    keyPartnerships: z.array(z.string()),
    bpiAlignment: z.string(),
    risks: z.array(z.string()),
    riskMitigation: z.array(z.string()),
  }),
  businessImpact: z.object({
    customerSatisfactionIncrease: z.string(),
    revenueGrowthPotential: z.string(),
    marketCoverageExpansion: z.string(),
  }),
})
type DetailedResearch = z.infer<typeof DetailedResearchSchema>

const ProposedTrendSeedSchema = z.object({
  title: z.string(),
  category: z.string(),
  impact: z.enum(["High", "Medium", "Low"]),
  summary: z.string(),
  interpretation: z.string(),
})
const ProposedTrendsSchema = z.object({
  trends: z.array(ProposedTrendSeedSchema).min(1).max(5),
})

type ResearchResponse = {
  detailed_research: DetailedResearch
  prototype_prompt: string
  sources: string[]
}

export async function POST(request: Request) {
  try {
    const body = (await safeJson(request)) as
      | { title?: string; category?: string }
      | {
          bootstrap?: boolean
          mode?: "seeds" | "full"
          existingTrends?: string[]
          count?: number
          searchTopic?: string
        }

    const TAVILY_API_KEY = process.env.TAVILY_API_KEY
    const GEMINI_API_KEY = process.env.GEMINI_API_KEY

    if (!TAVILY_API_KEY || !GEMINI_API_KEY) {
      console.error("[/api/research] Missing env vars", {
        hasTavily: Boolean(TAVILY_API_KEY),
        hasGemini: Boolean(GEMINI_API_KEY),
      })
      return jsonResponse(
        {
          error:
            "Missing required environment variables. Please set TAVILY_API_KEY and GEMINI_API_KEY in your project settings.",
        },
        400,
      )
    }

    // Bootstrap SEEDS ONLY for progressive UI on the client
    if ("bootstrap" in body && (body as any).bootstrap && (body as any).mode === "seeds") {
      try {
        const existingTrends = (body as any).existingTrends || []
        const requestedCount = (body as any).count || 1
        const searchTopic = (body as any).searchTopic
        const isAutomatic = !(body as any).searchTopic // If no search topic, it's automatic bootstrap

        let broadQueries: string[]

        if (searchTopic) {
          broadQueries = [
            `${searchTopic} Philippines banking BPI fintech trends 2024 2025 opportunities`,
            `${searchTopic} BSP regulation Philippines banking digital transformation innovation`,
            `${searchTopic} market analysis competitive landscape Philippines financial services`,
          ]
        } else {
          broadQueries = [
            "Philippines banking fintech trends 2024 2025 BPI digital transformation BSP regulation",
            "AI fraud detection sustainable finance SME lending digital payments Philippines banking opportunities",
          ]
        }

        const tavilyBroad = await conductTavilyResearch(broadQueries, TAVILY_API_KEY, {
          perQueryMaxResults: 10,
          totalCharsLimit: 10000,
        })

        const seeds = await proposeTrendsWithGeminiRest(
          GEMINI_API_KEY,
          tavilyBroad,
          existingTrends,
          requestedCount,
          searchTopic,
        )

        return jsonResponse(
          {
            seeds,
            generationType: isAutomatic ? "automatic" : "manual",
          },
          200,
        )
      } catch (e) {
        console.error("[/api/research bootstrap seeds] error", e)
        return jsonResponse({ error: toMessage(e) }, 500)
      }
    }

    // Single-trend analysis - further optimized to 3 queries max
    const { title, category } = body as { title?: string; category?: string }
    if (!title || !category) {
      return jsonResponse({ error: "Missing 'title' or 'category'." }, 400)
    }

    const queries = generateUltraOptimizedSearchQueries(title, category)
    const tavily = await conductTavilyResearch(queries, TAVILY_API_KEY, {
      perQueryMaxResults: 10,
      totalCharsLimit: 12000,
    })
    const detailedResearch = await analyzeWithGeminiRest(GEMINI_API_KEY, tavily, title)
    const prototypePrompt = generatePrototypePrompt({ title, category }, detailedResearch)
    const sourceUrls = Array.from(new Set(tavily.sources)).slice(0, 6)

    const resp: ResearchResponse = {
      detailed_research: detailedResearch,
      prototype_prompt: prototypePrompt,
      sources: sourceUrls,
    }
    return jsonResponse(resp, 200)
  } catch (err: unknown) {
    console.error("[/api/research] unhandled error", err)
    
    // Provide more specific error messages for common issues
    if (err instanceof Error) {
      if (err.message.includes("Array must contain at least 1 element(s)")) {
        console.error("[/api/research bootstrap seeds] error", err)
        return jsonResponse({ 
          error: "AI failed to generate trends. This can happen due to API rate limits or prompt complexity. Please try again in a moment.",
          technical_error: "Empty trends array from AI model"
        }, 500)
      }
      if (err.message.includes("ZodError")) {
        console.error("[/api/research bootstrap seeds] error", err)
        return jsonResponse({ 
          error: "AI response validation failed. Please try again.",
          technical_error: err.message
        }, 500)
      }
    }
    
    return jsonResponse({ error: toMessage(err) }, 500)
  }
}

// Helpers

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json; charset=utf-8" },
  })
}

async function safeJson(request: Request) {
  try {
    return await request.json()
  } catch (e) {
    console.error("[/api/research] invalid JSON body", e)
    return {}
  }
}

function toMessage(err: unknown) {
  return err instanceof Error ? err.message : typeof err === "string" ? err : "Unexpected error"
}

// Ultra-optimized search queries - only 3 comprehensive queries
function generateUltraOptimizedSearchQueries(title: string, category: string) {
  const queries = [
    `${title} Philippines banking BPI ${category} market analysis competitive landscape 2024`,
    `BSP ${category} regulation Philippines banking implementation cost ROI case study`,
    `${title} adoption rate user behavior Philippines fintech UnionBank RCBC technical requirements`,
  ]
  return queries
}

async function conductTavilyResearch(
  queries: string[],
  apiKey: string,
  opts?: { perQueryMaxResults?: number; totalCharsLimit?: number },
): Promise<{ mergedText: string; sources: string[] }> {
  const endpoint = "https://api.tavily.com/search"
  const perQueryMaxResults = opts?.perQueryMaxResults ?? 10
  const totalCharsLimit = opts?.totalCharsLimit ?? 12000

  const fetches = queries.map(async (q) => {
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
        include_raw_content: true,
        max_results: perQueryMaxResults,
      }),
    })
    if (!res.ok) {
      const text = await res.text().catch(() => "")
      console.error("[tavily] request failed", { status: res.status, statusText: res.statusText, query: q, body: text })
      throw new Error(`Tavily error (${res.status}): ${text || res.statusText}`)
    }
    return (await res.json()) as {
      results?: Array<{ url?: string; raw_content?: string; content?: string; snippet?: string; title?: string }>
    }
  })

  const results = await Promise.all(fetches)
  const pieces: string[] = []
  const sources: string[] = []
  let charCount = 0

  for (const r of results) {
    if (!r?.results) continue
    for (const item of r.results) {
      if (charCount >= totalCharsLimit) break
      const txt = (item.raw_content || item.content || item.snippet || "").trim()
      if (txt) {
        const cleaned = txt.replace(/\s+/g, " ").slice(0, 2000)
        const nextCount = charCount + cleaned.length + 2
        if (nextCount <= totalCharsLimit) {
          pieces.push(cleaned)
          charCount = nextCount
        }
      }
      if (item.url) sources.push(item.url)
    }
    if (charCount >= totalCharsLimit) break
  }

  const merged = pieces.join("\n\n")
  return { mergedText: merged, sources }
}

async function proposeTrendsWithGeminiRest(
  apiKey: string,
  tavilyData: { mergedText: string; sources: string[] },
  existingTrends: string[] = [],
  requestedCount = 1,
  searchTopic?: string,
) {
  const existingList =
    existingTrends.length > 0
      ? `\n\nEXISTING TRENDS TO AVOID DUPLICATING:\n${existingTrends.map((t, i) => `${i + 1}. ${t}`).join("\n")}`
      : ""

  const topicFocus = searchTopic
    ? `\n\nSPECIFIC FOCUS AREA: "${searchTopic}"\nGenerate trends that are directly related to or inspired by "${searchTopic}" in the context of banking and financial services. Consider how "${searchTopic}" could create new opportunities, solve existing problems, or be applied innovatively in the BPI ecosystem.`
    : ""

  const prompt = `
Using the consolidated research and sources below, propose ${requestedCount} COMPLETELY NEW whitespace opportunities SPECIFIC to the BPI (Bank of the Philippine Islands) ecosystem.${topicFocus}

BPI INNOVATION CHALLENGE CONTEXT (Use as guidance, not limitations):
While considering these strategic focus areas, feel free to explore beyond them for innovative opportunities:

Track 1: Digitalization - Autonomous agents that digitize and optimize core banking processes, from product development to service delivery. Focus on AI agents for dynamic product prototyping, risk-based authentication with zero-trust principles, and AI-powered digital twins for branch network optimization.

Track 2: ESG+E2 - Financial inclusion and sustainable business growth. Focus on AI for green finance & ESG-aligned product innovation, ethical microfinance lending, and evaluating ESG alignment of SMEs.

Track 3: Hyper-Personalization and Customer Experience - AI agents that independently orchestrate personalized customer journeys. Focus on sentiment-aware multi-channel CX orchestration, proactive issue resolution, and AI-driven financial 'what-if' sandbox tools.

Track 4: Workplace Productivity and Future of Work - Autonomous systems that augment employee capabilities. Focus on computer vision for banking operations, predictive employee well-being & retention, and semi-autonomous decision intelligence.

Track 5: Synergies and Ecosystem Collaboration - Agentic AI that manages partnerships, compliance monitoring, and risk assessment. Focus on improving inter-departmental synergies, BPI-Ayala company collaboration, and ecosystem vendor/partner coordination.

CRITICAL REQUIREMENTS:
- Use the above tracks as INSPIRATION and CONTEXT, but don't limit yourself to only these areas
${searchTopic ? `- PRIORITIZE trends directly related to "${searchTopic}" - think creatively about how this topic intersects with banking, fintech, and financial services` : ""}
- Explore emerging technologies, cultural trends, regulatory changes, or market shifts that could create new opportunities
- Consider cross-industry innovations that could be adapted for banking (e.g., gaming, social media, e-commerce, healthcare)
- Look for underserved demographics, untapped use cases, or novel business models
- Each idea must be GENUINELY DIFFERENT from existing trends${existingList}
- NO DUPLICATES or similar concepts to what's already been generated
- Focus on UNEXPLORED niches, emerging technologies, or underserved market segments
- Each trend must be either:
  1) A capability BPI NEEDS but doesn't yet have (reasonable assumption), or
  2) An expansion that leverages existing BPI assets into a NEW product/segment, or
  3) A partnership-led play BPI has NOT launched (e.g., with telcos, LGUs, fintechs, MSME platforms), or
  4) An innovative application of emerging technology or cultural trends to banking
- Must be feasible within PH regulatory context (BSP) and aligned to BPI's core strengths
- Avoid well-known, already-launched BPI features
- Generate DIVERSE categories: explore fintech, insurtech, proptech, agritech, edtech, healthtech intersections with banking
- Keep titles crisp and executive-friendly
- Think beyond traditional banking - consider lifestyle, entertainment, social impact, sustainability angles

Return JSON exactly like:
{
  "trends": [
    {
      "title": "string",
      "category": "string",
      "impact": "High" | "Medium" | "Low",
      "summary": "What the opportunity is, in 1-2 sentences.",
      "interpretation": "Why it matters to BPI, mentioning leverage points and regulatory considerations."
    }
  ]
}
Provide exactly ${requestedCount} trends. Only return JSON with no commentary.

[SOURCES]
${tavilyData.sources.slice(0, 8).join("\n")}
[RESEARCH]
${tavilyData.mergedText.slice(0, 8000)}
`.trim()

  const text = await geminiGenerateText(apiKey, prompt, { temperature: 0.4 })
  const parsed = extractJson(text)
  if (!parsed) {
    console.error("[proposeTrendsWithGeminiRest] invalid JSON from model", { preview: text.slice(0, 500) })
    throw new Error("Model did not return valid trend seeds.")
  }
  
  // Log the parsed response to debug empty trends array
  console.log("[proposeTrendsWithGeminiRest] AI response parsed:", JSON.stringify(parsed, null, 2))
  
  // Check if trends array is empty before validation
  if (!parsed || !(parsed as any).trends || (parsed as any).trends.length === 0) {
    console.error("[proposeTrendsWithGeminiRest] AI returned empty trends array")
    console.error("[proposeTrendsWithGeminiRest] Full AI response:", text.slice(0, 1000))
    
    // Try one more time with a simpler prompt as fallback
    console.log("[proposeTrendsWithGeminiRest] Attempting fallback generation...")
    const fallbackPrompt = `Generate ${requestedCount} innovative banking/fintech trends for BPI Philippines. Return JSON only:
{
  "trends": [
    {
      "title": "Brief descriptive title",
      "category": "Category name", 
      "impact": "High",
      "summary": "Brief description of the opportunity.",
      "interpretation": "Why this matters to BPI."
    }
  ]
}`
    
    const fallbackText = await geminiGenerateText(apiKey, fallbackPrompt, { temperature: 0.6 })
    const fallbackParsed = extractJson(fallbackText)
    
    if (!fallbackParsed || !(fallbackParsed as any).trends || (fallbackParsed as any).trends.length === 0) {
      throw new Error("AI model failed to generate any trends even with fallback. Please try again.")
    }
    
    return ProposedTrendsSchema.parse(fallbackParsed)
  }
  
  const safe = ProposedTrendsSchema.parse(parsed)
  return safe.trends.slice(0, requestedCount)
}

async function analyzeWithGeminiRest(
  apiKey: string,
  tavilyData: { mergedText: string; sources: string[] },
  trendTitle: string,
): Promise<DetailedResearch> {
  const prompt = `
Based on this market research data about '${trendTitle}' for BPI (Bank of the Philippine Islands):

BPI INNOVATION CHALLENGE CONTEXT (Reference framework, not constraints):
While these strategic tracks provide valuable context, consider broader opportunities:
- Track 1: Digitalization (AI agents, product prototyping, zero-trust authentication, digital twins)
- Track 2: ESG+E2 (Green finance, microfinance, SME ESG evaluation)
- Track 3: Hyper-Personalization (Sentiment-aware CX, proactive resolution, financial sandbox)
- Track 4: Workplace Productivity (Computer vision, employee well-being, decision intelligence)
- Track 5: Synergies & Collaboration (Inter-departmental, Ayala partnerships, ecosystem coordination)

Consider also:
- Cross-industry innovations and emerging technology applications
- Cultural and demographic trends in the Philippines
- Regulatory changes and market evolution opportunities
- Novel business models and partnership structures
- Underserved market segments and use cases

Provide detailed analysis in JSON format focusing on:
- Key insights and business implications
- Market validation specific to the Philippine market
- Competitive position vs UnionBank, RCBC, Security Bank
- Cost-effective implementation timeline and required investment
- BSP regulatory factors
- KPIs and projected ROI
- Risks and mitigation strategies
- Business model analysis including revenue streams, customer segments, and strategic alignment
- **BUSINESS IMPACT ASSESSMENT with specific quantitative estimates**

Format strictly according to "detailedResearch":
{
  "keyInsights": {
    "summary": "Key insight - what the opportunity is",
    "interpretation": "Business implication - why it matters to BPI"
  },
  "marketValidation": { "targetMarketSize": "string", "adoptionRate": "string", "revenueOpportunity": "string" },
  "competitiveAnalysis": { "currentState": "string", "bpiPosition": "string", "marketWindow": "string", "competitors": ["string"] },
  "implementationDetails": { "technicalRequirements": "string", "developmentTime": "string", "investmentNeeded": "string", "riskFactors": ["string"] },
  "successMetrics": { "targetKPIs": ["string"], "pilotStrategy": "string", "roiTimeline": "string" },
  "supportingEvidence": { "caseStudies": ["string"], "localContext": "string", "regulatory": "string" },
  "businessModel": {
    "revenueModel": "Primary revenue model",
    "keyCustomers": ["Customer segment 1", "Customer segment 2", "Customer segment 3"],
    "valuePropositions": ["Value proposition 1", "Value proposition 2", "Value proposition 3"],
    "keyPartnerships": ["Partnership 1", "Partnership 2", "Partnership 3"],
    "bpiAlignment": "How this model aligns with BPI's existing assets and capabilities",
    "risks": ["Business model risk 1", "Business model risk 2", "Business model risk 3"],
    "riskMitigation": ["Risk mitigation strategy 1", "Risk mitigation strategy 2", "Risk mitigation strategy 3"]
  },
  "businessImpact": {
    "customerSatisfactionIncrease": "Provide specific percentage estimate (e.g., '15-25% increase in customer satisfaction scores') based on market research, competitive analysis, and similar implementations. Include reasoning for the estimate.",
    "revenueGrowthPotential": "Provide specific revenue impact estimate (e.g., '₱2.5-4.2B additional annual revenue within 3 years') based on market size, adoption rates, and pricing analysis. Include breakdown of revenue sources.",
    "marketCoverageExpansion": "Provide specific percentage of previously underserved customers that will be reached (e.g., '35-45% of currently unbanked SMEs in Metro Manila') based on demographic analysis and market gaps. Include target segments."
  }
}

**CRITICAL: For businessImpact section, provide SPECIFIC, QUANTITATIVE estimates with clear reasoning based on the research data. Do not use generic statements. Base estimates on:**
- Market research data and competitive benchmarks
- Philippine banking industry statistics
- Similar implementations in comparable markets
- BPI's current market position and capabilities
- Demographic and economic data for target segments

Generate realistic Philippine market data and comprehensive business model analysis with specific risk mitigation strategies.
Return only JSON with no commentary.
`.trim()

  const text = await geminiGenerateText(apiKey, prompt, { temperature: 0.3 })
  const parsed = extractJson(text)
  if (!parsed) {
    console.error("[analyzeWithGeminiRest] invalid JSON from model", { preview: text.slice(0, 500) })
    throw new Error("Model did not return valid JSON.")
  }
  const safe = DetailedResearchSchema.parse(parsed)
  return safe
}

async function geminiGenerateText(
  apiKey: string,
  prompt: string,
  config?: { temperature?: number; topP?: number },
): Promise<string> {
  const endpoint =
    "https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-pro:generateContent?key=" +
    encodeURIComponent(apiKey)

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    generationConfig: {
      temperature: config?.temperature ?? 0.2,
      topP: config?.topP ?? 0.9,
    },
  }

  const res = await fetch(endpoint, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  })

  if (!res.ok) {
    const errText = await res.text().catch(() => "")
    console.error("[gemini] non-OK response", { status: res.status, statusText: res.statusText, body: errText })
    throw new Error(`Gemini error (${res.status}): ${errText || res.statusText}`)
  }

  const json = (await res.json()) as any
  const parts = json?.candidates?.[0]?.content?.parts
  if (!Array.isArray(parts) || parts.length === 0) {
    console.error("[gemini] unexpected response shape", { json })
    throw new Error("Gemini returned an unexpected response.")
  }
  const text = parts.map((p: any) => p?.text || "").join("\n")
  return text
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

  if (start === -1 || end === -1) return null

  let jsonStr = raw.slice(start, end + 1)

  jsonStr = jsonStr
    .replace(/\\"/g, '"')
    .replace(/\\\\/g, "\\")
    .replace(/\\n/g, " ")
    .replace(/\\t/g, " ")
    .replace(/\s+/g, " ")
    .trim()

  try {
    return JSON.parse(jsonStr)
  } catch (e) {
    console.error("[extractJson] parse error", e)
    try {
      const cleaned = jsonStr.replace(/,(\s*[}\]])/g, "$1").replace(/([{,]\s*)(\w+):/g, '$1"$2":')
      return JSON.parse(cleaned)
    } catch (e2) {
      console.error("[extractJson] second parse attempt failed", e2)
      return null
    }
  }
}

function generatePrototypePrompt(trend: { title: string; category: string }, analysis: DetailedResearch): string {
  const kpis = (analysis.successMetrics?.targetKPIs || []).slice(0, 5).join(", ")
  const risks = (analysis.implementationDetails?.riskFactors || []).slice(0, 3).join(", ")
  const comps = (analysis.competitiveAnalysis?.competitors || []).slice(0, 3).join(", ")

  return `${trend.title}

**CRITICAL: Create a COMPLETE, PRODUCTION-READY prototype with ALL features fully functional. No placeholders, no broken interactions, and every button must be clickable.**

---

## **UI AESTHETIC PRIORITY**

### **Design Philosophy**
UI aesthetic is the TOP PRIORITY. Create a stunning, modern interface that:
- **Looks professional and polished** - comparable to the best fintech apps globally
- **Every button MUST be clickable** and provide proper feedback
- **Smooth interactions** with hover effects, transitions, and micro-animations
- **Visual hierarchy** that guides users naturally through the interface
- **Consistent spacing and alignment** throughout all components

### **Typography Requirements (MANDATORY)**
- **Use the most appropriate modern font** for banking applications
- **Ensure excellent readability** across all device sizes
- **Strong typography hierarchy** with clear distinctions between headings, body text, and labels
- **Consistent font weights** and sizing throughout the application

---

## **CORE FUNCTIONALITY REQUIREMENTS**

### **Interactive Elements (NON-NEGOTIABLE)**
- **EVERY button must be clickable** and perform an action. Make sure to code all buttons and their corresponding routes.
- **ALL forms must have working validation** with proper error states
- **Navigation must work seamlessly** between all screens
- **Loading states** for all async operations
- **Success/error feedback** for all user actions

### **User Experience Excellence**
- **Intuitive navigation** that requires no explanation
- **Fast, responsive interactions** with immediate visual feedback
- **Mobile-first design** optimized for touch interactions and mobile screen size
- **Accessible design** with proper contrast and touch targets
- **Error prevention** and graceful error handling
- For profile avatars, automatically generate initials from the user's name (e.g., "Juan Dela Cruz" → "JD").
---

## **Philippine Banking Context**

### **Target Market Understanding**
Create a prototype specifically for "${trend.title}" in the ${trend.category} domain that serves:
- Filipino banking customers with varying tech literacy levels
- Mobile-first users who rely on smartphones for banking
- Users who value security, convenience, and clear communication

### **Local Considerations**
- Use familiar financial terminology and concepts
- Consider Filipino user behavior patterns
- Implement trust-building elements (security badges, clear policies)
- Support common use cases in Philippine banking

---

## **Technical Implementation**

### **Technology Stack Requirements**
- **Framework:** Next.js 14+ with App Router
- **Styling:** Tailwind CSS for consistent, maintainable styles  
- **Components:** Use shadcn/ui or similar high-quality component library
- **State Management:** React hooks for clean, predictable state
- **TypeScript:** For type safety and better development experience

---

### **Core Feature Implementation**
Based on the research analysis for "${trend.title}":

**Primary Value Proposition:** ${analysis.keyInsights?.summary || "Innovative banking solution for Filipino users"}

**Key Features to Implement:**
1. **Main functionality** directly addressing "${trend.title}"
2. **Supporting features** that enhance the core experience  
3. **User dashboard** with relevant metrics and insights
4. **Security features** appropriate for banking applications

---

## **Final Design Requirements**

### **Visual Quality Checklist**
- [ ] **Stunning visual design** that impresses immediately
- [ ] **Consistent design system** across all screens
- [ ] **Perfect responsive behavior** on all device sizes
- [ ] **Smooth, polished animations** and transitions
- [ ] **Professional color scheme** (use suggested BPI colors as guidance)
- [ ] **Excellent typography** with clear hierarchy
- [ ] **Proper spacing and alignment** throughout

### **Functionality Checklist**
- [ ] **Every button works** and provides feedback
- [ ] **All navigation functions** properly
- [ ] **Forms validate** and show appropriate messages
- [ ] **Loading states** display during operations  
- [ ] **Error handling** is graceful and helpful
- [ ] **User flows are complete** from start to finish

---

## **User Experience Metrics**
- **Visual appeal:** Must look like a premium app
- **Usability:** Users can complete tasks without confusion
- **Performance:** Fast, responsive, smooth interactions
- **Functionality:** All features work as expected
---

## **FINAL MANDATE**

**Create a prototype that:**
1. **Looks absolutely stunning** - UI aesthetic is the highest priority
2. **Functions flawlessly** - every button clickable, every feature working
3. **Solves real problems** for Filipino banking customers
4. **Demonstrates clear business value** for BPI
5. **Uses appropriate design choices** - colors are guidance, choose what works best
6. **Employs the best fonts** for banking application readability

**Context Data:**
\`\`\`json
{
  "trend": "${trend.title}",
  "category": "${trend.category}",
  "keyInsights": ${JSON.stringify(analysis.keyInsights || {})},
  "marketValidation": ${JSON.stringify(analysis.marketValidation || {})},
  "businessModel": ${JSON.stringify(analysis.businessModel || {})},
  "competitiveAnalysis": ${JSON.stringify(analysis.competitiveAnalysis || {})},
  "implementationDetails": ${JSON.stringify(analysis.implementationDetails || {})},
  "successMetrics": ${JSON.stringify(analysis.successMetrics || {})},
  "supportingEvidence": ${JSON.stringify(analysis.supportingEvidence || {})},
  "businessImpact": ${JSON.stringify(analysis.businessImpact || {})}
}
\`\`\`

**BUILD A PROTOTYPE THAT PRIORITIZES STUNNING VISUALS, PERFECT FUNCTIONALITY, AND BUSINESS VALUE.**`.trim()
}

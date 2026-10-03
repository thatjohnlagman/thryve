import { GoogleGenerativeAI } from "@google/generative-ai"

// Active Gemini models verified for Google AI Studio API
export const DEFAULT_GEMINI_MODEL = process.env.GEMINI_MODEL || "gemini-flash-lite-latest"
export const ACTIVE_GEMINI_MODELS = [
  DEFAULT_GEMINI_MODEL,
  "gemini-flash-lite-latest",
  "gemini-2.5-flash-lite",
  "gemini-flash-latest",
  "gemini-2.5-flash",
  "gemini-3.5-flash",
  "gemini-3.5-flash-lite",
  "gemini-3.8-flash",
]

export function getGeminiClient(): GoogleGenerativeAI {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    throw new Error("GEMINI_API_KEY environment variable is missing. Please add it to your .env.local file.")
  }
  return new GoogleGenerativeAI(apiKey)
}

/**
 * Call Gemini with automatic model fallback across active models
 */
export async function generateWithFallback(
  prompt: string | any[],
  systemInstruction?: string,
  config: {
    temperature?: number
    maxOutputTokens?: number
    topP?: number
    responseMimeType?: string
  } = {}
): Promise<string> {
  const genAI = getGeminiClient()
  // Unique models to try in priority order
  const modelsToTry = Array.from(new Set(ACTIVE_GEMINI_MODELS))

  let lastError: any = null

  for (const modelName of modelsToTry) {
    try {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: systemInstruction || undefined,
        generationConfig: {
          temperature: config.temperature ?? 0.7,
          maxOutputTokens: config.maxOutputTokens ?? 8192,
          topP: config.topP ?? 0.9,
          responseMimeType: config.responseMimeType,
        },
      })

      const contents = Array.isArray(prompt) ? prompt : [{ role: "user", parts: [{ text: prompt }] }]
      const result = await model.generateContent({ contents })
      const response = await result.response
      const text = response.text()
      if (text) return text
    } catch (err: any) {
      console.warn(`[Gemini] Attempt with model ${modelName} failed:`, err?.message || err)
      lastError = err
    }
  }

  throw lastError || new Error("Failed to generate content with any Gemini model")
}

/**
 * Google Search Grounding via Gemini REST API
 * Directly queries live Google Search with automatic fallback to ungrounded generation if quota/search limit is reached
 */
export async function searchWithGoogleGrounding(
  prompt: string,
  systemInstruction?: string
): Promise<{ text: string; searchQueries?: string[]; sources?: { title: string; url: string }[] }> {
  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) throw new Error("GEMINI_API_KEY is required for search grounding")

  const modelsToTry = Array.from(new Set(ACTIVE_GEMINI_MODELS))

  for (const model of modelsToTry) {
    try {
      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`

      const payload: any = {
        contents: [
          {
            role: "user",
            parts: [{ text: prompt }],
          },
        ],
        tools: [
          {
            googleSearch: {}, // Native Google Search Grounding tool
          },
        ],
      }

      if (systemInstruction) {
        payload.systemInstruction = {
          parts: [{ text: systemInstruction }],
        }
      }

      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const errorText = await res.text()
        console.warn(`[Gemini Search Grounding] Model ${model} returned ${res.status}: ${errorText.substring(0, 150)}`)
        continue
      }

      const data = await res.json()
      const candidate = data.candidates?.[0]
      const text = candidate?.content?.parts?.[0]?.text || ""

      // Extract search grounding metadata
      const groundingMetadata = candidate?.groundingMetadata || {}
      const searchQueries = groundingMetadata.webSearchQueries || []
      const sources: { title: string; url: string }[] = []

      if (groundingMetadata.groundingChunks) {
        for (const chunk of groundingMetadata.groundingChunks) {
          if (chunk.web?.uri) {
            sources.push({
              title: chunk.web.title || "Source",
              url: chunk.web.uri,
            })
          }
        }
      }

      if (text) {
        return { text, searchQueries, sources }
      }
    } catch (err: any) {
      console.warn(`[Gemini Search Grounding] Error on ${model}:`, err?.message || err)
    }
  }

  // Graceful fallback to direct generation if search grounding quota is exceeded
  console.log(`[Gemini Search Grounding] Falling back to standard generative completion...`)
  const fallbackText = await generateWithFallback(prompt, systemInstruction)
  return { text: fallbackText, sources: [] }
}

/**
 * Generates a complete, interactive, mobile-first single-file HTML/Tailwind web app prototype
 */
export async function generateInteractivePrototypeUI(params: {
  prompt: string
  title: string
  description?: string
  category?: string
}): Promise<string> {
  const { prompt, title, description = "", category = "Fintech" } = params

  const systemPrompt = `You are an elite principal UI/UX frontend engineer creating an interactive, self-contained, production-grade prototype for "Thryve", an autonomous agentic AI product prototyping and data analysis platform.

CRITICAL SPECIFICATIONS:
1. OUTPUT: Output ONLY valid, raw, complete HTML code starting with <!DOCTYPE html> and ending with </html>. Do NOT wrap in markdown fences (\`\`\`html).
2. STYLING & ICONS:
   - Include Tailwind CSS via CDN: <script src="https://cdn.tailwindcss.com"></script>
   - Include Lucide Icons via CDN: <script src="https://unpkg.com/lucide@latest"></script>
   - Font: Inter or Poppins via Google Fonts (<link rel="preconnect" href="https://fonts.googleapis.com">...)
   - Theme Colors: Incorporate a modern, premium design aesthetic (rich indigo, violet, or emerald accents, sleek slate/neutral cards, subtle glassmorphism, clean borders).
3. INTERACTIVITY:
   - Provide genuine JavaScript click handlers, state management, and realistic mock user flows.
   - Tabs must switch views.
   - Buttons must trigger modals, submit mock actions, or update live metrics and charts.
   - Include functional cards, live filters, and meaningful data visualization.
4. USER EXPERIENCE:
   - Modern, responsive application shell (mobile-friendly with clean desktop adaptation).
   - Sleek navigation bar or sidebar.
   - Professional micro-interactions, smooth hover transitions, and badge indicators.
   - NO empty placeholder images or broken external links. Use inline SVG, Lucide icons, or CSS gradients for avatars and visuals.
   - Automatically call \`lucide.createIcons();\` in script initialization.`

  const userPrompt = `Build an interactive prototype for:
Title: ${title}
Category: ${category}
Description: ${description}
Detailed Feature Prompt:
${prompt}

Ensure all views, tabs, modal actions, and interactive widgets are fully coded and functional.`

  let generatedHtml = await generateWithFallback(userPrompt, systemPrompt, {
    temperature: 0.7,
    maxOutputTokens: 8192,
  })

  // Strip code fences if the model included them
  generatedHtml = generatedHtml
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  return generatedHtml
}

/**
 * Generates an interactive, self-contained business analytics dashboard from CSV data
 */
export async function generateInteractiveDashboardUI(params: {
  csvSample: string
  fileName: string
}): Promise<{ html: string; chartsCount: number; summary: string }> {
  const { csvSample, fileName } = params

  const systemPrompt = `You are a Principal Data Scientist and Frontend Engineer specializing in high-impact executive dashboards.
Your task is to analyze the provided CSV dataset and generate an interactive, self-contained HTML dashboard with metrics, interactive Chart.js charts, and business intelligence insights.

CRITICAL SPECIFICATIONS:
1. OUTPUT: Return ONLY valid HTML starting with <!DOCTYPE html> and ending with </html>. Do not wrap in markdown fences.
2. LIBRARIES:
   - Include Tailwind CSS: <script src="https://cdn.tailwindcss.com"></script>
   - Include Chart.js: <script src="https://cdn.jsdelivr.net/npm/chart.js"></script>
   - Include Lucide Icons: <script src="https://unpkg.com/lucide@latest"></script>
3. CONTENT:
   - Top Header with dataset name, last updated timestamp, and export button.
   - KPI Summary Cards: 4 key metric cards (e.g. Total Volume, Average Value, Growth Rate, Active Segment) with % change badges.
   - 3 to 4 Interactive Charts: Rendered with Chart.js (e.g. Bar chart for categories, Line chart for trends, Doughnut chart for breakdown).
   - Data Table: Preview of the top 6-8 sample rows with styled Tailwind table.
   - AI Insights Panel: 3 concise bullet findings and strategic business recommendations.
4. DATA EFFICIENCY & SCRIPT INTEGRITY (CRITICAL TO AVOID TRUNCATION):
   - DO NOT serialize the entire raw CSV or write large raw JS arrays (e.g. no huge rawData arrays).
   - Pre-aggregate the data in your thought process and directly pass concise labels (max 5-8 items) and aggregated number arrays into each Chart.js dataset config.
   - Keep scripts concise and modular.
   - YOU MUST ALWAYS cleanly close all script tags and HTML tags: </script></body></html>. Never leave unfinished code.
5. BRANDING: Dark executive theme (slate-900 / zinc-900 background) with clean typography and rounded cards.`

  const userPrompt = `Dataset File: ${fileName}
Data Sample (Headers & Rows):
${csvSample}

Generate a complete, fully-functioning executive dashboard with 4 Chart.js charts. Ensure all charts are fully instantiated and the HTML closes cleanly with </html>.`

  let generatedHtml = await generateWithFallback(userPrompt, systemPrompt, {
    temperature: 0.4,
    maxOutputTokens: 8192,
  })

  generatedHtml = generatedHtml
    .replace(/^```html\s*/i, "")
    .replace(/^```\s*/i, "")
    .replace(/\s*```$/i, "")
    .trim()

  // Validate that the generated HTML is complete and valid
  const isComplete =
    generatedHtml.includes("</html>") &&
    generatedHtml.includes("</script>") &&
    generatedHtml.includes("new Chart")

  if (!isComplete) {
    throw new Error(
      `Gemini dashboard output was truncated or incomplete (includes </html>: ${generatedHtml.includes("</html>")}, includes new Chart: ${generatedHtml.includes("new Chart")})`
    )
  }

  return {
    html: generatedHtml,
    chartsCount: 4,
    summary: `Executive Dashboard generated for ${fileName}`,
  }
}

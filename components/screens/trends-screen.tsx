"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import {
  TrendingUp,
  Users,
  DollarSign,
  Smartphone,
  ArrowUpDown,
  Search,
  Heart,
  Share,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { TrendDetailsSheet } from "@/components/trend-details-sheet"
import { PrototypePromptModal } from "@/components/prototype-prompt-modal"
import { NewsSection } from "@/components/news/news-section"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { createClient } from "@/lib/supabase"

interface DetailedResearch {
  keyInsights: {
    summary: string
    interpretation: string
  }
  marketValidation: {
    targetMarketSize: string
    adoptionRate: string
    revenueOpportunity: string
  }
  competitiveAnalysis: {
    currentState: string
    bpiPosition: string
    marketWindow: string
    competitors: string[]
  }
  implementationDetails: {
    technicalRequirements: string
    developmentTime: string
    investmentNeeded: string
    riskFactors: string[]
  }
  successMetrics: {
    targetKPIs: string[]
    pilotStrategy: string
    roiTimeline: string
  }
  supportingEvidence: {
    caseStudies: string[]
    localContext: string
    regulatory: string
  }
  businessModel: {
    revenueModel: string
    keyCustomers: string[]
    valuePropositions: string[]
    keyPartnerships: string[]
    bpiAlignment: string
    risks: string[]
  }
}

interface Trend {
  id: string
  title: string
  summary: string
  interpretation: string
  category: string
  impact: "High" | "Medium" | "Low"
  detailedResearch?: DetailedResearch
  prototypePrompt?: string
  sources?: string[]
  createdAt: number
  isHeart: boolean // Added isHeart field for tracking saved trends
  generationType?: "automatic" | "manual" // Added generationType field to distinguish automatic vs manual trends
}

const STORAGE_KEY = "bpi.trends.v1"
const TRENDS_PER_PAGE = 3
// const REFRESH_INTERVAL_DAYS = 1 // Adjust this value as needed

type SortOption = "newest" | "impact-high" | "impact-low" | "category" | "completed" | "saved"

// Custom logger that sends logs to terminal via API
const terminalLog = async (message: string, data?: any) => {
  try {
    await fetch('/api/debug', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        message, 
        data: data ? JSON.stringify(data, null, 2) : undefined,
        timestamp: new Date().toISOString()
      })
    })
  } catch (error) {
    // Fallback to console if API fails
    console.log(message, data)
  }
}

async function loadTrendsFromSupabase(): Promise<Trend[]> {
  try {
    console.log("[TrendsScreen] Starting loadTrendsFromSupabase")
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    console.log("[TrendsScreen] Auth check result:", {
      hasUser: !!user,
      userId: user?.id,
      userError: userError?.message,
    })

    if (userError) {
      console.error("[TrendsScreen] Auth error:", userError)
      return []
    }

    if (!user) {
      console.log("[TrendsScreen] No authenticated user found")
      return []
    }

    console.log("[TrendsScreen] Querying trends table for user:", user.id)
    const { data, error } = await supabase
      .from("trends")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    console.log("[TrendsScreen] Supabase query result:", {
      hasData: !!data,
      dataLength: data?.length || 0,
      hasError: !!error,
      errorMessage: error?.message,
      errorCode: error?.code,
      errorDetails: error?.details,
      errorHint: error?.hint,
    })

    if (error) {
      console.error("[TrendsScreen] Supabase query error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      throw error
    }

    const trends = (data || []).map((item) => {
      console.log("[TrendsScreen] Processing trend item:", {
        id: item.id,
        title: item.title,
        hasDetailedResearch: !!item.detailed_research,
        createdAt: item.created_at,
      })

      return {
        id: item.id,
        title: item.title,
        summary: item.summary,
        interpretation: item.interpretation,
        category: item.category,
        impact: item.impact,
        detailedResearch: item.detailed_research,
        prototypePrompt: item.prototype_prompt,
        sources: item.sources,
        isHeart: item.is_heart,
        generationType: item.generation_type, // Added generationType field
        createdAt: new Date(item.created_at).getTime(),
      }
    })

    console.log("[TrendsScreen] Successfully loaded trends:", {
      count: trends.length,
      trendsWithResearch: trends.filter((t) => !!t.detailedResearch).length,
    })

    return trends
  } catch (error) {
    console.error("[TrendsScreen] Failed to load from Supabase:", {
      error: error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
      errorStack: error instanceof Error ? error.stack : undefined,
    })
    return []
  }
}

async function saveTrendToSupabase(
  trend: Trend,
  generationType: "automatic" | "manual" = "manual",
): Promise<Trend | null> {
  try {
    console.log("[TrendsScreen] Starting saveTrendToSupabase for:", trend.title)
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    console.log("[TrendsScreen] Save auth check:", {
      hasUser: !!user,
      userId: user?.id,
      userError: userError?.message,
    })

    if (userError) {
      console.error("[TrendsScreen] Save auth error:", userError)
      return null
    }

    if (!user) {
      console.log("[TrendsScreen] No user for save operation")
      return null
    }

    const insertData = {
      title: trend.title,
      summary: trend.summary,
      interpretation: trend.interpretation,
      category: trend.category,
      impact: trend.impact,
      detailed_research: trend.detailedResearch,
      prototype_prompt: trend.prototypePrompt,
      sources: trend.sources,
      is_heart: trend.isHeart,
      user_id: user.id,
      generation_type: generationType, // Add generation type to distinguish automatic vs manual trends
    }

    console.log("[TrendsScreen] Inserting trend data:", {
      title: insertData.title,
      category: insertData.category,
      generationType: insertData.generation_type,
      hasDetailedResearch: !!insertData.detailed_research,
      sourcesCount: insertData.sources?.length || 0,
    })

    const { data, error } = await supabase.from("trends").insert(insertData).select().single()

    console.log("[TrendsScreen] Insert result:", {
      hasData: !!data,
      hasError: !!error,
      errorMessage: error?.message,
      errorCode: error?.code,
      insertedId: data?.id,
    })

    if (error) {
      console.error("[TrendsScreen] Insert error:", {
        message: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint,
      })
      throw error
    }

    const savedTrend = {
      ...trend,
      id: data.id,
    }

    console.log("[TrendsScreen] Successfully saved trend:", savedTrend.id)
    return savedTrend
  } catch (error) {
    console.error("[TrendsScreen] Failed to save to Supabase:", {
      trendTitle: trend.title,
      error: error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    })
    return null
  }
}

async function updateTrendHeartStatus(trendId: string, isHeart: boolean): Promise<void> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from("trends")
      .update({ is_heart: isHeart })
      .eq("id", trendId)
      .eq("user_id", user.id)

    if (error) throw error
  } catch (error) {
    console.error("[TrendsScreen] Failed to update heart status:", error)
  }
}

async function checkLatestTrendDate(): Promise<Date | null> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("trends")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)

    if (error) throw error
    return data?.[0]?.created_at ? new Date(data[0].created_at) : null
  } catch (error) {
    console.error("[TrendsScreen] Failed to check latest trend date:", error)
    return null
  }
}

async function updateTrendInSupabase(trend: Trend): Promise<void> {
  try {
    const supabase = createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const { error } = await supabase
      .from("trends")
      .update({
        title: trend.title,
        summary: trend.summary,
        interpretation: trend.interpretation,
        category: trend.category,
        impact: trend.impact,
        detailed_research: trend.detailedResearch,
        prototype_prompt: trend.prototypePrompt,
        sources: trend.sources,
        is_heart: trend.isHeart,
        generation_type: trend.generationType, // Added generationType field
      })
      .eq("id", trend.id)
      .eq("user_id", user.id)

    if (error) throw error
  } catch (error) {
    console.error("[TrendsScreen] Failed to update trend in Supabase:", error)
  }
}

async function checkCurrentWeekTrends(): Promise<Trend[]> {
  try {
    await terminalLog("[checkCurrentWeekTrends] Starting current week trends check")
    const supabase = createClient()
    
    // Get user with better error handling
    const { data: { user }, error: userError } = await supabase.auth.getUser()

    await terminalLog("[checkCurrentWeekTrends] Auth check:", {
      hasUser: !!user,
      userId: user?.id,
      userEmail: user?.email,
      userError: userError?.message,
      sessionValid: !!user
    })

    if (userError || !user) {
      await terminalLog("[checkCurrentWeekTrends] No user for current week check:", { error: userError?.message })
      return []
    }

    // Get start of current week (Monday) - simplified approach
    const now = new Date()
    const sevenDaysAgo = new Date(now)
    sevenDaysAgo.setDate(now.getDate() - 7)
    sevenDaysAgo.setHours(0, 0, 0, 0)

    await terminalLog("[checkCurrentWeekTrends] Week calculation (last 7 days):", {
      now: now.toISOString(),
      sevenDaysAgo: sevenDaysAgo.toISOString(),
      hoursAgo: Math.floor((now.getTime() - sevenDaysAgo.getTime()) / (1000 * 60 * 60))
    })

    // First, let's check ALL trends for this user to see what's in the database
    const { data: allData, error: allError } = await supabase
      .from("trends")
      .select("id, title, generation_type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(10)

    await terminalLog("[checkCurrentWeekTrends] All trends sample:", {
      hasData: !!allData,
      dataLength: allData?.length || 0,
      hasError: !!allError,
      errorMessage: allError?.message,
      sampleTrends: allData?.map(item => ({
        id: item.id,
        title: item.title,
        generation_type: item.generation_type,
        created_at: item.created_at
      })) || []
    })

    // Now check for automatic trends in the last 7 days
    const { data, error } = await supabase
      .from("trends")
      .select("*")
      .eq("user_id", user.id)
      .eq("generation_type", "automatic")
      .gte("created_at", sevenDaysAgo.toISOString())
      .order("created_at", { ascending: false })

    await terminalLog("[checkCurrentWeekTrends] Database query result:", {
      hasData: !!data,
      dataLength: data?.length || 0,
      hasError: !!error,
      errorMessage: error?.message,
      errorDetails: error?.details,
      errorHint: error?.hint,
      query: {
        user_id: user.id,
        generation_type: "automatic",
        created_at_gte: sevenDaysAgo.toISOString()
      }
    })

    if (error) {
      await terminalLog("[checkCurrentWeekTrends] Current week query error:", { 
        error: error.message,
        code: error.code,
        details: error.details,
        hint: error.hint
      })
      throw error
    }

    const trends = (data || []).map((item) => {
      const createdAt = new Date(item.created_at).getTime()
      terminalLog("[checkCurrentWeekTrends] Processing trend:", {
        id: item.id,
        title: item.title,
        generation_type: item.generation_type,
        created_at: item.created_at,
        createdAtTimestamp: createdAt,
        isThisWeek: createdAt >= sevenDaysAgo.getTime()
      })
      
      return {
        id: item.id,
        title: item.title,
        summary: item.summary,
        interpretation: item.interpretation,
        category: item.category,
        impact: item.impact,
        detailedResearch: item.detailed_research,
        prototypePrompt: item.prototype_prompt,
        sources: item.sources,
        isHeart: item.is_heart,
        generationType: item.generation_type,
        createdAt: createdAt,
      }
    })

    await terminalLog("[checkCurrentWeekTrends] Final result:", {
      trendsFound: trends.length,
      trendTitles: trends.map(t => t.title),
      trendDates: trends.map(t => new Date(t.createdAt).toISOString()),
      allAreAutomatic: trends.every(t => t.generationType === "automatic")
    })
    
    return trends
  } catch (error) {
    await terminalLog("[checkCurrentWeekTrends] Error checking current week trends:", { 
      error: error instanceof Error ? error.message : String(error),
      stack: error instanceof Error ? error.stack : undefined
    })
    return []
  }
}

async function getAllExistingTrendTitles(): Promise<string[]> {
  try {
    console.log("[TrendsScreen] Getting all existing trend titles")
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log("[TrendsScreen] No user for titles check:", userError?.message)
      return []
    }

    const { data, error } = await supabase.from("trends").select("title").eq("user_id", user.id)

    console.log("[TrendsScreen] Titles query result:", {
      hasData: !!data,
      dataLength: data?.length || 0,
      hasError: !!error,
      errorMessage: error?.message,
    })

    if (error) {
      console.error("[TrendsScreen] Titles query error:", error)
      throw error
    }

    const titles = data?.map((item) => item.title) || []
    console.log("[TrendsScreen] Retrieved titles:", titles.length)
    return titles
  } catch (error) {
    console.error("[TrendsScreen] Failed to get existing trend titles:", {
      error: error,
      errorMessage: error instanceof Error ? error.message : "Unknown error",
    })
    return []
  }
}

function isSimilarTitle(newTitle: string, existingTitles: string[]): boolean {
  const normalizeTitle = (title: string) =>
    title
      .toLowerCase()
      .replace(/[^\w\s]/g, "")
      .trim()

  const normalizedNew = normalizeTitle(newTitle)

  return existingTitles.some((existing) => {
    const normalizedExisting = normalizeTitle(existing)

    // Check for exact match after normalization
    if (normalizedNew === normalizedExisting) return true

    // Check for high similarity (80% or more common words)
    const newWords = normalizedNew.split(/\s+/)
    const existingWords = normalizedExisting.split(/\s+/)
    const commonWords = newWords.filter((word) => existingWords.includes(word))

    const similarity = commonWords.length / Math.max(newWords.length, existingWords.length)
    return similarity >= 0.8
  })
}

function shouldRefreshTrends(currentWeekTrends: Trend[]): boolean {
  const result = currentWeekTrends.length < 1
  terminalLog("[shouldRefreshTrends] Decision logic:", {
    currentWeekTrendsCount: currentWeekTrends.length,
    threshold: 1,
    condition: `${currentWeekTrends.length} < 1`,
    result: result,
    trendTitles: currentWeekTrends.map(t => t.title),
    trendGenerationTypes: currentWeekTrends.map(t => t.generationType)
  })
  return result
}

// Helper function to format dates properly
const formatDate = (timestamp: number) => {
  const date = new Date(timestamp)
  const now = new Date()
  const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60))
  const diffInHours = Math.floor(diffInMinutes / 60)
  const diffInDays = Math.floor(diffInHours / 24)

  if (diffInMinutes < 60) {
    if (diffInMinutes < 1) return "Just now"
    return `${diffInMinutes}m ago`
  } else if (diffInHours < 24) {
    return `${diffInHours}h ago`
  } else if (diffInDays === 1) {
    return "Yesterday"
  } else if (diffInDays < 7) {
    return `${diffInDays} days ago`
  } else {
    // Use DD/MM/YYYY format for older dates
    const day = date.getDate().toString().padStart(2, "0")
    const month = (date.getMonth() + 1).toString().padStart(2, "0")
    const year = date.getFullYear()
    return `${day}/${month}/${year}`
  }
}

interface TrendsScreenProps {
  trends?: Trend[]
  onTrendsUpdated?: () => void
}

function TrendsScreen({ trends: propTrends = [], onTrendsUpdated }: TrendsScreenProps) {
  const [trends, setTrends] = useState<Trend[]>([])
  const [detailsOpenFor, setDetailsOpenFor] = useState<string | null>(null)
  const [promptOpenFor, setPromptOpenFor] = useState<string | null>(null)
  const bootstrappedRef = useRef(false)
  const generationInProgressRef = useRef(false)
  const [searchingMore, setSearchingMore] = useState(false)
  const [prototypeCount, setPrototypeCount] = useState("3")
  const [sortBy, setSortBy] = useState<SortOption>("newest")
  const [topicInput, setTopicInput] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)
  const [searchingCategory, setSearchingCategory] = useState(false)
  const [completedCount, setCompletedCount] = useState(0)
  const [savedTrends, setSavedTrends] = useState<Set<string>>(new Set())
  const [debugInfo, setDebugInfo] = useState<any>(null)

  useEffect(() => {
    const checkAuth = async () => {
      const supabase = createClient()
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser()

      setDebugInfo({
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
        authError: error?.message,
        timestamp: new Date().toISOString(),
      })
    }

    checkAuth()
  }, [])

  useEffect(() => {
    const loadTrends = async () => {
      await terminalLog("[TrendsScreen] useEffect triggered - START")
      await terminalLog("[TrendsScreen] Bootstrap state:", {
        isBootstrapped: bootstrappedRef.current,
        generationInProgress: generationInProgressRef.current,
        propTrendsLength: propTrends.length,
        currentTrendsLength: trends.length
      })

      // Prevent multiple executions
      if (bootstrappedRef.current) {
        await terminalLog("[TrendsScreen] Already bootstrapped, skipping auto-generation")
        return
      }

      // Prevent concurrent generations
      if (generationInProgressRef.current) {
        await terminalLog("[TrendsScreen] Generation already in progress, skipping")
        return
      }

      // Set bootstrap flag IMMEDIATELY to prevent race conditions from React Strict Mode
      bootstrappedRef.current = true

      try {
        await terminalLog("[TrendsScreen] Loading trends from props:", { count: propTrends.length })
        const loadedTrends = propTrends.length > 0 ? propTrends : await loadTrendsFromSupabase()
        await terminalLog("[TrendsScreen] Total trends loaded:", { count: loadedTrends.length })
        
        // Log detailed breakdown of loaded trends
        const automaticTrends = loadedTrends.filter(t => t.generationType === "automatic")
        const manualTrends = loadedTrends.filter(t => t.generationType === "manual")
        const unknownTrends = loadedTrends.filter(t => !t.generationType)
        
        await terminalLog("[TrendsScreen] Trends breakdown:", {
          total: loadedTrends.length,
          automatic: automaticTrends.length,
          manual: manualTrends.length,
          unknown: unknownTrends.length,
          automaticTitles: automaticTrends.map(t => t.title),
          manualTitles: manualTrends.map(t => t.title)
        })

        if (loadedTrends.length > 0) {
          setTrends(loadedTrends)
          setSavedTrends(new Set(loadedTrends.filter((t) => t.isHeart).map((t) => t.id)))
          
          await terminalLog("[TrendsScreen] Checking if automatic trends need to be generated...")
          const currentWeekTrends = await checkCurrentWeekTrends()
          await terminalLog("📅 [TrendsScreen] Current week automatic trends analysis:", {
            count: currentWeekTrends.length,
            titles: currentWeekTrends.map(t => t.title),
            dates: currentWeekTrends.map(t => new Date(t.createdAt).toISOString()),
            generationTypes: currentWeekTrends.map(t => t.generationType)
          })

          const shouldRefresh = shouldRefreshTrends(currentWeekTrends)
          await terminalLog("[TrendsScreen] Should refresh decision:", {
            shouldRefresh,
            currentWeekCount: currentWeekTrends.length,
            threshold: 1,
            logic: `${currentWeekTrends.length} < 1 = ${shouldRefresh}`
          })

          if (shouldRefresh) {
            const trendsNeeded = 1 - currentWeekTrends.length
            await terminalLog("[TrendsScreen] TRIGGERING AUTO-GENERATION:", {
              trendsNeeded,
              reason: `less than 1 automatic trends this week (found ${currentWeekTrends.length})`
            })
            generationInProgressRef.current = true // Set generation flag
            bootstrappedRef.current = true // Set BEFORE async call to prevent race conditions
            try {
              await searchForMoreTrends(trendsNeeded, "automatic")
            } finally {
              generationInProgressRef.current = false // Reset flag
            }
          } else {
            await terminalLog("[TrendsScreen] No auto-generation needed (already have 1+ automatic trends this week)")
            bootstrappedRef.current = true
          }
        } else {
          await terminalLog("[TrendsScreen] No trends found in database - checking for empty DB scenario")
          
          try {
            const currentWeekTrends = await checkCurrentWeekTrends()
            await terminalLog("[TrendsScreen] Current week automatic trends (empty DB check):", {
              count: currentWeekTrends.length,
              titles: currentWeekTrends.map(t => t.title)
            })

            if (currentWeekTrends.length === 0) {
              await terminalLog("[TrendsScreen] TRIGGERING AUTO-GENERATION (empty DB):", {
                reason: "Empty database with no automatic trends"
              })
              generationInProgressRef.current = true // Set generation flag
              bootstrappedRef.current = true // Set BEFORE async call to prevent race conditions
              try {
                await searchForMoreTrends(1, "automatic")
              } finally {
                generationInProgressRef.current = false // Reset flag
              }
            } else {
              await terminalLog("[TrendsScreen] Empty DB but found automatic trends this week, no generation needed")
              bootstrappedRef.current = true
            }
          } catch (error) {
            const errMsg = (error as Error)?.message || String(error)
            await terminalLog("[TrendsScreen] Error checking current week trends for empty DB:", { error: errMsg })
            bootstrappedRef.current = true
          }
        }
      } catch (error) {
        const errMsg = (error as Error)?.message || String(error)
        await terminalLog("[TrendsScreen] Failed to load trends:", { error: errMsg })
        bootstrappedRef.current = true
      }
      
      await terminalLog("[TrendsScreen] useEffect completed - END")
    }

    loadTrends()
  }, []) // Remove propTrends dependency to prevent re-execution

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery])

  const { allFilteredTrends, paginatedTrends, totalPages } = useMemo(() => {
    let filtered = [...trends]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (trend) =>
          trend.title.toLowerCase().includes(query) ||
          trend.category.toLowerCase().includes(query) ||
          trend.summary.toLowerCase().includes(query),
      )
    }

    switch (sortBy) {
      case "newest":
        filtered = filtered.sort((a, b) => b.createdAt - a.createdAt)
        break
      case "impact-high":
        filtered = filtered.sort((a, b) => {
          const impactOrder = { High: 3, Medium: 2, Low: 1 }
          return impactOrder[b.impact] - impactOrder[a.impact]
        })
        break
      case "impact-low":
        filtered = filtered.sort((a, b) => {
          const impactOrder = { High: 3, Medium: 2, Low: 1 }
          return impactOrder[a.impact] - impactOrder[b.impact]
        })
        break
      case "category":
        filtered = filtered.sort((a, b) => a.category.localeCompare(b.category))
        break
      case "completed":
        filtered = filtered.sort((a, b) => {
          const aCompleted = !!a.detailedResearch
          const bCompleted = !!b.detailedResearch
          return bCompleted === aCompleted ? 0 : bCompleted ? 1 : -1
        })
        break
      case "saved":
        filtered = filtered.filter((trend) => trend.isHeart)
        break
    }

    const totalPages = Math.ceil(filtered.length / TRENDS_PER_PAGE)
    const startIndex = (currentPage - 1) * TRENDS_PER_PAGE
    const endIndex = startIndex + TRENDS_PER_PAGE
    const paginatedTrends = filtered.slice(startIndex, endIndex)

    setCompletedCount(filtered.filter((t) => !!t.detailedResearch).length)

    return {
      allFilteredTrends: filtered,
      paginatedTrends,
      totalPages,
    }
  }, [trends, sortBy, searchQuery, currentPage])

  async function checkAutoGeneratePrototypesEnabled(): Promise<boolean> {
    try {
      await terminalLog("[checkAutoGeneratePrototypesEnabled] Starting auto-generate toggle check")
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      await terminalLog("[checkAutoGeneratePrototypesEnabled] Auth check:", {
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
        userError: userError?.message
      })

      if (userError || !user) {
        await terminalLog("❌ [checkAutoGeneratePrototypesEnabled] No user found for auto-generate check:", userError?.message)
        return false
      }

      await terminalLog("[checkAutoGeneratePrototypesEnabled] Querying profiles table for auto_generate_prototypes setting")
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("auto_generate_prototypes")
        .eq("id", user.id)
        .single()

      await terminalLog("[checkAutoGeneratePrototypesEnabled] Database query result:", {
        hasProfile: !!profile,
        hasError: !!profileError,
        errorMessage: profileError?.message,
        errorCode: profileError?.code,
        errorDetails: profileError?.details,
        rawProfileData: profile
      })

      if (profileError) {
        await terminalLog("[checkAutoGeneratePrototypesEnabled] Error checking auto-generate setting:", {
          error: profileError.message,
          code: profileError.code,
          details: profileError.details,
          hint: profileError.hint
        })
        return false
      }

      const isEnabled = profile?.auto_generate_prototypes || false
      await terminalLog("[checkAutoGeneratePrototypesEnabled] Final decision:", {
        profileValue: profile?.auto_generate_prototypes,
        defaultValue: false,
        finalResult: isEnabled,
        logic: `${profile?.auto_generate_prototypes} || false = ${isEnabled}`
      })

      return isEnabled
    } catch (error) {
      await terminalLog("[checkAutoGeneratePrototypesEnabled] Error checking auto-generate prototypes setting:", {
        error: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined
      })
      return false
    }
  }

  async function autoGeneratePrototypeFromTrend(trend: Trend) {
    try {
      await terminalLog("[autoGeneratePrototypeFromTrend] =================================")
      await terminalLog("[autoGeneratePrototypeFromTrend] AUTOMATIC PROTOTYPE GENERATION STARTED")
      await terminalLog("[autoGeneratePrototypeFromTrend] =================================")
      await terminalLog("[autoGeneratePrototypeFromTrend] Trend details:", {
        trendId: trend.id,
        trendTitle: trend.title,
        trendCategory: trend.category,
        hasPrototypePrompt: !!trend.prototypePrompt,
        prototypePromptLength: trend.prototypePrompt?.length || 0
      })
      
      console.log("[TrendsScreen] Auto-generating prototype for trend:", trend.title)

      if (!trend.prototypePrompt || trend.prototypePrompt.trim() === "") {
        await terminalLog("[autoGeneratePrototypeFromTrend] CRITICAL ERROR: No prototype prompt available:", {
          trendTitle: trend.title,
          prototypePrompt: trend.prototypePrompt,
          reason: "Cannot generate prototype without a prompt"
        })
        return
      }

      await terminalLog("[autoGeneratePrototypeFromTrend] Getting authentication...")
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      await terminalLog("[autoGeneratePrototypeFromTrend] Auth result:", {
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email,
        userError: userError?.message
      })

      if (userError || !user) {
        await terminalLog("[autoGeneratePrototypeFromTrend] Authentication failed:", {
          userError: userError?.message,
          reason: "Cannot generate prototype without authenticated user"
        })
        return
      }

      // SAFETY CHECK: Verify toggle is enabled before proceeding
      await terminalLog("[autoGeneratePrototypeFromTrend] SAFETY CHECK - Verifying toggle is enabled...")
      const isToggleEnabled = await checkAutoGeneratePrototypesEnabled()
      
      await terminalLog("[autoGeneratePrototypeFromTrend] Toggle verification result:", {
        isEnabled: isToggleEnabled,
        shouldProceed: isToggleEnabled
      })

      if (!isToggleEnabled) {
        await terminalLog("[autoGeneratePrototypeFromTrend] BLOCKED - Toggle is disabled:", {
          trendTitle: trend.title,
          reason: "Auto-generate prototypes toggle is OFF - aborting generation"
        })
        return
      }

      await terminalLog("[autoGeneratePrototypeFromTrend] Toggle check PASSED - proceeding with generation")

      // Enhanced prompt to ensure functional buttons and interactions
      const enhancedPrompt = `${trend.prototypePrompt}

CRITICAL REQUIREMENTS for functional prototype:
- All buttons must be clickable and functional
- Forms must have proper validation and submission handling
- Navigation elements must work properly
- Interactive elements should provide user feedback
- Include hover states and loading states where appropriate
- Ensure mobile responsiveness
- Add proper error handling for user actions
- Make the interface intuitive and user-friendly

Technical Implementation:
- Use React hooks for state management
- Implement proper event handlers for all interactive elements
- Add form validation with clear error messages
- Include loading spinners for async operations
- Use modern UI patterns and accessibility best practices
- Ensure all clickable elements have proper cursor styles
- Add smooth transitions and animations where appropriate

Focus on creating a fully functional, production-ready prototype that users can actually interact with meaningfully.`

      const requestPayload = {
        prompt: enhancedPrompt,
        title: `${trend.title} Prototype (Auto-Generated)`,
        description: `AI-generated prototype based on automatically discovered trend: ${trend.title}`,
        category: "Auto-Generated",
        priority: "High",
        trendId: trend.id,
        userId: user.id,
      }

      await terminalLog("📡 [autoGeneratePrototypeFromTrend] Sending auto-prototype generation request:", {
        title: requestPayload.title,
        trendId: requestPayload.trendId,
        promptLength: requestPayload.prompt.length,
      })

      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch("/api/prototypes/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`,
        },
        body: JSON.stringify(requestPayload),
      })

      if (response.ok) {
        const result = await response.json()
        await terminalLog("[autoGeneratePrototypeFromTrend] Auto-prototype generation started successfully:", result)
      } else {
        const errorData = await response.text()
        await terminalLog("[autoGeneratePrototypeFromTrend] Auto-prototype generation failed:", errorData)
      }
    } catch (error) {
      await terminalLog("[autoGeneratePrototypeFromTrend] Error in auto-prototype generation:", {
        error: error instanceof Error ? error.message : String(error)
      })
    }
  }

  async function analyzeTrend(trend: Trend, generationType: "automatic" | "manual" = "automatic") {
    try {
      console.log("[TrendsScreen] Starting analysis for trend:", trend.title)
      setTrends((prev) => prev.map((t) => (t.id === trend.id ? { ...t } : t)))

      const resR = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: trend.title,
          category: trend.category,
          researchMode: "detailed",
          sourceGuidelines:
            "Use authoritative sources like academic papers, industry reports, government data, and established news outlets. Avoid social media as primary sources for detailed research.",
        }),
      })

      console.log("[TrendsScreen] Research API response:", {
        ok: resR.ok,
        status: resR.status,
        contentType: resR.headers.get("content-type"),
      })

      const ct2 = resR.headers.get("content-type") || ""
      if (!ct2.includes("application/json")) {
        const text = await resR.text()
        console.error("[TrendsScreen] Non-JSON response from research API:", text.slice(0, 200))
        throw new Error(`Non-JSON response (${resR.status}): ${text.slice(0, 120)}`)
      }

      const dataR = await resR.json()
      console.log("[TrendsScreen] Research API data:", {
        hasDetailedResearch: !!dataR.detailed_research,
        hasPrototypePrompt: !!dataR.prototype_prompt,
        hasSources: !!dataR.sources,
      })

      if (!resR.ok) {
        console.error("[TrendsScreen] Research API error:", dataR)
        throw new Error(dataR?.error || "Trend research failed.")
      }

      const detailed = dataR.detailed_research as DetailedResearch
      const prototypePrompt = dataR.prototype_prompt as string
      const sourceUrls = (dataR.sources as string[]) || []

      const updatedTrend = {
        ...trend,
        detailedResearch: detailed,
        prototypePrompt,
        sources: sourceUrls,
      }

      console.log("[TrendsScreen] Updated trend with research data:", {
        id: updatedTrend.id,
        hasDetailedResearch: !!updatedTrend.detailedResearch,
        hasPrototypePrompt: !!updatedTrend.prototypePrompt,
        sourcesCount: updatedTrend.sources.length,
      })

      setTrends((prev) => prev.map((t) => (t.id === trend.id ? updatedTrend : t)))

      const savedTrend = await saveTrendToSupabase(updatedTrend, generationType)
      if (savedTrend) {
        console.log("[TrendsScreen] Successfully saved updated trend to Supabase")

        if (generationType === "automatic") {
          await terminalLog("[analyzeTrend] AUTOMATIC TREND - Checking if should auto-generate prototype:", {
            trendId: updatedTrend.id,
            trendTitle: updatedTrend.title,
            generationType: generationType,
            hasPrototypePrompt: !!updatedTrend.prototypePrompt,
            prototypePromptLength: updatedTrend.prototypePrompt?.length || 0
          })
          
          console.log("[TrendsScreen] Checking if should auto-generate prototype for automatic trend")
          const shouldAutoGenerate = await checkAutoGeneratePrototypesEnabled()

          await terminalLog("⚙️ [analyzeTrend] Auto-generate decision result:", {
            shouldAutoGenerate,
            hasPrototypePrompt: !!updatedTrend.prototypePrompt,
            willProceed: shouldAutoGenerate && !!updatedTrend.prototypePrompt
          })

          if (shouldAutoGenerate && updatedTrend.prototypePrompt) {
            await terminalLog("[analyzeTrend] PROCEEDING with auto-prototype generation:", {
              trendTitle: updatedTrend.title,
              reason: "Toggle enabled AND prototype prompt exists"
            })
            await autoGeneratePrototypeFromTrend(updatedTrend)
          } else if (!shouldAutoGenerate) {
            await terminalLog("[analyzeTrend] SKIPPING auto-prototype generation:", {
              trendTitle: updatedTrend.title,
              reason: "Auto-generate prototypes toggle is DISABLED in user settings"
            })
          } else {
            await terminalLog("[analyzeTrend] SKIPPING auto-prototype generation:", {
              trendTitle: updatedTrend.title,
              reason: "No prototype prompt available for auto-generation"
            })
            console.log("[TrendsScreen] No prototype prompt available for auto-generation")
          }
        } else {
          await terminalLog("[analyzeTrend] MANUAL TREND - No auto-prototype generation:", {
            trendId: updatedTrend.id,
            trendTitle: updatedTrend.title,
            generationType: generationType,
            reason: "Only automatic trends trigger auto-prototype generation"
          })
        }
      } else {
        console.error("[TrendsScreen] Failed to save updated trend to Supabase")
      }
    } catch (e: any) {
      console.error("[TrendsScreen] analyzeTrend error:", {
        error: e,
        errorMessage: e?.message,
        trendTitle: trend.title,
      })
    }
  }

  async function searchForMoreTrends(count: number, generationType: "automatic" | "manual" = "manual") {
    await terminalLog("[searchForMoreTrends] CALLED with params:", {
      count,
      generationType,
      currentBootstrapState: bootstrappedRef.current,
      currentTrendsCount: trends.length,
      timestamp: new Date().toISOString()
    })
    
    setSearchingMore(true)
    try {
      console.log(
        "[TrendsScreen] Starting searchForMoreTrends with count:",
        count,
        "generationType:",
        generationType,
      )
      const allExistingTitles = await getAllExistingTrendTitles()
      const currentSessionTitles = trends.map((t) => t.title)
      const existingTitles = [...new Set([...allExistingTitles, ...currentSessionTitles])]

      console.log("[TrendsScreen] Existing titles count:", {
        fromDatabase: allExistingTitles.length,
        fromSession: currentSessionTitles.length,
        totalUnique: existingTitles.length,
      })

      console.log("[TrendsScreen] Calling research API for more trends")
      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bootstrap: true,
          mode: "seeds",
          existingTrends: existingTitles,
          count: count,
          searchTopic: topicInput.trim() || undefined,
          ideationSources:
            "You may use Reddit, Twitter/X, and Facebook for trend ideation and inspiration. Credit these platforms in sources when used for initial ideas.",
          sourceGuidelines:
            "For ideation: Reddit, Twitter/X, Facebook are acceptable. For detailed research: use credible sources only.",
        }),
      })

      console.log("[TrendsScreen] Research API response:", {
        ok: res.ok,
        status: res.status,
        statusText: res.statusText,
        contentType: res.headers.get("content-type"),
      })

      const ct = res.headers.get("content-type") || ""
      if (!ct.includes("application/json")) {
        const text = await res.text()
        console.error("[TrendsScreen] Non-JSON response from research API:", text.slice(0, 200))
        throw new Error(`Non-JSON response (${res.status})`)
      }

      const data = await res.json()
      console.log("[TrendsScreen] Research API data:", {
        hasData: !!data,
        hasSeeds: !!data.seeds,
        seedsLength: data.seeds?.length || 0,
        hasError: !!data.error,
        generationType: data.generationType,
      })

      if (!res.ok) {
        console.error("[TrendsScreen] Research API error:", data)
        throw new Error(data?.error || "Additional trend generation failed.")
      }

      const seeds = (data?.seeds || []) as Array<{
        title: string
        category: string
        impact?: "High" | "Medium" | "Low"
        summary: string
        interpretation: string
      }>

      console.log("[TrendsScreen] Processing seeds:", seeds.length)
      const uniqueSeeds = seeds.filter((seed) => !isSimilarTitle(seed.title, existingTitles))

      console.log("[TrendsScreen] Unique seeds after filtering:", uniqueSeeds.length)

      if (uniqueSeeds.length === 0) {
        console.log("[TrendsScreen] No unique trends found, all were duplicates")
        return
      }

      const currentTime = Date.now()

      const newTrends: Trend[] = uniqueSeeds.slice(0, count).map((s, idx) => ({
        id: `${currentTime}-new-${idx}`,
        title: s.title,
        category: s.category,
        impact: s.impact || "Medium",
        summary: s.summary,
        interpretation: s.interpretation,
        sources: [],
        detailedResearch: undefined,
        prototypePrompt: "",
        createdAt: currentTime + idx,
        isHeart: false,
        generationType: generationType,
      }))

      console.log(
        "[TrendsScreen] Created new trends:",
        newTrends.map((t) => `${t.title} (${t.generationType})`),
      )
      setTrends((prev) => [...newTrends, ...prev])

      for (let i = 0; i < newTrends.length; i++) {
        console.log("[TrendsScreen] Created trend (will save after research):", newTrends[i].title)
      }

      console.log("[TrendsScreen] Starting automatic analysis for", newTrends.length, "new trends")
      for (const trend of newTrends) {
        console.log("[TrendsScreen] Analyzing new trend:", trend.title)
        await analyzeTrend(trend, generationType)
      }
      console.log("[TrendsScreen] Completed automatic analysis for new trends")

      setTopicInput("")
    } catch (e: any) {
      console.error("[TrendsScreen] search for more trends error:", {
        error: e,
        errorMessage: e?.message,
        errorStack: e?.stack,
      })
    } finally {
      setSearchingMore(false)
    }
  }

  async function searchForCategoryTrends(searchTopic: string, count = 1) {
    if (!searchTopic.trim()) return

    setSearchingCategory(true)
    try {
      const existingTitles = trends.map((t) => t.title)

      const res = await fetch("/api/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bootstrap: true,
          mode: "seeds",
          existingTrends: existingTitles,
          count: count,
          searchTopic: searchTopic.trim(),
          ideationSources:
            "You may use Reddit, Twitter/X, and Facebook for trend ideation and inspiration. Credit these platforms in sources when used for initial ideas.",
          sourceGuidelines:
            "For ideation: Reddit, Twitter/X, Facebook are acceptable. For detailed research: use credible sources only.",
        }),
      })

      const ct = res.headers.get("content-type") || ""
      if (!ct.includes("application/json")) {
        const text = await res.text()
        throw new Error(`Non-JSON response (${res.status})`)
      }

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data?.error || "Category-specific trend generation failed.")
      }

      const seeds = (data?.seeds || []) as Array<{
        title: string
        category: string
        impact?: "High" | "Medium" | "Low"
        summary: string
        interpretation: string
      }>

      const currentTime = Date.now()
      const newTrends: Trend[] = seeds.slice(0, count).map((s, idx) => ({
        id: `${currentTime}-search-${idx}`,
        title: s.title,
        category: s.category,
        impact: s.impact || "Medium",
        summary: s.summary,
        interpretation: s.interpretation,
        sources: [],
        detailedResearch: undefined,
        prototypePrompt: "",
        createdAt: currentTime + idx,
        isHeart: false,
        generationType: "manual", // Set generation type to manual
      }))

      setTrends((prev) => [...newTrends, ...prev])
      setSearchQuery("") // Clear search to show the new results
      setCurrentPage(1) // Reset to first page

      setTrends((prev) => {
        const updated = [...prev]
        newTrends.forEach((newTrend) => {
          const existingIndex = updated.findIndex((t) => t.createdAt === newTrend.createdAt)
          if (existingIndex !== -1) {
            updated[existingIndex] = newTrend
          }
        })
        return updated
      })
    } catch (e: any) {
      console.error("[TrendsScreen] search for category trends error", e)
    } finally {
      setSearchingCategory(false)
    }
  }

  const getImpactColor = (impact: string) => {
    switch (impact) {
      case "High":
        return "bg-red-100 text-red-800 border-red-200"
      case "Medium":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "Low":
        return "bg-green-100 text-green-800 border-green-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const getCategoryIcon = (category: string) => {
    switch (category) {
      case "Digital Payments":
        return <Smartphone className="w-4 h-4" />
      case "User Experience":
        return <Users className="w-4 h-4" />
      case "Sustainability":
        return <TrendingUp className="w-4 h-4" />
      case "Security":
        return <DollarSign className="w-4 h-4" />
      default:
        return <TrendingUp className="w-4 h-4" />
    }
  }

  const toggleSaved = async (trendId: string) => {
    const trend = trends.find((t) => t.id === trendId)
    if (!trend) return

    const newHeartStatus = !trend.isHeart

    setTrends((prev) => prev.map((t) => (t.id === trendId ? { ...t, isHeart: newHeartStatus } : t)))

    await updateTrendHeartStatus(trendId, newHeartStatus)
  }

  const saveTrendToDatabase = async (trend: Trend) => {
    try {
      const supabase = createClient()
      const { error } = await supabase.from("trends").insert({
        id: Number.parseInt(trend.id.split("-")[0]),
        title: trend.title,
        category: trend.category,
        impact: trend.impact,
        summary: trend.summary,
        interpretation: trend.interpretation,
        sources: trend.sources,
        detailed_research: trend.detailedResearch,
        prototype_prompt: trend.prototypePrompt,
        is_heart: trend.isHeart,
        generation_type: trend.generationType, // Added generationType field
      })

      if (error) {
        console.error("Error saving trend to database:", error)
        return false
      }

      console.log("Successfully saved trend to database:", trend.title)
      onTrendsUpdated?.()
      return true
    } catch (error) {
      console.error("Failed to save trend to database:", error)
      return false
    }
  }

  return (
    <div className="min-h-screen bg-white pb-1">
      <div className="px-2 py-5 bg-white">
        <div className="h-16 flex items-center justify-center mb-4">
          <img
            src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/thryve_nav_logo.svg"
            alt="thryve"
            className="h-12"
          />
        </div>
      </div>

  <div className="px-4 lg:pl-8 xl:pl-12 space-y-6 pb-24 lg:pb-10">{/* extra bottom padding so pagination not hidden behind mobile nav */}
        <Card className="shadow-sm border border-gray-200 bg-white">
          <CardContent className="p-4 space-y-4">
            <div className="space-y-1">
              <div className="flex items-center justify-between">
                <h1 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-[#E0000A]">Market Trends</h1>
                <span className="text-gray-500 text-sm">Today's insights</span>
              </div>
              <div className="flex items-center justify-between text-sm">
                <div className="text-[#E0000A] font-semibold text-sm">{completedCount} trends analyzed</div>
              </div>
            </div>

            <div className="space-y-4">
              <div>
                <h2 className="text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 mb-1">Generate More Insights</h2>
                <p className="text-sm text-gray-600 mb-3">
                  Type your focus area, and our AI will deliver the latest, high-potential insights instantly.
                </p>
                <div className="space-y-3">
                  <Input
                    placeholder="Enter a Topic to Explore"
                    className="w-full rounded-lg"
                    value={topicInput}
                    onChange={(e) => setTopicInput(e.target.value)}
                  />
                  <p className="text-sm text-gray-600">
                    Stay ahead with trends tracked from thousands of verified data points.
                  </p>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <span className="text-sm text-gray-600">Number of trends:</span>
                      <Select value={prototypeCount} onValueChange={setPrototypeCount}>
                        <SelectTrigger className="w-16 h-8 rounded-lg">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="1">1</SelectItem>
                          <SelectItem value="2">2</SelectItem>
                          <SelectItem value="3">3</SelectItem>
                          <SelectItem value="4">4</SelectItem>
                          <SelectItem value="5">5</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>
                  <Button
                    onClick={() => searchForMoreTrends(Number.parseInt(prototypeCount))}
                    disabled={searchingMore}
                    className="w-full bg-[#E0000A] hover:bg-red-700 text-white h-12 lg:h-14 xl:h-16 text-base lg:text-lg xl:text-xl font-semibold rounded-lg"
                  >
                    {searchingMore ? "Discovering More Insights..." : "Discover More Insights"}
                  </Button>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl lg:text-2xl xl:text-3xl font-semibold text-gray-900 flex items-center gap-2">
              Today's Market Trends
              <TrendingUp className="w-5 h-5 text-[#E0000A]" />
            </h2>
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-auto h-8 border-none bg-transparent p-0">
                  <ArrowUpDown className={`w-4 h-4 ${sortBy !== "newest" ? "text-[#E0000A]" : "text-gray-400"}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="impact-high">High Impact First</SelectItem>
                  <SelectItem value="impact-low">Low Impact First</SelectItem>
                  <SelectItem value="category">By Category</SelectItem>
                  <SelectItem value="completed">Completed First</SelectItem>
                  <SelectItem value="saved">Saved Only</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search for existing insights"
              className="pl-10 bg-gray-50 border-gray-200 rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {searchQuery && !searchingCategory && (
            <div className="text-sm text-gray-600">
              Found {allFilteredTrends.length} trend{allFilteredTrends.length !== 1 ? "s" : ""} matching "{searchQuery}"
            </div>
          )}

          {searchingCategory && (
            <div className="text-sm text-[#E0000A] flex items-center gap-2">
              <TrendingUp className="w-4 h-4 animate-spin" />
              Generating trends related to "{searchQuery}"...
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
          {paginatedTrends.map((trend) => {
            return (
              <Card key={trend.id} className="shadow-sm border border-gray-200 rounded-lg bg-white">
                <CardContent className="p-4 space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-start justify-between">
                      <h3 className="text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 leading-tight pr-2">{trend.title}</h3>
                      <span className="text-xs text-gray-500 whitespace-nowrap">{formatDate(trend.createdAt)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full border border-purple-200">
                        {trend.category}
                      </span>
                    </div>
                  </div>

                  <Card className="bg-yellow-50 border-yellow-200">
                    <CardContent className="p-3 space-y-1">
                      <h4 className="text-sm font-semibold text-yellow-900">Key Insight</h4>
                      <p className="text-sm lg:text-base xl:text-lg text-yellow-800 leading-relaxed">
                        {trend.summary || "AI will summarize market validation here."}
                      </p>
                    </CardContent>
                  </Card>

                  <Card className="bg-purple-50 border-purple-200">
                    <CardContent className="p-3 space-y-1">
                      <h4 className="text-sm font-semibold text-purple-900">Business Implication</h4>
                      <p className="text-sm lg:text-base xl:text-lg text-purple-800 leading-relaxed">
                        {trend.interpretation || "Insights will appear here."}
                      </p>
                    </CardContent>
                  </Card>

                  <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                    <div className="flex items-center gap-3">
                      <button
                        className="flex items-center gap-2 text-[#E0000A] hover:bg-red-50 px-4 py-3 rounded-lg transition-colors flex-1"
                        onClick={() => {
                          sessionStorage.setItem(
                            "ai-chat-context",
                            JSON.stringify({
                              type: "trend",
                              id: trend.id, // Added missing trend ID
                              title: trend.title,
                              category: trend.category,
                              summary: trend.summary,
                              interpretation: trend.interpretation,
                            }),
                          )
                          window.dispatchEvent(new CustomEvent("switch-to-ai-chat"))
                        }}
                      >
                        <img
                          src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/ask_yve_trends.svg"
                          alt="AI Chat"
                          className="w-8 h-8"
                        />
                        <span className="text-sm font-medium">Ask Yve anything</span>
                      </button>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => toggleSaved(trend.id)}
                        className="flex items-center gap-1 hover:bg-gray-50 px-3 py-2 rounded-lg transition-colors"
                      >
                        <Heart
                          className={`w-6 h-6 transition-colors ${
                            trend.isHeart ? "text-red-500 fill-red-500" : "text-gray-400 hover:text-red-400"
                          }`}
                        />
                      </button>
                      <Share className="w-6 h-6 text-gray-400 ml-2" />
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-3 pt-2">
                    {!trend.detailedResearch ? (
                      <Button className="col-span-2 bg-gray-100 text-gray-400 cursor-not-allowed rounded-lg" disabled>
                        <TrendingUp className="w-4 h-4 mr-2 animate-spin" />
                        Analyzing...
                      </Button>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="bg-white border-gray-300 text-gray-700 hover:bg-gray-50 hover:text-gray-900 rounded-lg"
                          onClick={() => setDetailsOpenFor(trend.id)}
                        >
                          View Details
                        </Button>
                        <Button
                          className="bg-[#E0000A] hover:bg-red-700 text-white font-semibold rounded-lg"
                          onClick={() => {
                            console.log("[TRENDS-SCREEN] Generate Prototype clicked for trend:", trend.id)
                            console.log("[TRENDS-SCREEN] Trend data analysis:")
                            console.log(`   - Title: "${trend.title}"`)
                            console.log(`   - Category: "${trend.category}"`)
                            console.log(`   - Has prototypePrompt: ${!!trend.prototypePrompt}`)
                            console.log(`   - PrototypePrompt length: ${trend.prototypePrompt?.length || 0}`)
                            if (trend.prototypePrompt) {
                              console.log(
                                `   - PrototypePrompt preview: "${trend.prototypePrompt.substring(0, 200)}..."`,
                              )
                            } else {
                              console.log("   - PrototypePrompt: null/undefined/empty")
                            }
                            console.log("🚀 [TRENDS-SCREEN] Opening PrototypePromptModal...")
                            setPromptOpenFor(trend.id)
                          }}
                        >
                          Generate Prototype
                        </Button>
                      </>
                    )}
                  </div>
                </CardContent>
              </Card>
            )
          })}
          </div>

          {totalPages > 1 && (
            <div className="flex items-center justify-between pt-4">
              <div className="text-sm text-gray-600">
                Showing {(currentPage - 1) * TRENDS_PER_PAGE + 1} to{" "}
                {Math.min(currentPage * TRENDS_PER_PAGE, allFilteredTrends.length)} of {allFilteredTrends.length} trends
              </div>
              <div className="flex items-center gap-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  className="w-8 h-8 p-0"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <span className="text-sm text-gray-600 font-medium">
                  Page {currentPage} of {totalPages}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages}
                  className="w-8 h-8 p-0"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>
          )}
        </div>

        {detailsOpenFor && (
          <TrendDetailsSheet
            open={!!detailsOpenFor}
            onOpenChange={(o) => !o && setDetailsOpenFor(null)}
            trendTitle={allFilteredTrends.find((t) => t.id === detailsOpenFor)?.title || "Trend Details"}
            trendSummary={allFilteredTrends.find((t) => t.id === detailsOpenFor)?.summary || ""}
            trendInterpretation={allFilteredTrends.find((t) => t.id === detailsOpenFor)?.interpretation || ""}
            trendCategory={allFilteredTrends.find((t) => t.id === detailsOpenFor)?.category || ""}
            trendImpact={allFilteredTrends.find((t) => t.id === detailsOpenFor)?.impact || "Medium"}
            detailedResearch={
              allFilteredTrends.find((t) => t.id === detailsOpenFor)?.detailedResearch as NonNullable<
                Trend["detailedResearch"]
              >
            }
            sources={allFilteredTrends.find((t) => t.id === detailsOpenFor)?.sources || []}
          />
        )}

        {promptOpenFor && (
          <PrototypePromptModal
            open={!!promptOpenFor}
            onOpenChange={(o) => !o && setPromptOpenFor(null)}
            trendTitle={(() => {
              const selectedTrend = allFilteredTrends.find((t) => t.id === promptOpenFor)
              console.log("[TRENDS-SCREEN] PrototypePromptModal props:")
              console.log(`   - promptOpenFor: ${promptOpenFor}`)
              console.log(`   - selectedTrend found: ${!!selectedTrend}`)
              if (selectedTrend) {
                console.log(`   - selectedTrend.title: "${selectedTrend.title}"`)
                console.log(`   - selectedTrend.prototypePrompt exists: ${!!selectedTrend.prototypePrompt}`)
                console.log(`   - selectedTrend.prototypePrompt length: ${selectedTrend.prototypePrompt?.length || 0}`)
              }
              return selectedTrend?.title || "Trend"
            })()}
            prompt={(() => {
              const selectedTrend = allFilteredTrends.find((t) => t.id === promptOpenFor)
              const prompt = selectedTrend?.prototypePrompt || ""
              console.log(
                `[TRENDS-SCREEN] Final prompt being passed: "${prompt.substring(0, 100)}${prompt.length > 100 ? "..." : ""}"`,
              )
              return prompt
            })()}
            trendId={promptOpenFor} // Added trendId prop to connect trend to prototype
          />
        )}

        <div className="mt-8">
          <NewsSection />
        </div>
      </div>
    </div>
  )
}

export { TrendsScreen }
export default TrendsScreen
;(() => {
  if (typeof document !== "undefined" && !document.getElementById("progress-anim")) {
    const style = document.createElement("style")
    style.id = "progress-anim"
    style.innerHTML = `
      @keyframes progress {
        0% { transform: translateX(-100%); }
        100% { transform: translateX(300%); }
      }
      .animate-[progress_1.2s_linear_infinite] {
        animation: progress 1.2s linear infinite;
      }
    `
    document.head.appendChild(style)
  }
})()

"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Lightbulb,
  Calendar,
  Eye,
  Search,
  ArrowUpDown,
  ChevronLeft,
  ChevronRight,
  Zap,
  Loader2,
  AlertCircle,
  CheckCircle,
  FileText,
  TrendingUp,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { WebBrowserModal } from "@/components/web-browser-modal"
import { PrototypeViewAll } from "@/components/prototype-view-all"
import { V0ChatModal } from "@/components/v0-chat-modal"
import { createClient } from "@/lib/supabase"

interface Prototype {
  id: string
  title: string
  description: string
  category: string
  priority: "High" | "Medium" | "Low"
  status: "Generating" | "Ready" | "Failed" | "Archived"
  v0_url?: string
  v0_project_id?: string
  prompt: string
  created_at: string
  error_message?: string
  trends?: {
    title: string
    category: string
    impact: string
  }
}

type SortOption = "newest" | "priority-high" | "priority-low" | "category" | "status"

interface PrototypesScreenProps {
  onNavbarToggle?: (visible: boolean) => void
}

export function PrototypesScreen({ onNavbarToggle }: PrototypesScreenProps) {
  const [webBrowserUrl, setWebBrowserUrl] = useState<string | null>(null)
  const [firstName, setFirstName] = useState("Name here")
  const [showPrototypeGenerator, setShowPrototypeGenerator] = useState(false)
  const [showViewAll, setShowViewAll] = useState(false)
  const [targetMarket, setTargetMarket] = useState("")
  const [description, setDescription] = useState("")
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("newest")
  const [currentPage, setCurrentPage] = useState(1)
  const [prototypes, setPrototypes] = useState<Prototype[]>([])
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [processingTrends, setProcessingTrends] = useState<Set<string>>(new Set()) // Track trends being processed
  const [lastAutoCheckTime, setLastAutoCheckTime] = useState<number>(0) // Debounce auto-generation
  const [v0ChatModal, setV0ChatModal] = useState<{ isOpen: boolean; prototype: Prototype | null }>({
    isOpen: false,
    prototype: null,
  })
  const [isNavbarVisible, setIsNavbarVisible] = useState(true)
  const itemsPerPage = 3

  const handleNavbarToggle = () => {
    const newVisibility = !isNavbarVisible
    setIsNavbarVisible(newVisibility)
    onNavbarToggle?.(newVisibility)
  }

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        await fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "[PROTOTYPES-PROFILE] =================================",
            data: {},
          }),
        })

        await fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "[PROTOTYPES-PROFILE] FETCHING USER PROFILE FOR NAME",
            data: {},
          }),
        })

        await fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "[PROTOTYPES-PROFILE] =================================",
            data: {},
          }),
        })

        const supabase = createClient()

        await fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "[PROTOTYPES-PROFILE] Getting authenticated user...",
            data: {},
          }),
        })

        const {
          data: { user },
          error: authError,
        } = await supabase.auth.getUser()

        await fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "[PROTOTYPES-PROFILE] Auth result:",
            data: {
              hasUser: !!user,
              userId: user?.id,
              userEmail: user?.email,
              authError: authError?.message,
              authErrorCode: authError?.code,
            },
          }),
        })

        if (user) {
          await fetch("/api/debug", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: "[PROTOTYPES-PROFILE] Querying profiles table...",
              data: {
                queryUserId: user.id,
              },
            }),
          })

          const { data: profile, error: profileError } = await supabase
            .from("profiles")
            .select("first_name")
            .eq("id", user.id)
            .single()

          await fetch("/api/debug", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: "[PROTOTYPES-PROFILE] Profile query result:",
              data: {
                hasProfile: !!profile,
                firstName: profile?.first_name,
                profileError: profileError?.message,
                profileErrorCode: profileError?.code,
                rawProfileData: profile,
              },
            }),
          })

          if (profile?.first_name) {
            await fetch("/api/debug", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: "[PROTOTYPES-PROFILE] Setting firstName:",
                data: {
                  newFirstName: profile.first_name,
                  previousFirstName: firstName,
                },
              }),
            })
            setFirstName(profile.first_name)
          } else {
            await fetch("/api/debug", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: "[PROTOTYPES-PROFILE] No first_name found - keeping default:",
                data: {
                  profileFirstName: profile?.first_name,
                  defaultFirstName: firstName,
                  profileExists: !!profile,
                },
              }),
            })
          }
        } else {
          await fetch("/api/debug", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: "[PROTOTYPES-PROFILE] No authenticated user found",
              data: {
                authError: authError?.message,
              },
            }),
          })
        }
      } catch (error) {
        await fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "[PROTOTYPES-PROFILE] Error fetching user profile:",
            data: {
              errorMessage: error instanceof Error ? error.message : String(error),
              errorStack: error instanceof Error ? error.stack : undefined,
            },
          }),
        })
        console.error("Error fetching user profile:", error)
      }
    }

    fetchUserProfile()
  }, [])

  useEffect(() => {
    console.log("[PROTOTYPES-SCREEN] Component mounted - running initial effects")
    fetchPrototypes()
    // Also check for automatic trends that need prototype generation
    console.log("[PROTOTYPES-SCREEN] About to call checkAndGenerateFromAutoTrends...")
    checkAndGenerateFromAutoTrends()
  }, [])

  async function checkAndGenerateFromAutoTrends() {
    try {
      console.log("[PROTOTYPES-SCREEN] =================================")
      console.log("[PROTOTYPES-SCREEN] checkAndGenerateFromAutoTrends CALLED")
      console.log("[PROTOTYPES-SCREEN] =================================")

      // Debounce: only run once every 30 seconds to prevent rapid successive calls
      const now = Date.now()
      const DEBOUNCE_TIME = 30000 // 30 seconds

      console.log("[PROTOTYPES-SCREEN] Debounce check:", {
        now: now,
        lastAutoCheckTime: lastAutoCheckTime,
        timeSinceLastCheck: now - lastAutoCheckTime,
        debounceTime: DEBOUNCE_TIME,
        shouldSkip: now - lastAutoCheckTime < DEBOUNCE_TIME,
      })

      if (now - lastAutoCheckTime < DEBOUNCE_TIME) {
        console.log(
          "[PROTOTYPES-SCREEN] Skipping auto-check due to debounce, last check was",
          Math.round((now - lastAutoCheckTime) / 1000),
          "seconds ago",
        )
        console.log(
          "[PROTOTYPES-SCREEN] To test immediately, wait",
          Math.round((DEBOUNCE_TIME - (now - lastAutoCheckTime)) / 1000),
          "more seconds",
        )
        return
      }

      setLastAutoCheckTime(now)
      console.log("[PROTOTYPES-SCREEN] Checking for automatic trends that need prototypes...")
      const supabase = createClient()

      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        console.log("[PROTOTYPES-SCREEN] Not authenticated — skipping auto-trend prototype check")
        return
      }

      // CRITICAL: Check if auto-generate prototypes toggle is enabled
      console.log("[PROTOTYPES-SCREEN] Checking auto-generate prototypes toggle...")
      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("auto_generate_prototypes")
        .eq("id", user.id)
        .single()

      if (profileError) {
        console.error("[PROTOTYPES-SCREEN] Error checking toggle setting:", profileError)
        return
      }

      const isToggleEnabled = profile?.auto_generate_prototypes || false
      console.log("[PROTOTYPES-SCREEN] Toggle check result:", {
        toggleValue: profile?.auto_generate_prototypes,
        isEnabled: isToggleEnabled,
      })

      if (!isToggleEnabled) {
        console.log("[PROTOTYPES-SCREEN] BLOCKED - Auto-generate prototypes toggle is DISABLED")
        console.log("[PROTOTYPES-SCREEN] Skipping automatic prototype generation")
        return
      }

      console.log("[PROTOTYPES-SCREEN] Toggle check PASSED - proceeding with auto-generation")

      // Find automatic trends with a prototype_prompt that don't yet have a prototype record
      const { data: trends, error: trendsError } = await supabase
        .from("trends")
        .select("id,title,prototype_prompt,category,impact")
        .eq("user_id", user.id)
        .eq("generation_type", "automatic")
        .not("prototype_prompt", "is", null)

      if (trendsError) {
        console.error("📡 [PROTOTYPES-SCREEN] Failed to query trends:", trendsError)
        return
      }

      if (!trends || trends.length === 0) {
        console.log("[PROTOTYPES-SCREEN] No automatic trends found for prototype generation")
        return
      }

      for (const t of trends) {
        try {
          // Check if this trend is already being processed
          if (processingTrends.has(t.id)) {
            console.log("📡 [PROTOTYPES-SCREEN] Trend already being processed, skipping:", t.id)
            continue
          }

          // More robust check for existing prototypes - check for any status including "Generating"
          const { data: existingProtos, error: checkError } = await supabase
            .from("prototypes")
            .select("id, status")
            .eq("trend_id", t.id)
            .limit(5) // Check multiple in case of duplicates

          if (checkError) {
            console.error("[PROTOTYPES-SCREEN] Error checking existing prototypes for trend:", t.id, checkError)
            continue
          }

          if (existingProtos && existingProtos.length > 0) {
            console.log(
              "[PROTOTYPES-SCREEN] Prototype(s) already exist for trend:",
              t.id,
              "Count:",
              existingProtos.length,
            )
            // Log status of existing prototypes for debugging
            existingProtos.forEach((proto, idx) => {
              console.log(`   - Prototype ${idx + 1}: ${proto.id} (Status: ${proto.status})`)
            })
            continue
          }

          if (!t.prototype_prompt || t.prototype_prompt.trim() === "") {
            console.log("[PROTOTYPES-SCREEN] Trend has no prototype prompt, skipping:", t.id)
            continue
          }

          // Mark trend as being processed
          setProcessingTrends((prev) => new Set(prev).add(t.id))

          console.log("[PROTOTYPES-SCREEN] Initiating prototype generation for trend:", t.id, t.title)

          const {
            data: { session },
          } = await supabase.auth.getSession()

          const response = await fetch("/api/prototypes/generate", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${session?.access_token}`,
            },
            body: JSON.stringify({
              prompt: t.prototype_prompt,
              title: `${t.title} Prototype (Auto-Generated)`,
              description: `Auto-generated prototype based on trend: ${t.title}`,
              category: t.category || "Auto-Generated",
              priority: t.impact === "High" ? "High" : t.impact === "Low" ? "Low" : "Medium",
              trendId: t.id,
              userId: user.id,
            }),
          })

          if (response.ok) {
            const result = await response.json()
            console.log("[PROTOTYPES-SCREEN] Started prototype generation for trend:", t.id, result)
          } else {
            const text = await response.text()
            console.error("[PROTOTYPES-SCREEN] Failed to start prototype for trend:", t.id, text)
          }
        } catch (err) {
          console.error("[PROTOTYPES-SCREEN] Error processing trend for prototype generation:", t.id, err)
        } finally {
          // Remove trend from processing set regardless of success/failure
          setProcessingTrends((prev) => {
            const newSet = new Set(prev)
            newSet.delete(t.id)
            return newSet
          })
        }
      }
    } catch (err) {
      console.error("[PROTOTYPES-SCREEN] checkAndGenerateFromAutoTrends failed:", err)
    }
  }

  useEffect(() => {
    setCurrentPage(1)
  }, [searchQuery, sortBy])

  const fetchPrototypes = async () => {
    console.log("[PROTOTYPES-SCREEN] =================================")
    console.log("[PROTOTYPES-SCREEN] FETCHING PROTOTYPES")
    console.log("[PROTOTYPES-SCREEN] =================================")

    try {
      setLoading(true)

      // Handle authentication client-side like other screens
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        console.error("[PROTOTYPES-SCREEN] Authentication failed:", userError?.message)
        console.log("[PROTOTYPES-SCREEN] User not authenticated, redirecting or showing login")
        return
      }

      console.log("[PROTOTYPES-SCREEN] User authenticated:", user.id)

      // Get session for auth headers
      const {
        data: { session },
      } = await supabase.auth.getSession()

      console.log("[PROTOTYPES-SCREEN] Calling API with auth...")
      const response = await fetch("/api/prototypes/generate", {
        headers: {
          Authorization: `Bearer ${session?.access_token}`,
        },
      })

      console.log("[PROTOTYPES-SCREEN] API Response:")
      console.log(`   - status: ${response.status}`)
      console.log(`   - ok: ${response.ok}`)

      if (response.ok) {
        const data = await response.json()
        console.log(`[PROTOTYPES-SCREEN] Fetched ${data.prototypes?.length || 0} prototypes`)
        setPrototypes(data.prototypes || [])

        // Log prototype details for debugging
        if (data.prototypes && data.prototypes.length > 0) {
          console.log("[PROTOTYPES-SCREEN] Prototype details:")
          data.prototypes.forEach((proto: any, index: number) => {
            console.log(`   ${index + 1}. ${proto.title} - Status: ${proto.status} - URL: ${proto.v0_url || "None"}`)
          })
        }
      } else {
        const errorText = await response.text()
        console.error("[PROTOTYPES-SCREEN] API request failed:", errorText)
      }
    } catch (error) {
      console.error("[PROTOTYPES-SCREEN] =================================")
      console.error("[PROTOTYPES-SCREEN] FETCH PROTOTYPES FAILED")
      console.error("[PROTOTYPES-SCREEN] =================================")
      console.error("[PROTOTYPES-SCREEN] Error:", error)
    } finally {
      setLoading(false)
      console.log("✅ [PROTOTYPES-SCREEN] Fetch prototypes completed")
    }
  }

  const { filteredPrototypes, totalPages } = useMemo(() => {
    let filtered = [...prototypes]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (prototype) =>
          prototype.title.toLowerCase().includes(query) ||
          prototype.category.toLowerCase().includes(query) ||
          prototype.description.toLowerCase().includes(query),
      )
    }

    switch (sortBy) {
      case "newest":
        filtered = filtered.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
        break
      case "priority-high":
        filtered = filtered.sort((a, b) => {
          const priorityOrder = { High: 3, Medium: 2, Low: 1 }
          return priorityOrder[b.priority] - priorityOrder[a.priority]
        })
        break
      case "priority-low":
        filtered = filtered.sort((a, b) => {
          const priorityOrder = { High: 3, Medium: 2, Low: 1 }
          return priorityOrder[a.priority] - priorityOrder[b.priority]
        })
        break
      case "category":
        filtered = filtered.sort((a, b) => a.category.localeCompare(b.category))
        break
      case "status":
        filtered = filtered.sort((a, b) => a.status.localeCompare(b.status))
        break
    }

    const total = Math.ceil(filtered.length / itemsPerPage)
    return { filteredPrototypes: filtered, totalPages: total }
  }, [prototypes, searchQuery, sortBy])

  const paginatedPrototypes = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage
    return filteredPrototypes.slice(startIndex, startIndex + itemsPerPage)
  }, [filteredPrototypes, currentPage])

  const handleGeneratePrototype = async () => {
    console.log("[PROTOTYPES-SCREEN] Generate custom prototype clicked")

    if (!targetMarket.trim() || !description.trim()) {
      alert("Please fill in both target market and description")
      return
    }

    console.log("[PROTOTYPES-SCREEN] Getting client-side authentication...")

    // Handle authentication on client-side
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("[PROTOTYPES-SCREEN] Authentication failed:", userError?.message)
      alert("Authentication required. Please log in to generate prototypes.")
      return
    }

    console.log("[PROTOTYPES-SCREEN] User authenticated:", user.id)

    setGenerating(true)
    try {
      const prompt = `Create a modern web application for ${targetMarket}. ${description}. 

Requirements:
- Clean, professional design
- Mobile-responsive layout
- Modern UI components
- Functional user interface
- Philippine market context where applicable

Focus on creating a practical, usable prototype that demonstrates the core functionality.`

      console.log("[PROTOTYPES-SCREEN] Custom prompt created, length:", prompt.length)

      // Get the session token to pass to API
      const {
        data: { session },
      } = await supabase.auth.getSession()

      const response = await fetch("/api/prototypes/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${session?.access_token}`, // Pass auth token
        },
        body: JSON.stringify({
          prompt,
          title: `${targetMarket} Solution`,
          description,
          category: "Custom",
          priority: "Medium",
          userId: user.id, // Pass userId directly
        }),
      })

      console.log("[PROTOTYPES-SCREEN] API Response:", response.status, response.ok)

      if (response.ok) {
        const result = await response.json()
        console.log("[PROTOTYPES-SCREEN] Custom prototype generation started:", result)

        // Reset form and close modal
        setTargetMarket("")
        setDescription("")
        setShowPrototypeGenerator(false)

        // Refresh prototypes list
        fetchPrototypes()

        alert("Prototype generation started! Check back in a few moments.")
      } else {
        const errorData = await response.text()
        console.error("[PROTOTYPES-SCREEN] API request failed:", errorData)
        throw new Error(`Failed to start prototype generation: ${response.status}`)
      }
    } catch (error) {
      console.error("[PROTOTYPES-SCREEN] Custom prototype generation failed:", error)
      alert("Failed to start prototype generation. Please try again.")
    } finally {
      console.log("[PROTOTYPES-SCREEN] Custom prototype generation completed")
      setGenerating(false)
    }
  }

  const handleViewAll = () => {
    console.log("View All clicked")
    setShowViewAll(true)
  }

  const getCurrentDate = () => {
    const today = new Date()
    const options: Intl.DateTimeFormatOptions = {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    }
    return today.toLocaleDateString("en-US", options)
  }

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "text-red-600 border-red-200 bg-red-50"
      case "Medium":
        return "text-yellow-600 border-yellow-200 bg-yellow-50"
      case "Low":
        return "text-green-600 border-green-200 bg-green-50"
      default:
        return "text-gray-600 border-gray-200 bg-gray-50"
    }
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "Ready":
        return "text-green-600 border-green-200 bg-green-50"
      case "Generating":
        return "text-blue-600 border-blue-200 bg-blue-50"
      case "Failed":
        return "text-red-600 border-red-200 bg-red-50"
      default:
        return "text-gray-600 border-gray-200 bg-gray-50"
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "Ready":
        return <CheckCircle className="w-4 h-4" />
      case "Generating":
        return <Loader2 className="w-4 h-4 animate-spin" />
      case "Failed":
        return <AlertCircle className="w-4 h-4" />
      default:
        return null
    }
  }

  if (showViewAll) {
    return (
      <PrototypeViewAll
        prototypes={prototypes.map((p) => ({
          id: p.id,
          title: p.title,
          issue: p.description,
          reason: p.trends?.title || "Custom generated prototype",
          category: p.category,
          priority: p.priority,
          generatedAt: new Date(p.created_at).toLocaleDateString(),
          url: p.v0_url || "#",
          tags: [p.category],
          status: p.status,
          description: p.description,
        }))}
        onBack={() => setShowViewAll(false)}
      />
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="w-8 h-8 animate-spin mx-auto mb-4 text-red-600" />
          <p className="text-gray-600">Loading prototypes...</p>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="px-2 py-5 bg-white">
        <div className="h-16 flex items-center justify-center mb-4 relative">
          <img
            src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/thryve_nav_logo.svg"
            alt="thryve"
            className="h-12"
          />
        </div>
      </div>

  <div className="px-4 lg:pl-8 xl:pl-12 pb-8">
        <div className="mb-5 relative">
          <Card className="bg-gradient-to-br from-red-500 via-red-600 to-red-700 shadow-xl relative overflow-hidden border-0">
            <CardContent className="p-3 relative">
              <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 rounded-full -translate-y-16 translate-x-16"></div>
              <div className="absolute bottom-0 left-0 w-24 h-24 bg-white/5 rounded-full translate-y-12 -translate-x-12"></div>
              <div className="flex items-start justify-between relative z-10">
                <div className="flex-1 pr-2 sm:pr-4 pl-4 sm:pl-6 md:pl-8">
                  <div className="mb-1 sm:mb-2">
                    <div className="flex items-start sm:items-baseline justify-between mb-1 sm:mb-0.5 gap-2">
                      <h2 className="text-2xl sm:text-3xl font-bold text-white leading-tight">Hi there,</h2>
                      <div className="text-right">
                        <span className="block text-sm sm:text-lg font-bold text-yellow-200 leading-tight">
                          {prototypes.length} Prototypes
                        </span>
                        <span className="text-[10px] sm:text-sm text-white/80">Generated this week</span>
                      </div>
                    </div>
                    <div className="flex items-baseline justify-between mb-1 sm:mb-2">
                      <h3 className="text-4xl sm:text-5xl lg:text-6xl xl:text-7xl font-bold text-yellow-300 flex items-center gap-2 leading-none">
                        {firstName}!
                        <img
                          src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/welcome_hand_wave1.svg"
                          alt="Waving Hand"
                          className="w-6 h-6 sm:w-8 sm:h-8 text-yellow-600"
                        />
                      </h3>
                    </div>
                  </div>
                  <div className="bg-white/15 backdrop-blur-sm rounded-lg p-2.5 sm:p-3 lg:p-4 mb-2 bg-gradient-to-r from-white/15 to-transparent">
                    <p className="text-white/90 text-[11px] sm:text-sm lg:text-base xl:text-lg font-medium mb-0.5 sm:mb-1 lg:mb-2">Thryve is ready to deliver</p>
                    <p className="text-yellow-200 text-xs sm:text-sm lg:text-base xl:text-lg font-semibold">Market-Ready Solutions</p>
                  </div>
                  <div className="flex items-center gap-2 text-white/80 text-[10px] sm:text-xs lg:text-sm xl:text-base">
                    <Calendar className="w-3 h-3 text-yellow-300" />
                    <span>{getCurrentDate()}</span>
                  </div>
                </div>
              </div>
              <div className="absolute bottom-0 right-1 sm:-bottom-10 sm:-right-4 w-28 h-28 sm:w-60 sm:h-60 z-20 opacity-90 sm:opacity-85 pointer-events-none select-none hero-mascot">
                <img
                  src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/yve_prototype_hero.svg"
                  alt="Yve"
                  className="w-full h-full drop-shadow-lg"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="mb-4">
          <div className="flex gap-3">
            <Button
              onClick={() => setShowPrototypeGenerator(true)}
              className="flex-1 bg-red-600 hover:bg-red-700 text-white px-6 py-3 lg:py-5 xl:py-6 rounded-lg font-medium text-sm sm:text-base lg:text-lg xl:text-xl transition-all"
            >
              + Generate Prototype
            </Button>
            <Button
              onClick={handleViewAll}
              variant="outline"
              className="flex-1 border-gray-300 text-gray-700 px-6 py-3 lg:py-5 xl:py-6 rounded-lg font-medium text-sm sm:text-base lg:text-lg xl:text-xl hover:bg-gray-50 bg-transparent flex items-center gap-2 transition-all"
            >
              <Eye className="w-5 h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7" />
              View All
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg lg:text-2xl xl:text-3xl font-semibold text-gray-900 flex items-center gap-2 lg:ml-[5px]">
              Recent Prototypes
              <Zap className="w-5 h-5 lg:w-6 lg:h-6 xl:w-7 xl:h-7 text-[#E0000A]" />
            </h2>
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-auto h-8 border-none bg-transparent p-0">
                  <ArrowUpDown className={`w-4 h-4 ${sortBy !== "newest" ? "text-[#E0000A]" : "text-gray-400"}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="priority-high">High Priority First</SelectItem>
                  <SelectItem value="priority-low">Low Priority First</SelectItem>
                  <SelectItem value="category">By Category</SelectItem>
                  <SelectItem value="status">By Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="mb-4">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
              <Input
                placeholder="Search prototypes..."
                className="w-full rounded-lg pl-10"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
              />
            </div>
          </div>

          {searchQuery && (
            <div className="text-sm text-gray-600 mb-3">
              Found {filteredPrototypes.length} prototype{filteredPrototypes.length !== 1 ? "s" : ""} matching "
              {searchQuery}"
            </div>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedPrototypes.map((prototype) => (
            <Card key={prototype.id} className="shadow-sm hover:shadow-md transition-shadow duration-200">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg lg:text-xl xl:text-2xl font-semibold text-gray-900 mb-2">{prototype.title}</CardTitle>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={getPriorityColor(prototype.priority)}>
                        {prototype.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {prototype.category}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 max-w-20 truncate flex-shrink-0">{prototype.created_at}</span>
                </div>
              </CardHeader>

              <CardContent className="pt-0 flex flex-col h-full">
                <div className="flex-1 space-y-3">
                  {prototype.status === "Ready" && prototype.v0_url ? (
                    <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden relative">
                      <div className="aspect-video relative">
                        <iframe
                          src={prototype.v0_url}
                          className="w-full h-full border-0"
                          title="Prototype Preview"
                          sandbox="allow-scripts allow-same-origin"
                        />
                      </div>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <Button
                          size="icon"
                          onClick={() => setWebBrowserUrl(prototype.v0_url!)}
                          className="w-12 h-12 bg-black/70 hover:bg-black/80 text-white rounded-full"
                        >
                          <Lightbulb className="w-5 h-5" />
                        </Button>
                      </div>
                    </div>
                  ) : prototype.status === "Generating" ? (
                    <div className="mb-4 border border-gray-200 rounded-lg p-8 text-center bg-blue-50">
                      <Loader2 className="w-8 h-8 animate-spin mx-auto mb-2 text-blue-600" />
                      <p className="text-blue-600 font-medium">Generating prototype...</p>
                      <p className="text-sm text-gray-600">This may take a few minutes</p>
                    </div>
                  ) : prototype.status === "Failed" ? (
                    <div className="mb-4 border border-red-200 rounded-lg p-8 text-center bg-red-50">
                      <AlertCircle className="w-8 h-8 mx-auto mb-2 text-red-600" />
                      <p className="text-red-600 font-medium">Generation failed</p>
                      {prototype.error_message && (
                        <p className="text-sm text-gray-600 mt-1">{prototype.error_message}</p>
                      )}
                    </div>
                  ) : null}

                  <div className="flex items-start gap-2">
                    <Lightbulb className="w-4 h-4 text-[#7A1216] mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700">{prototype.description}</p>
                  </div>
                </div>

                {prototype.trends && (
                  <div className="flex items-start gap-2">
                  </div>
                )}

                <div className="flex items-center gap-2 pt-2 mt-auto">
                  {prototype.status === "Ready" && prototype.v0_url ? (
                    <>
                      <Button
                        onClick={() => {
                          console.log("View Prototype clicked for:", prototype.title, "URL:", prototype.v0_url)
                          setWebBrowserUrl(prototype.v0_url!)
                        }}
                        className="flex-1 bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 hover:border-gray-300"
                      >
                        <div className="w-2 h-2 bg-red-600 rounded-full mr-2"></div>
                        <Lightbulb className="w-4 h-4 mr-2" />
                        View Prototype
                      </Button>
                      {prototype.v0_project_id && (
                        <Button
                          onClick={() => setV0ChatModal({ isOpen: true, prototype })}
                          variant="outline"
                          className="flex-1 border-red-200 text-red-600 hover:bg-red-50 hover:text-red-700"
                        >
                          <div className="w-2 h-2 bg-yellow-500 rounded-full mr-2"></div>
                          <img
                            src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/ask_yve_dashboard.svg"
                            alt="Ask Yve"
                            className="w-4 h-4 mr-2"
                          />
                          Ask Yve
                        </Button>
                      )}
                    </>
                  ) : (
                    <Button disabled className="flex-1 bg-gray-300 text-gray-500 cursor-not-allowed">
                      <div className="w-2 h-2 bg-gray-400 rounded-full mr-2"></div>
                      <Lightbulb className="w-4 h-4 mr-2" />
                      {prototype.status === "Generating" ? "Generating..." : "Unavailable"}
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-4">
            <div className="text-sm text-gray-600">
              Showing {(currentPage - 1) * itemsPerPage + 1} to{" "}
              {Math.min(currentPage * itemsPerPage, filteredPrototypes.length)} of {filteredPrototypes.length}{" "}
              prototypes
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

      {showPrototypeGenerator && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b">
            <div className="flex items-center gap-3">
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPrototypeGenerator(false)}
                className="text-gray-600"
              >
                <ChevronLeft className="w-6 h-6" />
              </Button>
              <h1 className="text-xl font-semibold">Prototype Generator</h1>
            </div>
          </div>

          <div className="flex-1 p-4 pb-24 overflow-y-auto">
            <div className="max-w-md mx-auto space-y-6">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <div className="flex items-center gap-2 mb-2"></div>
                <p className="text-sm text-blue-700">
                  Generate functional prototypes. Describe your idea and get a working prototype in minutes.
                </p>
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Target Market</label>
                <Input
                  placeholder="e.g., Small business owners, Digital banking users"
                  value={targetMarket}
                  onChange={(e) => setTargetMarket(e.target.value)}
                  className="w-full"
                />
              </div>

              <div className="space-y-2">
                <label className="text-sm font-medium text-gray-900">Description</label>
                <Textarea
                  placeholder="Describe the prototype concept, features, and goals. Be specific about functionality and user experience."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full h-64 resize-none"
                />
              </div>

              <Button
                className="w-full bg-red-600 hover:bg-red-700 text-white py-3"
                onClick={handleGeneratePrototype}
                disabled={generating || !targetMarket.trim() || !description.trim()}
              >
                {generating ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Generating Prototype...
                  </>
                ) : (
                  <>
                    <Lightbulb className="w-4 h-4 mr-2" />
                    Generate with Yve
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}

      {webBrowserUrl && (
        <WebBrowserModal url={webBrowserUrl} onClose={() => setWebBrowserUrl(null)} fileName="Prototype Preview" />
      )}

      {v0ChatModal.isOpen && v0ChatModal.prototype && (
        <V0ChatModal
          isOpen={v0ChatModal.isOpen}
          onClose={() => setV0ChatModal({ isOpen: false, prototype: null })}
          prototype={v0ChatModal.prototype}
        />
      )}
    </div>
  )
}

export default PrototypesScreen

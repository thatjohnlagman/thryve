"use client"

import { useState, useEffect, useMemo } from "react"
import {
  Lightbulb,
  Calendar,
  Clock,
  Bell,
  User,
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
  const [firstName, setFirstName] = useState("Miggy")
  const [lastName, setLastName] = useState("Mango")
  const [currentDateStr, setCurrentDateStr] = useState("Wednesday, August 27, 2025")
  const [currentTimeStr, setCurrentTimeStr] = useState("9:41 A.M.")
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

  const displayName = useMemo(() => {
    const full = `${firstName} ${lastName}`.trim()
    if (full) return full
    if (firstName) return firstName
    return ""
  }, [firstName, lastName])

  const todayCount = useMemo(() => {
    const today = new Date().toDateString()
    return prototypes.filter((p) => {
      if (!p.created_at) return false
      try {
        return new Date(p.created_at).toDateString() === today
      } catch {
        return false
      }
    }).length
  }, [prototypes])

  const prototypeCount = todayCount > 0 ? todayCount : prototypes.length
  const prototypeLabel = todayCount > 0 ? "Generated today" : (prototypes.length > 0 ? "Generated this week" : "Generated today")

  useEffect(() => {
    const updateDateTime = () => {
      const now = new Date()
      setCurrentDateStr(
        now.toLocaleDateString("en-US", {
          weekday: "long",
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      )
      setCurrentTimeStr(
        now.toLocaleTimeString("en-US", {
          hour: "numeric",
          minute: "2-digit",
          hour12: true,
        })
      )
    }
    updateDateTime()
    const timer = setInterval(updateDateTime, 60000)
    return () => clearInterval(timer)
  }, [])

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
            .select("first_name, last_name")
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
                lastName: profile?.last_name,
                profileError: profileError?.message,
                profileErrorCode: profileError?.code,
                rawProfileData: profile,
              },
            }),
          })

          if (profile?.first_name) {
            setFirstName(profile.first_name)
            if (profile.last_name) {
              setLastName(profile.last_name)
            }
          } else if (user.user_metadata?.first_name || user.user_metadata?.name || user.user_metadata?.full_name) {
            const fullName = user.user_metadata.full_name || user.user_metadata.name || ""
            if (fullName) {
              const parts = fullName.trim().split(" ")
              setFirstName(parts[0])
              setLastName(parts.slice(1).join(" "))
            } else {
              setFirstName(user.user_metadata.first_name || "")
              setLastName(user.user_metadata.last_name || "")
            }
          } else if (user.email) {
            const prefix = user.email.split("@")[0]
            setFirstName(prefix.charAt(0).toUpperCase() + prefix.slice(1))
            setLastName("")
          }
        } else {
          // If no active auth session (e.g. dev auth bypass mode):
          // Query the profiles table for any available profile so local testing reflects real DB data
          const { data: profiles } = await supabase
            .from("profiles")
            .select("first_name, last_name")
            .order("created_at", { ascending: false })
            .limit(1)

          if (profiles && profiles.length > 0 && profiles[0].first_name) {
            setFirstName(profiles[0].first_name)
            setLastName(profiles[0].last_name || "")
          }
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
    checkAndGenerateFromAutoTrends()
  }, [])

  // Auto-refresh when any prototype is in 'Generating' status
  useEffect(() => {
    const hasGenerating = prototypes.some((p) => p.status === "Generating")
    if (!hasGenerating) return

    const interval = setInterval(() => {
      fetchPrototypes(true)
    }, 3500)

    return () => clearInterval(interval)
  }, [prototypes])

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

  const fetchPrototypes = async (silent = false) => {
    try {
      if (!silent) setLoading(true)

      const supabase = createClient()
      let userId: string | null = null
      let accessToken: string | undefined = undefined

      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (user) userId = user.id

        const {
          data: { session },
        } = await supabase.auth.getSession()
        accessToken = session?.access_token
      } catch {}

      const headers: Record<string, string> = {}
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`
      }

      const url = userId ? `/api/prototypes/generate?userId=${userId}` : "/api/prototypes/generate"
      const response = await fetch(url, {
        headers,
        cache: "no-store",
      })

      if (response.ok) {
        const data = await response.json()
        setPrototypes(data.prototypes || [])
      } else {
        const errorText = await response.text()
        console.error("[PROTOTYPES-SCREEN] API request failed:", errorText)
      }
    } catch (error) {
      console.error("[PROTOTYPES-SCREEN] Fetch prototypes error:", error)
    } finally {
      if (!silent) setLoading(false)
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
    if (!targetMarket.trim() || !description.trim()) {
      alert("Please fill in both target market and description")
      return
    }

    const supabase = createClient()
    let userId: string | null = null
    let accessToken: string | undefined = undefined

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) userId = user.id

      const {
        data: { session },
      } = await supabase.auth.getSession()
      accessToken = session?.access_token
    } catch {}

    setGenerating(true)
    try {
      const prompt = `Create a modern web application for ${targetMarket}. ${description}. 

Requirements:
- Clean, professional design with rich aesthetics
- Mobile-responsive layout and desktop adaptation
- Modern UI components with genuine interactivity (clickable buttons, view switching)
- Realistic mock data and intuitive user flows

Focus on creating an impressive, practical, usable prototype that demonstrates core functionality.`

      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      }
      if (accessToken) {
        headers["Authorization"] = `Bearer ${accessToken}`
      }

      const response = await fetch("/api/prototypes/generate", {
        method: "POST",
        headers,
        body: JSON.stringify({
          prompt,
          title: `${targetMarket} Solution`,
          description,
          category: "Custom",
          priority: "Medium",
          userId: userId,
        }),
      })

      if (response.ok) {
        setTargetMarket("")
        setDescription("")
        setShowPrototypeGenerator(false)
        fetchPrototypes()
        alert("Prototype generation started! It will appear on your screen in a moment.")
      } else {
        const errorData = await response.text()
        console.error("[PROTOTYPES-SCREEN] API request failed:", errorData)
        throw new Error(`Failed to start prototype generation: ${response.status}`)
      }
    } catch (error) {
      console.error("[PROTOTYPES-SCREEN] Custom prototype generation failed:", error)
      alert("Failed to start prototype generation. Please try again.")
    } finally {
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
    <div className="min-h-screen bg-[#FDFDFD] relative overflow-x-hidden">
      {/* Decorative Brand Geometric Accents */}
      <div className="absolute inset-x-0 top-0 h-96 pointer-events-none select-none overflow-hidden z-0">
        {/* Left of logo: red & yellow chevron */}
        <div className="absolute top-4 sm:top-5 left-1/2 -translate-x-[160px] sm:-translate-x-[185px]">
          <svg width="48" height="34" viewBox="0 0 48 34" fill="none">
            <polygon points="34,0 0,17 34,34" fill="#FF0000" />
            <polygon points="30,5 10,17 30,29" fill="#FFE500" />
          </svg>
        </div>

        {/* Top-right above logo: yellow chevron with red tip */}
        <div className="absolute top-2 sm:top-3 left-1/2 translate-x-[75px] sm:translate-x-[95px]">
          <svg width="52" height="36" viewBox="0 0 52 36" fill="none">
            <polygon points="0,2 38,18 0,34" fill="#FFE500" />
            <polygon points="38,2 50,18 38,34" fill="#FF0000" />
          </svg>
        </div>

        {/* Far-left edge: yellow chevron and red triangle */}
        <div className="absolute top-24 -left-1">
          <svg width="30" height="54" viewBox="0 0 30 54" fill="none">
            <polygon points="0,0 26,18 0,34" fill="#FFE500" />
            <polygon points="0,24 20,38 0,52" fill="#FF0000" />
          </svg>
        </div>

        {/* Far-right edge: red triangle pointing inward */}
        <div className="absolute top-28 -right-1">
          <svg width="24" height="44" viewBox="0 0 24 44" fill="none">
            <polygon points="24,0 2,22 24,44" fill="#FF0000" />
          </svg>
        </div>
      </div>

      {/* Top Header Bar */}
      <div className="relative z-10 px-4 sm:px-6 lg:px-10 pt-4 pb-2 flex items-center justify-between">
        {/* Left spacer for centering logo */}
        <div className="w-20 sm:w-24"></div>

        {/* Centered Logo */}
        <div className="flex-1 flex justify-center items-center">
          <img
            src="/assets/Thryve_1st.svg"
            alt="thryve"
            className="h-10 sm:h-12 w-auto object-contain"
          />
        </div>

        {/* Right Action Icons: Notification Bell & Profile Avatar */}
        <div className="w-20 sm:w-24 flex items-center justify-end gap-2.5 sm:gap-3">
          <button
            type="button"
            className="p-1.5 sm:p-2 text-slate-900 hover:text-red-600 hover:bg-slate-100 rounded-full transition-colors relative"
            aria-label="Notifications"
          >
            <Bell className="w-5 h-5 sm:w-6 sm:h-6 stroke-[2]" />
          </button>
          <button
            type="button"
            className="p-0.5 text-slate-900 hover:ring-2 hover:ring-red-400 rounded-full transition-all"
            aria-label="User Profile"
          >
            <div className="w-8 h-8 sm:w-9 sm:h-9 rounded-full border-2 border-slate-900 flex items-center justify-center bg-transparent">
              <User className="w-4 h-4 sm:w-5 sm:h-5 text-slate-900 stroke-[2.2]" />
            </div>
          </button>
        </div>
      </div>

      <div className="px-4 lg:pl-8 xl:pl-12 pb-8 relative z-10">
        {/* Hero Welcome Card */}
        <div className="mb-6 relative">
          <div className="bg-white rounded-[26px] sm:rounded-[32px] p-5 sm:p-7 md:p-8 shadow-[0_20px_50px_rgba(0,0,0,0.12),0_4px_12px_rgba(0,0,0,0.05)] border border-slate-100/90 relative">
            <div className="flex items-start justify-between gap-4">
              {/* Left Info Column */}
              <div className="flex-1 min-w-0 pr-2">
                <p className="text-slate-600 font-bold text-lg sm:text-xl lg:text-2xl tracking-tight leading-none mb-1">
                  Welcome
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  <h1 className="text-2xl sm:text-3xl md:text-4xl lg:text-[40px] font-black text-slate-900 tracking-tight leading-tight">
                    {displayName ? `${displayName}!` : "there!"}
                  </h1>
                  <img
                    src="/assets/hand-wave.svg"
                    alt="Waving Hand"
                    className="w-6 h-6 sm:w-8 sm:h-8 flex-shrink-0 animate-bounce duration-1000"
                  />
                </div>

                {/* Subtitles */}
                <div className="mt-2.5 sm:mt-3.5 space-y-1">
                  <p className="text-[#475569] font-bold text-xs sm:text-sm md:text-base leading-snug">
                    Thryve is ready to deliver Market-Ready Solutions.
                  </p>
                  <p className="text-[#64748b] font-medium text-[11px] sm:text-xs md:text-sm leading-snug">
                    AI detected opportunity in mobile payment workflows in 5 minutes
                  </p>
                </div>

                {/* Date & Time Row */}
                <div className="flex flex-wrap items-center gap-3 sm:gap-4 mt-3 sm:mt-4 text-[11px] sm:text-xs md:text-sm font-semibold text-[#8ea2b8]">
                  <div className="flex items-center gap-1.5">
                    <Calendar className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8ea2b8] flex-shrink-0" />
                    <span>{currentDateStr}</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Clock className="w-3.5 h-3.5 sm:w-4 sm:h-4 text-[#8ea2b8] flex-shrink-0" />
                    <span>{currentTimeStr}</span>
                  </div>
                </div>
              </div>

              {/* Right Column: Generated Stat */}
              <div className="text-right flex-shrink-0 pt-0.5">
                <span className="block text-xs sm:text-sm font-semibold text-[#8ea2b8]">
                  {prototypeLabel}
                </span>
                <span className="block text-xl sm:text-2xl md:text-3xl font-black text-[#85181b] leading-tight mt-0.5">
                  {prototypeCount} {prototypeCount === 1 ? "Prototype" : "Prototypes"}
                </span>
              </div>
            </div>

            {/* Mascot badge overlapping bottom right - whole round Yve */}
            <div className="absolute -bottom-5 right-2 sm:-bottom-6 sm:right-4 w-16 h-16 sm:w-20 sm:h-20 md:w-24 md:h-24 z-20 pointer-events-none select-none drop-shadow-lg -rotate-[6deg]">
              <img
                src="/assets/yve_splash_smile_1.svg"
                alt="Yve Mascot"
                className="w-full h-full object-contain"
              />
            </div>
          </div>
        </div>

        {/* Action Buttons */}
        <div className="mb-6">
          <div className="flex gap-3">
            <Button
              onClick={() => setShowPrototypeGenerator(true)}
              className="flex-1 bg-gradient-to-r from-red-600 to-red-700 hover:from-red-700 hover:to-red-800 text-white shadow-sm px-6 py-3 lg:py-5 xl:py-6 rounded-xl font-semibold text-sm sm:text-base lg:text-lg transition-all"
            >
              + Generate Prototype
            </Button>
            <Button
              onClick={handleViewAll}
              variant="outline"
              className="flex-1 border-slate-200 text-slate-700 px-6 py-3 lg:py-5 xl:py-6 rounded-xl font-semibold text-sm sm:text-base lg:text-lg hover:bg-slate-50 bg-white flex items-center justify-center gap-2 transition-all shadow-sm"
            >
              <Eye className="w-5 h-5" />
              View All
            </Button>
          </div>
        </div>

        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl sm:text-2xl lg:text-3xl font-bold text-slate-900 flex items-center gap-2">
              Recent Action
              <Zap className="w-5 h-5 lg:w-6 lg:h-6 text-[#E0000A]" />
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

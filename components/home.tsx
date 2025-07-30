"use client"

import { useState, useEffect, useRef } from "react"
import { BottomNavigation } from "@/components/bottom-navigation"
import { PrototypesScreen } from "@/components/screens/prototypes-screen"
import { TrendsScreen } from "@/components/screens/trends-screen"
import { UtilitiesScreen } from "@/components/screens/utilities-screen"
import { AIChatScreen } from "@/components/screens/ai-chat-screen"
import { SplashScreen } from "@/components/splash-screen"
import { TeamsScreen } from "@/components/screens/teams-screen"
import LoginScreen from "@/components/auth/login-screen"
import RegisterScreen from "@/components/auth/register-screen"
import { ForgotPasswordScreen } from "@/components/auth/forgot-password-screen"
import { supabase } from "@/lib/supabase"
import { User } from "lucide-react"
import { ProfileScreen } from "@/components/screens/profile-screen"
// Profile lives in sidebar on desktop; restored dedicated button/modal on mobile
import { OnboardingScreen } from "@/components/onboarding-screen"

type AuthState = "login" | "register" | "forgot-password" | "authenticated" | "loading"

interface DebugInfo {
  authState: AuthState
  userId: string | null
  email: string | null
  authError: string | null
  trendsCount: number
  timestamp: string
}

async function checkCurrentWeekTrends() {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    // Get start of current week (Monday)
    const now = new Date()
    const startOfWeek = new Date(now)
    startOfWeek.setDate(now.getDate() - now.getDay() + 1) // Monday
    startOfWeek.setHours(0, 0, 0, 0)

    const { data, error } = await supabase
      .from("trends")
      .select("*")
      .eq("user_id", user.id)
      .eq("generation_type", "automatic") // Only count automatic trends
      .gte("created_at", startOfWeek.toISOString())
      .order("created_at", { ascending: false })

    if (error) throw error

    return (data || []).map((item) => ({
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
      createdAt: new Date(item.created_at).getTime(),
    }))
  } catch (error) {
    console.error("[App] Failed to load current week trends:", error)
    return []
  }
}

function shouldRefreshTrends(currentWeekTrends: any[]): boolean {
  return currentWeekTrends.length < 3
}

async function getAllExistingTrendTitles(): Promise<string[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase.from("trends").select("title").eq("user_id", user.id)

    if (error) throw error

    return (data || []).map((item) => item.title)
  } catch (error) {
    console.error("[App] Failed to load existing trend titles:", error)
    return []
  }
}

export default function Home() {
  const [activeTab, setActiveTab] = useState("prototypes")
  const [showSplash, setShowSplash] = useState(true)
  const [showOnboarding, setShowOnboarding] = useState(false)
  const [showAuthFade, setShowAuthFade] = useState(false)
  const [authState, setAuthState] = useState<AuthState>("loading")
  const [showProfileModal, setShowProfileModal] = useState(false)
  const [globalTrends, setGlobalTrends] = useState<any[]>([])
  const screenContainerRef = useRef<HTMLDivElement>(null)
  const [debugInfo, setDebugInfo] = useState<DebugInfo>({
    authState: "loading",
    userId: null,
    email: null,
    authError: null,
    trendsCount: 0,
    timestamp: new Date().toISOString(),
  })

  useEffect(() => {
    const handleSwitchToAIChat = () => {
      setActiveTab("ai-chat")

      // Smooth scroll to chat area after tab switch
      setTimeout(() => {
        const chatContainer = document.querySelector("[data-chat-container]")
        if (chatContainer) {
          chatContainer.scrollIntoView({
            behavior: "smooth",
            block: "start",
          })
        }
      }, 100)
    }

    window.addEventListener("switch-to-ai-chat", handleSwitchToAIChat)

    return () => {
      window.removeEventListener("switch-to-ai-chat", handleSwitchToAIChat)
    }
  }, [])

  useEffect(() => {
    const checkAuthSession = async () => {
      try {
        console.log("Checking auth session...")
        const {
          data: { session },
          error,
        } = await supabase.auth.getSession()

        if (error) {
          console.error("Session check error:", error)
          setDebugInfo((prev) => ({
            ...prev,
            authState: "login",
            authError: `Session check error: ${error.message}`,
            timestamp: new Date().toISOString(),
          }))
          setAuthState("login")
          return
        }

        if (session && session.user) {
          console.log("Found existing session for user:", session.user.email)
          setDebugInfo((prev) => ({
            ...prev,
            authState: "authenticated",
            userId: session.user.id,
            email: session.user.email || null,
            authError: null,
            timestamp: new Date().toISOString(),
          }))
          setAuthState("authenticated")
        } else {
          console.log("No existing session found")
          setDebugInfo((prev) => ({
            ...prev,
            authState: "login",
            userId: null,
            email: null,
            authError: "Auth session missing!",
            timestamp: new Date().toISOString(),
          }))
          setAuthState("login")
        }
      } catch (error) {
        console.error("Session initialization error:", error)
        setDebugInfo((prev) => ({
          ...prev,
          authState: "login",
          authError: `Session init error: ${error instanceof Error ? error.message : "Unknown error"}`,
          timestamp: new Date().toISOString(),
        }))
        setAuthState("login")
      }
    }

    checkAuthSession()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      console.log("Auth state changed:", event, session?.user?.email)

      if (event === "SIGNED_IN" && session) {
        setDebugInfo((prev) => ({
          ...prev,
          authState: "authenticated",
          userId: session.user.id,
          email: session.user.email || null,
          authError: null,
          timestamp: new Date().toISOString(),
        }))
        setAuthState("authenticated")
      } else if (event === "SIGNED_OUT") {
        setDebugInfo((prev) => ({
          ...prev,
          authState: "login",
          userId: null,
          email: null,
          authError: "User signed out",
          timestamp: new Date().toISOString(),
        }))
        setAuthState("login")
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  useEffect(() => {
    if (authState !== "authenticated") return

    const initializeTrends = async () => {
      try {
        console.log("[App] User authenticated, loading trends...")

        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        // Load all existing trends first
        const { data: allTrends, error } = await supabase
          .from("trends")
          .select("*")
          .eq("user_id", user.id)
          .order("created_at", { ascending: false })

        if (error) throw error

        const trends = (allTrends || []).map((item) => ({
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
          createdAt: new Date(item.created_at).getTime(),
        }))

        setGlobalTrends(trends)
        setDebugInfo((prev) => ({
          ...prev,
          trendsCount: trends.length,
          timestamp: new Date().toISOString(),
        }))
        console.log("[App] Loaded", trends.length, "existing trends")

        const currentWeekAutomaticTrends = await checkCurrentWeekTrends()
        console.log("[App] Current week automatic trends:", currentWeekAutomaticTrends.length)

        if (trends.length === 0) {
          console.log("[App] No existing trends found, bootstrapping initial trends...")
          await bootstrapNewTrends([])
        } else if (shouldRefreshTrends(currentWeekAutomaticTrends)) {
          console.log(
            "[App] Only",
            currentWeekAutomaticTrends.length,
            "automatic trends this week (need 3), bootstrapping new trends...",
          )
          await bootstrapNewTrends(trends.map((t) => t.title))
        } else {
          console.log(
            "[App] Found",
            currentWeekAutomaticTrends.length,
            "automatic trends this week, no bootstrap needed",
          )
        }
      } catch (error) {
        console.error("[App] Error initializing trends:", error)
      }
    }

    const bootstrapNewTrends = async (existingTitles: string[]) => {
      try {
        console.log("[App] Starting bootstrap with", existingTitles.length, "existing titles")
        const response = await fetch("/api/research", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            bootstrap: true,
            mode: "seeds",
            existingTrends: existingTitles,
            count: 3, // Explicitly request 3 trends
          }),
        })

        if (!response.ok) {
          const errorText = await response.text()
          console.error("[App] Bootstrap API error:", response.status, errorText)
          throw new Error(`Bootstrap failed: ${response.status} - ${errorText}`)
        }

        const result = await response.json()
        console.log("[App] Bootstrap request completed successfully:", {
          hasSeeds: !!result.seeds,
          seedsCount: result.seeds?.length || 0,
          generationType: result.generationType,
        })
      } catch (error) {
        console.error("[App] Bootstrap failed:", error)
      }
    }

    initializeTrends()
  }, [authState])

  useEffect(() => {
    const resetAllScrollPositions = () => {
      // Reset main screen container
      if (screenContainerRef.current) {
        screenContainerRef.current.scrollTop = 0
      }

      // Reset window/document scroll position
      window.scrollTo(0, 0)
      document.documentElement.scrollTop = 0
      document.body.scrollTop = 0

      // Reset any other potential scroll containers
      const scrollableElements = document.querySelectorAll("[data-chat-container], .overflow-y-auto, .overflow-auto")
      scrollableElements.forEach((element) => {
        if (element instanceof HTMLElement) {
          element.scrollTop = 0
        }
      })
    }

    // Immediate reset
    resetAllScrollPositions()

    // Delayed reset to handle any async rendering
    const timeoutId = setTimeout(resetAllScrollPositions, 50)

    return () => clearTimeout(timeoutId)
  }, [activeTab])

  const renderAuthScreen = () => {
    switch (authState) {
      case "login":
        return (
          <LoginScreen
            onLogin={() => setAuthState("authenticated")}
            onSwitchToRegister={() => setAuthState("register")}
            onForgotPassword={() => setAuthState("forgot-password")}
          />
        )
      case "register":
        return (
          <RegisterScreen
            onRegister={() => setAuthState("authenticated")}
            onSwitchToLogin={() => setAuthState("login")}
          />
        )
      case "forgot-password":
        return <ForgotPasswordScreen onBackToLogin={() => setAuthState("login")} />
      default:
        return null
    }
  }

  const renderScreen = () => {
    switch (activeTab) {
      case "prototypes":
        return <PrototypesScreen />
      case "trends":
        return <TrendsScreen trends={globalTrends} onTrendsUpdated={refreshGlobalTrends} />
      case "utilities":
        return <UtilitiesScreen />
      case "ai-chat":
        return <AIChatScreen />
      case "teams":
        return <TeamsScreen />
      case "profile":
        return <ProfileScreen />
      default:
        return <PrototypesScreen />
    }
  }

  const refreshGlobalTrends = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data: allTrends, error } = await supabase
        .from("trends")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      const trends = (allTrends || []).map((item) => ({
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
        createdAt: new Date(item.created_at).getTime(),
      }))

      setGlobalTrends(trends)
      console.log("[App] Refreshed global trends:", trends.length)
    } catch (error) {
      console.error("[App] Failed to refresh global trends:", error)
    }
  }

  const handleSplashComplete = () => {
    setShowSplash(false)
    setShowOnboarding(true)
  }

  const handleOnboardingComplete = () => {
    setShowAuthFade(true)
    setTimeout(() => {
      setShowOnboarding(false)
      setShowAuthFade(false)
    }, 300)
  }

  const handleOnboardingSkip = () => {
    setShowAuthFade(true)
    setTimeout(() => {
      setShowOnboarding(false)
      setShowAuthFade(false)
    }, 300)
  }

  if (authState === "loading") {
    return (
      <div className="min-h-screen bg-gray-50 flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#7A1216] mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    )
  }

  if (showSplash) {
    return <SplashScreen onComplete={handleSplashComplete} />
  }

  if (showOnboarding) {
    return (
      <div className={showAuthFade ? "animate-fade-out" : ""}>
        <OnboardingScreen onComplete={handleOnboardingComplete} onSkip={handleOnboardingSkip} />
      </div>
    )
  }

  if (authState !== "authenticated") {
    return <div className="animate-fade-in">{renderAuthScreen()}</div>
  }

  return (
  <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="lg:flex lg:min-h-screen">
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />

    <div className="lg:flex-1 flex-1 relative lg:ml-64">{/* shift content right by sidebar width on desktop */}
          {/* Mobile profile button (hidden on lg) */}
          <div className="absolute top-3 right-4 z-30 lg:hidden">
            <button
              onClick={() => setShowProfileModal(true)}
              className="p-2 rounded-full bg-white/90 backdrop-blur-sm border border-gray-200 shadow-sm hover:bg-white hover:shadow-md transition-all duration-200"
            >
              <User size={20} className="text-gray-700" />
            </button>
          </div>

          <div
            ref={screenContainerRef}
            className="lg:min-h-screen lg:bg-white lg:p-6 h-screen overflow-y-auto"
            style={{ scrollBehavior: "auto" }}
          >
            {renderScreen()}
          </div>
        </div>
      </div>

      <div className="lg:hidden">
        <BottomNavigation activeTab={activeTab} onTabChange={setActiveTab} />
      </div>

      {/* Mobile Profile Modal */}
      {showProfileModal && (
        <>
          <div
            className="fixed inset-0 z-40 bg-black/30 backdrop-blur-sm animate-fade-in"
            onClick={() => setShowProfileModal(false)}
          />
          <div className="fixed inset-y-0 right-0 w-full max-w-sm bg-white z-50 shadow-xl flex flex-col animate-slide-in-right">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-red-50 to-rose-50">
              <h2 className="text-lg font-semibold text-gray-800">Profile</h2>
              <button
                onClick={() => setShowProfileModal(false)}
                className="p-2 rounded-full hover:bg-white transition-colors"
              >
                <svg className="w-5 h-5 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <ProfileScreen />
            </div>
          </div>
        </>
      )}
    </div>
  )
}

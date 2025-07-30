"use client"

import { TrendingUp, BarChart3, MessageCircle, Users, Sparkles, User } from "lucide-react"
import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

interface BottomNavigationProps {
  activeTab: string
  onTabChange: (tab: string) => void
}

export function BottomNavigation({ activeTab, onTabChange }: BottomNavigationProps) {
  // Desktop sidebar now always visible & fixed; no collapsible state.

  const tabs = [
    { id: "utilities", label: "Analysis", icon: BarChart3 },
    { id: "trends", label: "Trends", icon: TrendingUp },
    { id: "prototypes", label: "Prototypes", icon: Sparkles, isCenter: true },
    { id: "ai-chat", label: "Chat Yve", icon: MessageCircle, isYve: true },
  { id: "teams", label: "Workspaces", icon: Users },
  ]

  const handleTabChange = (tabId: string) => {
    // Add navigation class to prevent smooth scrolling during reset
    document.documentElement.classList.add("navigating")

    // Immediate scroll reset
    window.scrollTo(0, 0)
    document.documentElement.scrollTop = 0
    document.body.scrollTop = 0

    // Call the parent handler - always navigate even if same tab
    onTabChange(tabId)

    // Remove navigation class after a short delay
    setTimeout(() => {
      document.documentElement.classList.remove("navigating")
    }, 100)
  }

  return (
    <>
  <div className={`lg:fixed lg:top-0 lg:left-0 lg:h-screen lg:w-64 xl:w-72 lg:bg-white lg:shadow-xl lg:border-r lg:border-gray-200 lg:flex lg:flex-col lg:px-6 lg:py-8 lg:z-50 lg:overflow-y-auto fixed bottom-0 left-0 w-full bg-white shadow-[0_-2px_8px_rgba(0,0,0,0.05)] border-t border-gray-200 z-50`}>
        <div className="hidden lg:block lg:mb-8 lg:pt-4">
          <img
            src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/thryve_splash.svg"
            alt="Thryve Logo"
            className="w-32 h-auto mx-auto"
          />
        </div>
  <div className="lg:flex lg:flex-col lg:flex-1 lg:space-y-2 lg:justify-start lg:items-stretch lg:py-0 lg:px-0 flex justify-around items-end py-2 px-4 flex-1">
          {tabs.map((tab) => {
              const Icon = tab.icon
              const isActive = activeTab === tab.id

              if (tab.isCenter) {
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className="lg:relative lg:flex lg:flex-row lg:items-center lg:justify-start lg:w-full lg:p-4 xl:p-5 lg:rounded-lg lg:bg-white lg:shadow-lg lg:mt-0 lg:mb-0 relative flex flex-col items-center -mt-3 transition-all"
                  >
                    <div
                      className={`lg:w-10 lg:h-10 xl:w-12 xl:h-12 lg:mr-3 lg:p-0 lg:bg-white lg:rounded-full relative w-14 h-14 sm:w-16 sm:h-16 rounded-full shadow-lg mb-1 ${
                        isActive ? "bg-gradient-to-r from-yellow-500 to-red-500 p-[2px]" : "bg-gray-300 p-[2px]"
                      } transition-all`}
                    >
                      <div className="lg:w-full lg:h-full w-full h-full rounded-full bg-white flex items-center justify-center">
                        <Icon className={`w-5 h-5 sm:w-6 sm:h-6 lg:w-6 lg:h-6 xl:w-7 xl:h-7 ${isActive ? "text-red-600" : "text-gray-500"}`} />
                      </div>
                    </div>
                    <span
                      className={`text-[10px] xs:text-[11px] sm:text-xs md:text-sm lg:text-base xl:text-lg ${
                        isActive ? "text-red-600 font-semibold" : "text-gray-500 font-medium"
                      }`}
                    >
                      {tab.label}
                    </span>
                  </button>
                )
              }

              if (tab.isYve) {
                return (
                  <button
                    key={tab.id}
                    onClick={() => handleTabChange(tab.id)}
                    className={`lg:flex lg:flex-row lg:items-center lg:justify-start lg:w-full lg:p-4 xl:p-5 lg:rounded-lg lg:transition-all lg:duration-200 flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 ${
                      isActive
                        ? "lg:bg-red-50 lg:border-red-200 lg:border text-red-600"
                        : "lg:hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                    }`}
                  >
                    <img
                      src={
                        isActive
                          ? "https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/yve_navbar_highlighted.svg"
                          : "https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/yve_navbar_no_highlight.svg"
                      }
                      alt="Chat Yve"
                      className="lg:w-6 lg:h-6 xl:w-7 xl:h-7 lg:mr-3 lg:mb-0 w-6 h-6 mb-1"
                    />
                    <span className={`text-[10px] xs:text-[11px] sm:text-xs md:text-sm lg:text-base xl:text-lg font-medium ${isActive ? "text-red-600" : "text-gray-500"}`}>
                      {tab.label}
                    </span>
                  </button>
                )
              }

              return (
                <button
                  key={tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={`lg:flex lg:flex-row lg:items-center lg:justify-start lg:w-full lg:p-4 xl:p-5 lg:rounded-lg lg:transition-all lg:duration-200 flex flex-col items-center py-2 px-3 rounded-lg transition-all duration-200 ${
                    isActive
                      ? "lg:bg-red-50 lg:border-red-200 lg:border text-red-600"
                      : "lg:hover:bg-gray-50 text-gray-500 hover:text-gray-700"
                  }`}
                >
                  <Icon className="w-5 h-5 sm:w-6 sm:h-6 lg:w-6 lg:h-6 xl:w-7 xl:h-7 lg:mr-3 lg:mb-0 mb-1" />
                  <span className="text-[10px] xs:text-[11px] sm:text-xs md:text-sm lg:text-base xl:text-lg font-medium">{tab.label}</span>
                </button>
              )
            })}
          {/* Profile tab (desktop) */}
          <div className="hidden lg:block mt-auto pt-4 border-t border-gray-200">
            <button
              onClick={() => handleTabChange("profile")}
              className={`w-full flex items-center gap-3 p-3 xl:p-4 rounded-lg transition-colors text-left ${
                activeTab === "profile" ? "bg-red-50 border border-red-200" : "hover:bg-gray-50"
              }`}
            >
              <div className="w-10 h-10 xl:w-12 xl:h-12 rounded-full bg-red-600 text-white flex items-center justify-center">
                <User className="w-5 h-5 xl:w-6 xl:h-6" />
              </div>
              <div className="flex flex-col items-start">
                <ProfileName />
                <span className="text-[10px] sm:text-xs lg:text-[13px] xl:text-sm text-gray-500">View your account</span>
              </div>
            </button>
          </div>
        </div>
      </div>
    </>
  )
}

function ProfileName() {
  const [firstName, setFirstName] = useState<string | null>(null)

  useEffect(() => {
    let isMounted = true
    const load = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser()
        if (!user) return
        const { data, error } = await supabase
          .from("profiles")
          .select("first_name")
          .eq("id", user.id)
          .single()
        if (!error && isMounted) {
          setFirstName(data?.first_name || null)
        }
      } catch (e) {
        // silent fail
      }
    }
    load()
    return () => { isMounted = false }
  }, [])

  return (
    <span className="font-medium text-gray-800 text-sm lg:text-base xl:text-lg leading-tight">
      {firstName || "Profile"}
    </span>
  )
}

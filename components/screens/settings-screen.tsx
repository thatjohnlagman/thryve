"use client"

import { useState, useEffect } from "react"
import { Bell, Lightbulb, Palette, User, Shield, HelpCircle, LogOut, ChevronRight, Zap } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { createClient } from "@/lib/supabase"

export function SettingsScreen() {
  const [autoGeneration, setAutoGeneration] = useState(true)
  const [dailyPrototypes, setDailyPrototypes] = useState([10])
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [autoGeneratePrototypes, setAutoGeneratePrototypes] = useState(false)

  useEffect(() => {
    loadUserSettings()
  }, [])

  const loadUserSettings = async () => {
    try {
      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        console.error("[Settings] No user found:", userError?.message)
        return
      }

      const { data: profile, error: profileError } = await supabase
        .from("profiles")
        .select("auto_generate_prototypes")
        .eq("id", user.id)
        .single()

      if (profileError) {
        console.error("[Settings] Error loading profile:", profileError)
        return
      }

      if (profile) {
        setAutoGeneratePrototypes(profile.auto_generate_prototypes || false)
        console.log("[Settings] Loaded auto-generate prototypes setting:", profile.auto_generate_prototypes)
      }
    } catch (error) {
      console.error("[Settings] Error loading user settings:", error)
    }
  }

  const handleAutoGeneratePrototypesChange = async (enabled: boolean) => {
    try {
      setAutoGeneratePrototypes(enabled)

      const supabase = createClient()
      const {
        data: { user },
        error: userError,
      } = await supabase.auth.getUser()

      if (userError || !user) {
        console.error("[Settings] No user found for saving setting:", userError?.message)
        return
      }

      const { error: updateError } = await supabase
        .from("profiles")
        .update({ auto_generate_prototypes: enabled })
        .eq("id", user.id)

      if (updateError) {
        console.error("[Settings] Error saving auto-generate prototypes setting:", updateError)
        setAutoGeneratePrototypes(!enabled)
      } else {
        console.log("[Settings] Successfully saved auto-generate prototypes setting:", enabled)
      }
    } catch (error) {
      console.error("[Settings] Error updating auto-generate prototypes setting:", error)
      setAutoGeneratePrototypes(!enabled)
    }
  }

  const settingsGroups = [
    {
      title: "Prototype Generation",
      items: [
        {
          icon: <Lightbulb className="w-5 h-5" />,
          label: "Auto-generate prototypes",
          description: "Automatically create new prototypes daily",
          type: "toggle",
          value: autoGeneration,
          onChange: setAutoGeneration,
        },
        {
          icon: <Zap className="w-5 h-5" />,
          label: "Auto-generate from trends",
          description: "Automatically create prototypes when new trends are discovered",
          type: "toggle",
          value: autoGeneratePrototypes,
          onChange: handleAutoGeneratePrototypesChange,
        },
        {
          icon: <Lightbulb className="w-5 h-5" />,
          label: "Daily prototype limit",
          description: `Generate up to ${dailyPrototypes[0]} prototypes per day`,
          type: "slider",
          value: dailyPrototypes,
          onChange: setDailyPrototypes,
          min: 1,
          max: 20,
        },
      ],
    },
    {
      title: "Preferences",
      items: [
        {
          icon: <Bell className="w-5 h-5" />,
          label: "Push notifications",
          description: "Get notified about new trends and prototypes",
          type: "toggle",
          value: notifications,
          onChange: setNotifications,
        },
        {
          icon: <Palette className="w-5 h-5" />,
          label: "Dark mode",
          description: "Switch to dark theme",
          type: "toggle",
          value: darkMode,
          onChange: setDarkMode,
        },
      ],
    },
    {
      title: "Account",
      items: [
        {
          icon: <User className="w-5 h-5" />,
          label: "Profile settings",
          description: "Manage your account information",
          type: "navigation",
        },
        {
          icon: <Shield className="w-5 h-5" />,
          label: "Privacy & security",
          description: "Control your data and security settings",
          type: "navigation",
        },
      ],
    },
    {
      title: "Support",
      items: [
        {
          icon: <HelpCircle className="w-5 h-5" />,
          label: "Help & feedback",
          description: "Get help or send us feedback",
          type: "navigation",
        },
      ],
    },
  ]

  return (
    <div className="p-4 space-y-6">
      {/* Header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#7A1216] mb-2">Settings</h1>
        <p className="text-sm text-gray-600">Customize your BPI Innovate experience</p>
      </div>

      {/* User Profile Card */}
      <Card className="bg-gradient-to-r from-[#7A1216] to-red-800 text-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">John Doe</h3>
              <p className="text-sm opacity-90">Product Manager</p>
              <p className="text-xs opacity-75">john.doe@bpi.com.ph</p>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Settings Groups */}
      {settingsGroups.map((group) => (
        <div key={group.title} className="space-y-3">
          <h2 className="text-lg font-semibold text-gray-900">{group.title}</h2>

          <Card>
            <CardContent className="p-0">
              {group.items.map((item, index) => (
                <div
                  key={item.label}
                  className={`p-4 ${index !== group.items.length - 1 ? "border-b border-gray-100" : ""}`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3 flex-1">
                      <div className="text-[#7A1216]">{item.icon}</div>
                      <div className="flex-1">
                        <p className="font-medium text-gray-900">{item.label}</p>
                        <p className="text-sm text-gray-600">{item.description}</p>
                      </div>
                    </div>

                    <div className="flex items-center">
                      {item.type === "toggle" && (
                        <Switch checked={item.value as boolean} onCheckedChange={item.onChange} />
                      )}

                      {item.type === "navigation" && <ChevronRight className="w-5 h-5 text-gray-400" />}
                    </div>
                  </div>

                  {item.type === "slider" && (
                    <div className="mt-4 px-8">
                      <Slider
                        value={item.value as number[]}
                        onValueChange={item.onChange}
                        min={item.min}
                        max={item.max}
                        step={1}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>{item.min}</span>
                        <span>{item.max}</span>
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}

      {/* Sign Out */}
      <Card className="border-red-200">
        <CardContent className="p-4">
          <Button variant="ghost" className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50">
            <LogOut className="w-5 h-5 mr-3" />
            Sign out
          </Button>
        </CardContent>
      </Card>

      {/* App Version */}
      <div className="text-center text-xs text-gray-500 pb-4">BPI Innovate v1.0.0</div>
    </div>
  )
}

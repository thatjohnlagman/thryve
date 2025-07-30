"use client"

import { useState, useEffect } from "react"
import type { ReactNode } from "react"
import { Bell, Lightbulb, Palette, User, Shield, HelpCircle, LogOut, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Switch } from "@/components/ui/switch"
import { Slider } from "@/components/ui/slider"
import { supabase } from "@/lib/supabase"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"

export function ProfileScreen() {
  const [autoGeneration, setAutoGeneration] = useState(false)
  const [dailyPrototypes, setDailyPrototypes] = useState([10])
  const [notifications, setNotifications] = useState(true)
  const [darkMode, setDarkMode] = useState(false)
  const [userProfile, setUserProfile] = useState<{
    first_name: string | null
    last_name: string | null
    auto_generate_prototypes: boolean | null
  } | null>(null)
  const [showConfirmDialog, setShowConfirmDialog] = useState(false)

  useEffect(() => {
    const fetchUserProfile = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser()
        if (!user) return

        const { data: profile, error } = await supabase
          .from("profiles")
          .select("first_name, last_name, auto_generate_prototypes")
          .eq("id", user.id)
          .single()

        if (error) {
          console.error("Error fetching profile:", error)
          return
        }

        setUserProfile(profile)
        setAutoGeneration(profile?.auto_generate_prototypes || false)
      } catch (error) {
        console.error("Error fetching user profile:", error)
      }
    }

    fetchUserProfile()
  }, [])

  const handleAutoGenerationToggle = (checked: boolean) => {
    console.log("[PROFILE-SCREEN] Toggle clicked:", {
      newValue: checked,
      oldValue: autoGeneration,
      willShowDialog: checked,
      timestamp: new Date().toISOString()
    })
    
    if (checked) {
      console.log("[PROFILE-SCREEN] Enabling toggle - showing confirmation dialog")
      setShowConfirmDialog(true)
    } else {
      console.log("[PROFILE-SCREEN] Disabling toggle - updating immediately")
      updateAutoGenerationSetting(false)
    }
  }

  const updateAutoGenerationSetting = async (enabled: boolean) => {
    try {
      console.log("[PROFILE-SCREEN] =================================")
      console.log("auto-gen option is here")
      console.log("[PROFILE-SCREEN] =================================")
      console.log("[PROFILE-SCREEN] Setting details:", {
        newValue: enabled,
        timestamp: new Date().toISOString()
      })

      const {
        data: { user },
      } = await supabase.auth.getUser()
      
      console.log("[PROFILE-SCREEN] Auth check:", {
        hasUser: !!user,
        userId: user?.id,
        userEmail: user?.email
      })
      
      if (!user) {
        console.error("[PROFILE-SCREEN] No user found for settings update")
        return
      }

      console.log("[PROFILE-SCREEN] Updating database...")
      const { error } = await supabase.from("profiles").update({ auto_generate_prototypes: enabled }).eq("id", user.id)

      console.log("[PROFILE-SCREEN] Database update result:", {
        hasError: !!error,
        errorMessage: error?.message,
        errorCode: error?.code,
        success: !error
      })

      if (error) {
        console.error("[PROFILE-SCREEN] Error updating auto-generation setting:", error)
        return
      }

      setAutoGeneration(enabled)
      console.log("[PROFILE-SCREEN] Successfully updated setting:", {
        oldValue: autoGeneration,
        newValue: enabled,
        stateUpdated: true
      })
      console.log(`Auto-generate prototypes ${enabled ? "enabled" : "disabled"}`)
    } catch (error) {
      console.error("[PROFILE-SCREEN] Error updating auto-generation setting:", error)
    }
  }

  const handleConfirmEnable = () => {
    updateAutoGenerationSetting(true)
    setShowConfirmDialog(false)
  }

  const handleSignOut = async () => {
    try {
      const { error } = await supabase.auth.signOut()
      if (error) {
        console.error("Sign out error:", error)
      }
      // The auth state change listener in the main app will handle the UI update
    } catch (error) {
      console.error("Sign out failed:", error)
    }
  }

  // Discriminated union types for settings items
  type ToggleItem = { icon: ReactNode; label: string; description: string; type: "toggle"; value: boolean; onChange: (checked: boolean) => void }
  type SliderItem = { icon: ReactNode; label: string; description: string; type: "slider"; value: number[]; onChange: (value: number[]) => void; min: number; max: number }
  type NavigationItem = { icon: ReactNode; label: string; description: string; type: "navigation" }
  type SettingItem = ToggleItem | SliderItem | NavigationItem
  interface SettingsGroup { title: string; items: SettingItem[] }

  const settingsGroups: SettingsGroup[] = [
    {
      title: "Prototype Generation",
      items: [
        {
          icon: <Lightbulb className="w-5 h-5" />,
          label: "Auto-generate from trends",
          description: "Automatically create prototypes when new trends are discovered",
          type: "toggle",
          value: autoGeneration,
          onChange: handleAutoGenerationToggle,
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
    <div className="p-4 space-y-6 lg:pl-8 lg:pr-8 xl:pl-12 xl:pr-12">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#7A1216] mb-2">Profile</h1>
        <p className="text-sm text-gray-600">Manage your account and preferences</p>
      </div>

      <Card className="bg-[#FF000F] text-white">
        <CardContent className="p-4">
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 bg-white/20 rounded-full flex items-center justify-center">
              <User className="w-8 h-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold">
                {userProfile?.first_name && userProfile?.last_name
                  ? `${userProfile.first_name} ${userProfile.last_name}`
                  : "Loading..."}
              </h3>
            </div>
          </div>
        </CardContent>
      </Card>

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
                        <div className="flex items-center gap-2">
                          <Switch
                            checked={item.value as boolean}
                            onCheckedChange={(checked) => {
                              console.log(`Switch toggled: ${checked}`)
                              item.onChange(checked)
                            }}
                            className="data-[state=checked]:bg-[#7A1216] data-[state=unchecked]:bg-gray-300"
                          />
                          <span className="text-xs text-gray-500 ml-1">{item.value ? "ON" : "OFF"}</span>
                        </div>
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

      <Card className="border-red-200">
        <CardContent className="p-4">
          <Button
            variant="ghost"
            className="w-full justify-start text-red-600 hover:text-red-700 hover:bg-red-50"
            onClick={handleSignOut}
          >
            <LogOut className="w-5 h-5 mr-3" />
            Sign out
          </Button>
        </CardContent>
      </Card>

      <div className="text-center text-xs text-gray-500 pb-4">BPI Innovate v1.0.0</div>

      <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Enable Auto-Generate Prototypes?</DialogTitle>
            <DialogDescription>
              This will automatically generate prototypes whenever new trends are discovered automatically by the
              system. This feature uses AI resources and may generate multiple prototypes per day.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex gap-2">
            <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
              No
            </Button>
            <Button onClick={handleConfirmEnable} className="bg-[#7A1216] hover:bg-[#5A0E11]">
              Yes, Enable
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

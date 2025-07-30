"use client"

import type React from "react"
import { useState, useRef, useEffect, useMemo } from "react"
import { FileSpreadsheet, BarChart3, RefreshCw, Search, ArrowUpDown } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Select, SelectContent, SelectItem, SelectTrigger } from "@/components/ui/select"
import { Input } from "@/components/ui/input"
import { DashboardBrowserModal } from "@/components/dashboard-browser-modal"
import { supabase } from "@/lib/supabase"

interface UploadedFile {
  id: string
  name: string
  size: string
  uploadedAt: string
  charts: number
  status: "processing" | "ready" | "error" | "generating-dashboard" | "expired"
  csvData?: string // Keep for backward compatibility
  dashboardUrl?: string
  dashboardExpiresAt?: string
  isExpired?: boolean
  fileLink?: string // New field for Supabase storage
  generatedCode?: string // Store generated code
  hasVersions?: boolean
  currentVersion?: number
  totalVersions?: number
}

type SortOption = "newest" | "oldest" | "name" | "size" | "status"

export function UtilitiesScreen() {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null)
  const [dashboardFileName, setDashboardFileName] = useState<string>("")
  const [clickedAskYve, setClickedAskYve] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [showVersionHistory, setShowVersionHistory] = useState<string | null>(null)
  const [versions, setVersions] = useState<any[]>([])
  const [redeployingFiles, setRedeployingFiles] = useState<Set<string>>(new Set())
  const [searchQuery, setSearchQuery] = useState("")
  const [sortBy, setSortBy] = useState<SortOption>("newest")
  const [deployingVersions, setDeployingVersions] = useState<Set<string>>(new Set())

  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    loadExistingUtilities()

    // Handle view dashboard request from AI chat
    const handleViewDashboard = async () => {
      const utilityId = sessionStorage.getItem("view-utility-dashboard")
      if (utilityId) {
        sessionStorage.removeItem("view-utility-dashboard")

        // Find the utility
        const utility = uploadedFiles.find((file) => file.id === utilityId)
        if (utility) {
          // If dashboard exists and is not expired, show it
          if (utility.dashboardUrl && !utility.isExpired) {
            // Ensure the URL is properly formatted as an absolute URL
            let cleanUrl = utility.dashboardUrl
            if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
              cleanUrl = `https://${cleanUrl}`
            }
            setDashboardUrl(cleanUrl)
            setDashboardFileName(utility.name)
          }
          // If utility has generated code but no dashboard or expired dashboard, deploy it
          else if (utility.generatedCode) {
            console.log("[Utilities] Deploying updated dashboard for:", utility.name)
            await handleRedeployDashboard(utility)
          } else {
            console.log("[Utilities] Utility has no code to deploy:", utilityId)
          }
        } else {
          console.log("[Utilities] Utility not found:", utilityId)
        }
      }
    }

    // Check immediately and also listen for the custom event
    handleViewDashboard()
    const eventHandler = () => handleViewDashboard()
    window.addEventListener("switch-to-utilities", eventHandler)

    return () => {
      window.removeEventListener("switch-to-utilities", eventHandler)
    }
  }, [uploadedFiles]) // Add uploadedFiles as dependency so it works when data loads

  const loadExistingUtilities = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      const { data, error } = await supabase
        .from("utilities")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false })

      if (error) throw error

      const utilities = await Promise.all(
        (data || []).map(async (item) => {
          const { data: versionData } = await supabase
            .from("utility_versions")
            .select("version_number")
            .eq("utility_id", item.id)
            .order("version_number", { ascending: false })

          return {
            id: item.id,
            name: item.file_name,
            size: item.file_size,
            uploadedAt: getRelativeTime(new Date(item.created_at)),
            charts: item.charts_count || 0,
            status: isDashboardExpired(item) ? ("expired" as const) : item.status,
            dashboardUrl: item.dashboard_url,
            dashboardExpiresAt: item.dashboard_expires_at,
            isExpired: isDashboardExpired(item),
            fileLink: item.file_link,
            generatedCode: item.generated_code,
            hasVersions: (versionData?.length || 0) > 0,
            totalVersions: versionData?.length || 0,
            currentVersion: versionData?.[0]?.version_number || 1,
          }
        }),
      )

      setUploadedFiles(utilities)
    } catch (error) {
      console.error("Error loading utilities:", error)
    } finally {
      setLoading(false)
    }
  }

  const getRelativeTime = (date: Date): string => {
    const now = new Date()
    const diffMs = now.getTime() - date.getTime()
    const diffMinutes = Math.floor(diffMs / (1000 * 60))
    const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))

    if (diffMinutes < 1) return "Just now"
    if (diffMinutes < 60) return `${diffMinutes} minutes ago`
    if (diffHours < 24) return `${diffHours} hours ago`
    return `${diffDays} days ago`
  }

  const isDashboardExpired = (item: any): boolean => {
    if (!item.dashboard_expires_at) return false
    return new Date(item.dashboard_expires_at) < new Date()
  }

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    console.log("File selected:", file.name, file.size)

    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) throw new Error("User not authenticated")

      const fileExt = file.name.split(".").pop()?.toLowerCase()
      const fileName = `${user.id}/${Date.now()}-${file.name}`

      const { data: uploadData, error: uploadError } = await supabase.storage
        .from("utilities-files")
        .upload(fileName, file)

      if (uploadError) throw uploadError

      const { data: utilityData, error: dbError } = await supabase
        .from("utilities")
        .insert({
          user_id: user.id,
          file_name: file.name,
          file_size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
          file_type: fileExt || "csv",
          file_link: uploadData.path,
          status: "processing",
        })
        .select()
        .single()

      if (dbError) throw dbError

      const newFile: UploadedFile = {
        id: utilityData.id,
        name: file.name,
        size: `${(file.size / 1024 / 1024).toFixed(1)} MB`,
        uploadedAt: "Just now",
        charts: 0,
        status: "processing",
        fileLink: uploadData.path,
      }

      setUploadedFiles((prev) => [newFile, ...prev])
      console.log("File uploaded to storage, starting dashboard generation...")

      // Read file content for dashboard generation
      const reader = new FileReader()
      reader.onload = async (e) => {
        const csvData = e.target?.result as string
        await generateDashboard(utilityData.id, csvData, file.name)
      }
      reader.readAsText(file)
    } catch (error) {
      console.error("Error uploading file:", error)
    }

    if (event.target) {
      event.target.value = ""
    }
  }

  const generateDashboard = async (utilityId: string, csvData: string, fileName: string) => {
    try {
      await supabase.from("utilities").update({ status: "generating-dashboard" }).eq("id", utilityId)

      setUploadedFiles((prev) => prev.map((f) => (f.id === utilityId ? { ...f, status: "generating-dashboard" } : f)))

      const cacheKey = `dashboard_code_${fileName}_${csvData.length}`
      const cachedCode = sessionStorage.getItem(cacheKey)

      const response = await fetch("/api/generate-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utilityId: utilityId,
          fileName: fileName,
          generatedCode: cachedCode,
        }),
      })

      const result = await response.json()

      if (result.success && result.dashboardUrl) {
        if (result.generatedCode && !cachedCode) {
          sessionStorage.setItem(cacheKey, result.generatedCode)
        }

        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour to match E2B sandbox

        await supabase
          .from("utilities")
          .update({
            status: "ready",
            dashboard_url: result.dashboardUrl,
            sandbox_id: result.sandboxId,
            charts_count: Math.floor(Math.random() * 5) + 3,
            dashboard_expires_at: expiresAt,
            generated_code: result.generatedCode || cachedCode,
            cache_key: cacheKey,
          })
          .eq("id", utilityId)

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === utilityId
              ? {
                  ...f,
                  status: "ready",
                  charts: Math.floor(Math.random() * 5) + 3,
                  dashboardUrl: result.dashboardUrl,
                  dashboardExpiresAt: expiresAt,
                  isExpired: false,
                  generatedCode: result.generatedCode || cachedCode,
                }
              : f,
          ),
        )
      } else if (result.canRetry && result.generatedCode) {
        console.log("GitHub Models succeeded but E2B deployment failed, showing redeploy option")

        await supabase
          .from("utilities")
          .update({
            status: "error",
            error_message: "E2B deployment failed - code generated successfully",
            generated_code: result.generatedCode,
          })
          .eq("id", utilityId)

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === utilityId
              ? {
                  ...f,
                  status: "error",
                  generatedCode: result.generatedCode,
                }
              : f,
          ),
        )
      } else {
        if (!response.ok) {
          throw new Error(`API Error ${response.status}`)
        }
        throw new Error(result.error || "Dashboard generation failed")
      }
    } catch (error) {
      console.error("Error during dashboard generation:", error)

      await supabase
        .from("utilities")
        .update({
          status: "error",
          error_message: error instanceof Error ? error.message : "Unknown error",
        })
        .eq("id", utilityId)

      setUploadedFiles((prev) => prev.map((f) => (f.id === utilityId ? { ...f, status: "error" } : f)))
    }
  }

  const handleViewDashboard = (file: UploadedFile) => {
    if (file.dashboardUrl) {
      console.log("Opening existing dashboard:", file.dashboardUrl)
      
      // Ensure the URL is properly formatted as an absolute URL
      let cleanUrl = file.dashboardUrl
      
      // If the URL doesn't start with http:// or https://, add https://
      if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
        cleanUrl = `https://${cleanUrl}`
      }
      
      console.log("Cleaned dashboard URL:", cleanUrl)
      setDashboardUrl(cleanUrl)
      setDashboardFileName(file.name)
    } else {
      console.error("No dashboard URL available for file:", file.name)
    }
  }

  const handleChooseFileClick = () => {
    console.log("Choose file button clicked")
    fileInputRef.current?.click()
  }

  const getStatusColor = (status: string) => {
    switch (status) {
      case "ready":
        return "bg-green-100 text-green-800 border-green-200"
      case "processing":
        return "bg-yellow-100 text-yellow-800 border-yellow-200"
      case "error":
        return "bg-red-100 text-red-800 border-red-200"
      case "generating-dashboard":
        return "bg-blue-100 text-blue-800 border-blue-200"
      case "expired":
        return "bg-gray-100 text-gray-800 border-gray-200"
      default:
        return "bg-gray-100 text-gray-800 border-gray-200"
    }
  }

  const isDashboardExpiredCheck = (file: UploadedFile): boolean => {
    if (!file.dashboardExpiresAt) return false
    return new Date(file.dashboardExpiresAt) < new Date()
  }

  const handleRedeployDashboard = async (file: UploadedFile) => {
    if (!file.fileLink && !file.generatedCode) {
      console.error("No file link or generated code available for redeployment")
      return
    }

    console.log("Redeploying dashboard for:", file.name)

    setRedeployingFiles((prev) => new Set(prev).add(file.id))

    try {
      await supabase.from("utilities").update({ status: "generating-dashboard" }).eq("id", file.id)

      setUploadedFiles((prev) => prev.map((f) => (f.id === file.id ? { ...f, status: "generating-dashboard" } : f)))

      const cachedCode = file.generatedCode || sessionStorage.getItem(`dashboard_code_${file.name}`)

      const response = await fetch("/api/generate-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          utilityId: file.id,
          fileName: file.name,
          generatedCode: cachedCode,
          isRedeployment: true, // Flag to indicate this is a redeployment
        }),
      })

      const result = await response.json()

      if (result.success && result.dashboardUrl) {
        const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString() // 1 hour

        await supabase
          .from("utilities")
          .update({
            status: "ready",
            dashboard_url: result.dashboardUrl,
            sandbox_id: result.sandboxId,
            dashboard_expires_at: expiresAt,
            error_message: null, // Clear any previous error messages
          })
          .eq("id", file.id)

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: "ready",
                  dashboardUrl: result.dashboardUrl,
                  dashboardExpiresAt: expiresAt,
                  isExpired: false,
                }
              : f,
          ),
        )

        // Ensure the URL is properly formatted before setting state
        let cleanUrl = result.dashboardUrl
        if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
          cleanUrl = `https://${cleanUrl}`
        }
        setDashboardUrl(cleanUrl)
        setDashboardFileName(file.name)
      } else if (result.canRetry) {
        console.log("E2B deployment still failing, keeping redeploy option available")

        await supabase
          .from("utilities")
          .update({
            status: "error",
            error_message: "E2B deployment failed - code available for retry",
          })
          .eq("id", file.id)

        setUploadedFiles((prev) =>
          prev.map((f) =>
            f.id === file.id
              ? {
                  ...f,
                  status: "error",
                  generatedCode: result.generatedCode || cachedCode,
                }
              : f,
          ),
        )
      } else {
        if (!response.ok) {
          throw new Error(`API Error ${response.status}`)
        }
        throw new Error(result.error || "Dashboard redeployment failed")
      }
    } catch (error) {
      console.error("Error during dashboard redeployment:", error)

      await supabase
        .from("utilities")
        .update({
          status: file.status === "expired" ? "expired" : "error", // Preserve expired status if redeployment fails
          error_message: error instanceof Error ? error.message : "Redeployment failed",
        })
        .eq("id", file.id)

      setUploadedFiles((prev) =>
        prev.map((f) => (f.id === file.id ? { ...f, status: file.status === "expired" ? "expired" : "error" } : f)),
      )
    } finally {
      setRedeployingFiles((prev) => {
        const newSet = new Set(prev)
        newSet.delete(file.id)
        return newSet
      })
    }
  }

  const handleAskYve = (file: UploadedFile) => {
    console.log("Ask Yve clicked for utility:", file.name)

    // Set context for AI chat with generated code
    sessionStorage.setItem(
      "ai-chat-context",
      JSON.stringify({
        type: "utility",
        id: file.id,
        title: file.name,
        file_name: file.name,
        file_size: file.size,
        status: file.status,
        charts_count: file.charts,
        dashboard_url: file.dashboardUrl,
        has_code: !!file.generatedCode,
        generated_code: file.generatedCode, // Include the actual code for AI analysis
      }),
    )

    // Trigger navigation to AI chat
    window.dispatchEvent(new CustomEvent("switch-to-ai-chat"))
  }

  const loadVersionHistory = async (utilityId: string) => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user) return

      // Get the main utility data (this is v1)
      const { data: utilityData, error: utilityError } = await supabase
        .from("utilities")
        .select("*")
        .eq("id", utilityId)
        .eq("user_id", user.id)
        .single()

      if (utilityError) throw utilityError

      // Get additional versions (v2 and above)
      const { data: versionData, error: versionError } = await supabase.rpc("get_utility_versions", {
        utility_uuid: utilityId,
        user_uuid: user.id,
      })

      if (versionError) throw versionError

      // Combine the data: main utility is v1, then additional versions
      const allVersions = []

      // Add the main utility as v1
      if (utilityData) {
        allVersions.push({
          id: utilityData.id, // Use utility ID for main version
          version_number: 1,
          version_description: "Initial version",
          generated_code: utilityData.generated_code,
          dashboard_url: utilityData.dashboard_url,
          sandbox_id: utilityData.sandbox_id,
          dashboard_expires_at: utilityData.dashboard_expires_at,
          is_deployed: utilityData.status === 'ready' && !!utilityData.dashboard_url, // Check if utility is deployed
          created_at: utilityData.created_at,
          deployed_at: utilityData.dashboard_expires_at ? utilityData.created_at : null,
          relative_time: new Date(utilityData.created_at).toLocaleDateString(),
          is_main_version: true // Flag to identify this is from utilities table
        })
      }

      // Add additional versions (v2+)
      if (versionData && versionData.length > 0) {
        allVersions.push(
          ...versionData.map((v: any) => ({
            ...v,
            is_main_version: false,
          }))
        )
      }

      // Sort by version number (descending)
      allVersions.sort((a, b) => b.version_number - a.version_number)

      setVersions(allVersions)
      setShowVersionHistory(utilityId)
    } catch (error) {
      console.error("Error loading version history:", error)
    }
  }

  const deploySpecificVersion = async (utilityId: string, versionId: string) => {
    try {
      setDeployingVersions(prev => new Set(prev).add(versionId))
      
      // Check if this is the main version (v1) by checking if versionId equals utilityId
      const isMainVersion = versionId === utilityId
      
      let response
      if (isMainVersion) {
        // For main version (v1), deploy using the main utility code
        const utility = uploadedFiles.find(f => f.id === utilityId)
        if (!utility || !utility.generatedCode) {
          throw new Error("No code found for main version")
        }
        
        response = await fetch("/api/generate-dashboard", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            utilityId: utilityId,
            fileName: utility.name,
            generatedCode: utility.generatedCode,
            isRedeployment: true,
          }),
        })
      } else {
        // For additional versions (v2+), get the version data first
        const versionData = versions.find(v => v.id === versionId)
        const utility = uploadedFiles.find(f => f.id === utilityId)
        
        if (!versionData || !utility) {
          throw new Error("Version or utility data not found")
        }
        
        response = await fetch("/api/ai-chat/utilities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "deploy_version",
            utility_id: utilityId,
            version_id: versionId,
            versionData: versionData,
            utilityData: { file_name: utility.name }
          }),
        })
      }

      const result = await response.json()

      if (result.success) {
        // If this is a version deployment (not main), handle database updates
        if (!isMainVersion && result.dashboardUrl) {
          // Calculate expiration time (1 hour from now)
          const expiresAt = new Date(Date.now() + 60 * 60 * 1000).toISOString()

          // Update database with client-side authentication
          // Mark all versions as not deployed first
          await supabase
            .from("utility_versions")
            .update({
              is_deployed: false,
              dashboard_url: null,
              sandbox_id: null,
              dashboard_expires_at: null,
            })
            .eq("utility_id", utilityId)

          // Mark this specific version as deployed
          await supabase
            .from("utility_versions")
            .update({
              is_deployed: true,
              dashboard_url: result.dashboardUrl,
              sandbox_id: result.sandboxId,
              deployed_at: new Date().toISOString(),
              dashboard_expires_at: expiresAt,
            })
            .eq("id", versionId)

          // Also update the main utilities table
          await supabase
            .from("utilities")
            .update({
              status: "ready",
              dashboard_url: result.dashboardUrl,
              sandbox_id: result.sandboxId,
              dashboard_expires_at: expiresAt,
              error_message: null,
            })
            .eq("id", utilityId)
        }
        
        await loadExistingUtilities()
        // Reload version history to update deployment status
        await loadVersionHistory(utilityId)

        if (result.dashboardUrl) {
          const utility = uploadedFiles.find((f) => f.id === utilityId)
          if (utility) {
            // Ensure the URL is properly formatted before setting state
            let cleanUrl = result.dashboardUrl
            if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
              cleanUrl = `https://${cleanUrl}`
            }
            setDashboardUrl(cleanUrl)
            setDashboardFileName(utility.name)
          }
        }
      } else {
        console.error("Error deploying version:", result.error)
        alert("Failed to deploy version: " + (result.error || "Unknown error"))
      }
    } catch (error) {
      console.error("Error deploying version:", error)
      alert("Failed to deploy version. Please try again.")
    } finally {
      setDeployingVersions(prev => {
        const newSet = new Set(prev)
        newSet.delete(versionId)
        return newSet
      })
    }
  }

  const filteredAndSortedFiles = useMemo(() => {
    let filtered = [...uploadedFiles]

    // Apply search filter
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (file) =>
          file.name.toLowerCase().includes(query) ||
          file.status.toLowerCase().includes(query) ||
          file.size.toLowerCase().includes(query),
      )
    }

    // Apply sorting
    switch (sortBy) {
      case "newest":
        filtered = filtered.sort((a, b) => {
          const aTime = new Date(a.uploadedAt === "Just now" ? Date.now() : a.uploadedAt).getTime()
          const bTime = new Date(b.uploadedAt === "Just now" ? Date.now() : b.uploadedAt).getTime()
          return bTime - aTime
        })
        break
      case "oldest":
        filtered = filtered.sort((a, b) => {
          const aTime = new Date(a.uploadedAt === "Just now" ? Date.now() : a.uploadedAt).getTime()
          const bTime = new Date(b.uploadedAt === "Just now" ? Date.now() : b.uploadedAt).getTime()
          return aTime - bTime
        })
        break
      case "name":
        filtered = filtered.sort((a, b) => a.name.localeCompare(b.name))
        break
      case "size":
        filtered = filtered.sort((a, b) => {
          const aSize = Number.parseFloat(a.size.replace(/[^\d.]/g, ""))
          const bSize = Number.parseFloat(b.size.replace(/[^\d.]/g, ""))
          return bSize - aSize
        })
        break
      case "status":
        filtered = filtered.sort((a, b) => a.status.localeCompare(b.status))
        break
    }

    return filtered
  }, [uploadedFiles, searchQuery, sortBy])

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="text-center">
          <RefreshCw className="w-8 h-8 text-[#E0000A] animate-spin mx-auto mb-4" />
          <p className="text-gray-600">Loading utilities...</p>
        </div>
      </div>
    )
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

  <div className="px-4 lg:pl-8 xl:pl-12 space-y-6">
        <div className="text-left">
          <h1 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-[#E0000A] mb-2">Interactive Dashboard</h1>
          <p className="text-gray-500 lg:text-lg xl:text-xl">Upload and visualize your data with AI insights</p>
        </div>

  <div className="max-w-md mx-auto lg:max-w-none lg:mx-0">
          <div className="border-2 border-dashed border-[#E0000A] rounded-lg p-8 text-center bg-gray-50">
            <div className="mb-4">
              <div className="w-12 h-12 mx-auto mb-4">
                <svg viewBox="0 0 24 24" fill="none" className="w-full h-full text-[#E0000A]">
                  <path
                    d="M12 15V3m0 0l-4 4m4-4l4 4M2 17l.621 2.485A2 2 0 004.561 21h14.878a2 2 0 001.94-1.515L22 17"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
            </div>
            <h3 className="text-lg lg:text-xl xl:text-2xl font-semibold text-[#E0000A] mb-2">Upload your Data</h3>
            <p className="text-sm lg:text-base xl:text-lg text-gray-600 mb-6">
              Select a file from your device to upload
              <br />
              Supported formats: CSV, XLSX
            </p>
            <Button
              onClick={handleChooseFileClick}
              className="bg-[#E0000A] hover:bg-red-700 text-white px-8 py-2 rounded-full"
            >
              Choose file
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.xlsx,.xls"
              onChange={handleFileUpload}
              className="hidden"
            />
          </div>
        </div>

        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg lg:text-2xl xl:text-3xl font-semibold text-gray-900">Recent Files</h2>
            <div className="flex items-center gap-2">
              <Select value={sortBy} onValueChange={(value) => setSortBy(value as SortOption)}>
                <SelectTrigger className="w-auto h-8 border-none bg-transparent p-0">
                  <ArrowUpDown className={`w-4 h-4 ${sortBy !== "newest" ? "text-[#E0000A]" : "text-gray-400"}`} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="newest">Newest First</SelectItem>
                  <SelectItem value="oldest">Oldest First</SelectItem>
                  <SelectItem value="name">By Name</SelectItem>
                  <SelectItem value="size">By Size</SelectItem>
                  <SelectItem value="status">By Status</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search files by name, status, or size"
              className="pl-10 bg-gray-50 border-gray-200 rounded-lg"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          {searchQuery && (
            <div className="text-sm text-gray-600 mb-4">
              Found {filteredAndSortedFiles.length} file{filteredAndSortedFiles.length !== 1 ? "s" : ""} matching "
              {searchQuery}"
            </div>
          )}

          {filteredAndSortedFiles.length > 0 && (
            <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
              {filteredAndSortedFiles.map((file) => (
                <Card key={file.id} className="shadow-sm border border-gray-200 rounded-lg mb-4 lg:mb-0">
              <CardContent className="p-4">
                <div className="flex items-start gap-3 mb-4">
                  <div className="w-10 h-10 bg-red-100 rounded-lg flex items-center justify-center flex-shrink-0">
                    <FileSpreadsheet className="w-5 h-5 text-[#E0000A]" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-medium text-gray-900 truncate text-base lg:text-lg xl:text-xl">{file.name}</h3>
                    <p className="text-sm lg:text-base text-gray-500">
                      {file.size} • {file.uploadedAt}
                    </p>
                  </div>
                  {file.status === "ready" && (
                    <Badge className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">Ready</Badge>
                  )}
                  {file.status === "error" && (
                    <Badge className="bg-red-100 text-red-800 text-xs px-2 py-1 rounded-full">Error</Badge>
                  )}
                  {file.status === "expired" && (
                    <Badge className="bg-gray-100 text-gray-800 text-xs px-2 py-1 rounded-full">Expired</Badge>
                  )}
                </div>

                {file.status === "ready" && (
                  <>
                    <div className="bg-green-50 rounded-lg p-3 mb-4">
                      <div className="flex items-center gap-2">
                        <BarChart3 className="w-4 h-4 text-green-600" />
                        <div className="flex-1">
                          <p className="text-sm lg:text-base xl:text-lg font-medium text-green-900">{file.charts} charts generated</p>
                          <p className="text-xs lg:text-sm xl:text-base text-green-700">AI analysis complete</p>
                        </div>
                        {file.hasVersions && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => loadVersionHistory(file.id)}
                            className="text-xs text-green-700 hover:text-green-900 hover:bg-green-100"
                          >
                            v{file.currentVersion} ({file.totalVersions} versions)
                          </Button>
                        )}
                      </div>
                    </div>

                    <div className="flex gap-2">
                      {isDashboardExpiredCheck(file) ? (
                        <Button
                          onClick={() => handleRedeployDashboard(file)}
                          disabled={redeployingFiles.has(file.id)}
                          className="flex-1 bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50"
                        >
                          {redeployingFiles.has(file.id) ? (
                            <>
                              <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                              Redeploying...
                            </>
                          ) : (
                            "Redeploy Dashboard"
                          )}
                        </Button>
                      ) : (
                        <Button
                          onClick={() => handleViewDashboard(file)}
                          className="flex-1 bg-[#E0000A] hover:bg-red-700 text-white rounded-lg"
                        >
                          View Dashboard
                        </Button>
                      )}
                      <Button
                        variant="outline"
                        className={`flex-1 border-gray-300 text-gray-700 rounded-lg bg-transparent flex items-center gap-2 transition-colors ${
                          clickedAskYve === file.id ? "bg-[#E0000A] text-white border-[#E0000A]" : ""
                        }`}
                        onClick={() => {
                          setClickedAskYve(file.id)
                          setTimeout(() => setClickedAskYve(null), 200)
                          handleAskYve(file)
                        }}
                      >
                        <img
                          src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/ask_yve_dashboard.svg"
                          alt="Ask Yve"
                          className="w-4 h-4"
                        />
                        Ask Yve
                      </Button>
                    </div>
                  </>
                )}

                {file.status === "processing" && (
                    <div className="flex items-center gap-3 p-3 bg-yellow-50 rounded-lg">
                    <RefreshCw className="w-5 h-5 text-yellow-600 animate-spin" />
                    <div>
                      <p className="text-sm lg:text-base xl:text-lg font-medium text-yellow-900">Processing your data...</p>
                      <p className="text-xs lg:text-sm xl:text-base text-yellow-700">AI is analyzing and generating dashboard</p>
                    </div>
                  </div>
                )}

                {file.status === "generating-dashboard" && (
                  <div className="flex items-center gap-3 p-3 bg-blue-50 rounded-lg">
                    <RefreshCw className="w-5 h-5 text-blue-600 animate-spin" />
                    <div>
                      <p className="text-sm lg:text-base xl:text-lg font-medium text-blue-900">Generating AI dashboard...</p>
                      <p className="text-xs lg:text-sm xl:text-base text-blue-700">This may take a few minutes</p>
                    </div>
                  </div>
                )}

                {file.status === "error" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-red-50 rounded-lg">
                      <div className="w-5 h-5 text-red-600 flex-shrink-0">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div>
                        {file.generatedCode ? (
                          <>
                            <p className="text-sm lg:text-base xl:text-lg font-medium text-red-900">Deployment failed</p>
                            <p className="text-xs lg:text-sm xl:text-base text-red-700">Code saved - you can retry deployment</p>
                          </>
                        ) : (
                          <>
                            <p className="text-sm lg:text-base xl:text-lg font-medium text-red-900">Processing failed</p>
                            <p className="text-xs lg:text-sm xl:text-base text-red-700">Please try uploading again or contact support</p>
                          </>
                        )}
                      </div>
                    </div>
                    {file.generatedCode && (
                      <Button
                        onClick={() => handleRedeployDashboard(file)}
                        disabled={redeployingFiles.has(file.id)}
                        className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50"
                      >
                        {redeployingFiles.has(file.id) ? (
                          <>
                            <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                            Retrying...
                          </>
                        ) : (
                          "Retry Deploy"
                        )}
                      </Button>
                    )}
                  </div>
                )}

                {file.status === "expired" && (
                  <div className="space-y-3">
                    <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                      <div className="w-5 h-5 text-gray-600 flex-shrink-0">
                        <svg viewBox="0 0 20 20" fill="currentColor">
                          <path
                            fillRule="evenodd"
                            d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z"
                            clipRule="evenodd"
                          />
                        </svg>
                      </div>
                      <div>
                        <p className="text-sm lg:text-base xl:text-lg font-medium text-gray-900">Dashboard expired</p>
                        <p className="text-xs lg:text-sm xl:text-base text-gray-700">Redeploy to access your dashboard again</p>
                      </div>
                    </div>
                    <Button
                      onClick={() => handleRedeployDashboard(file)}
                      disabled={redeployingFiles.has(file.id)}
                      className="w-full bg-orange-600 hover:bg-orange-700 text-white rounded-lg disabled:opacity-50"
                    >
                      {redeployingFiles.has(file.id) ? (
                        <>
                          <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                          Redeploying...
                        </>
                      ) : (
                        "Redeploy Dashboard"
                      )}
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
              ))}
            </div>
          )}

          {filteredAndSortedFiles.length === 0 && uploadedFiles.length > 0 && (
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-6 text-center">
                <Search className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No files found</p>
                <p className="text-sm text-gray-500">Try adjusting your search or sort criteria</p>
              </CardContent>
            </Card>
          )}

          {filteredAndSortedFiles.length === 0 && uploadedFiles.length === 0 && (
            <Card className="bg-gray-50 border-gray-200">
              <CardContent className="p-6 text-center">
                <FileSpreadsheet className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                <p className="text-gray-600">No files uploaded yet</p>
                <p className="text-sm text-gray-500">Upload your first dataset to get started</p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>

      {showVersionHistory && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-2xl w-full max-h-[80vh] overflow-hidden shadow-xl border">
            <div className="p-6 border-b bg-gray-50">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Version History</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowVersionHistory(null)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="p-6 overflow-y-auto max-h-[60vh] bg-white">
              <div className="space-y-4">
                {versions.map((version) => (
                  <div key={version.id} className="border rounded-lg p-4 bg-gray-50">
                    <div className="flex items-center justify-between mb-2">
                      <div className="flex items-center gap-2">
                        <Badge variant={version.is_deployed ? "default" : "secondary"}>
                          Version {version.version_number}
                        </Badge>
                        {version.is_deployed && (
                          <Badge variant="outline" className="text-green-600 border-green-600">
                            Currently Deployed
                          </Badge>
                        )}
                      </div>
                      <span className="text-sm text-gray-500">{version.relative_time}</span>
                    </div>
                    <p className="text-sm text-gray-700 mb-3">{version.version_description}</p>
                    <div className="flex gap-2">
                      {(() => {
                        const isDeploying = deployingVersions.has(version.id)
                        
                        // Check if deployed and not expired
                        let isDeployed = version.is_deployed
                        if (isDeployed && version.dashboard_expires_at) {
                          const now = new Date()
                          const expirationTime = new Date(version.dashboard_expires_at)
                          if (now > expirationTime) {
                            isDeployed = false // Dashboard has expired
                          }
                        }
                        
                        if (isDeploying) {
                          return (
                            <Button
                              size="sm"
                              disabled
                              className="bg-blue-600 text-white"
                            >
                              <div className="flex items-center space-x-2">
                                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
                                <span>Deploying...</span>
                              </div>
                            </Button>
                          )
                        } else if (isDeployed && version.dashboard_url) {
                          return (
                            <Button
                              size="sm"
                              onClick={() => {
                                let cleanUrl = version.dashboard_url
                                if (!cleanUrl.startsWith('http://') && !cleanUrl.startsWith('https://')) {
                                  cleanUrl = `https://${cleanUrl}`
                                }
                                window.open(cleanUrl, "_blank")
                              }}
                              className="bg-green-600 hover:bg-green-700 text-white"
                            >
                              View Dashboard
                            </Button>
                          )
                        } else if (!isDeployed) {
                          return (
                            <Button
                              size="sm"
                              onClick={() => deploySpecificVersion(showVersionHistory!, version.id)}
                              className="bg-[#E0000A] hover:bg-red-700 text-white"
                            >
                              Deploy This Version
                            </Button>
                          )
                        }
                        return null
                      })()}
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => {
                          console.log("Show code for version:", version.version_number)
                        }}
                      >
                        View Code
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {dashboardUrl && (
        <DashboardBrowserModal
          url={dashboardUrl}
          fileName={dashboardFileName}
          onClose={() => {
            setDashboardUrl(null)
            setDashboardFileName("")
          }}
        />
      )}
    </div>
  )
}

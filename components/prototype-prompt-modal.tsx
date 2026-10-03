"use client"

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Clipboard, Lightbulb, Loader2 } from "lucide-react"
import { useState } from "react"
import { createClient } from "@/lib/supabase"

interface PrototypePromptModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  trendTitle: string
  prompt: string
  trendId?: string
}

function sanitizePrompt(rawPrompt: string): string {
  if (!rawPrompt) return ""
  return rawPrompt
    .replace(/\bBPI's\b/gi, "Thryve's")
    .replace(/\bBPI\b/gi, "Thryve")
    .replace(/\bBank of the Philippine Islands\b/gi, "Thryve")
}

export function PrototypePromptModal({ open, onOpenChange, trendTitle, prompt, trendId }: PrototypePromptModalProps) {
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  const cleanPrompt = sanitizePrompt(prompt)

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(cleanPrompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const handleGeneratePrototype = async () => {
    if (!cleanPrompt || cleanPrompt.trim() === "") {
      console.error("[PROTOTYPE-MODAL] Empty or missing prompt!")
      alert("Error: No prototype prompt available for this trend.")
      return
    }

    const supabase = createClient()
    let userId: string | null = null
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (user) userId = user.id
    } catch {}

    setGenerating(true)
    try {
      const enhancedPrompt = `${cleanPrompt}

CRITICAL REQUIREMENTS for functional prototype:
- All buttons must be clickable and functional
- Tabs, navigation, and modal views must switch properly
- Modern, responsive application shell with high visual polish
- Interactive elements should provide immediate user feedback
- Include realistic mock data and actions
- Make the interface intuitive, modern, and production-ready.`

      const { data: { session } } = await supabase.auth.getSession()

      const requestPayload = {
        prompt: enhancedPrompt,
        title: `${trendTitle} Prototype`,
        description: `Interactive prototype based on: ${trendTitle}`,
        category: "Trend-Based",
        priority: "High",
        trendId: trendId,
        userId: userId,
      }

      const headers: Record<string, string> = { "Content-Type": "application/json" }
      if (session?.access_token) {
        headers["Authorization"] = `Bearer ${session.access_token}`
      }

      const response = await fetch("/api/prototypes/generate", {
        method: "POST",
        headers,
        body: JSON.stringify(requestPayload),
      })

      if (response.ok) {
        onOpenChange(false)
        alert(
          `Prototype generation started for "${trendTitle}"! Check the Prototypes screen in a moment to interact with your prototype.`
        )
      } else {
        const errorData = await response.text()
        console.error("[PROTOTYPE-MODAL] API request failed:", errorData)
        throw new Error(`API request failed: ${errorData}`)
      }
    } catch (error) {
      console.error("[PROTOTYPE-MODAL] GENERATION REQUEST FAILED:", error)
      alert("Failed to generate prototype. Please try again.")
    } finally {
      setGenerating(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-left">Prototype Prompt — {trendTitle}</DialogTitle>
          <DialogDescription className="sr-only">
            Generated prototype instructions to build an interactive UI.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <pre className="whitespace-pre-wrap break-words text-xs bg-gray-50 p-3 rounded border border-gray-200 max-h-[50vh] overflow-auto">
            {cleanPrompt}
          </pre>

          <div className="flex gap-3">
            <Button onClick={handleCopy} variant="outline" className="flex-1 bg-transparent">
              <Clipboard className="w-4 h-4 mr-2" />
              {copied ? "Copied!" : "Copy Prompt"}
            </Button>

            <Button
              onClick={handleGeneratePrototype}
              disabled={generating}
              className="flex-1 bg-[#E0000A] hover:bg-[#B8000A] text-white"
            >
              {generating ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Generating...
                </>
              ) : (
                <>
                  <Lightbulb className="w-4 h-4 mr-2" />
                  Generate Now
                </>
              )}
            </Button>
          </div>

          <div className="text-xs text-gray-600 bg-blue-50 p-3 rounded border border-blue-200">
            <p className="font-medium text-blue-800 mb-1">Generate Now will:</p>
            <ul className="list-disc list-inside space-y-1 text-blue-700">
              <li>Create a fully functional interactive prototype using Gemini AI</li>
              <li>Ensure all buttons, tabs, and interactions work properly</li>
              <li>Make it available immediately in your Prototypes screen</li>
              <li>Provide an interactive live browser preview</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

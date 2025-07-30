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

export function PrototypePromptModal({ open, onOpenChange, trendTitle, prompt, trendId }: PrototypePromptModalProps) {
  const [copied, setCopied] = useState(false)
  const [generating, setGenerating] = useState(false)

  // Debug logging whenever the modal opens
  console.log("[PROTOTYPE-MODAL] =================================")
  console.log("[PROTOTYPE-MODAL] modal props here")
  console.log("[PROTOTYPE-MODAL] =================================")
  console.log("[PROTOTYPE-MODAL] Props analysis:")
  console.log(`   - open: ${open}`)
  console.log(`   - trendTitle: "${trendTitle}"`)
  console.log(`   - trendId: "${trendId}"`)
  console.log(`   - prompt exists: ${!!prompt}`)
  console.log(`   - prompt length: ${prompt?.length || 0}`)
  if (prompt) {
    console.log(`   - prompt preview: "${prompt.substring(0, 200)}${prompt.length > 200 ? '...' : ''}"`)
  } else {
    console.log("   - prompt: null/undefined/empty")
  }
  console.log("📋 [PROTOTYPE-MODAL] =================================")

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(prompt)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      // ignore
    }
  }

  const handleGeneratePrototype = async () => {
    console.log("[PROTOTYPE-MODAL] =================================")
    console.log("[PROTOTYPE-MODAL] gen proto clicked")
    console.log("[PROTOTYPE-MODAL] =================================")
    
    if (!prompt || prompt.trim() === "") {
      console.error("[PROTOTYPE-MODAL] CRITICAL ERROR: Empty or missing prompt!")
      alert("Error: No prototype prompt available for this trend. Please try a different trend or contact support.")
      return
    }

    console.log("[PROTOTYPE-MODAL] Getting client-side authentication...")
    
    // Handle authentication on client-side like AI chat screen does
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.error("[PROTOTYPE-MODAL] Authentication failed:", userError?.message)
      alert("Authentication required. Please log in to generate prototypes.")
      return
    }

    console.log("[PROTOTYPE-MODAL] User authenticated:", user.id)
    console.log("[PROTOTYPE-MODAL] MANUAL GENERATION - Toggle check bypassed (manual generation always allowed)")
    
    console.log("[PROTOTYPE-MODAL] Generation request data:")
    console.log(`   - trendTitle: "${trendTitle}"`)
    console.log(`   - trendId: "${trendId}"`)
    console.log(`   - userId: "${user.id}"`)
    console.log(`   - base prompt length: ${prompt?.length || 0}`)

    setGenerating(true)
    try {
      // Enhanced prompt to ensure functional buttons and interactions
      const enhancedPrompt = `${prompt}

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

      console.log("[PROTOTYPE-MODAL] Enhanced prompt details:")
      console.log(`   - enhanced prompt length: ${enhancedPrompt.length}`)
      console.log(`   - calling API: /api/prototypes/generate`)

      // Get the session token to pass to API
      const { data: { session } } = await supabase.auth.getSession()
      
      const requestPayload = {
        prompt: enhancedPrompt,
        title: `${trendTitle} Prototype`,
        description: `AI-generated prototype based on trend: ${trendTitle}`,
        category: "Trend-Based",
        priority: "High",
        trendId: trendId,
        userId: user.id, // Pass userId directly
      }

      console.log("[PROTOTYPE-MODAL] Request payload:")
      console.log(`   - title: "${requestPayload.title}"`)
      console.log(`   - description: "${requestPayload.description}"`)
      console.log(`   - category: "${requestPayload.category}"`)
      console.log(`   - priority: "${requestPayload.priority}"`)
      console.log(`   - trendId: "${requestPayload.trendId}"`)
      console.log(`   - userId: "${requestPayload.userId}"`)
      console.log(`   - prompt length: ${requestPayload.prompt.length}`)

      const response = await fetch("/api/prototypes/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${session?.access_token}`, // Pass auth token
        },
        body: JSON.stringify(requestPayload),
      })

      console.log("[PROTOTYPE-MODAL] API Response:")
      console.log(`   - status: ${response.status}`)
      console.log(`   - ok: ${response.ok}`)

      if (response.ok) {
        const result = await response.json()
        console.log("[PROTOTYPE-MODAL] Generation started successfully:", result)

        // Close modal and show success message
        onOpenChange(false)

        // Show success notification
        alert(
          `Prototype generation started for "${trendTitle}"! Check the Prototypes screen in a few moments to see your generated prototype.`,
        )
      } else {
        const errorData = await response.text()
        console.error("[PROTOTYPE-MODAL] API request failed:", errorData)
        throw new Error(`API request failed with status ${response.status}: ${errorData}`)
      }
    } catch (error) {
      console.error("[PROTOTYPE-MODAL] =================================")
      console.error("[PROTOTYPE-MODAL] GENERATION REQUEST FAILED")
      console.error("[PROTOTYPE-MODAL] =================================")
      console.error("[PROTOTYPE-MODAL] Error:", error)
      alert("Failed to generate prototype. Please try again.")
    } finally {
      setGenerating(false)
      console.log("[PROTOTYPE-MODAL] Generation request completed")
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl w-[95vw]">
        <DialogHeader>
          <DialogTitle className="text-left">Prototype Prompt — {trendTitle}</DialogTitle>
          <DialogDescription className="sr-only">
            Generated prototype instructions you can copy to build a UI quickly or generate automatically with v0.
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <pre className="whitespace-pre-wrap break-words text-xs bg-gray-50 p-3 rounded border border-gray-200 max-h-[50vh] overflow-auto">
            {prompt}
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
              <li>Create a fully functional prototype using v0 AI</li>
              <li>Ensure all buttons and interactions work properly</li>
              <li>Make it available in your Prototypes screen</li>
              <li>Generate in 2-3 minutes with live preview</li>
            </ul>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  )
}

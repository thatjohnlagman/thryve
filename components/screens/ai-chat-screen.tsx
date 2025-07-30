"use client"

import type React from "react"
import { useState, useEffect, useRef } from "react"

// Fallback for crypto.randomUUID() in non-HTTPS environments
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID()
  }
  // Fallback implementation for HTTP environments
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = Math.random() * 16 | 0
    const v = c === 'x' ? r : (r & 0x3 | 0x8)
    return v.toString(16)
  })
}
import { Send, User, Plus, Search, Menu, Edit2, Copy, Check, Paperclip, X, Trash2, MoreVertical } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import ReactMarkdown from "react-markdown"
import useEmblaCarousel from "embla-carousel-react"
import { Textarea } from "@/components/ui/textarea"
import { createClient } from "@/lib/supabase"
import { Accordion, AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion"
import { DashboardBrowserModal } from "@/components/dashboard-browser-modal"

interface Message {
  id: string
  content: string
  message_type: "user" | "bot"
  created_at: string
  isStreaming?: boolean
  attachments?: FileAttachment[]
  extractedCode?: string
  has_code?: boolean
  utility_version_id?: string // Link to specific utility version created by this message
}

interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
}

interface ConversationHistory {
  id: string
  title: string
  lastMessage: string
  timestamp: string
  messageCount: number
  context_type?: string
  context_id?: string
}

// Client-side database functions (following trends pattern)
async function saveMessageToSupabase(
  message: Message,
  conversationId: string,
  contextType?: string,
  contextId?: string,
): Promise<boolean> {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log("[AI-Chat] No user for save operation:", userError?.message)
      return false
    }

    // Detect if message has code blocks for consistent accordion display
    const hasCode = message.message_type === "bot" ? extractCodeBlocks(message.content).length > 0 : false

    const { error } = await supabase.from("ai_messages").insert({
      conversation_id: conversationId,
      user_id: user.id,
      context_type: contextType || "general",
      context_id: contextId || null,
      content: message.content,
      message_type: message.message_type,
      has_code: hasCode,
      utility_version_id: message.utility_version_id || null, // Link to version if exists
    })

    if (error) {
      console.error("[AI-Chat] Error saving message:", error)
      return false
    }

    console.log("[AI-Chat] Message saved successfully with has_code:", hasCode, "version_id:", message.utility_version_id)
    return true
  } catch (error) {
    console.error("[AI-Chat] Failed to save message:", error)
    return false
  }
}

async function loadConversationsFromSupabase(): Promise<ConversationHistory[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log("[AI-Chat] No user for load conversations:", userError?.message)
      return []
    }

    const { data, error } = await supabase
      .from("ai_messages")
      .select("conversation_id, context_type, context_id, content, message_type, created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("[AI-Chat] Error loading conversations:", error)
      return []
    }

    // Group messages by conversation
    const conversationMap = new Map<string, ConversationHistory>()

    for (const message of data || []) {
      if (!conversationMap.has(message.conversation_id)) {
        conversationMap.set(message.conversation_id, {
          id: message.conversation_id,
          title: message.content.substring(0, 50) + "...",
          lastMessage: message.content,
          timestamp: message.created_at,
          messageCount: 1,
          context_type: message.context_type,
          context_id: message.context_id,
        })
      } else {
        const conv = conversationMap.get(message.conversation_id)!
        conv.messageCount++
        if (new Date(message.created_at) > new Date(conv.timestamp)) {
          conv.lastMessage = message.content
          conv.timestamp = message.created_at
        }
      }
    }

    return Array.from(conversationMap.values())
  } catch (error) {
    console.error("[AI-Chat] Failed to load conversations:", error)
    return []
  }
}

async function loadMessagesFromSupabase(conversationId: string): Promise<Message[]> {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: userError,
    } = await supabase.auth.getUser()

    if (userError || !user) {
      console.log("[AI-Chat] No user for load messages:", userError?.message)
      return []
    }

    const { data, error } = await supabase
      .from("ai_messages")
      .select("id, content, message_type, created_at, has_code, utility_version_id")
      .eq("conversation_id", conversationId)
      .eq("user_id", user.id)
      .order("created_at", { ascending: true })

    if (error) {
      console.error("[AI-Chat] Error loading messages:", error)
      return []
    }

    return (data || []).map((msg) => ({
      id: msg.id,
      content: msg.content,
      message_type: msg.message_type,
      created_at: msg.created_at,
      has_code: msg.has_code || false,
      utility_version_id: msg.utility_version_id,
    }))
  } catch (error) {
    console.error("[AI-Chat] Failed to load messages:", error)
    return []
  }
}

const removeCodeBlocks = (content: string) => {
  // Remove all code blocks and clean up the text
  return content
    .replace(/```[\s\S]*?```/g, "") // Remove standard code blocks
    .replace(/`{3,}[\s\S]*?`{3,}/g, "") // Remove variable backtick code blocks
    .replace(/\n\s*\n/g, "\n") // Remove excessive line breaks
    .trim()
}

const extractCodeBlocks = (content: string) => {
  console.log("[DEBUG] extractCodeBlocks called with content length:", content.length)
  console.log("[DEBUG] Content preview:", content.substring(0, 300))
  
  // Multiple regex patterns to catch different code block formats
  const patterns = [
    /```(\w+)?\s*\n([\s\S]*?)\n\s*```/g, // Standard format with newlines
    /```(\w+)?\s*([\s\S]*?)\s*```/g, // Without explicit newlines
    /`{3,}(\w+)?\s*\n([\s\S]*?)\n\s*`{3,}/g, // Variable backticks
  ]

  const codeBlocks: { language: string; code: string }[] = []

  for (let i = 0; i < patterns.length; i++) {
    const regex = patterns[i]
    console.log(`[DEBUG] Testing pattern ${i + 1}:`, regex.toString())
    
    let match
    while ((match = regex.exec(content)) !== null) {
      console.log(`[DEBUG] Pattern ${i + 1} found match:`, {
        fullMatch: match[0].substring(0, 100) + "...",
        language: match[1],
        codeLength: match[2]?.length
      })
      
      const language = match[1]?.toLowerCase() || "text"
      const code = match[2]?.trim()
      if (code && code.length > 0) {
        // Avoid duplicates by checking if we already have this exact code
        const isDuplicate = codeBlocks.some(block => block.code === code)
        if (!isDuplicate) {
          console.log(`[DEBUG] Adding code block: language=${language}, length=${code.length}`)
          codeBlocks.push({
            language,
            code,
          })
        } else {
          console.log("[DEBUG] Skipping duplicate code block")
        }
      }
    }
    // Reset regex lastIndex for next pattern
    regex.lastIndex = 0
  }

  // Also check for Python code without explicit code blocks (fallback)
  if (codeBlocks.length === 0) {
    console.log("[DEBUG] No code blocks found, checking for Python indicators")
    const pythonIndicators = [
      "import streamlit",
      "import pandas",
      "import plotly", 
      "st.title",
      "st.write",
      "pd.read_csv",
      "px.bar",
      "px.line",
    ]

    if (pythonIndicators.some((indicator) => content.includes(indicator))) {
      console.log("[DEBUG] Python indicators found, extracting Python code")
      // Extract potential Python code sections
      const lines = content.split("\n")
      const codeSection = []
      let inCodeSection = false

      for (const line of lines) {
        if (
          pythonIndicators.some((indicator) => line.includes(indicator)) ||
          line.match(/^(import|from|def|class|if|for|while|try|with)\s/) ||
          (inCodeSection && line.match(/^\s+/))
        ) {
          inCodeSection = true
          codeSection.push(line)
        } else if (inCodeSection && line.trim() === "") {
          codeSection.push(line)
        } else if (inCodeSection) {
          break
        }
      }

      if (codeSection.length > 0) {
        console.log("[DEBUG] Extracted Python code section, length:", codeSection.length)
        codeBlocks.push({
          language: "python",
          code: codeSection.join("\n").trim(),
        })
      }
    }
  }

  console.log("Code extraction debug:", {
    contentLength: content.length,
    foundBlocks: codeBlocks.length,
    blockLanguages: codeBlocks.map((b) => b.language),
    blockSizes: codeBlocks.map((b) => b.code.length),
    contentPreview: content.substring(0, 200) + "...",
  })

  return codeBlocks
}

export function AIChatScreen() {
  const [messages, setMessages] = useState<Message[]>([])
  const [inputValue, setInputValue] = useState("")
  const [contextInfo, setContextInfo] = useState<any>(null)
  const [isInitialState, setIsInitialState] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [conversationHistory, setConversationHistory] = useState<ConversationHistory[]>([])
  const [currentConversationId, setCurrentConversationId] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [openDropdown, setOpenDropdown] = useState<string | null>(null)
  const [revisionStatus, setRevisionStatus] = useState<Record<string, "processing" | "completed" | "failed" | "generating" | "deploying" | "loading">>({})
  const [deploymentUrls, setDeploymentUrls] = useState<Record<string, string>>({})
  const [codeVisibility, setCodeVisibility] = useState<Record<string, boolean>>({})
  const [deploymentStatus, setDeploymentStatus] = useState<Record<string, "idle" | "deploying" | "deployed">>({})
  const [versionDeploymentInfo, setVersionDeploymentInfo] = useState<Record<string, { isDeployed: boolean; dashboardUrl?: string; isExpired?: boolean }>>({})
  const [dashboardUrl, setDashboardUrl] = useState<string | null>(null)
  const [dashboardFileName, setDashboardFileName] = useState<string>("")

  // Helper function to ensure URL has proper protocol
  const formatDashboardUrl = (url: string): string => {
    if (!url) return url
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url
    }
    return `https://${url}`
  }

  const streamingBotMessageRef = useRef<Message | null>(null)
  const messagesEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    containScroll: "trimSnaps",
    dragFree: true,
  })
  const [canScrollPrev, setCanScrollPrev] = useState(false)
  const [canScrollNext, setCanScrollNext] = useState(false)

  useEffect(() => {
    loadConversationHistory()

    const context = sessionStorage.getItem("ai-chat-context")
    const explicitLoad = sessionStorage.getItem("ai-chat-explicit-load")

    if (context) {
      // Fresh context from trends/utilities/prototypes - start new chat with context
      try {
        const parsed = JSON.parse(context)
        console.log("Loading fresh context:", parsed)

        setContextInfo(parsed)
        resetToNewChat()

        // Clear context after loading
        sessionStorage.removeItem("ai-chat-context")
      } catch (e) {
        console.error("Failed to parse context:", e)
        resetToNewChat()
      }
    } else if (explicitLoad === "true") {
      // User explicitly loaded a conversation - restore it
      restoreConversation()
      sessionStorage.removeItem("ai-chat-explicit-load")
    } else {
      // Default: start fresh new chat
      resetToNewChat()
    }
  }, [])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [messages])

  useEffect(() => {
    document.body.style.overflow = "hidden"
    document.documentElement.style.overflow = "hidden"
    return () => {
      document.body.style.overflow = ""
      document.documentElement.style.overflow = ""
    }
  }, [])

  useEffect(() => {
    if (!emblaApi) return
    const updateScrollButtons = () => {
      setCanScrollPrev(emblaApi.canScrollPrev())
      setCanScrollNext(emblaApi.canScrollNext())
    }
    emblaApi.on("select", updateScrollButtons)
    emblaApi.on("reInit", updateScrollButtons)
    updateScrollButtons()
    return () => {
      emblaApi.off("select", updateScrollButtons)
      emblaApi.off("reInit", updateScrollButtons)
    }
  }, [emblaApi])

  useEffect(() => {
    const handleClickOutside = () => {
      setOpenDropdown(null)
    }

    if (openDropdown) {
      document.addEventListener("click", handleClickOutside)
      return () => document.removeEventListener("click", handleClickOutside)
    }
  }, [openDropdown])

  const resetToNewChat = () => {
    setMessages([])
    setIsInitialState(true)
    setCurrentConversationId(null)
    setIsSidebarOpen(false)
    clearSessionStorage()
  }

  const restoreConversation = () => {
    try {
      const persistedMessages = sessionStorage.getItem("ai-chat-messages")
      const persistedConversationId = sessionStorage.getItem("ai-chat-conversation-id")
      const persistedInitialState = sessionStorage.getItem("ai-chat-initial-state")

      if (persistedMessages && persistedConversationId) {
        const messages = JSON.parse(persistedMessages)
        setMessages(messages)
        setCurrentConversationId(persistedConversationId)
        setIsInitialState(persistedInitialState === "true")
      } else {
        resetToNewChat()
      }
    } catch (e) {
      console.error("Failed to restore conversation:", e)
      resetToNewChat()
    }
  }

  const clearSessionStorage = () => {
    const keysToRemove = [
      "ai-chat-messages",
      "ai-chat-conversation-id",
      "ai-chat-initial-state",
      "ai-chat-explicit-load",
      "ai-chat-context",
    ]
    keysToRemove.forEach((key) => sessionStorage.removeItem(key))
  }

  const persistConversationState = () => {
    if (messages.length > 0 && currentConversationId) {
      sessionStorage.setItem("ai-chat-messages", JSON.stringify(messages))
      sessionStorage.setItem("ai-chat-conversation-id", currentConversationId)
      sessionStorage.setItem("ai-chat-initial-state", isInitialState.toString())
    }
  }

  const scrollPrev = () => emblaApi?.scrollPrev()
  const scrollNext = () => emblaApi?.scrollNext()

  const loadConversationHistory = async (forceRefresh = false) => {
    const CACHE_KEY = "ai-chat-history-cache"
    const CACHE_TIMESTAMP_KEY = "ai-chat-history-timestamp"
    const CACHE_DURATION = 30000

    try {
      if (!forceRefresh) {
        const cachedHistory = sessionStorage.getItem(CACHE_KEY)
        const cacheTimestamp = sessionStorage.getItem(CACHE_TIMESTAMP_KEY)

        if (cachedHistory && cacheTimestamp) {
          const now = Date.now()
          const lastLoad = Number.parseInt(cacheTimestamp, 10)

          if (now - lastLoad < CACHE_DURATION) {
            setConversationHistory(JSON.parse(cachedHistory))
            return
          }
        }
      }

      console.log("[AI-Chat-Screen] Loading conversation history from Supabase (client-side)")

      // Use client-side approach like trends
      const conversations = await loadConversationsFromSupabase()
      setConversationHistory(conversations)
      sessionStorage.setItem(CACHE_KEY, JSON.stringify(conversations))
      sessionStorage.setItem(CACHE_TIMESTAMP_KEY, Date.now().toString())
    } catch (error) {
      console.error("Error loading conversation history:", error)
    }
  }

  const loadMessages = async (conversationId: string) => {
    try {
      console.log("[AI-Chat-Screen] Loading messages from Supabase (client-side)")
      const messages = await loadMessagesFromSupabase(conversationId)
      setMessages(messages)
      
      // Check deployment status for utility messages
      await checkVersionDeploymentStatus(messages)
    } catch (error) {
      console.error("Error loading messages:", error)
    }
  }

  const checkVersionDeploymentStatus = async (messages: Message[]) => {
    try {
      const supabase = createClient()
      const deploymentInfo: Record<string, { isDeployed: boolean; dashboardUrl?: string; isExpired?: boolean }> = {}
      
      // Find all messages with utility_version_id
      const versionIds = messages
        .filter(msg => msg.utility_version_id)
        .map(msg => msg.utility_version_id!)
      
      if (versionIds.length > 0) {
        // Check deployment status for these versions
        const { data: versions } = await supabase
          .from("utility_versions")
          .select("id, is_deployed, dashboard_url, dashboard_expires_at")
          .in("id", versionIds)
        
        if (versions) {
          const now = new Date()
          versions.forEach(version => {
            // Check if dashboard has expired using dashboard_expires_at column
            const isExpired = version.dashboard_expires_at && 
              now > new Date(version.dashboard_expires_at)
            
            deploymentInfo[version.id] = {
              isDeployed: version.is_deployed && !isExpired,
              dashboardUrl: (version.is_deployed && !isExpired) ? version.dashboard_url : undefined,
              isExpired: !!isExpired
            }
          })
        }
      }
      
      // Also check main utility deployment status for messages that might be related to v1
      if (contextInfo?.type === "utility") {
        const { data: utility } = await supabase
          .from("utilities")
          .select("id, status, dashboard_url, dashboard_expires_at")
          .eq("id", contextInfo.id)
          .single()
        
        if (utility) {
          const isExpired = utility.dashboard_expires_at && 
            new Date() > new Date(utility.dashboard_expires_at)
          
          // Store main utility info for potential use
          deploymentInfo[`main_${utility.id}`] = {
            isDeployed: utility.status === 'ready' && !!utility.dashboard_url && !isExpired,
            dashboardUrl: (utility.status === 'ready' && !isExpired) ? utility.dashboard_url : undefined,
            isExpired: !!isExpired
          }
        }
      }
      
      setVersionDeploymentInfo(deploymentInfo)
      console.log("[AI-Chat] Version deployment info loaded:", deploymentInfo)
    } catch (error) {
      console.error("Error checking version deployment status:", error)
    }
  }

  const handleQuickAction = (action: string) => {
    setInputValue(action)
  }

  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId)
    setEditingContent(content)
  }

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return

    const editedMessage = messages.find((msg) => msg.id === editingMessageId)
    const isUserMessage = editedMessage?.message_type === "user"

    setMessages((prev) => prev.map((msg) => (msg.id === editingMessageId ? { ...msg, content: editingContent } : msg)))
    setEditingMessageId(null)
    setEditingContent("")

    if (isUserMessage) {
      const messageIndex = messages.findIndex((msg) => msg.id === editingMessageId)
      setMessages((prev) => prev.slice(0, messageIndex + 1))
      setIsLoading(true)

      try {
        const streamingBotMessage: Message = {
          id: (Date.now() + 1).toString(),
          content: "",
          message_type: "bot",
          created_at: new Date().toISOString(),
          isStreaming: true,
        }
        setMessages((prev) => [...prev, streamingBotMessage])
        streamingBotMessageRef.current = streamingBotMessage

        const response = await fetch("/api/ai-chat/trends", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            action: "send_message",
            conversation_id: currentConversationId,
            message: editingContent,
          }),
        })

        if (!response.ok) throw new Error(`HTTP error! status: ${response.status}`)

        const data = await response.json()
        if (data.error) throw new Error(data.error)

        await streamResponse(data.response)
      } catch (error: any) {
        console.error("Error generating response for edited message:", error)
        handleResponseError()
      } finally {
        setIsLoading(false)
        streamingBotMessageRef.current = null
      }
    }
  }

  const handleCancelEdit = () => {
    setEditingMessageId(null)
    setEditingContent("")
  }

  const handleCopyMessage = async (content: string, messageId: string) => {
    try {
      await navigator.clipboard.writeText(content)
      setCopiedMessageId(messageId)
      setTimeout(() => setCopiedMessageId(null), 2000)
    } catch (error) {
      console.error("Failed to copy message:", error)
    }
  }

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(event.target.files || [])
    setSelectedFiles((prev) => [...prev, ...files])
    setShowFileUpload(true)
  }

  const handleRemoveFile = (index: number) => {
    setSelectedFiles((prev) => prev.filter((_, i) => i !== index))
    if (selectedFiles.length === 1) {
      setShowFileUpload(false)
    }
  }

  const handleSendMessage = async () => {
    await sendMessage(inputValue)
  }

  const sendMessage = async (messageContent: string, isEdit = false, editMessageId?: string) => {
    if ((!messageContent.trim() && selectedFiles.length === 0) || isLoading) return

    setIsLoading(true)
    const attachments = selectedFiles
    setInputValue("")
    setSelectedFiles([])
    setShowFileUpload(false)

    try {
      // Create conversation ID if this is initial state
      let conversationId = currentConversationId
      if (isInitialState || !conversationId) {
        conversationId = generateUUID()
        setCurrentConversationId(conversationId)
      }

      const userMessage: Message = {
        id: Date.now().toString(),
        content: messageContent,
        message_type: "user",
        created_at: new Date().toISOString(),
        attachments: attachments.map((file, index) => ({
          id: `${Date.now()}-${index}`,
          name: file.name,
          size: file.size,
          type: file.type,
          url: URL.createObjectURL(file),
        })),
      }
      setMessages((prev) => [...prev, userMessage])

      // Save user message to database (client-side like trends)
      await saveMessageToSupabase(userMessage, conversationId, contextInfo?.type, contextInfo?.id)

      const loadingMessage: Message = {
        id: (Date.now() + 1).toString(),
        content: "Yve is thinking...",
        message_type: "bot",
        created_at: new Date().toISOString(),
        isStreaming: true,
      }
      setMessages((prev) => [...prev, loadingMessage])

      // Call the appropriate API based on context
      console.log("=".repeat(60))
      console.log("API REQUEST DETAILS")
      console.log("=".repeat(60))
      console.log("Context info:", JSON.stringify(contextInfo, null, 2))
      console.log("Message content:", messageContent)
      console.log("Message history count:", messages.length)
      console.log("Context type:", contextInfo?.type)
      console.log("=".repeat(60))

      let apiResponse
      if (contextInfo?.type === "utility") {
        console.log("Making API request to utilities AI API")
        console.log("- Endpoint: /api/ai-chat/utilities")
        console.log("- Request body:")
        const requestBody = {
          message: messageContent,
          conversationHistory: messages.slice(-10),
          utilityContext: contextInfo,
        }
        console.log(JSON.stringify(requestBody, null, 2))

        apiResponse = await fetch("/api/ai-chat/utilities", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })
      } else {
        console.log("💬 Making API request to simple chat API")
        const requestBody = {
          message: messageContent,
          context_type: contextInfo?.type || "general",
          context_info: contextInfo,
          conversation_history: messages.slice(-10),
        }
        console.log("- Request body:")
        console.log(JSON.stringify(requestBody, null, 2))

        apiResponse = await fetch("/api/ai-chat-simple", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
        })
      }

      console.log("=".repeat(60))
      console.log("API RESPONSE DETAILS")
      console.log("=".repeat(60))
      console.log("Response status:", apiResponse.status, apiResponse.statusText)
      console.log("Response ok:", apiResponse.ok)
      console.log("Response headers:", Object.fromEntries(apiResponse.headers.entries()))
      console.log("=".repeat(60))

      if (!apiResponse.ok) {
        const errorText = await apiResponse.text()
        console.error("API Error Response:", errorText)
        throw new Error(`HTTP error! status: ${apiResponse.status} - ${errorText}`)
      }

      const data = await apiResponse.json()
      console.log("=".repeat(60))
      console.log("API RESPONSE DATA")
      console.log("=".repeat(60))
      console.log("Full response data:", JSON.stringify(data, null, 2))
      console.log("Has error:", !!data.error)
      console.log("Is code revision:", data.isCodeRevision)
      console.log("Has updated code:", data.hasUpdatedCode)
      console.log(
        "Message preview:",
        (contextInfo?.type === "utility" ? data.message : data.response)?.substring(0, 200) + "...",
      )
      console.log("=".repeat(60))

      if (data.error) throw new Error(data.error)

      // Remove loading message and add bot response
      setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id))

      const botMessage: Message = {
        id: (Date.now() + 2).toString(),
        content: contextInfo?.type === "utility" ? data.message : data.response,
        message_type: "bot",
        created_at: new Date().toISOString(),
        has_code: false, // Will be set below if code is detected
      }

      if (contextInfo?.type === "utility") {
        const messageContent = data.message
        const detectedCodeBlocks = extractCodeBlocks(messageContent)

        console.log("=".repeat(80))
        console.log("ENHANCED CODE DETECTION")
        console.log("=".repeat(80))
        console.log("Context type:", contextInfo?.type)
        console.log("Backend isCodeRevision:", data.isCodeRevision)
        console.log("Detected code blocks:", detectedCodeBlocks.length)
        console.log(
          "Code blocks found:",
          detectedCodeBlocks.map((block) => ({ language: block.language, length: block.code.length })),
        )
        console.log("Message length:", messageContent.length)
        console.log("=".repeat(80))

        // If we have code blocks, treat this as a code revision regardless of backend flag
        const hasCode = detectedCodeBlocks.length > 0
        const isPythonCode = detectedCodeBlocks.some(
          (block) =>
            block.language === "python" ||
            (!block.language && block.code.includes("import ")) || // Detect Python by imports
            (!block.language && (block.code.includes("def ") || block.code.includes("class "))), // Detect Python by syntax
        )

        // Set has_code flag immediately so accordion shows up
        botMessage.has_code = hasCode

        if (hasCode && isPythonCode) {
          // Find the main Python code block
          const pythonBlock = detectedCodeBlocks.find(
            (block) =>
              block.language === "python" ||
              (!block.language &&
                (block.code.includes("import ") || block.code.includes("def ") || block.code.includes("class "))),
          )

          if (pythonBlock) {
            const updatedCode = pythonBlock.code

            console.log("=".repeat(80))
            console.log("CODE REVISION DETECTED - EXTRACTED CODE:")
            console.log("=".repeat(80))
            console.log("Code language:", pythonBlock.language || "detected-python")
            console.log("Code length:", updatedCode.length, "characters")
            console.log("Utility ID:", contextInfo.id)
            console.log("User message:", messageContent.substring(0, 100) + "...")
            console.log("=".repeat(80))

            botMessage.extractedCode = updatedCode

            // Save the code revision as a new version
            try {
              const supabase = createClient()

              console.log("Starting database operations...")
              const userResult = await supabase.auth.getUser()
              console.log("- User result:", userResult.data.user?.id ? "Found" : "Not found")

              const { data: versionData, error: versionError } = await supabase.rpc("get_next_version_number", {
                utility_uuid: contextInfo.id,
              })

              // Ensure version numbers in utility_versions start from 2 (since v1 is in utilities table)
              const nextVersion = Math.max(versionData || 1, 2)
              console.log("- Next version will be:", nextVersion)

              const versionInsert = {
                utility_id: contextInfo.id,
                user_id: userResult.data.user?.id,
                version_number: nextVersion,
                version_description: `AI revision: ${messageContent.substring(0, 50)}...`,
                generated_code: updatedCode,
              }

              const { data: insertedVersion, error: versionError2 } = await supabase
                .from("utility_versions")
                .insert(versionInsert)
                .select()
                .single()

              if (versionError2) {
                console.error("Error saving code version:", versionError2)
              } else {
                console.log("Code revision saved as version", nextVersion, "with ID:", insertedVersion.id)
                // Link this message to the created version
                botMessage.utility_version_id = insertedVersion.id
                
                // Mark this version as not deployed initially
                setVersionDeploymentInfo(prev => ({
                  ...prev,
                  [insertedVersion.id]: {
                    isDeployed: false,
                    dashboardUrl: undefined
                  }
                }))
              }

              const { data: utilityUpdate, error: updateError } = await supabase
                .from("utilities")
                .update({
                  generated_code: updatedCode,
                  updated_at: new Date().toISOString(),
                })
                .eq("id", contextInfo.id)

              if (updateError) {
                console.error("Error updating utility:", updateError)
              } else {
                console.log("Utility updated with new code")
              }
            } catch (error) {
              console.error("Error in code revision save:", error)
            }
          }
        } else if (hasCode) {
          console.log("Code blocks found but not Python - skipping version save")
        }
      }

      // Add bot message to state first (so it shows immediately)
      setMessages((prev) => [...prev, botMessage])

      // Save bot message to database (client-side like trends)
      await saveMessageToSupabase(botMessage, conversationId, contextInfo?.type, contextInfo?.id)

      if (isInitialState) {
        setIsInitialState(false)
        loadConversationHistory(true)
      }
    } catch (error: any) {
      console.error("[AI-Chat] Error sending message:", error)
      handleResponseError()
    } finally {
      setIsLoading(false)
      streamingBotMessageRef.current = null
    }
  }

  const toggleCodeVisibility = (messageId: string) => {
    setCodeVisibility((prev) => ({
      ...prev,
      [messageId]: !prev[messageId],
    }))
  }

  const streamResponse = async (response: any) => {
    if (!streamingBotMessageRef.current) return

    const currentMessage = streamingBotMessageRef.current
    if (currentMessage) {
      console.log("Completing stream for message:", currentMessage.id)
      const finalContent = response.message || response
      const hasCode = extractCodeBlocks(finalContent).length > 0
      
      setMessages((prev) =>
        prev.map((msg) =>
          msg.id === currentMessage.id ? { 
            ...msg, 
            content: finalContent, 
            isStreaming: false, 
            has_code: hasCode 
          } : msg,
        ),
      )
      // Clear the streaming reference
      streamingBotMessageRef.current = null
    }
  }

  const handleResponseError = () => {
    const loadingMessageId = (Date.now() + 1).toString()
    setMessages((prev) =>
      prev.filter((msg) => msg.id !== loadingMessageId && msg.id !== streamingBotMessageRef.current?.id),
    )
    const errorMessage: Message = {
      id: (Date.now() + 1).toString(),
      content: "Sorry, I encountered an error. Please try again.",
      message_type: "bot",
      created_at: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, errorMessage])
  }

  const handleNewChat = () => {
    resetToNewChat()
    setContextInfo(null)
  }

  const handleLoadConversation = async (conversation: ConversationHistory) => {
    setCurrentConversationId(conversation.id)
    setIsInitialState(false)
    setIsSidebarOpen(false)

    // Set explicit load flag for persistence across navigation
    sessionStorage.setItem("ai-chat-explicit-load", "true")

    // Restore context information if conversation has context
    if (conversation.context_type && conversation.context_id) {
      console.log("[AI-Chat] Restoring context for conversation:", conversation.context_type, conversation.context_id)
      
      // For utility context, fetch the utility information
      if (conversation.context_type === "utility") {
        try {
          const supabase = createClient()
          const { data: utility, error } = await supabase
            .from("utilities")
            .select("*")
            .eq("id", conversation.context_id)
            .single()

          if (!error && utility) {
            console.log("[AI-Chat] Restored utility context:", utility)
            setContextInfo({
              type: "utility",
              id: utility.id,
              file_name: utility.file_name,
              file_size: utility.file_size,
              status: utility.status,
              charts_count: utility.charts_count,
              generated_code: utility.generated_code,
              dashboard_url: utility.dashboard_url,
              sandbox_id: utility.sandbox_id
            })
          } else {
            console.warn("[AI-Chat] Could not restore utility context:", error)
            setContextInfo(null)
          }
        } catch (error) {
          console.error("[AI-Chat] Error restoring utility context:", error)
          setContextInfo(null)
        }
      } else {
        // For other context types, set basic context info
        setContextInfo({
          type: conversation.context_type,
          id: conversation.context_id
        })
      }
    } else {
      // No context for this conversation
      setContextInfo(null)
    }

    await loadMessages(conversation.id)
    persistConversationState()
  }

  const handleDeleteConversation = async (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation() // Prevent triggering the load conversation
    setOpenDropdown(null) // Close dropdown after clicking delete

    try {
      const response = await fetch("/api/ai-chat/trends", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "delete_conversation",
          conversation_id: conversationId,
        }),
      })

      if (response.ok) {
        // Remove from conversation history
        setConversationHistory((prev) => prev.filter((conv) => conv.id !== conversationId))

        // If this was the current conversation, reset to new chat
        if (currentConversationId === conversationId) {
          resetToNewChat()
        }

        // Clear cache to force refresh on next load
        sessionStorage.removeItem("ai-chat-history-cache")
        sessionStorage.removeItem("ai-chat-history-timestamp")
      } else {
        console.error("Failed to delete conversation")
        alert("Failed to delete conversation. Please try again.")
      }
    } catch (error) {
      console.error("Error deleting conversation:", error)
      alert("An error occurred while deleting the conversation.")
    }
  }

  const handleDropdownToggle = (conversationId: string, event: React.MouseEvent) => {
    event.stopPropagation()
    setOpenDropdown(openDropdown === conversationId ? null : conversationId)
  }

  const filteredConversationHistory = conversationHistory.filter(
    (conversation) =>
      (conversation.title || "").toLowerCase().includes(searchQuery.toLowerCase()) ||
      (conversation.lastMessage || "").toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const getInitialMessage = () => {
    if (contextInfo?.type === "trend") {
      return `What would you like to ask about "${contextInfo.title}"?`
    }
    if (contextInfo?.type === "utility") {
      return `What would you like to know about your "${contextInfo.title}" dashboard?`
    }
    return "What would you like to explore first? Thryve with me!"
  }

  return (
    <div
      className="fixed inset-0 flex bg-gray-50 overflow-hidden lg:left-64 lg:w-[calc(100%-16rem)] xl:left-72 xl:w-[calc(100%-18rem)]"
    >
      {isSidebarOpen && (
        <div
          className="absolute inset-0 bg-black/10 backdrop-blur-sm z-40"
          onClick={() => setIsSidebarOpen(false)}
        />
      )}

      <div
        className={`absolute right-0 top-0 h-full w-64 bg-white z-50 transform transition-transform duration-300 shadow-2xl border-l border-gray-200 ${
          isSidebarOpen ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <div className="p-4 h-full flex flex-col">
          <div className="relative mb-4">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search..."
              className="pl-10 bg-gray-50 border border-gray-200 text-gray-900 placeholder:text-gray-500 focus:border-gray-400 rounded-lg w-full py-2"
            />
          </div>

          <Button
            onClick={handleNewChat}
            className="w-full mb-4 bg-gray-100 hover:bg-gray-200 text-gray-700 border border-gray-200"
            variant="outline"
          >
            <Plus className="w-4 h-4 mr-2" />
            New Chat
          </Button>

          <div className="text-gray-700 text-sm mb-2 font-medium">Chat History</div>
          <div className="flex-1 min-h-0">
            <div className="h-[calc(100vh-320px)] pb-8 overflow-y-auto">
              <div className="space-y-3 pr-2">
                {filteredConversationHistory.length > 0 ? (
                  filteredConversationHistory.map((conversation) => (
                    <div key={conversation.id} className="relative group">
                      <Button
                        onClick={() => handleLoadConversation(conversation)}
                        variant="ghost"
                        className="w-full text-left justify-start p-4 text-gray-700 hover:bg-gray-100 min-h-[80px] border border-gray-200 rounded-lg max-w-[200px]"
                      >
                        <div className="w-full overflow-hidden pr-8">
                          <div className="font-medium text-sm leading-tight mb-2 truncate">{conversation.title}</div>
                          <div className="text-xs text-gray-500 leading-tight line-clamp-2 break-words">
                            {conversation.lastMessage}
                          </div>
                          <div className="text-xs text-gray-400 mt-2">
                            {new Date(conversation.timestamp).toLocaleDateString()}
                          </div>
                        </div>
                      </Button>
                      <div className="absolute top-2 right-2">
                        <button
                          onClick={(e) => handleDropdownToggle(conversation.id, e)}
                          className="p-1 rounded-full text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                          title="More options"
                        >
                          <MoreVertical className="w-4 h-4" />
                        </button>
                        {openDropdown === conversation.id && (
                          <div className="absolute right-0 top-8 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[120px]">
                            <button
                              onClick={(e) => handleDeleteConversation(conversation.id, e)}
                              className="w-full px-3 py-2 text-left text-sm text-red-600 hover:bg-red-50 rounded-lg flex items-center gap-2"
                            >
                              <Trash2 className="w-3 h-3" />
                              Delete
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-gray-500 text-sm text-center py-4">
                    {searchQuery ? "No conversations found" : "No chat history yet"}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      <div 
        className="flex flex-col w-full overflow-hidden" 
        data-chat-container
        style={{ height: 'var(--app-height, 100vh)' }}
      >
        <div className="p-1 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <img
                src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/ai_yve.svg"
                alt="AI Yve"
                className="w-16 h-16"
              />
            </div>
            <button
              onClick={() => setIsSidebarOpen(true)}
              className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              aria-label="Open chat history"
            >
              <Menu className="w-5 h-5 text-gray-600" />
            </button>
          </div>
        </div>

  <div className="flex-1 flex flex-col min-h-0 lg:pl-8 xl:pl-12">
          {isInitialState && messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 leading-5">
              <img
                src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/big_ai_yve.svg"
                alt="AI Yve"
                className="w-32 h-32 mb-6"
              />
              <div className="text-center">
                <p className="text-gray-600 text-lg mb-2">{getInitialMessage()}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full overflow-y-auto" ref={chatContainerRef}>
                <div className="space-y-4 p-4">
                  {messages.map((message) => (
                    <div
                      key={message.id}
                      className={`flex gap-3 ${message.message_type === "user" ? "justify-end" : "justify-start"}`}
                    >
                      {message.message_type === "bot" && (
                        <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                          <img
                            src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/yve_chat_bubble.svg"
                            alt="Yve"
                            className="w-8 h-8"
                          />
                        </div>
                      )}

                      <div className="max-w-[80%] group">
                        <Card
                          className={`${message.message_type === "user" ? "bg-[#BE0E0E] text-white" : "bg-white border-gray-200"}`}
                        >
                          <CardContent className="p-3">
                            {message.attachments && message.attachments.length > 0 && (
                              <div className="mb-3 space-y-2">
                                {message.attachments.map((attachment) => (
                                  <div
                                    key={attachment.id}
                                    className="flex items-center gap-2 p-2 bg-gray-100 rounded-lg"
                                  >
                                    <Paperclip className="w-4 h-4 text-gray-500" />
                                    <span className="text-sm text-gray-700 truncate">{attachment.name}</span>
                                    <span className="text-xs text-gray-500">
                                      ({(attachment.size / 1024).toFixed(1)} KB)
                                    </span>
                                  </div>
                                ))}
                              </div>
                            )}

                            {editingMessageId === message.id ? (
                              <div className="space-y-3">
                                <Textarea
                                  value={editingContent}
                                  onChange={(e) => setEditingContent(e.target.value)}
                                  className="min-h-[100px] resize-none"
                                  placeholder="Edit your message..."
                                />
                                <div className="flex gap-2">
                                  <Button size="sm" onClick={handleSaveEdit} disabled={!editingContent.trim()}>
                                    Save
                                  </Button>
                                  <Button size="sm" variant="outline" onClick={handleCancelEdit}>
                                    Cancel
                                  </Button>
                                </div>
                              </div>
                            ) : (
                              <>
                                {message.message_type === "bot" ? (
                                  <div className="space-y-3">
                                    {message.isStreaming ? (
                                      <div className="flex items-center space-x-2">
                                        <div className="flex space-x-1">
                                          <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"></div>
                                          <div
                                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                            style={{ animationDelay: "0.1s" }}
                                          ></div>
                                          <div
                                            className="w-2 h-2 bg-gray-400 rounded-full animate-bounce"
                                            style={{ animationDelay: "0.2s" }}
                                          ></div>
                                        </div>
                                        <span className="text-sm">Yve is thinking...</span>
                                      </div>
                                    ) : revisionStatus[message.id] === "generating" ? (
                                      <div className="space-y-3">
                                        <div className="flex items-center space-x-3">
                                          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                          <span className="text-sm font-medium">Generating revised code...</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                          <div
                                            className="bg-blue-500 h-2 rounded-full animate-pulse"
                                            style={{ width: "30%" }}
                                          ></div>
                                        </div>
                                      </div>
                                    ) : revisionStatus[message.id] === "deploying" ? (
                                      <div className="space-y-3">
                                        <div className="flex items-center space-x-3">
                                          <div className="w-6 h-6 border-2 border-green-500 border-t-transparent rounded-full animate-spin"></div>
                                          <span className="text-sm font-medium">Deploying dashboard...</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                          <div
                                            className="bg-green-500 h-2 rounded-full animate-pulse"
                                            style={{ width: "80%" }}
                                          ></div>
                                        </div>
                                      </div>
                                    ) : revisionStatus[message.id] === "loading" ? (
                                      <div className="space-y-3">
                                        <div className="flex items-center space-x-3">
                                          <div className="w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                                          <span className="text-sm font-medium">Processing revision...</span>
                                        </div>
                                        <div className="w-full bg-gray-200 rounded-full h-2">
                                          <div
                                            className="bg-blue-500 h-2 rounded-full animate-pulse"
                                            style={{ width: "60%" }}
                                          ></div>
                                        </div>
                                      </div>
                                    ) : (
                                      <div
                                        className="prose prose-sm max-w-none prose-gray
                                        prose-headings:text-gray-900 prose-headings:font-semibold prose-headings:mb-3 prose-headings:mt-4
                                        prose-p:text-gray-700 prose-p:leading-relaxed prose-p:mb-4
                                        prose-ul:my-4 prose-ul:space-y-2 prose-li:text-gray-700 prose-li:leading-relaxed
                                        prose-ol:my-4 prose-ol:space-y-2
                                        prose-strong:text-gray-900 prose-strong:font-semibold
                                        prose-em:text-gray-800 prose-em:italic
                                        prose-code:bg-gray-100 prose-code:px-2 prose-code:py-1 prose-code:rounded prose-code:text-sm prose-code:font-mono prose-code:text-gray-800
                                        prose-pre:bg-gray-900 prose-pre:text-gray-100 prose-pre:p-4 prose-pre:rounded-lg prose-pre:overflow-x-auto prose-pre:my-4
                                        prose-blockquote:border-l-4 prose-blockquote:border-gray-300 prose-blockquote:pl-4 prose-blockquote:italic prose-blockquote:text-gray-600 prose-blockquote:my-4
                                        prose-hr:border-gray-300 prose-hr:my-6
                                        prose-a:text-blue-600 prose-a:underline prose-a:hover:text-blue-800
                                        first:prose-p:mt-0 last:prose-p:mb-0"
                                      >
                                        <ReactMarkdown
                                          components={{
                                            h1: ({ children }) => (
                                              <h1 className="text-lg font-semibold text-gray-900 mb-3 mt-4 first:mt-0 border-b border-gray-200 pb-2">
                                                {children}
                                              </h1>
                                            ),
                                            h2: ({ children }) => (
                                              <h2 className="text-base font-semibold text-gray-900 mb-3 mt-4 first:mt-0">
                                                {children}
                                              </h2>
                                            ),
                                            h3: ({ children }) => (
                                              <h3 className="text-sm font-semibold text-gray-900 mb-2 mt-3 first:mt-0">
                                                {children}
                                              </h3>
                                            ),
                                            p: ({ children }) => (
                                              <p className="text-gray-700 leading-relaxed mb-4 last:mb-0">{children}</p>
                                            ),
                                            ul: ({ children }) => <ul className="space-y-2 my-4 pl-4">{children}</ul>,
                                            ol: ({ children }) => <ol className="space-y-2 my-4 pl-4">{children}</ol>,
                                            li: ({ children }) => (
                                              <li className="text-gray-700 leading-relaxed relative pl-2 before:content-['•'] before:absolute before:left-[-8px] before:text-gray-400">
                                                {children}
                                              </li>
                                            ),
                                            code: ({ children, ...props }) => {
                                              const isInline = !props.className?.includes("language-")
                                              return isInline ? (
                                                <code className="bg-gray-100 px-2 py-0.5 rounded text-sm font-mono text-gray-800">
                                                  {children}
                                                </code>
                                              ) : (
                                                <code className="block bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4 text-sm font-mono">
                                                  {children}
                                                </code>
                                              )
                                            },
                                            pre: ({ children }) => (
                                              <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto my-4">
                                                {children}
                                              </pre>
                                            ),
                                            blockquote: ({ children }) => (
                                              <blockquote className="border-l-4 border-blue-300 pl-4 italic text-gray-600 my-4 bg-blue-50 py-2 rounded-r">
                                                {children}
                                              </blockquote>
                                            ),
                                            hr: () => <hr className="border-gray-300 my-6" />,
                                            strong: ({ children }) => (
                                              <strong className="font-semibold text-gray-900">{children}</strong>
                                            ),
                                            em: ({ children }) => <em className="italic text-gray-800">{children}</em>,
                                            a: ({ href, children }) => (
                                              <a
                                                href={href}
                                                className="text-blue-600 underline hover:text-blue-800 transition-colors"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                              >
                                                {children}
                                              </a>
                                            ),
                                          }}
                                        >
                                          {removeCodeBlocks(message.content)}
                                        </ReactMarkdown>
                                      </div>
                                    )}

                                    {message.message_type === "bot" &&
                                      !message.isStreaming &&
                                      message.has_code &&
                                      (() => {
                                        const codeBlocks = extractCodeBlocks(message.content)
                                        console.log(
                                          "Showing accordion for message:",
                                          message.id,
                                          "has_code:",
                                          message.has_code,
                                          "codeBlocks:",
                                          codeBlocks.length,
                                        )
                                        return (
                                          <div className="mt-4 w-full overflow-hidden">
                                            <Accordion type="single" collapsible className="w-full">
                                              <AccordionItem
                                                value="code-section"
                                                className="border border-gray-200 rounded-lg"
                                              >
                                                <AccordionTrigger className="text-gray-700 hover:text-gray-800 px-4 py-3 text-sm font-medium">
                                                  View Code ({codeBlocks.length} block{codeBlocks.length > 1 ? "s" : ""}
                                                  )
                                                </AccordionTrigger>
                                                <AccordionContent className="w-full overflow-hidden px-4 pb-4">
                                                  <div className="space-y-4">
                                                    {codeBlocks.map((block, index) => (
                                                      <div
                                                        key={index}
                                                        className="bg-gray-900 rounded-lg overflow-hidden"
                                                      >
                                                        <div className="flex items-center justify-between px-4 py-2 bg-gray-800">
                                                          <span className="text-xs text-gray-400 font-mono">
                                                            {block.language.toUpperCase()} Code
                                                          </span>
                                                          <Button
                                                            size="sm"
                                                            variant="ghost"
                                                            onClick={() => {
                                                              navigator.clipboard.writeText(block.code)
                                                            }}
                                                            className="text-gray-400 hover:text-white h-6 px-2 text-xs"
                                                          >
                                                            Copy
                                                          </Button>
                                                        </div>
                                                        <div className="p-4 overflow-x-auto">
                                                          <pre className="text-sm text-gray-100 font-mono whitespace-pre">
                                                            <code>{block.code}</code>
                                                          </pre>
                                                        </div>
                                                      </div>
                                                    ))}
                                                  </div>
                                                </AccordionContent>
                                              </AccordionItem>
                                            </Accordion>
                                          </div>
                                        )
                                      })()}

                                    {contextInfo?.type === "utility" &&
                                      message.message_type === "bot" &&
                                      !message.isStreaming &&
                                      (message.content.includes("Your request has been revised") ||
                                        message.content.includes("Click 'View Dashboard'") ||
                                        message.content.includes("dashboard code has been successfully updated") ||
                                        message.content.includes("Here's the updated") ||
                                        message.content.includes("I've updated") ||
                                        message.content.includes("updated dashboard") ||
                                        (message.has_code &&
                                          extractCodeBlocks(message.content).some(
                                            (block) =>
                                              block.language === "python" &&
                                              (block.code.includes("streamlit") || block.code.includes("plotly")),
                                          ))) && (
                                        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
                                          <div className="flex items-center justify-between">
                                            <div className="flex items-center space-x-2">
                                              <div className="w-2 h-2 bg-blue-500 rounded-full"></div>
                                              <span className="text-sm font-medium text-blue-800">
                                                Dashboard Code Updated
                                              </span>
                                            </div>
                                            <div className="flex gap-2">
                                              {(() => {
                                                const versionId = message.utility_version_id
                                                const deploymentInfo = versionId ? versionDeploymentInfo[versionId] : null
                                                const isDeployed = deploymentInfo?.isDeployed || false
                                                const isDeploying = deploymentStatus[message.id] === "deploying"
                                                
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
                                                } else if (isDeployed && deploymentInfo?.dashboardUrl && !deploymentInfo?.isExpired) {
                                                  return (
                                                    <Button
                                                      size="sm"
                                                      onClick={() => {
                                                        setDashboardUrl(formatDashboardUrl(deploymentInfo.dashboardUrl!))
                                                        setDashboardFileName(contextInfo.file_name || "dashboard.py")
                                                      }}
                                                      className="bg-green-600 hover:bg-green-700 text-white"
                                                    >
                                                      View Dashboard
                                                    </Button>
                                                  )
                                                } else {
                                                  return (
                                                    <Button
                                                      size="sm"
                                                      onClick={async () => {
                                                        try {
                                                          setDeploymentStatus(prev => ({ ...prev, [message.id]: "deploying" }))
                                                          
                                                          console.log(
                                                            "[AI-Chat] Deploying dashboard for utility:",
                                                            contextInfo.id,
                                                          )

                                                          // FIRST: Try to get updated code from THIS specific message
                                                          let updatedCode = message.extractedCode

                                                          // FALLBACK: Extract from message content if not stored
                                                          if (!updatedCode) {
                                                            const codeBlocks = extractCodeBlocks(message.content)
                                                            const pythonBlock = codeBlocks.find(
                                                              (block) =>
                                                                block.language === "python" ||
                                                                block.code.includes("streamlit"),
                                                            )
                                                            if (pythonBlock) {
                                                              updatedCode = pythonBlock.code
                                                            }
                                                          }

                                                          // LAST RESORT: Use context code (this is what was causing the issue)
                                                          if (!updatedCode) {
                                                            updatedCode = contextInfo.generated_code
                                                            console.log("[AI-Chat] Using fallback context code (not ideal)")
                                                          }

                                                          if (!updatedCode) {
                                                            console.error(
                                                              "[AI-Chat] No code found in message, extracted code, or context",
                                                            )
                                                            alert("No code found to deploy. Please try regenerating the code first.")
                                                            setDeploymentStatus(prev => ({ ...prev, [message.id]: "idle" }))
                                                            return
                                                          }

                                                          console.log("=".repeat(80))
                                                          console.log("DEPLOYING CODE FROM MESSAGE - FULL CODE BEING SENT:")
                                                          console.log("=".repeat(80))
                                                          console.log(updatedCode)
                                                          console.log("=".repeat(80))
                                                          console.log("Code length:", updatedCode.length, "characters")
                                                          console.log("Utility ID:", contextInfo.id)
                                                          console.log("File name:", contextInfo.file_name)
                                                          console.log("Message version ID:", message.utility_version_id)
                                                          console.log("=".repeat(80))

                                                          // Call the deployment API directly
                                                          const response = await fetch("/api/generate-dashboard", {
                                                            method: "POST",
                                                            headers: { "Content-Type": "application/json" },
                                                            body: JSON.stringify({
                                                              utilityId: contextInfo.id,
                                                              fileName: contextInfo.file_name,
                                                              generatedCode: updatedCode,
                                                              isRedeployment: true,
                                                              versionId: message.utility_version_id, // Pass version ID if available
                                                            }),
                                                          })

                                                          const result = await response.json()

                                                          if (result.success && result.dashboardUrl) {
                                                            console.log(
                                                              "[AI-Chat] Dashboard deployed successfully:",
                                                              result.dashboardUrl,
                                                            )

                                                            // Update the database
                                                            const supabase = createClient()
                                                            const expiresAt = new Date(
                                                              Date.now() + 60 * 60 * 1000,
                                                            ).toISOString()

                                                            // Update utilities table
                                                            await supabase
                                                              .from("utilities")
                                                              .update({
                                                                status: "ready",
                                                                dashboard_url: result.dashboardUrl,
                                                                sandbox_id: result.sandboxId,
                                                                dashboard_expires_at: expiresAt,
                                                                error_message: null,
                                                              })
                                                              .eq("id", contextInfo.id)

                                                            // Mark all versions as not deployed first
                                                            await supabase
                                                              .from("utility_versions")
                                                              .update({
                                                                is_deployed: false,
                                                                dashboard_url: null,
                                                                sandbox_id: null,
                                                                dashboard_expires_at: null,
                                                              })
                                                              .eq("utility_id", contextInfo.id)

                                                            // Mark the specific version from this message as deployed
                                                            if (message.utility_version_id) {
                                                              await supabase
                                                                .from("utility_versions")
                                                                .update({
                                                                  is_deployed: true,
                                                                  dashboard_url: result.dashboardUrl,
                                                                  sandbox_id: result.sandboxId,
                                                                  deployed_at: new Date().toISOString(),
                                                                  dashboard_expires_at: expiresAt,
                                                                })
                                                                .eq("id", message.utility_version_id)
                                                              
                                                              console.log("[AI-Chat] Marked version", message.utility_version_id, "as deployed")
                                                              
                                                              // Update local deployment info
                                                              setVersionDeploymentInfo(prev => ({
                                                                ...prev,
                                                                [message.utility_version_id!]: {
                                                                  isDeployed: true,
                                                                  dashboardUrl: result.dashboardUrl,
                                                                  isExpired: false
                                                                }
                                                              }))
                                                            } else {
                                                              // Fallback: mark latest version as deployed
                                                              const { data: latestVersion } = await supabase
                                                                .from("utility_versions")
                                                                .select("id")
                                                                .eq("utility_id", contextInfo.id)
                                                                .order("version_number", { ascending: false })
                                                                .limit(1)
                                                                .single()

                                                              if (latestVersion) {
                                                                await supabase
                                                                  .from("utility_versions")
                                                                  .update({
                                                                    is_deployed: true,
                                                                    dashboard_url: result.dashboardUrl,
                                                                    sandbox_id: result.sandboxId,
                                                                    deployed_at: new Date().toISOString(),
                                                                    dashboard_expires_at: expiresAt,
                                                                  })
                                                                  .eq("id", latestVersion.id)
                                                              }
                                                            }
                                                            
                                                            setDeploymentStatus(prev => ({ ...prev, [message.id]: "deployed" }))

                                                            // Show the dashboard in modal
                                                            setDashboardUrl(formatDashboardUrl(result.dashboardUrl))
                                                            setDashboardFileName(contextInfo.file_name || "dashboard.py")
                                                          } else {
                                                            console.error("[AI-Chat] Deployment failed:", result.error)
                                                            alert(
                                                              "Failed to deploy dashboard: " +
                                                                (result.error || "Unknown error"),
                                                            )
                                                            setDeploymentStatus(prev => ({ ...prev, [message.id]: "idle" }))
                                                          }
                                                        } catch (error) {
                                                          console.error("[AI-Chat] Error deploying dashboard:", error)
                                                          alert("Failed to deploy dashboard. Please try again.")
                                                          setDeploymentStatus(prev => ({ ...prev, [message.id]: "idle" }))
                                                        }
                                                      }}
                                                      className="bg-blue-600 hover:bg-blue-700 text-white"
                                                    >
                                                      Deploy this version
                                                    </Button>
                                                  )
                                                }
                                              })()}
                                            </div>
                                          </div>
                                        </div>
                                      )}

                                    {revisionStatus[message.id] === "completed" && deploymentUrls[message.id] && (
                                      <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
                                        <div className="flex items-center justify-between">
                                          <div className="flex items-center space-x-2">
                                            <div className="w-2 h-2 bg-green-500 rounded-full"></div>
                                            <span className="text-sm font-medium text-green-800">
                                              Dashboard Updated Successfully
                                            </span>
                                          </div>
                                          <Button
                                            size="sm"
                                            onClick={() => {
                                              setDashboardUrl(formatDashboardUrl(deploymentUrls[message.id]))
                                              setDashboardFileName(contextInfo?.file_name || "dashboard.py")
                                            }}
                                            className="bg-green-600 hover:bg-green-700 text-white"
                                          >
                                            View Dashboard
                                          </Button>
                                        </div>
                                      </div>
                                    )}

                                    {revisionStatus[message.id] === "failed" && (
                                      <div className="mt-4 p-4 bg-red-50 border border-red-200 rounded-lg">
                                        <div className="flex items-center space-x-2">
                                          <div className="w-2 h-2 bg-red-500 rounded-full"></div>
                                          <span className="text-sm font-medium text-red-800">Deployment Failed</span>
                                        </div>
                                      </div>
                                    )}
                                  </div>
                                ) : (
                                  <p className="text-sm leading-relaxed">{message.content}</p>
                                )}
                              </>
                            )}

                            <div className="flex items-center justify-between mt-2">
                              <p
                                className={`text-xs ${message.message_type === "user" ? "text-red-100" : "text-gray-500"}`}
                              >
                                {new Date(message.created_at).toLocaleTimeString([], {
                                  hour: "2-digit",
                                  minute: "2-digit",
                                })}
                              </p>

                              <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                {message.message_type === "user" && !message.isStreaming && (
                                  <Button
                                    onClick={() => handleEditMessage(message.id, message.content)}
                                    size="sm"
                                    variant="ghost"
                                    className="h-7 w-7 p-0 hover:bg-blue-100 hover:text-blue-600 transition-colors"
                                    title="Edit message"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                )}
                                <Button
                                  onClick={() => handleCopyMessage(message.content, message.id)}
                                  size="sm"
                                  variant="ghost"
                                  className="h-7 w-7 p-0 hover:bg-gray-100 transition-colors"
                                  title="Copy message"
                                >
                                  {copiedMessageId === message.id ? (
                                    <Check className="w-3.5 h-3.5 text-green-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5" />
                                  )}
                                </Button>
                              </div>
                            </div>
                          </CardContent>
                        </Card>
                      </div>

                      {message.message_type === "user" && (
                        <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                          <User className="w-4 h-4 text-gray-600" />
                        </div>
                      )}
                    </div>
                  ))}
                  <div ref={messagesEndRef} />
                </div>
              </div>
            </div>
          )}

          {isInitialState && messages.length === 0 && (
            <div className="px-4 pb-2 flex-shrink-0">
              <div className="relative">
                <div className="overflow-hidden" ref={emblaRef}>
                  <div className="flex gap-3 pb-2">
                    {contextInfo?.type === "trend" ? (
                      <>
                        <Button
                          variant="outline"
                          className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                          onClick={() => handleQuickAction(`How can BPI implement ${contextInfo.title}?`)}
                        >
                          Implementation Strategy
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                          onClick={() => handleQuickAction(`What are the risks of ${contextInfo.title}?`)}
                        >
                          Risk Analysis
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                          onClick={() => handleQuickAction(`Market opportunity for ${contextInfo.title}`)}
                        >
                          Market Opportunity
                        </Button>
                      </>
                    ) : contextInfo?.type === "utility" ? (
                      <>
                        <Button
                          variant="outline"
                          className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                          onClick={() =>
                            handleQuickAction(`Explain the insights from my ${contextInfo.title} dashboard`)
                          }
                        >
                          Explain Insights
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                          onClick={() => handleQuickAction(`How can I improve my ${contextInfo.title} dashboard?`)}
                        >
                          Improve Dashboard
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                          onClick={() => handleQuickAction(`Add new visualizations to my dashboard`)}
                        >
                          Add Visualizations
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                          onClick={() => handleQuickAction(`Show version history and revisions`)}
                        >
                          Version History
                        </Button>
                      </>
                    ) : (
                      <>
                        <Button
                          variant="outline"
                          className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                          onClick={() => handleQuickAction("Top Opportunities Today")}
                        >
                          Top Opportunities Today
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                          onClick={() => handleQuickAction("Run a Market Simulator")}
                        >
                          Run a Market Simulator
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                          onClick={() => handleQuickAction("Analyze Market Trends")}
                        >
                          Analyze Market Trends
                        </Button>
                        <Button
                          variant="outline"
                          className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                          onClick={() => handleQuickAction("Generate Business Ideas")}
                        >
                          Generate Business Ideas
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {showFileUpload && selectedFiles.length > 0 && (
          <div className="px-5 py-2 bg-gray-50 border-t border-gray-200">
            <div className="space-y-2">
              <div className="text-sm text-gray-600 font-medium">Selected Files:</div>
              {selectedFiles.map((file, index) => (
                <div key={index} className="flex items-center justify-between bg-white p-2 rounded-lg border">
                  <div className="flex items-center gap-2">
                    <Paperclip className="w-4 h-4 text-gray-500" />
                    <span className="text-sm text-gray-700 truncate">{file.name}</span>
                    <span className="text-xs text-gray-500">({(file.size / 1024).toFixed(1)} KB)</span>
                  </div>
                  <Button
                    onClick={() => handleRemoveFile(index)}
                    size="sm"
                    variant="ghost"
                    className="h-6 w-6 p-0 hover:bg-gray-200"
                  >
                    <X className="w-3 h-3" />
                  </Button>
                </div>
              ))}
            </div>
          </div>
        )}

  <div className="p-5 pb-8 bg-white border-t border-gray-200 flex-shrink-0 mb-16 lg:mb-0">
          <div className="flex items-center gap-3 bg-gray-100 rounded-full px-4 py-1.5">
            <button
              onClick={() => fileInputRef.current?.click()}
              className="p-1.5 hover:bg-gray-200 rounded-full transition-colors"
              title="Attach file"
            >
              <Paperclip className="w-4 h-4 text-gray-600" />
            </button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileSelect}
              className="hidden"
              accept=".txt,.pdf,.doc,.docx,.jpg,.jpeg,.png,.gif"
            />
            <Input
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault()
                  handleSendMessage()
                }
              }}
              placeholder="Ask Yve anything..."
              className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder:text-gray-500"
              disabled={isLoading}
            />
            <Button
              onClick={handleSendMessage}
              size="sm"
              className="bg-[#BE0E0E] hover:bg-[#A00C0C] text-white rounded-full p-2 h-8 w-8"
              disabled={(!inputValue.trim() && selectedFiles.length === 0) || isLoading}
            >
              <Send className="w-4 h-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Dashboard Browser Modal */}
      {dashboardUrl && (
        <DashboardBrowserModal
          url={dashboardUrl}
          onClose={() => setDashboardUrl(null)}
          fileName={dashboardFileName}
        />
      )}
    </div>
  )
}

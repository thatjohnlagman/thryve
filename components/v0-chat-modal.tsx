"use client"

import type React from "react"

import { useState, useEffect, useRef } from "react"
import {
  X,
  Send,
  Loader2,
  ExternalLink,
  RefreshCw,
  Menu,
  Edit2,
  Copy,
  Check,
  Paperclip,
  Plus,
  Search,
  User,
  Code,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { Textarea } from "@/components/ui/textarea"
import ReactMarkdown from "react-markdown"

interface V0ChatMessage {
  id: string
  content: string
  role: "user" | "assistant"
  createdAt: string
  type?: string
  demoUrl?: string
  isStreaming?: boolean
  attachments?: FileAttachment[]
  extractedCode?: string
  has_code?: boolean
}

interface FileAttachment {
  id: string
  name: string
  size: number
  type: string
  url: string
}

interface V0Chat {
  id: string
  title?: string
  webUrl?: string
  demoUrl?: string
}

interface Prototype {
  id: string
  title: string
  description: string
  v0_project_id?: string
  v0_url?: string
}

interface V0ChatModalProps {
  isOpen: boolean
  onClose: () => void
  prototype: Prototype
  onNewDemo?: (demoUrl: string) => void
}

const removeCodeBlocks = (content: string) => {
  return content
    .replace(/```[\s\S]*?```/g, "")
    .replace(/`{3,}[\s\S]*?`{3,}/g, "")
    .replace(/^\s*```.*$/gm, "") // Remove standalone code fence lines
    .replace(/\n\s*\n\s*\n/g, "\n\n") // Clean up excessive newlines
    .trim()
}

const extractCodeBlocks = (content: string) => {
  const patterns = [
    /```(\w+)?\s*\n([\s\S]*?)\n\s*```/g,
    /```(\w+)?\s*([\s\S]*?)\s*```/g,
    /`{3,}(\w+)?\s*\n([\s\S]*?)\n\s*`{3,}/g,
    // Handle v0-specific patterns
    /```(\w+)\s+file="[^"]*"\s*\n([\s\S]*?)\n\s*```/g,
  ]

  const codeBlocks: { language: string; code: string }[] = []

  for (let i = 0; i < patterns.length; i++) {
    const regex = patterns[i]
    let match
    while ((match = regex.exec(content)) !== null) {
      const language = match[1]?.toLowerCase() || "text"
      const code = match[2]?.trim()
      if (code && code.length > 0) {
        const isDuplicate = codeBlocks.some((block) => block.code === code)
        if (!isDuplicate) {
          codeBlocks.push({
            language,
            code,
          })
        }
      }
    }
    regex.lastIndex = 0
  }

  return codeBlocks
}

export function V0ChatModal({ isOpen, onClose, prototype, onNewDemo }: V0ChatModalProps) {
  const [messages, setMessages] = useState<V0ChatMessage[]>([])
  const [chat, setChat] = useState<V0Chat | null>(null)
  const [input, setInput] = useState("")
  const [isLoading, setIsLoading] = useState(true)
  const [isSending, setIsSending] = useState(false)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [editingMessageId, setEditingMessageId] = useState<string | null>(null)
  const [editingContent, setEditingContent] = useState("")
  const [copiedMessageId, setCopiedMessageId] = useState<string | null>(null)
  const [selectedFiles, setSelectedFiles] = useState<File[]>([])
  const [showFileUpload, setShowFileUpload] = useState(false)
  const [searchQuery, setSearchQuery] = useState("")
  const [isInitialState, setIsInitialState] = useState(true)
  const [canModifyProject, setCanModifyProject] = useState(false)
  const [projectFiles, setProjectFiles] = useState<{ [key: string]: string }>({})

  const scrollAreaRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamingBotMessageRef = useRef<V0ChatMessage | null>(null)

  const chatId = prototype.v0_project_id

  useEffect(() => {
    if (isOpen) {
      loadChatHistory()
      collectProjectFiles()
      // Prevent body scroll like Chat Yve
      document.body.style.overflow = "hidden"
      document.documentElement.style.overflow = "hidden"
    }
    return () => {
      document.body.style.overflow = ""
      document.documentElement.style.overflow = ""
    }
  }, [isOpen])

  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTo({
        top: chatContainerRef.current.scrollHeight,
        behavior: "smooth",
      })
    }
  }, [messages])

  const loadChatHistory = async () => {
    try {
      setIsLoading(true)
      console.log("[V0-CHAT] Loading chat history for:", chatId)

      if (!chatId) {
        console.warn("[V0-CHAT] No chat ID available for this prototype")
        setMessages([])
        setChat({ id: "", title: prototype.title })
        setIsLoading(false)
        setIsInitialState(true)
        return
      }

      const response = await fetch("/api/v0-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "getHistory",
          chatId,
        }),
      })

      const data = await response.json()

      if (data.success) {
        const transformedMessages = (data.messages || []).map((msg: any) => ({
          ...msg,
          role: msg.role === "user" ? "user" : "assistant",
          createdAt: msg.createdAt,
          has_code: msg.role === "assistant" ? extractCodeBlocks(msg.content).length > 0 : false,
        }))
        setMessages(transformedMessages)
        setChat(data.chat)
        setIsInitialState(transformedMessages.length === 0)
        console.log("[V0-CHAT] Loaded", transformedMessages.length, "messages")
      } else {
        console.error("[V0-CHAT] Failed to load chat history:", data.error)
        setMessages([])
        setChat({ id: "", title: prototype.title })
        setIsInitialState(true)
      }
    } catch (error) {
      console.error("[V0-CHAT] Error loading chat history:", error)
      setMessages([])
      setChat({ id: "", title: prototype.title })
      setIsInitialState(true)
    } finally {
      setIsLoading(false)
    }
  }

  const handleEditMessage = (messageId: string, content: string) => {
    setEditingMessageId(messageId)
    setEditingContent(content)
  }

  const handleSaveEdit = async () => {
    if (!editingMessageId || !editingContent.trim()) return

    const editedMessage = messages.find((msg) => msg.id === editingMessageId)
    const isUserMessage = editedMessage?.role === "user"

    setMessages((prev) => prev.map((msg) => (msg.id === editingMessageId ? { ...msg, content: editingContent } : msg)))
    setEditingMessageId(null)
    setEditingContent("")

    if (isUserMessage) {
      const messageIndex = messages.findIndex((msg) => msg.id === editingMessageId)
      setMessages((prev) => prev.slice(0, messageIndex + 1))
      await sendMessage(editingContent, true, editingMessageId)
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

  const sendMessage = async (messageContent?: string, isEdit = false, editMessageId?: string) => {
    const content = messageContent || input
    if ((!content.trim() && selectedFiles.length === 0) || isSending) return

    if (!chatId) {
      console.error("❌ [V0-CHAT] Cannot send message: No chat ID available")
      return
    }

    setIsSending(true)
    if (!messageContent) {
      setInput("")
      setSelectedFiles([])
      setShowFileUpload(false)
    }

    const userMessage: V0ChatMessage = {
      id: `temp-${Date.now()}`,
      content: content,
      role: "user",
      createdAt: new Date().toISOString(),
      attachments: selectedFiles.map((file, index) => ({
        id: `${Date.now()}-${index}`,
        name: file.name,
        size: file.size,
        type: file.type,
        url: URL.createObjectURL(file),
      })),
    }

    if (!isEdit) {
      setMessages((prev) => [...prev, userMessage])
    }

    const loadingMessage: V0ChatMessage = {
      id: (Date.now() + 1).toString(),
      content: "Yve is thinking...",
      role: "assistant",
      createdAt: new Date().toISOString(),
      isStreaming: true,
    }
    setMessages((prev) => [...prev, loadingMessage])
    streamingBotMessageRef.current = loadingMessage

    try {
      console.log("[V0-CHAT] Sending message:", content.substring(0, 50) + "...")

      const action = canModifyProject && Object.keys(projectFiles).length > 0 ? "updateProject" : "sendMessage"

      const response = await fetch("/api/v0-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action,
          chatId,
          message: content,
          ...(action === "updateProject" && { projectFiles }),
        }),
      })

      const data = await response.json()

      if (data.success) {
        setMessages((prev) => prev.filter((msg) => msg.id !== loadingMessage.id))

        const realUserMessage = { ...userMessage, id: `user-${Date.now()}` }
        const newMessages = isEdit ? [] : [realUserMessage]

        if (data.message) {
          const botMessage = {
            ...data.message,
            role: "assistant" as const,
            has_code: extractCodeBlocks(data.message.content).length > 0,
          }
          newMessages.push(botMessage)
        }

        setMessages((prev) => {
          if (isEdit) {
            return [...prev, ...newMessages]
          }
          const withoutTemp = prev.filter((m) => m.id !== userMessage.id)
          return [...withoutTemp, ...newMessages]
        })

        if (data.chat) {
          setChat(data.chat)
        }

        if (data.files && data.files.length > 0) {
          console.log(`[V0-CHAT] Received ${data.files.length} updated files from Yve`)
          // You could implement file download/update logic here
        }

        if (data.newDemoUrl && data.newDemoUrl !== prototype.v0_url) {
          console.log("[V0-CHAT] New demo URL received, updating prototype in database...")
          console.log(`   Old URL: ${prototype.v0_url}`)
          console.log(`   New URL: ${data.newDemoUrl}`)

          try {
            const updateResponse = await fetch("/api/prototypes/update-url", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prototypeId: prototype.id,
                newUrl: data.newDemoUrl,
              }),
            })

            if (updateResponse.ok) {
              console.log("[V0-CHAT] Prototype URL updated successfully in database")
              // Update the local prototype object
              prototype.v0_url = data.newDemoUrl
            } else {
              console.error("[V0-CHAT] Failed to update prototype URL in database")
            }
          } catch (error) {
            console.error("❌ [V0-CHAT] Error updating prototype URL:", error)
          }
        }

        if (data.newDemoUrl && onNewDemo) {
          onNewDemo(data.newDemoUrl)
        }

        if (isInitialState) {
          setIsInitialState(false)
        }

        console.log("[V0-CHAT] Message sent successfully")
      } else {
        console.error("[V0-CHAT] Failed to send message:", data.error)
        setMessages((prev) => prev.filter((m) => m.id !== userMessage.id && m.id !== loadingMessage.id))
      }
    } catch (error) {
      console.error("[V0-CHAT] Error sending message:", error)
      setMessages((prev) => prev.filter((m) => m.id !== userMessage.id && m.id !== loadingMessage.id))
    } finally {
      setIsSending(false)
      streamingBotMessageRef.current = null
    }
  }

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault()
      sendMessage()
    }
  }

  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  const getInitialMessage = () => {
    return `What would you like to ask Yve about "${prototype.title}"?`
  }

  const handleQuickAction = (action: string) => {
    setInput(action)
  }

  const collectProjectFiles = async () => {
    try {
      console.log("[V0-CHAT] Collecting current project files...")

      const files: { [key: string]: string } = {}

      setProjectFiles(files)
      setCanModifyProject(Object.keys(files).length > 0)

      console.log(`[V0-CHAT] Collected ${Object.keys(files).length} project files`)
    } catch (error) {
      console.error("[V0-CHAT] Error collecting project files:", error)
    }
  }

  const createNewV0Project = async () => {
    try {
      setIsLoading(true)
      console.log("🆕 [V0-CHAT] Creating new Yve project...")

      const response = await fetch("/api/v0-chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: "createProject",
          message: `Create a new version of "${prototype.title}" with improvements`,
          projectName: prototype.title,
        }),
      })

      const data = await response.json()

      if (data.success) {
        setChat({
          id: data.chatId,
          title: prototype.title,
          webUrl: data.webUrl,
          demoUrl: data.demoUrl,
        })

        if (data.message) {
          setMessages([
            {
              ...data.message,
              role: "assistant" as const,
              has_code: extractCodeBlocks(data.message.content).length > 0,
            },
          ])
        }

        if (data.chatId || data.demoUrl) {
          console.log("[V0-CHAT] New project created, updating prototype in database...")
          console.log(`   New Project ID: ${data.chatId}`)
          console.log(`   New Demo URL: ${data.demoUrl}`)

          try {
            const updateResponse = await fetch("/api/prototypes/update-project", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                prototypeId: prototype.id,
                v0ProjectId: data.chatId,
                v0Url: data.demoUrl,
              }),
            })

            if (updateResponse.ok) {
              console.log("[V0-CHAT] Prototype updated with new project details")
              // Update the local prototype object
              prototype.v0_project_id = data.chatId
              prototype.v0_url = data.demoUrl
            } else {
              console.error("[V0-CHAT] Failed to update prototype with new project details")
            }
          } catch (error) {
            console.error("[V0-CHAT] Error updating prototype with new project details:", error)
          }
        }

        if (data.demoUrl && onNewDemo) {
          onNewDemo(data.demoUrl)
        }

        setIsInitialState(false)
        console.log("[V0-CHAT] Created new Yve project successfully")
      } else {
        console.error("[V0-CHAT] Failed to create new project:", data.error)
      }
    } catch (error) {
      console.error("[V0-CHAT] Error creating new project:", error)
    } finally {
      setIsLoading(false)
    }
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 lg:left-64 xl:left-72 bg-gray-50 z-50 flex overflow-hidden">
      {isSidebarOpen && (
        <div className="fixed inset-0 bg-black/10 backdrop-blur-sm z-40" onClick={() => setIsSidebarOpen(false)} />
      )}

      <div
        className={`fixed left-0 top-0 h-full w-64 bg-white z-50 transform transition-transform duration-300 shadow-2xl border-r border-gray-200 ${
          isSidebarOpen ? "translate-x-0" : "-translate-x-full"
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

          <div className="mb-6 flex justify-center">
            <img
              src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/ai_yve.svg"
              alt="Yve AI"
              className="w-16 h-16"
            />
          </div>

          <Button
            onClick={() => {
              setMessages([])
              setIsInitialState(true)
              setIsSidebarOpen(false)
            }}
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
                <div className="text-gray-500 text-sm text-center py-4">No chat history yet</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex flex-col h-dvh w-full overflow-hidden" data-chat-container>
        <div className="p-1 bg-white border-b border-gray-200 flex-shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <button
                onClick={() => setIsSidebarOpen(true)}
                className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5 text-gray-600" />
              </button>
              <img
                src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/ai_yve.svg"
                alt="Yve AI"
                className="w-16 h-16"
              />
              {canModifyProject && (
                <div className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">Project Mode</div>
              )}
            </div>
            <div className="flex items-center gap-2">
              {!chatId && (
                <Button variant="outline" size="sm" onClick={createNewV0Project}>
                  <Code className="h-4 w-4 mr-1" />
                  Create Yve Project
                </Button>
              )}
              {chat?.webUrl && (
                <Button variant="outline" size="sm" onClick={() => window.open(chat.webUrl, "_blank")}>
                  <ExternalLink className="h-4 w-4" />
                </Button>
              )}
              {chat?.demoUrl && (
                <Button variant="outline" size="sm" onClick={() => window.open(chat.demoUrl, "_blank")}>
                  <RefreshCw className="h-4 w-4" />
                </Button>
              )}
              <Button variant="ghost" size="sm" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col min-h-0">
          {isInitialState && messages.length === 0 ? (
            <div className="flex-1 flex flex-col items-center justify-center px-6 leading-5">
              <img
                src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/big_ai_yve.svg"
                alt="Yve AI"
                className="w-32 h-32 rounded-full mb-6"
              />
              <div className="text-center">
                <p className="text-gray-600 text-lg mb-2">{getInitialMessage()}</p>
              </div>
            </div>
          ) : (
            <div className="flex-1 min-h-0 overflow-hidden">
              <div className="h-full overflow-y-auto" ref={chatContainerRef}>
                <div className="space-y-4 p-4">
                  {isLoading ? (
                    <div className="flex items-center justify-center h-32">
                      <Loader2 className="h-6 w-6 animate-spin" />
                      <span className="ml-2 text-muted-foreground">Loading chat history...</span>
                    </div>
                  ) : (
                    messages.map((message) => (
                      <div
                        key={message.id}
                        className={`flex gap-3 ${message.role === "user" ? "justify-end" : "justify-start"}`}
                      >
                        {message.role === "assistant" && (
                          <div className="w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0">
                            <img
                              src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/ai_yve.svg"
                              alt="Yve AI"
                              className="w-16 h-16"
                            />
                          </div>
                        )}

                        <div className="max-w-[80%] group">
                          <Card
                            className={`${message.role === "user" ? "bg-[#BE0E0E] text-white" : "bg-white border-gray-200"}`}
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
                                  {message.role === "assistant" ? (
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
                                      ) : (
                                        <div className="prose prose-sm max-w-none">
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
                                                <p className="text-gray-700 leading-relaxed mb-4 last:mb-0 whitespace-pre-wrap">
                                                  {children}
                                                </p>
                                              ),
                                              ul: ({ children }) => (
                                                <ul className="list-disc list-inside space-y-1 my-3 text-gray-700">
                                                  {children}
                                                </ul>
                                              ),
                                              ol: ({ children }) => (
                                                <ol className="list-decimal list-inside space-y-1 my-3 text-gray-700">
                                                  {children}
                                                </ol>
                                              ),
                                              li: ({ children }) => (
                                                <li className="text-gray-700 leading-relaxed">{children}</li>
                                              ),
                                              code: ({ children, className, ...props }) => {
                                                const isInline = !className?.includes("language-")
                                                if (isInline) {
                                                  return (
                                                    <code className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800 border">
                                                      {children}
                                                    </code>
                                                  )
                                                }
                                                return (
                                                  <div className="my-4">
                                                    <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono border">
                                                      <code>{children}</code>
                                                    </pre>
                                                  </div>
                                                )
                                              },
                                              pre: ({ children }) => (
                                                <div className="my-4">
                                                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-lg overflow-x-auto text-sm font-mono border">
                                                    {children}
                                                  </pre>
                                                </div>
                                              ),
                                              blockquote: ({ children }) => (
                                                <blockquote className="border-l-4 border-blue-300 pl-4 italic text-gray-600 my-4 bg-blue-50 py-3 rounded-r">
                                                  {children}
                                                </blockquote>
                                              ),
                                              hr: () => <hr className="border-gray-300 my-6" />,
                                              strong: ({ children }) => (
                                                <strong className="font-semibold text-gray-900">{children}</strong>
                                              ),
                                              em: ({ children }) => (
                                                <em className="italic text-gray-800">{children}</em>
                                              ),
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
                                              div: ({ children, className }) => {
                                                if (className?.includes("thinking")) {
                                                  return (
                                                    <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 my-3">
                                                      <div className="text-yellow-800 text-sm font-medium mb-1">
                                                        Thinking
                                                      </div>
                                                      <div className="text-yellow-700 text-sm">{children}</div>
                                                    </div>
                                                  )
                                                }
                                                return <div className={className}>{children}</div>
                                              },
                                            }}
                                          >
                                            {removeCodeBlocks(message.content)}
                                          </ReactMarkdown>
                                          {extractCodeBlocks(message.content).length > 0 && (
                                            <div className="mt-4 space-y-3">
                                              {extractCodeBlocks(message.content).map((block, index) => (
                                                <div key={index} className="relative">
                                                  <div className="flex items-center justify-between bg-gray-800 text-gray-300 px-4 py-2 rounded-t-lg text-sm">
                                                    <span className="font-mono">{block.language}</span>
                                                    <Button
                                                      size="sm"
                                                      variant="ghost"
                                                      className="h-6 px-2 text-xs text-gray-300 hover:text-white hover:bg-gray-700"
                                                      onClick={() => navigator.clipboard.writeText(block.code)}
                                                    >
                                                      <Copy className="w-3 h-3 mr-1" />
                                                      Copy
                                                    </Button>
                                                  </div>
                                                  <pre className="bg-gray-900 text-gray-100 p-4 rounded-b-lg overflow-x-auto text-sm font-mono border-t border-gray-700">
                                                    <code>{block.code}</code>
                                                  </pre>
                                                </div>
                                              ))}
                                            </div>
                                          )}
                                        </div>
                                      )}
                                    </div>
                                  ) : (
                                    <p className="text-sm leading-relaxed">{message.content}</p>
                                  )}
                                </>
                              )}

                              <div className="flex items-center justify-between mt-2">
                                <p className={`text-xs ${message.role === "user" ? "text-red-100" : "text-gray-500"}`}>
                                  {formatTimestamp(message.createdAt)}
                                </p>

                                <div className="flex items-center gap-1 opacity-70 group-hover:opacity-100 transition-opacity">
                                  {message.role === "user" && !message.isStreaming && (
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
                                  {message.demoUrl && (
                                    <Button
                                      variant="ghost"
                                      size="sm"
                                      className="h-6 px-2 text-xs"
                                      onClick={() => window.open(message.demoUrl, "_blank")}
                                    >
                                      <ExternalLink className="h-3 w-3 mr-1" />
                                      View
                                    </Button>
                                  )}
                                </div>
                              </div>
                            </CardContent>
                          </Card>
                        </div>

                        {message.role === "user" && (
                          <div className="w-8 h-8 bg-gray-300 rounded-full flex items-center justify-center flex-shrink-0">
                            <User className="w-4 h-4 text-gray-600" />
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              </div>
            </div>
          )}

          {isInitialState && messages.length === 0 && (
            <div className="px-4 pb-2 flex-shrink-0">
              <div className="flex gap-3 pb-2 overflow-x-auto">
                <Button
                  variant="outline"
                  className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                  onClick={() =>
                    handleQuickAction("Create a modern, responsive version of this prototype with better UX")
                  }
                >
                  Modernize Design
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                  onClick={() => handleQuickAction("Add authentication and user management features")}
                >
                  Add Auth
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                  onClick={() => handleQuickAction("Integrate with a database and add CRUD operations")}
                >
                  Add Database
                </Button>
                <Button
                  variant="outline"
                  className="rounded-full px-6 py-2 text-sm text-gray-600 border-gray-300 bg-transparent whitespace-nowrap flex-shrink-0"
                  onClick={() => handleQuickAction("Deploy this as a production-ready application")}
                >
                  Deploy App
                </Button>
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
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyPress}
              placeholder="Ask Yve to modify your prototype..."
              className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder:text-gray-500"
              disabled={isSending}
            />
            <Button
              onClick={() => sendMessage()}
              size="sm"
              className="bg-[#BE0E0E] hover:bg-[#A00C0C] text-white rounded-full p-2 h-8 w-8"
              disabled={(!input.trim() && selectedFiles.length === 0) || isSending}
            >
              {isSending ? <Loader2 className="w-4 h-4 animate-spin" /> : <Send className="w-4 h-4" />}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

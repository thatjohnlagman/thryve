"use client"

import { useState, useEffect, useRef } from "react"
import {
  ArrowLeft,
  MoreVertical,
  Pin,
  PinOff,
  Menu,
  Eye,
  Users,
  MessageCircle,
  Plus,
  Send,
  Wifi,
  WifiOff,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { WebBrowserModal } from "@/components/web-browser-modal"
import { createClient } from "@/lib/supabase"

interface TeamDetailsProps {
  team: any
  onBack: () => void
}

export function TeamDetails({ team, onBack }: TeamDetailsProps) {
  const [showMembersSheet, setShowMembersSheet] = useState(false)
  const [showChatSheet, setShowChatSheet] = useState(false)
  const [webBrowserUrl, setWebBrowserUrl] = useState<string | null>(null)
  const [chatMessage, setChatMessage] = useState("")
  const [showAddAnnouncement, setShowAddAnnouncement] = useState(false)
  const [newAnnouncementTitle, setNewAnnouncementTitle] = useState("")
  const [newAnnouncementDescription, setNewAnnouncementDescription] = useState("")
  const [showAllProjects, setShowAllProjects] = useState(false)
  const [showCreateProject, setShowCreateProject] = useState(false)
  const [showEditProject, setShowEditProject] = useState(false)
  const [newProject, setNewProject] = useState({
    title: "",
    issue: "",
    reason: "",
    category: "General",
    priority: "Medium",
    url: "",
  })
  const [editProject, setEditProject] = useState({
    id: "",
    title: "",
    issue: "",
    reason: "",
    category: "General",
    priority: "Medium",
    url: "",
  })

  const [announcements, setAnnouncements] = useState<any[]>([])
  const [chatMessages, setChatMessages] = useState<any[]>([])
  const [pinnedProjects, setPinnedProjects] = useState<any[]>([])
  const [allProjects, setAllProjects] = useState<any[]>([])
  const [members, setMembers] = useState<any[]>([])
  const [loading, setLoading] = useState(false)
  const [isLive, setIsLive] = useState(false)
  const [messagesLoading, setMessagesLoading] = useState(false)
  const [showInviteModal, setShowInviteModal] = useState(false)

  const subscriptionRef = useRef<any>(null)
  const chatEndRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (team?.id) {
      fetchTeamData()
      setupRealtimeSubscription()
    }

    return () => {
      if (subscriptionRef.current) {
        subscriptionRef.current.unsubscribe()
      }
    }
  }, [team?.id])

  useEffect(() => {
    if (showChatSheet && chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: "smooth" })
    }
  }, [chatMessages, showChatSheet])

  const setupRealtimeSubscription = async () => {
    try {
      console.log("[TeamDetails] Setting up real-time subscription for team chat and announcements")
      console.log("[TeamDetails] Team ID:", team.id)

      const supabaseClient = createClient()

      console.log("[TeamDetails] Testing WebSocket connection...")

      const channel = supabaseClient
        .channel(`team-realtime-${team.id}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "team_chat_messages",
          },
          async (payload) => {
            console.log("[TeamDetails] REAL-TIME MESSAGE RECEIVED (NO FILTER):", payload)
            console.log("[TeamDetails] Message content:", payload.new)

            if (payload.new.team_id !== team.id) {
              console.log("[TeamDetails] Message is for different team, ignoring")
              return
            }

            const {
              data: { user },
            } = await supabaseClient.auth.getUser()

            const { data: newMessage } = await supabaseClient
              .from("team_chat_messages")
              .select(`
                *,
                profiles:user_id (
                  first_name,
                  last_name
                )
              `)
              .eq("id", payload.new.id)
              .single()

            console.log("[TeamDetails] Fetched complete message:", newMessage)

            if (newMessage) {
              console.log("[TeamDetails] Processing new real-time message...")
              const formattedMessage = {
                id: newMessage.id,
                user: newMessage.profiles
                  ? `${newMessage.profiles.first_name || ""} ${newMessage.profiles.last_name || ""}`.trim() ||
                    "Unknown User"
                  : "Unknown User",
                message: newMessage.message,
                timestamp: new Date(newMessage.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
                isUser: newMessage.user_id === user?.id,
                created_at: newMessage.created_at,
              }

              console.log("[TeamDetails] Formatted message:", formattedMessage)

              setChatMessages((prev) => {
                console.log("[TeamDetails] Current messages count:", prev.length)

                const withoutTempMessages = prev.filter((msg) => {
                  if (
                    msg.id.startsWith("temp-") &&
                    msg.message === formattedMessage.message &&
                    msg.isUser === formattedMessage.isUser
                  ) {
                    console.log("[TeamDetails] Removing temp message:", msg.id)
                    return false // Remove temp message
                  }
                  return true
                })

                if (withoutTempMessages.some((msg) => msg.id === formattedMessage.id)) {
                  console.log("[TeamDetails] Message already exists, skipping duplicate")
                  return withoutTempMessages
                }

                const newMessages = [...withoutTempMessages, formattedMessage].sort(
                  (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime(),
                )

                console.log("[TeamDetails] Added new message! Total messages:", newMessages.length)

                fetch("/api/debug", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    type: "UI_STATE_UPDATED",
                    data: {
                      teamId: team.id,
                      totalMessages: newMessages.length,
                      latestMessage: formattedMessage,
                      allMessageIds: newMessages.map((m) => ({ id: m.id, message: m.message.substring(0, 20) })),
                    },
                  }),
                }).catch((e) => console.log("Debug log failed:", e))

                return newMessages
              })
            } else {
              console.log("[TeamDetails] Failed to fetch complete message data")
            }
          },
        )
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "team_announcements",
            filter: `team_id=eq.${team.id}`,
          },
          async (payload) => {
            console.log("[TeamDetails] Real-time announcement received:", payload)

            const { data: newAnnouncement } = await supabaseClient
              .from("team_announcements")
              .select(`
                *,
                profiles:user_id (
                  first_name,
                  last_name
                )
              `)
              .eq("id", payload.new.id)
              .single()

            if (newAnnouncement) {
              const formattedAnnouncement = {
                ...newAnnouncement,
                user: {
                  name: newAnnouncement.profiles
                    ? `${newAnnouncement.profiles.first_name || ""} ${newAnnouncement.profiles.last_name || ""}`.trim() ||
                      newAnnouncement.profiles.first_name ||
                      "Unknown User"
                    : "Unknown User",
                  avatar: newAnnouncement.profiles?.first_name?.charAt(0).toUpperCase() || "U",
                },
                timestamp: new Date(newAnnouncement.created_at).toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                }),
              }

              setAnnouncements((prev) => {
                if (prev.some((ann) => ann.id === formattedAnnouncement.id)) {
                  return prev
                }
                return [formattedAnnouncement, ...prev].sort(
                  (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
                )
              })
            }
          },
        )
        .subscribe((status, err) => {
          console.log("[TeamDetails] Real-time subscription status:", status)
          if (err) {
            console.error("[TeamDetails] Real-time subscription error:", err)
          }
          setIsLive(status === "SUBSCRIBED")

          if (status === "SUBSCRIBED") {
            console.log("[TeamDetails] Real-time subscription is ACTIVE - chat should work live!")
          } else {
            console.log("[TeamDetails] Real-time subscription status:", status)
          }
        })

      subscriptionRef.current = channel
    } catch (error) {
      console.error("Error setting up real-time subscription:", error)
      setIsLive(false)
    }
  }

  const fetchTeamData = async () => {
    setLoading(true)
    try {
      console.log("[TeamDetails] Fetching team data using client-side approach")

      const supabaseClient = createClient()

      const { data: announcementsData } = await supabaseClient
        .from("team_announcements")
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name
          )
        `)
        .eq("team_id", team.id)
        .order("created_at", { ascending: false })

      if (announcementsData) {
        const formattedAnnouncements = announcementsData.map((announcement: any) => ({
          ...announcement,
          user: {
            name: announcement.profiles
              ? `${announcement.profiles.first_name || ""} ${announcement.profiles.last_name || ""}`.trim() ||
                announcement.profiles.first_name ||
                "Unknown User"
              : "Unknown User",
            avatar: announcement.profiles?.first_name?.charAt(0).toUpperCase() || "U",
          },
          timestamp: new Date(announcement.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
        }))
        setAnnouncements(formattedAnnouncements)
      }

      const { data: projectsData } = await supabaseClient
        .from("team_projects")
        .select("*")
        .eq("team_id", team.id)
        .order("created_at", { ascending: false })

      if (projectsData) {
        setAllProjects(projectsData)
        setPinnedProjects(projectsData.filter((p) => p.is_pinned))
      }

      const { data: membersData } = await supabaseClient
        .from("team_members")
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name
          )
        `)
        .eq("team_id", team.id)
        .eq("is_active", true)

      if (membersData) {
        const formattedMembers = membersData.map((member: any) => ({
          id: member.id,
          name: member.profiles
            ? `${member.profiles.first_name || ""} ${member.profiles.last_name || ""}`.trim() ||
              member.profiles.first_name ||
              "Team Member"
            : "Team Member",
          role: member.role,
          avatar: member.avatar || member.profiles?.first_name?.charAt(0).toUpperCase() || "U",
          user_id: member.user_id,
        }))
        setMembers(formattedMembers)
      }

      await fetchMessages()
    } catch (error) {
      console.error("Error fetching team data:", error)
    } finally {
      setLoading(false)
    }
  }

  const fetchMessages = async () => {
    if (chatMessages.length > 0 && isLive) {
      console.log("[TeamDetails] Skipping message fetch - real-time is active and messages already loaded")
      return
    }

    setMessagesLoading(true)
    try {
      console.log("[TeamDetails] Fetching messages using client-side approach")

      const supabaseClient = createClient()

      const { data: messagesData } = await supabaseClient
        .from("team_chat_messages")
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name
          )
        `)
        .eq("team_id", team.id)
        .order("created_at", { ascending: true })
        .limit(50)

      if (messagesData) {
        const {
          data: { user },
        } = await supabaseClient.auth.getUser()

        const formattedMessages = messagesData.map((message: any) => ({
          id: message.id,
          user: message.profiles
            ? `${message.profiles.first_name || ""} ${message.profiles.last_name || ""}`.trim() || "Unknown User"
            : "Unknown User",
          message: message.message,
          timestamp: new Date(message.created_at).toLocaleTimeString([], {
            hour: "2-digit",
            minute: "2-digit",
          }),
          isUser: message.user_id === user?.id,
          created_at: message.created_at,
        }))

        setChatMessages(formattedMessages)
      }
    } catch (error) {
      console.error("Error fetching messages:", error)
    } finally {
      setMessagesLoading(false)
    }
  }

  const handleSendMessage = async () => {
    if (!chatMessage.trim()) return

    const tempMessage = {
      id: `temp-${Date.now()}`,
      user: "You",
      message: chatMessage.trim(),
      timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
      isUser: true,
      created_at: new Date().toISOString(),
    }

    setChatMessages((prev) => [...prev, tempMessage])
    const messageToSend = chatMessage
    setChatMessage("")

    try {
      console.log("[TeamDetails] Sending message using client-side approach")

      const supabaseClient = createClient()
      const {
        data: { user },
      } = await supabaseClient.auth.getUser()

      if (!user) {
        throw new Error("Not authenticated")
      }

      const { data, error } = await supabaseClient
        .from("team_chat_messages")
        .insert({
          team_id: team.id,
          user_id: user.id,
          message: messageToSend,
        })
        .select()

      if (error) {
        throw error
      }

      console.log("Message sent successfully:", data)
      console.log("Real-time should pick this up for team:", team.id)

      fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "MESSAGE_SENT_TO_DB",
          data: {
            teamId: team.id,
            messageId: data?.[0]?.id,
            message: messageToSend,
            userId: user.id,
            timestamp: new Date().toISOString(),
          },
        }),
      }).catch((e) => console.log("Debug log failed:", e))
    } catch (error) {
      console.error("Error sending message:", error)
      setChatMessages((prev) => prev.filter((msg) => msg.id !== tempMessage.id))
      setChatMessage(messageToSend)
    }
  }

  const handleAddAnnouncement = async () => {
    if (!newAnnouncementTitle.trim() || !newAnnouncementDescription.trim()) return

    try {
      console.log("[TeamDetails] Adding announcement using client-side approach")

      const supabaseClient = createClient()
      const {
        data: { user },
      } = await supabaseClient.auth.getUser()

      if (!user) {
        throw new Error("Not authenticated")
      }

      const { data, error } = await supabaseClient
        .from("team_announcements")
        .insert({
          team_id: team.id,
          user_id: user.id,
          title: newAnnouncementTitle,
          description: newAnnouncementDescription,
        })
        .select(`
          *,
          profiles:user_id (
            first_name,
            last_name
          )
        `)
        .single()

      if (error) {
        throw error
      }

      const formattedAnnouncement = {
        ...data,
        user: {
          name: data.profiles
            ? `${data.profiles.first_name || ""} ${data.profiles.last_name || ""}`.trim() ||
              data.profiles.first_name ||
              "Unknown User"
            : "Unknown User",
          avatar: data.profiles?.first_name?.charAt(0).toUpperCase() || "U",
        },
        timestamp: new Date(data.created_at).toLocaleTimeString([], {
          hour: "2-digit",
          minute: "2-digit",
        }),
      }

      setAnnouncements((prev) => [formattedAnnouncement, ...prev])

      console.log("[TeamDetails] Announcement added and UI updated immediately")
      setNewAnnouncementTitle("")
      setNewAnnouncementDescription("")
      setShowAddAnnouncement(false)
    } catch (error) {
      console.error("Error adding announcement:", error)
    }
  }

  const handleCreateProject = async () => {
    if (!newProject.title.trim()) return

    try {
      setLoading(true)
      console.log("[TeamDetails] Creating project using client-side approach")

      const supabaseClient = createClient()
      const {
        data: { user },
      } = await supabaseClient.auth.getUser()

      if (!user) {
        throw new Error("Not authenticated")
      }

      const { data, error } = await supabaseClient
        .from("team_projects")
        .insert({
          team_id: team.id,
          title: newProject.title.trim(),
          issue: newProject.issue.trim() || null,
          reason: newProject.reason.trim() || null,
          category: newProject.category || "General",
          priority: newProject.priority || "Medium",
          url: newProject.url.trim() || null,
          is_pinned: false,
          created_by: user.id,
        })
        .select()
        .single()

      if (error) {
        throw error
      }

      console.log("[TeamDetails] Project created successfully:", data)

      // Reset form and close modal
      setNewProject({
        title: "",
        issue: "",
        reason: "",
        category: "General",
        priority: "Medium",
        url: "",
      })
      setShowCreateProject(false)

      // Refresh team data to show new project
      await fetchTeamData()
    } catch (error) {
      console.error("Error creating project:", error)
    } finally {
      setLoading(false)
    }
  }

  const openEditProject = (project: any) => {
    setEditProject({
      id: project.id,
      title: project.title || "",
      issue: project.issue || "",
      reason: project.reason || "",
      category: project.category || "General",
      priority: project.priority || "Medium",
      url: project.url || "",
    })
    setShowEditProject(true)
  }

  const handleUpdateProject = async () => {
    if (!editProject.id || !editProject.title.trim()) return
    try {
      setLoading(true)
      const supabaseClient = createClient()
      await supabaseClient
        .from("team_projects")
        .update({
          title: editProject.title.trim(),
          issue: editProject.issue.trim() || null,
          reason: editProject.reason.trim() || null,
          category: editProject.category,
          priority: editProject.priority,
          url: editProject.url.trim() || null,
        })
        .eq("id", editProject.id)
      await fetchTeamData()
      setShowEditProject(false)
    } catch (e) {
      console.error("Error updating project", e)
    } finally {
      setLoading(false)
    }
  }

  const handleTogglePin = async (projectId: string, currentPinStatus: boolean) => {
    try {
      const supabaseClient = createClient()

      const { data, error } = await supabaseClient
        .from("team_projects")
        .update({ is_pinned: !currentPinStatus })
        .eq("id", projectId)
        .eq("team_id", team.id)
        .select()
        .single()

      if (error) {
        throw error
      }

      if (!currentPinStatus) {
        await supabaseClient
          .from("team_projects")
          .update({ is_pinned: false })
          .eq("team_id", team.id)
          .neq("id", projectId)
      }

      await fetchTeamData()
    } catch (error) {
      console.error("Error toggling pin status:", error)
    }
  }

  const pinnedProject = pinnedProjects.length > 0 ? pinnedProjects[0] : null

  return (
    <>
      <div className="min-h-screen bg-white relative z-10">
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-white relative z-20">
          <Button variant="ghost" size="sm" onClick={onBack} className="p-2">
            <ArrowLeft size={20} />
          </Button>
          <h2 className="text-lg lg:text-3xl font-semibold lg:font-bold">{team.name}</h2>
          <Button variant="ghost" size="sm" className="p-2">
            <MoreVertical size={20} />
          </Button>
        </div>

        <div className="overflow-y-auto pb-24 relative z-10" style={{ height: "calc(100vh - 73px)" }}>
          <div className="p-4 space-y-6">
            <div>
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <h3 className="text-2xl lg:text-3xl font-bold text-red-600">Pinned Project</h3>
                  <Pin size={20} className="text-red-600" />
                </div>
                <Button variant="outline" size="sm" onClick={() => setShowAllProjects(true)} className="text-sm">
                  <Menu size={16} className="mr-1" />
                  All Projects
                </Button>
              </div>

              {pinnedProject ? (
                <Card className="shadow-lg hover:shadow-xl transition-shadow duration-200 border-0 bg-white relative lg:mx-0 lg:w-full lg:pb-4 lg:min-h-[560px]">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-xl lg:text-3xl font-bold text-gray-900 pr-8 flex-1">{pinnedProject.title}</CardTitle>
                      <div className="flex items-center gap-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePin(pinnedProject.id, true)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Unpin"
                        >
                          <PinOff size={16} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => openEditProject(pinnedProject)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                          title="Edit Project"
                        >
                          <MoreVertical size={16} />
                        </Button>
                      </div>
                    </div>
                  </CardHeader>

                  <CardContent className="pt-0 space-y-4">
                    {pinnedProject.url && (
                      <div className="border border-gray-200 rounded-lg overflow-hidden relative lg:max-h-[420px]">
                        <div className="aspect-video relative lg:aspect-auto lg:h-[400px]">
                          <iframe
                            src={pinnedProject.url}
                            className="w-full h-full border-0"
                            title="Prototype Preview"
                            sandbox="allow-scripts allow-same-origin"
                          />
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Button
                              size="icon"
                              onClick={() => setWebBrowserUrl(pinnedProject.url)}
                              className="w-12 h-12 bg-black/70 hover:bg-black/80 text-white rounded-full"
                            >
                              <Eye size={16} />
                            </Button>
                          </div>
                        </div>
                      </div>
                    )}

                    <div className="space-y-3">
            {pinnedProject.issue && (
                        <>
              <p className="text-sm lg:text-lg text-gray-700 font-medium">Issue:</p>
              <p className="text-sm lg:text-lg text-gray-600">{pinnedProject.issue}</p>
                        </>
                      )}

            {pinnedProject.reason && (
                        <>
              <p className="text-sm lg:text-lg text-gray-700 font-medium">Reason:</p>
              <p className="text-sm lg:text-lg text-gray-600">{pinnedProject.reason}</p>
                        </>
                      )}
                    </div>

                    {pinnedProject.url && (
                      <Button
                        onClick={() => setWebBrowserUrl(pinnedProject.url)}
            className="w-full bg-red-600 hover:bg-red-700 text-white lg:text-lg"
                      >
                        <Eye className="w-4 h-4 mr-2" />
                        View Details
                      </Button>
                    )}
                  </CardContent>
                </Card>
              ) : (
                <Card className="shadow-lg border-2 border-dashed border-gray-300 bg-gray-50">
                  <CardContent className="p-8 text-center">
                    <Pin size={48} className="text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-600 mb-2">No Pinned Project</h4>
                    <p className="text-sm text-gray-500 mb-4">Pin a project to showcase your team's work</p>
                    <div className="space-y-2">
                      <Button
                        onClick={() => setShowAllProjects(true)}
                        className="bg-red-600 hover:bg-red-700 text-white w-full"
                      >
                        View All Projects
                      </Button>
                      <Button onClick={() => setShowCreateProject(true)} variant="outline" className="w-full">
                        Create New Project
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3">
              <Card
                className="cursor-pointer hover:shadow-md transition-all duration-200 border-2 border-gray-200 bg-white hover:bg-red-50 hover:border-red-300"
                onClick={() => setShowMembersSheet(true)}
              >
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-red-50">
                    <Users size={20} className="text-gray-600 stroke-red-500 hover:text-red-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 lg:text-xl">View Members</h4>
                  <p className="text-sm lg:text-lg text-gray-600">{members.length} members</p>
                </CardContent>
              </Card>

              <Card
                className="cursor-pointer hover:shadow-md transition-all duration-200 border-2 border-gray-200 bg-white hover:bg-red-50 hover:border-red-300"
                onClick={() => setShowChatSheet(true)}
              >
                <CardContent className="p-4 text-center">
                  <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-2 group-hover:bg-red-50">
                    <MessageCircle size={20} className="text-gray-600 stroke-red-500 hover:text-red-600" />
                  </div>
                  <h4 className="font-medium text-gray-900 lg:text-xl">View Chat</h4>
                  <p className="text-sm lg:text-lg text-gray-600">{chatMessages.length} messages</p>
                </CardContent>
              </Card>
            </div>

            <div>
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-xl lg:text-3xl font-bold text-gray-900">Announcement/Progress</h3>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-sm bg-transparent border-gray-300"
                  onClick={() => setShowAddAnnouncement(true)}
                >
                  <Plus size={16} className="mr-1" />
                  Add New
                </Button>
              </div>

              <div className="relative">
                {announcements.length > 0 ? (
                  announcements.map((announcement, index) => (
                    <div key={announcement.id} className="relative">
                      <Card
                        className="border border-[#E8E8E8] mb-6 relative z-10 shadow-sm hover:shadow-md transition-all duration-200"
                        style={{ backgroundColor: "rgba(237, 221, 221, 0.5)" }}
                      >
                        <CardContent className="p-6">
                          <div className="flex items-start gap-4 mb-4">
                            <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center font-bold text-sm border-2 border-white shadow-md flex-shrink-0">
                              {announcement.user?.avatar || "U"}
                            </div>
                            <div className="flex-1 min-w-0">
                              <div className="flex items-start justify-between">
                                <div>
                                  <h4 className="font-semibold text-gray-900 mb-1 lg:text-xl">{announcement.title}</h4>
                                  <p className="font-medium text-sm lg:text-lg text-gray-800">
                                    {announcement.user?.name || "Unknown User"}
                                  </p>
                                </div>
                                <span className="text-xs lg:text-sm text-gray-600 ml-2">{announcement.timestamp}</span>
                              </div>
                            </div>
                          </div>
                          <div className="w-full">
                            <p className="text-sm lg:text-lg text-gray-700 leading-relaxed">{announcement.description}</p>
                          </div>
                        </CardContent>
                      </Card>
                    </div>
                  ))
                ) : (
                  <Card className="border-2 border-dashed border-gray-300 bg-gray-50">
                    <CardContent className="p-8 text-center">
                      <MessageCircle size={48} className="text-gray-400 mx-auto mb-4" />
                      <h4 className="text-lg font-medium text-gray-600 mb-2">No Announcements Yet</h4>
                      <p className="text-sm text-gray-500">Be the first to share an update with your team</p>
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>

      {showMembersSheet && (
        <div className="fixed inset-0 z-50 flex flex-col lg:items-center lg:justify-center lg:p-6 lg:bg-black/40">
          {/* Mobile full-screen */}
          <div className="flex flex-col flex-1 bg-white lg:relative lg:flex-none lg:rounded-xl lg:shadow-xl lg:max-w-lg lg:w-full lg:max-h-[80vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 rounded-t-xl">
              <Button variant="ghost" size="sm" onClick={() => setShowMembersSheet(false)} className="p-2">
                <ArrowLeft size={20} />
              </Button>
              <h2 className="text-lg font-semibold">Workspace Members</h2>
              <Button
                size="sm"
                className="bg-red-600 text-white hover:bg-red-700"
                onClick={() => setShowInviteModal(true)}
                data-invite-button
              >
                Invite
              </Button>
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {members.map((member) => (
                <div
                  key={member.id}
                  className="flex items-center gap-4 p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="w-12 h-12 bg-blue-100 rounded-full flex items-center justify-center font-semibold text-blue-700">
                    {member.avatar}
                  </div>
                  <div>
                    <h4 className="font-medium text-gray-900">{member.name}</h4>
                    <p className="text-sm text-gray-600">{member.role}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {showChatSheet && (
        <div className="fixed inset-0 lg:left-64 xl:left-72 bg-white z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <Button variant="ghost" size="sm" onClick={() => setShowChatSheet(false)} className="p-2">
              <ArrowLeft size={20} />
            </Button>
            <div className="flex items-center gap-2">
              <h2 className="text-lg font-semibold">Workspace Chat</h2>
              <div
                className={`flex items-center gap-1 px-2 py-1 rounded-full text-xs ${
                  isLive ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"
                }`}
              >
                {isLive ? <Wifi size={12} /> : <WifiOff size={12} />}
                {isLive ? "Live" : "Offline"}
              </div>
            </div>
            <div className="w-10" />
          </div>

          <div className="flex-1 p-4 space-y-3 overflow-y-auto">
            {messagesLoading ? (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-red-600 mx-auto mb-4" />
                  <p className="text-sm lg:text-base text-gray-500">Loading messages...</p>
                </div>
              </div>
            ) : chatMessages.length > 0 ? (
              <>
                {chatMessages.map((message) => (
                  <div key={message.id} className={`flex ${message.isUser ? "justify-end" : "justify-start"}`}>
                    <div
                      className={`max-w-xs lg:max-w-md px-4 py-2 rounded-2xl ${
                        message.isUser ? "bg-[#be0e0e] text-white" : "bg-gray-100 text-gray-900"
                      }`}
                    >
                      {!message.isUser && (
                        <p className="text-xs lg:text-sm font-medium mb-1 opacity-75">{message.user}</p>
                      )}
                      <p className="text-sm lg:text-base leading-relaxed">{message.message}</p>
                      <p className={`text-xs lg:text-sm mt-1 ${message.isUser ? "text-red-100" : "text-gray-500"}`}>
                        {message.timestamp}
                      </p>
                    </div>
                  </div>
                ))}
                <div ref={chatEndRef} />
              </>
            ) : (
              <div className="flex-1 flex items-center justify-center">
                <div className="text-center">
                  <MessageCircle size={48} className="text-gray-400 mx-auto mb-4" />
                  <h4 className="text-lg lg:text-xl font-medium text-gray-600 mb-2">No Messages Yet</h4>
                  <p className="text-sm lg:text-base text-gray-500">Start the conversation with your team</p>
                </div>
              </div>
            )}
          </div>

          <div className="p-5 pb-8 bg-white border-t border-gray-200 flex-shrink-0 mb-16 lg:mb-0">
            <div className="flex items-center gap-3 bg-gray-100 rounded-full px-4 py-1.5">
              <Input
                value={chatMessage}
                onChange={(e) => setChatMessage(e.target.value)}
                placeholder="Type a message..."
                className="flex-1 bg-transparent border-none outline-none text-gray-900 placeholder:text-gray-500 lg:text-base"
                onKeyPress={(e) => e.key === "Enter" && handleSendMessage()}
              />
              <Button
                onClick={handleSendMessage}
                size="sm"
                className="bg-[#be0e0e] hover:bg-red-700 rounded-full p-2 h-8 w-8"
              >
                <Send size={16} />
              </Button>
            </div>
          </div>
        </div>
      )}

      {showAllProjects && (
        <div className="fixed inset-0 z-50 flex flex-col lg:p-8 lg:bg-black/40 lg:items-center lg:justify-center">
          <div className="flex flex-col flex-1 bg-white lg:rounded-xl lg:shadow-xl lg:max-w-4xl lg:w-full lg:h-[85vh]">
            <div className="flex items-center justify-between p-4 border-b border-gray-200 rounded-t-xl">
              <Button variant="ghost" size="sm" onClick={() => setShowAllProjects(false)} className="p-2">
                <ArrowLeft size={20} />
              </Button>
              <h2 className="text-lg font-semibold">All Projects</h2>
              <div className="w-10" />
            </div>
            <div className="flex-1 p-4 space-y-4 overflow-y-auto">
              {allProjects.length > 0 ? (
                allProjects.map((project) => (
                  <Card key={project.id} className="shadow-sm hover:shadow-md transition-shadow">
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between mb-3">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-2">
                            <h4 className="font-semibold text-gray-900">{project.title}</h4>
                            {project.is_pinned && <Pin size={16} className="text-red-600" />}
                          </div>
                          {project.issue && (
                            <p className="text-sm text-gray-600 mb-1">
                              <span className="font-medium">Issue:</span> {project.issue}
                            </p>
                          )}
                          {project.reason && (
                            <p className="text-sm text-gray-600">
                              <span className="font-medium">Reason:</span> {project.reason}
                            </p>
                          )}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleTogglePin(project.id, project.is_pinned)}
                          className={`ml-2 ${
                            project.is_pinned
                              ? "text-red-600 hover:text-red-700 hover:bg-red-50"
                              : "text-gray-400 hover:text-red-600 hover:bg-red-50"
                          }`}
                        >
                          {project.is_pinned ? <PinOff size={16} /> : <Pin size={16} />}
                        </Button>
                      </div>
                      {project.url && (
                        <Button
                          onClick={() => setWebBrowserUrl(project.url)}
                          size="sm"
                          className="w-full bg-red-600 hover:bg-red-700 text-white"
                        >
                          <Eye className="w-4 h-4 mr-2" />
                          View Project
                        </Button>
                      )}
                    </CardContent>
                  </Card>
                ))
              ) : (
                <div className="flex-1 flex items-center justify-center">
                  <div className="text-center">
                    <Pin size={48} className="text-gray-400 mx-auto mb-4" />
                    <h4 className="text-lg font-medium text-gray-600 mb-2">No Projects Yet</h4>
                    <p className="text-sm text-gray-500 mb-4">Create your first project to get started</p>
                    <Button onClick={() => setShowCreateProject(true)} className="bg-red-600 hover:bg-red-700 text-white">
                      <Plus className="w-4 h-4 mr-2" />
                      Create Project
                    </Button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showCreateProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto relative z-[10000]">
            <CardHeader>
              <CardTitle>Create New Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Title *</label>
                <Input
                  placeholder="Enter project title"
                  value={newProject.title}
                  onChange={(e) => setNewProject((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Issue/Problem</label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md resize-none"
                  rows={3}
                  placeholder="Describe the issue or problem this project addresses"
                  value={newProject.issue}
                  onChange={(e) => setNewProject((prev) => ({ ...prev, issue: e.target.value }))}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason/Solution</label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md resize-none"
                  rows={3}
                  placeholder="Explain the reason or solution for this project"
                  value={newProject.reason}
                  onChange={(e) => setNewProject((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    className="w-full p-3 border border-gray-300 rounded-md"
                    value={newProject.category}
                    onChange={(e) => setNewProject((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="General">General</option>
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Research">Research</option>
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    className="w-full p-3 border border-gray-300 rounded-md"
                    value={newProject.priority}
                    onChange={(e) => setNewProject((prev) => ({ ...prev, priority: e.target.value }))}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project URL</label>
                <Input
                  placeholder="https://example.com (optional)"
                  value={newProject.url}
                  onChange={(e) => setNewProject((prev) => ({ ...prev, url: e.target.value }))}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleCreateProject}
                  disabled={!newProject.title.trim() || loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {loading ? "Creating..." : "Create Project"}
                </Button>
                <Button variant="outline" onClick={() => setShowCreateProject(false)} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showEditProject && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-[9999] flex items-center justify-center p-4">
          <Card className="w-full max-w-md max-h-[90vh] overflow-y-auto relative z-[10000]">
            <CardHeader>
              <CardTitle>Edit Project</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project Title *</label>
                <Input
                  placeholder="Enter project title"
                  value={editProject.title}
                  onChange={(e) => setEditProject((prev) => ({ ...prev, title: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Issue/Problem</label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md resize-none"
                  rows={3}
                  placeholder="Describe the issue or problem this project addresses"
                  value={editProject.issue}
                  onChange={(e) => setEditProject((prev) => ({ ...prev, issue: e.target.value }))}
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Reason/Solution</label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md resize-none"
                  rows={3}
                  placeholder="Explain the reason or solution for this project"
                  value={editProject.reason}
                  onChange={(e) => setEditProject((prev) => ({ ...prev, reason: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Category</label>
                  <select
                    className="w-full p-3 border border-gray-300 rounded-md"
                    value={editProject.category}
                    onChange={(e) => setEditProject((prev) => ({ ...prev, category: e.target.value }))}
                  >
                    <option value="General">General</option>
                    <option value="Development">Development</option>
                    <option value="Design">Design</option>
                    <option value="Marketing">Marketing</option>
                    <option value="Research">Research</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Priority</label>
                  <select
                    className="w-full p-3 border border-gray-300 rounded-md"
                    value={editProject.priority}
                    onChange={(e) => setEditProject((prev) => ({ ...prev, priority: e.target.value }))}
                  >
                    <option value="Low">Low</option>
                    <option value="Medium">Medium</option>
                    <option value="High">High</option>
                    <option value="Critical">Critical</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Project URL</label>
                <Input
                  placeholder="https://example.com (optional)"
                  value={editProject.url}
                  onChange={(e) => setEditProject((prev) => ({ ...prev, url: e.target.value }))}
                />
              </div>
              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleUpdateProject}
                  disabled={!editProject.title.trim() || loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {loading ? "Saving..." : "Save Changes"}
                </Button>
                <Button variant="outline" onClick={() => setShowEditProject(false)} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {showAddAnnouncement && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Add Announcement</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                <Input
                  placeholder="Enter announcement title"
                  value={newAnnouncementTitle}
                  onChange={(e) => setNewAnnouncementTitle(e.target.value)}
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                <textarea
                  className="w-full p-3 border border-gray-300 rounded-md resize-none"
                  rows={4}
                  placeholder="Enter announcement description"
                  value={newAnnouncementDescription}
                  onChange={(e) => setNewAnnouncementDescription(e.target.value)}
                />
              </div>

              <div className="flex gap-2 pt-4">
                <Button
                  onClick={handleAddAnnouncement}
                  disabled={!newAnnouncementTitle.trim() || !newAnnouncementDescription.trim() || loading}
                  className="flex-1 bg-red-600 hover:bg-red-700"
                >
                  {loading ? "Adding..." : "Add Announcement"}
                </Button>
                <Button variant="outline" onClick={() => setShowAddAnnouncement(false)} disabled={loading}>
                  Cancel
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {webBrowserUrl && (
        <WebBrowserModal url={webBrowserUrl} onClose={() => setWebBrowserUrl(null)} fileName="Project Preview" />
      )}

      {showInviteModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-md w-full shadow-xl border">
            <div className="p-6 border-b bg-gray-50 rounded-t-xl">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-gray-900">Team Invite Code</h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowInviteModal(false)}
                  className="text-gray-500 hover:text-gray-700"
                >
                  ✕
                </Button>
              </div>
            </div>
            <div className="p-6">
              <div className="text-center space-y-4">
                <p className="text-gray-600">Share this code with team members to invite them:</p>
                <div className="bg-gray-100 rounded-xl p-4 border-2 border-dashed border-gray-300">
                  <code className="text-2xl font-mono font-bold text-gray-900 tracking-wider">
                    {team.inviteCode || "No invite code available"}
                  </code>
                </div>
                <Button
                  onClick={() => {
                    if (team.inviteCode) {
                      navigator.clipboard
                        .writeText(team.inviteCode)
                        .then(() => {
                          // Show temporary success message
                          const button = document.querySelector("[data-copy-button]") as HTMLElement
                          if (button) {
                            const originalText = button.textContent
                            button.textContent = "Copied!"
                            setTimeout(() => {
                              button.textContent = originalText
                            }, 2000)
                          }
                        })
                        .catch(() => {
                          alert(`Team Code: ${team.inviteCode}`)
                        })
                    }
                  }}
                  className="w-full bg-red-600 text-white hover:bg-red-700"
                  data-copy-button
                >
                  Copy Code
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  )
}

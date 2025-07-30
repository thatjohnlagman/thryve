"use client"

import { useState, useEffect } from "react"
import { Search, MoreVertical, ArrowLeft, X, ArrowUpRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { TeamDetails } from "@/components/team-details"
import { createClient } from "@/lib/supabase"

export function TeamsScreen() {
  const [searchQuery, setSearchQuery] = useState("")
  const [showCreateTeamSheet, setShowCreateTeamSheet] = useState(false)
  const [showJoinTeamModal, setShowJoinTeamModal] = useState(false)
  const [showDotsMenu, setShowDotsMenu] = useState(false)
  const [teamName, setTeamName] = useState("")
  const [teamDescription, setTeamDescription] = useState("")
  const [teamCode, setTeamCode] = useState("")
  const [selectedTeam, setSelectedTeam] = useState<any>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [teams, setTeams] = useState<any[]>([])

  // Client-side database functions (like trends approach)
  const fetchTeamsFromSupabase = async () => {
    try {
      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-FETCH] =================================",
          data: {}
        })
      })
      
      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-FETCH] FETCHING USER TEAMS",
          data: {}
        })
      })
      
      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-FETCH] =================================",
          data: {}
        })
      })

      const supabase = createClient()
      
      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-FETCH] Getting authenticated user...",
          data: {}
        })
      })

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-FETCH] Auth result:",
          data: {
            hasUser: !!user,
            userId: user?.id,
            userEmail: user?.email,
            authError: authError?.message,
            authErrorCode: authError?.code
          }
        })
      })
      
      if (authError || !user) {
        await fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "[TEAMS-FETCH] No authenticated user found:",
            data: {
              authError: authError?.message
            }
          })
        })
        console.log("[Teams-Screen] No authenticated user found")
        return []
      }

      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-FETCH] Querying team memberships...",
          data: {
            userId: user.id
          }
        })
      })

      const { data: userTeamMemberships, error: membershipError } = await supabase
        .from("team_members")
        .select("team_id, role, avatar")
        .eq("user_id", user.id)
        .eq("is_active", true)

      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-FETCH] Membership query result:",
          data: {
            hasMemberships: !!userTeamMemberships,
            membershipCount: userTeamMemberships?.length || 0,
            membershipError: membershipError?.message,
            membershipErrorCode: membershipError?.code
          }
        })
      })

      if (membershipError || !userTeamMemberships?.length) {
        await fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "[TEAMS-FETCH] No team memberships found:",
            data: {
              membershipError: membershipError?.message,
              membershipCount: userTeamMemberships?.length || 0
            }
          })
        })
        return []
      }

      const teamIds = userTeamMemberships.map((m) => m.team_id)
      
      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-FETCH] Querying teams by IDs...",
          data: {
            teamIds: teamIds
          }
        })
      })

      const { data: teams, error: teamsError } = await supabase
        .from("teams")
        .select("*")
        .in("id", teamIds)

      if (teamsError) {
        console.error("Error fetching teams:", teamsError)
        return []
      }

      const { data: allMembers, error: membersError } = await supabase
        .from("team_members")
        .select("team_id, avatar, user_id")
        .in("team_id", teamIds)
        .eq("is_active", true)

      const formattedTeams = teams?.map((team) => {
        const teamMembers = allMembers?.filter((m) => m.team_id === team.id) || []
        const memberAvatars = teamMembers.slice(0, 3).map((member) => member.avatar || "U")

        return {
          id: team.id,
          name: team.name,
          description: team.description,
          tag: team.tag,
          color: team.color,
          inviteCode: team.invite_code,
          memberAvatars: memberAvatars,
          member_count: teamMembers.length,
        }
      }) || []

      return formattedTeams
    } catch (error) {
      console.error("[Teams-Screen] Error fetching teams:", error)
      return []
    }
  }

  const createTeamInSupabase = async (name: string, description: string) => {
    try {
      const supabase = createClient()
      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      if (authError || !user) {
        throw new Error("Not authenticated")
      }

      const { data: inviteCode } = await supabase.rpc("generate_team_invite_code")

      const gradients = [
        "bg-gradient-to-br from-red-500 to-red-600",
        "bg-gradient-to-br from-purple-500 to-purple-600",
        "bg-gradient-to-br from-cyan-500 to-cyan-600",
        "bg-gradient-to-br from-orange-500 to-orange-600",
        "bg-gradient-to-br from-green-500 to-green-600",
      ]

      const { data: team, error: teamError } = await supabase
        .from("teams")
        .insert({
          name: name.trim(),
          description: description?.trim() || "Team Description",
          color: gradients[Math.floor(Math.random() * gradients.length)],
          invite_code: inviteCode,
          created_by: user.id,
        })
        .select()
        .single()

      if (teamError) {
        throw new Error("Failed to create team")
      }

      const { error: memberError } = await supabase.from("team_members").insert({
        team_id: team.id,
        user_id: user.id,
        role: "Team Lead",
        avatar: user.email?.charAt(0).toUpperCase() || "U",
      })

      if (memberError) {
        throw new Error("Failed to add team member")
      }

      return {
        id: team.id,
        name: team.name,
        description: team.description,
        tag: team.tag,
        color: team.color,
        inviteCode: team.invite_code,
        memberAvatars: [user.email?.charAt(0).toUpperCase() || "U"],
        member_count: 1,
      }
    } catch (error) {
      console.error("[Teams-Screen] Error creating team:", error)
      throw error
    }
  }

  const joinTeamInSupabase = async (teamCode: string) => {
    try {
      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-JOIN] =================================",
          data: {}
        })
      })
      
      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-JOIN] ATTEMPTING TO JOIN TEAM",
          data: {}
        })
      })
      
      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-JOIN] =================================",
          data: {}
        })
      })

      const supabase = createClient()
      
      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-JOIN] Getting authenticated user...",
          data: {
            teamCode: teamCode.trim().toUpperCase()
          }
        })
      })

      const { data: { user }, error: authError } = await supabase.auth.getUser()
      
      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-JOIN] Auth result:",
          data: {
            hasUser: !!user,
            userId: user?.id,
            userEmail: user?.email,
            authError: authError?.message,
            authErrorCode: authError?.code
          }
        })
      })
      
      if (authError || !user) {
        await fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "[TEAMS-JOIN] Authentication failed:",
            data: {
              authError: authError?.message,
              reason: "Cannot join team without authenticated user"
            }
          })
        })
        throw new Error("Not authenticated")
      }

      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-JOIN] Looking up team by invite code...",
          data: {
            teamCode: teamCode.trim().toUpperCase()
          }
        })
      })

      // Find team by invite code
      const { data: team, error: teamError } = await supabase
        .from("teams")
        .select("*")
        .eq("invite_code", teamCode.trim().toUpperCase())
        .single()

      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-JOIN] Team lookup result:",
          data: {
            hasTeam: !!team,
            teamId: team?.id,
            teamName: team?.name,
            teamError: teamError?.message,
            teamErrorCode: teamError?.code
          }
        })
      })

      if (teamError || !team) {
        await fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "[TEAMS-JOIN] Team lookup failed:",
            data: {
              teamCode: teamCode.trim().toUpperCase(),
              teamError: teamError?.message,
              reason: "Invalid team code or team not found"
            }
          })
        })
        throw new Error("Invalid team code")
      }

      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-JOIN] Checking existing membership...",
          data: {
            teamId: team.id,
            userId: user.id
          }
        })
      })

      // Check if user is already a member
      const { data: existingMember } = await supabase
        .from("team_members")
        .select("*")
        .eq("team_id", team.id)
        .eq("user_id", user.id)
        .single()

      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-JOIN] Membership check result:",
          data: {
            hasExistingMember: !!existingMember,
            memberId: existingMember?.id,
            isActive: existingMember?.is_active,
            role: existingMember?.role
          }
        })
      })

      if (existingMember) {
        if (existingMember.is_active) {
          await fetch("/api/debug", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: "[TEAMS-JOIN] Already active member:",
              data: {
                memberId: existingMember.id,
                reason: "User is already an active member of this team"
              }
            })
          })
          throw new Error("You are already a member of this team")
        } else {
          await fetch("/api/debug", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: "[TEAMS-JOIN] Reactivating inactive membership...",
              data: {
                memberId: existingMember.id
              }
            })
          })
          // Reactivate membership
          const { error: updateError } = await supabase
            .from("team_members")
            .update({ is_active: true, joined_at: new Date().toISOString() })
            .eq("id", existingMember.id)

          await fetch("/api/debug", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: "[TEAMS-JOIN] Reactivation result:",
              data: {
                hasUpdateError: !!updateError,
                updateError: updateError?.message
              }
            })
          })

          if (updateError) {
            await fetch("/api/debug", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                message: "[TEAMS-JOIN] Reactivation failed:",
                data: {
                  updateError: updateError.message
                }
              })
            })
            throw new Error("Failed to rejoin team")
          }
        }
      } else {
        await fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "[TEAMS-JOIN] Creating new membership...",
            data: {
              teamId: team.id,
              userId: user.id,
              userEmail: user.email
            }
          })
        })

        const { error: memberError } = await supabase.from("team_members").insert({
          team_id: team.id,
          user_id: user.id,
          role: "Team Member",
          avatar: user.email?.charAt(0).toUpperCase() || "U",
        })

        await fetch("/api/debug", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            message: "[TEAMS-JOIN] Membership creation result:",
            data: {
              hasMemberError: !!memberError,
              memberError: memberError?.message,
              memberErrorCode: memberError?.code
            }
          })
        })

        if (memberError) {
          await fetch("/api/debug", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              message: "[TEAMS-JOIN] Membership creation failed:",
              data: {
                memberError: memberError.message,
                memberErrorCode: memberError.code
              }
            })
          })
          throw new Error("Failed to join team")
        }
      }

      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-JOIN] Successfully joined team:",
          data: {
            teamId: team.id,
            teamName: team.name,
            teamDescription: team.description
          }
        })
      })

      return {
        id: team.id,
        name: team.name,
        description: team.description,
        tag: team.tag,
        color: team.color,
      }
    } catch (error) {
      await fetch("/api/debug", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          message: "[TEAMS-JOIN] Error joining team:",
          data: {
            errorMessage: error instanceof Error ? error.message : String(error),
            errorStack: error instanceof Error ? error.stack : undefined
          }
        })
      })
      console.error("[Teams-Screen] Error joining team:", error)
      throw error
    }
  }

  useEffect(() => {
    fetchTeams()
  }, [])

  const fetchTeams = async () => {
    try {
      setLoading(true)
      console.log("[Teams-Screen] Fetching teams using client-side approach")
      
      // Use client-side database operations like trends
      const teamsData = await fetchTeamsFromSupabase()
      setTeams(teamsData)
    } catch (error) {
      console.error("Error fetching teams:", error)
    } finally {
      setLoading(false)
    }
  }

  const filteredTeams = teams.filter(
    (team) =>
      team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      team.description.toLowerCase().includes(searchQuery.toLowerCase()),
  )

  const hasTeams = teams.length > 0

  // Prevent scrolling when no teams - more aggressive approach
  useEffect(() => {
    if (!hasTeams) {
      // Prevent scrolling on multiple levels
      document.body.style.overflow = "hidden"
      document.body.style.height = "100vh"
      document.documentElement.style.overflow = "hidden"
      document.documentElement.style.height = "100vh"

      // Also prevent touch scrolling on mobile
      const preventScroll = (e: TouchEvent) => {
        e.preventDefault()
      }

      document.addEventListener("touchmove", preventScroll, { passive: false })

      return () => {
        document.body.style.overflow = ""
        document.body.style.height = ""
        document.documentElement.style.overflow = ""
        document.documentElement.style.height = ""
        document.removeEventListener("touchmove", preventScroll)
      }
    } else {
      document.body.style.overflow = ""
      document.body.style.height = ""
      document.documentElement.style.overflow = ""
      document.documentElement.style.height = ""
    }
  }, [hasTeams])

  const handleCreateTeam = () => {
    setShowCreateTeamSheet(true)
    setShowDotsMenu(false)
  }

  const handleJoinTeam = () => {
    setShowJoinTeamModal(true)
    setShowDotsMenu(false)
  }

  const handleSubmitCreateTeam = async () => {
    if (!teamName.trim()) return

    try {
      setLoading(true)
      setError("")

      console.log("[Teams-Screen] Creating team using client-side approach")

      // Use client-side database operations like trends
      const newTeam = await createTeamInSupabase(teamName, teamDescription)
      setTeams((prev) => [...prev, newTeam])
      setShowCreateTeamSheet(false)
      setTeamName("")
      setTeamDescription("")
    } catch (error: any) {
      console.error("Error creating team:", error)
      setError(error.message || "Failed to create team")
    } finally {
      setLoading(false)
    }
  }

  const handleSubmitJoinTeam = async () => {
    if (!teamCode.trim()) return

    try {
      setLoading(true)
      setError("")

      console.log("[Teams-Screen] Joining team using client-side approach")

      // Use client-side database operations like trends
      await joinTeamInSupabase(teamCode)
      setShowJoinTeamModal(false)
      setTeamCode("")
      // Refresh teams list
      await fetchTeams()
    } catch (error: any) {
      console.error("Error joining team:", error)
      setError(error.message || "Failed to join team")
    } finally {
      setLoading(false)
    }
  }

  const handleTeamClick = (team: any) => {
    setSelectedTeam(team)
  }

  const handleBackFromTeamDetails = () => {
    setSelectedTeam(null)
  }

  if (selectedTeam) {
    return (
      <div className="pb-20">
        <TeamDetails team={selectedTeam} onBack={handleBackFromTeamDetails} />
      </div>
    )
  }

  return (
    <>
      <div className={`bg-white ${!hasTeams ? "h-screen overflow-hidden" : "min-h-screen pb-20"}`}>
        <div className="px-2 py-5 bg-white">
          <div className="h-16 flex items-center justify-center mb-4">
            <img
              src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/thryve_nav_logo.svg"
              alt="thryve"
              className="h-12"
            />
          </div>
        </div>

  <div className={`px-4 lg:pl-8 xl:pl-12 space-y-6 ${hasTeams ? "overflow-y-auto" : ""}`}>
          {hasTeams && (
            <div className="text-left mb-6">
              <h1 className="text-2xl lg:text-3xl xl:text-4xl font-bold text-red-600 mb-2">Workspace Collaboration</h1>
              <p className="text-gray-500 lg:text-lg xl:text-xl">Innovate faster, collaborate smarter.</p>
            </div>
          )}

          {loading && !hasTeams && (
            <div className="flex justify-center items-center min-h-[60vh]">
              <div className="text-gray-500">Loading workspaces...</div>
            </div>
          )}

          {!hasTeams && !loading ? (
            <div className="flex flex-col items-center justify-center min-h-[60vh] space-y-6">
              <div className="flex flex-col items-center space-y-4">
                <img
                  src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/no_team_mascot.svg"
                  alt="No workspace mascot"
                  className="w-40 h-40"
                />
                <div className="text-center">
                  <h2 className="text-lg font-semibold text-gray-900 mb-1">No workspace yet? Let's get you</h2>
                  <h2 className="text-lg font-semibold text-gray-900">started!</h2>
                </div>
              </div>

              <div className="w-full max-w-xs space-y-3">
                <Button
                  onClick={handleCreateTeam}
                  className="w-full h-12 bg-red-600 hover:bg-red-700 text-white font-medium rounded-lg"
                >
                  Create a Workspace
                </Button>
                <Button
                  onClick={handleJoinTeam}
                  variant="outline"
                  className="w-full h-12 border-2 border-dashed border-red-300 text-red-600 hover:bg-red-50 font-medium rounded-lg bg-transparent hover:border-red-400"
                >
                  Join a Workspace by Code
                </Button>
              </div>
            </div>
          ) : hasTeams ? (
            <>
              <div className="flex items-center gap-3 mb-6">
                <div className="relative flex-1">
                  <Search size={20} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    placeholder="Search"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="pl-10 h-12 bg-gray-100 border-0 rounded-full"
                  />
                </div>
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setShowDotsMenu(!showDotsMenu)}
                    className="h-12 w-12 rounded-full hover:bg-gray-100"
                  >
                    <MoreVertical size={20} className="text-gray-600" />
                  </Button>

                  {showDotsMenu && (
                    <div className="absolute right-0 top-14 w-60 bg-white rounded-lg shadow-lg border border-gray-200 py-2 z-10">
                      <button
                        onClick={handleCreateTeam}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-700 whitespace-nowrap"
                      >
                        Create a Workspace
                      </button>
                      <button
                        onClick={handleJoinTeam}
                        className="w-full px-4 py-2 text-left hover:bg-gray-50 text-gray-700 whitespace-nowrap"
                      >
                        Join a Workspace
                      </button>
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-4 lg:space-y-0 lg:grid lg:grid-cols-2 xl:grid-cols-3 lg:gap-6">
                {filteredTeams.map((team) => (
                  <Card
                    key={team.id}
                    className={`${team.color} text-white border-0 rounded-2xl overflow-hidden cursor-pointer hover:scale-[1.02] transition-transform`}
                    onClick={() => handleTeamClick(team)}
                  >
                    <CardContent className="p-6">
                      <div className="flex items-center justify-between mb-4">
                        <div className="flex-1">
                          <h3 className="text-xl lg:text-2xl xl:text-3xl font-bold mb-1">{team.name}</h3>
                          <h4 className="text-base lg:text-lg xl:text-xl font-medium mb-2 opacity-90">{team.description}</h4>
                          <div className="text-xs lg:text-sm xl:text-base opacity-75 font-medium">{team.tag}</div>
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="text-white hover:bg-white/20 rounded-full h-10 w-10 p-0 ml-4"
                        >
                          <ArrowUpRight size={20} />
                        </Button>
                      </div>

                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-2">
                          {team.memberAvatars && team.memberAvatars.length > 0 ? (
                            <>
                              {team.memberAvatars.slice(0, 3).map((avatar: string, index: number) => (
                                <div
                                  key={index}
                                  className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-xs font-semibold"
                                >
                                  {avatar}
                                </div>
                              ))}
                              {team.member_count > 3 && (
                                <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-xs font-semibold">
                                  +{team.member_count - 3}
                                </div>
                              )}
                            </>
                          ) : (
                            <div className="w-8 h-8 bg-white/20 rounded-full flex items-center justify-center text-xs font-semibold">
                              U
                            </div>
                          )}
                          <span className="text-sm lg:text-base xl:text-lg font-medium ml-2">
                            {team.member_count} {team.member_count === 1 ? "Member" : "Members"}
                          </span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

  {/* Create Workspace Modal */}
      {showCreateTeamSheet && (
        <div className="fixed inset-0 bg-white z-50 flex flex-col">
          <div className="flex items-center justify-between p-4 border-b border-gray-200">
            <Button variant="ghost" size="sm" onClick={() => setShowCreateTeamSheet(false)} className="p-2">
              <ArrowLeft size={20} />
            </Button>
            <h2 className="text-lg font-semibold">Create Workspace</h2>
            <div className="w-10" />
          </div>

          <div className="flex-1 p-6 space-y-6">
            {error && (
              <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Team Name</label>
              <Input
                value={teamName}
                onChange={(e) => setTeamName(e.target.value)}
                placeholder="Enter team name"
                className="h-12"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Description</label>
              <textarea
                value={teamDescription}
                onChange={(e) => setTeamDescription(e.target.value)}
                placeholder="Describe your team's purpose"
                className="w-full h-32 p-3 border border-gray-300 rounded-lg resize-none"
              />
            </div>

            <Button
              onClick={handleSubmitCreateTeam}
              disabled={!teamName.trim() || loading}
              className="w-full h-12 bg-red-600 hover:bg-red-700 text-white"
            >
              {loading ? "Creating..." : "Create Workspace"}
            </Button>
          </div>
        </div>
      )}

  {/* Join Workspace Modal */}
      {showJoinTeamModal && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowJoinTeamModal(false)} />
          <div className="fixed inset-x-4 top-1/2 -translate-y-1/2 bg-white rounded-2xl p-6 z-50 max-w-sm mx-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold">Join Workspace</h3>
              <Button variant="ghost" size="sm" onClick={() => setShowJoinTeamModal(false)} className="p-1">
                <X size={20} />
              </Button>
            </div>

            <div className="space-y-4">
              {error && (
                <div className="p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm">{error}</div>
              )}

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">Workspace Code</label>
                <Input
                  value={teamCode}
                  onChange={(e) => setTeamCode(e.target.value)}
                  placeholder="Enter team code"
                  className="h-12"
                />
              </div>

              <Button
                onClick={handleSubmitJoinTeam}
                disabled={!teamCode.trim() || loading}
                className="w-full h-12 bg-red-600 hover:bg-red-700 text-white"
              >
                {loading ? "Joining..." : "Join Workspace"}
              </Button>
            </div>
          </div>
        </>
      )}

      {showDotsMenu && <div className="fixed inset-0 z-5" onClick={() => setShowDotsMenu(false)} />}
    </>
  )
}

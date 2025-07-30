import { createClient } from "@/lib/supabase"
import { type NextRequest, NextResponse } from "next/server"

export async function GET() {
  console.log("Teams API GET called")
  try {
    const supabase = createClient()
    console.log("Supabase client created successfully")

    // Verbose debugging for Supabase configuration
    console.log("Environment check:", {
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasAnonKey: !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
      supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL?.substring(0, 30) + "...",
      anonKeyLength: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.length
    })

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log("Teams API detailed auth check:", {
      userId: user?.id,
      userEmail: user?.email,
      userRole: user?.role,
      userAud: user?.aud,
      userAppMetadata: user?.app_metadata,
      userUserMetadata: user?.user_metadata,
      hasAuthError: !!authError,
      authErrorMessage: authError?.message,
      authErrorStatus: authError?.status,
      authErrorCode: authError?.code
    })

    if (authError || !user) {
      console.log("TEAMS API VERBOSE AUTH FAILURE:", {
        reason: !user ? "No user found" : "Auth error occurred",
        authError: authError
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { data: userTeamMemberships, error: membershipError } = await supabase
      .from("team_members")
      .select("team_id, role, avatar")
      .eq("user_id", user.id)
      .eq("is_active", true)

    if (membershipError) {
      console.error("Error fetching team memberships:", membershipError)
      return NextResponse.json({ error: "Failed to fetch team memberships" }, { status: 500 })
    }

    if (!userTeamMemberships || userTeamMemberships.length === 0) {
      return NextResponse.json({ teams: [] })
    }

    const teamIds = userTeamMemberships.map((m) => m.team_id)

    const { data: teams, error: teamsError } = await supabase.from("teams").select("*").in("id", teamIds)

    if (teamsError) {
      console.error("Error fetching teams:", teamsError)
      return NextResponse.json({ error: "Failed to fetch teams" }, { status: 500 })
    }

    const { data: allMembers, error: membersError } = await supabase
      .from("team_members")
      .select("team_id, avatar, user_id")
      .in("team_id", teamIds)
      .eq("is_active", true)

    if (membersError) {
      console.error("Error fetching all members:", membersError)
    }

    const formattedTeams =
      teams?.map((team) => {
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

    return NextResponse.json({ teams: formattedTeams })
  } catch (error) {
    console.error("Error in teams GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  console.log("Teams API POST called")
  try {
    const supabase = createClient()
    console.log("Supabase client created successfully")

    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    console.log("Teams POST detailed auth check:", {
      userId: user?.id,
      userEmail: user?.email,
      userRole: user?.role,
      userAud: user?.aud,
      hasAuthError: !!authError,
      authErrorMessage: authError?.message,
      authErrorStatus: authError?.status,
      authErrorCode: authError?.code
    })

    if (authError || !user) {
      console.log("TEAMS POST API VERBOSE AUTH FAILURE:", {
        reason: !user ? "No user found" : "Auth error occurred",
        authError: authError
      })
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { name, description } = await request.json()

    if (!name?.trim()) {
      return NextResponse.json({ error: "Team name is required" }, { status: 400 })
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
      console.error("Error creating team:", teamError)
      return NextResponse.json({ error: "Failed to create team" }, { status: 500 })
    }

    const { error: memberError } = await supabase.from("team_members").insert({
      team_id: team.id,
      user_id: user.id,
      role: "Team Lead",
      avatar: user.email?.charAt(0).toUpperCase() || "U",
    })

    if (memberError) {
      console.error("Error adding team member:", memberError)
      return NextResponse.json({ error: "Failed to add team member" }, { status: 500 })
    }

    return NextResponse.json({
      team: {
        id: team.id,
        name: team.name,
        description: team.description,
        tag: team.tag,
        color: team.color,
        inviteCode: team.invite_code,
        memberAvatars: [user.email?.charAt(0).toUpperCase() || "U"],
        member_count: 1,
      },
    })
  } catch (error) {
    console.error("Error in teams POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

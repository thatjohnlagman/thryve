import { createClient } from "@/lib/supabase"
import { type NextRequest, NextResponse } from "next/server"

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    // Verify user is a member of the team
    const { data: membership } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", params.id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Not a team member" }, { status: 403 })
    }

    const { data: announcements, error } = await supabase
      .from("team_announcements")
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name
        )
      `)
      .eq("team_id", params.id)
      .order("created_at", { ascending: false })

    if (error) {
      console.error("Error fetching announcements:", error)
      return NextResponse.json({ error: "Failed to fetch announcements" }, { status: 500 })
    }

    const formattedAnnouncements =
      announcements?.map((announcement) => ({
        id: announcement.id,
        title: announcement.title,
        description: announcement.description,
        user: {
          name: announcement.profiles
            ? `${announcement.profiles.first_name || ""} ${announcement.profiles.last_name || ""}`.trim() ||
              "Unknown User"
            : "Unknown User",
          avatar: announcement.profiles?.first_name?.charAt(0).toUpperCase() || "U",
        },
        timestamp: new Date(announcement.created_at).toLocaleString(),
      })) || []

    return NextResponse.json({ announcements: formattedAnnouncements })
  } catch (error) {
    console.error("Error in announcements GET:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

export async function POST(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    const { title, description } = await request.json()

    if (!title?.trim() || !description?.trim()) {
      return NextResponse.json({ error: "Title and description are required" }, { status: 400 })
    }

    // Verify user is a member of the team
    const { data: membership } = await supabase
      .from("team_members")
      .select("*")
      .eq("team_id", params.id)
      .eq("user_id", user.id)
      .eq("is_active", true)
      .single()

    if (!membership) {
      return NextResponse.json({ error: "Not a team member" }, { status: 403 })
    }

    const { data: announcement, error } = await supabase
      .from("team_announcements")
      .insert({
        team_id: params.id,
        user_id: user.id,
        title: title.trim(),
        description: description.trim(),
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
      console.error("Error creating announcement:", error)
      return NextResponse.json({ error: "Failed to create announcement" }, { status: 500 })
    }

    return NextResponse.json({
      announcement: {
        id: announcement.id,
        title: announcement.title,
        description: announcement.description,
        user: {
          name: announcement.profiles
            ? `${announcement.profiles.first_name || ""} ${announcement.profiles.last_name || ""}`.trim() ||
              "Unknown User"
            : "Unknown User",
          avatar: announcement.profiles?.first_name?.charAt(0).toUpperCase() || "U",
        },
        timestamp: "Just now",
      },
    })
  } catch (error) {
    console.error("Error in announcements POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

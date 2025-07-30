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

    const { searchParams } = new URL(request.url)
    const limit = Number.parseInt(searchParams.get("limit") || "50")
    const offset = Number.parseInt(searchParams.get("offset") || "0")

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

    const { data: messages, error } = await supabase
      .from("team_chat_messages")
      .select(`
        *,
        profiles:user_id (
          first_name,
          last_name
        )
      `)
      .eq("team_id", params.id)
      .order("created_at", { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      console.error("Error fetching messages:", error)
      return NextResponse.json({ error: "Failed to fetch messages" }, { status: 500 })
    }

    const formattedMessages =
      messages?.reverse().map((message) => ({
        id: message.id,
        user: message.profiles
          ? `${message.profiles.first_name || ""} ${message.profiles.last_name || ""}`.trim() || "Unknown User"
          : "Unknown User",
        message: message.message,
        timestamp: new Date(message.created_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isUser: message.user_id === user.id,
        created_at: message.created_at,
      })) || []

    return NextResponse.json({ messages: formattedMessages })
  } catch (error) {
    console.error("Error in messages GET:", error)
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

    const { message } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json({ error: "Message is required" }, { status: 400 })
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

    const { data: newMessage, error } = await supabase
      .from("team_chat_messages")
      .insert({
        team_id: params.id,
        user_id: user.id,
        message: message.trim(),
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
      console.error("Error creating message:", error)
      return NextResponse.json({ error: "Failed to send message" }, { status: 500 })
    }

    return NextResponse.json({
      message: {
        id: newMessage.id,
        user: newMessage.profiles
          ? `${newMessage.profiles.first_name || ""} ${newMessage.profiles.last_name || ""}`.trim() || "Unknown User"
          : "Unknown User",
        message: newMessage.message,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        isUser: true,
        created_at: newMessage.created_at,
      },
    })
  } catch (error) {
    console.error("Error in messages POST:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    console.log("[PROTOTYPE-UPDATE-URL] =================================")
    console.log("[PROTOTYPE-UPDATE-URL] UPDATING PROTOTYPE URL")
    console.log("[PROTOTYPE-UPDATE-URL] =================================")

    const body = await request.json()
    const { prototypeId, newUrl } = body

    console.log("[PROTOTYPE-UPDATE-URL] Request details:")
    console.log(`   - Prototype ID: ${prototypeId}`)
    console.log(`   - New URL: ${newUrl}`)

    if (!prototypeId || !newUrl) {
      console.error("[PROTOTYPE-UPDATE-URL] Missing required fields")
      return NextResponse.json({ error: "prototypeId and newUrl are required" }, { status: 400 })
    }

    const supabase = createClient()

    console.log("[PROTOTYPE-UPDATE-URL] Updating prototype URL in database...")
    const { data, error } = await supabase
      .from("prototypes")
      .update({
        v0_url: newUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", prototypeId)
      .select()
      .single()

    if (error) {
      console.error("[PROTOTYPE-UPDATE-URL] Database update failed:", error)
      return NextResponse.json({ error: "Failed to update prototype URL" }, { status: 500 })
    }

    console.log("[PROTOTYPE-UPDATE-URL] Prototype URL updated successfully")
    console.log(`   - Updated prototype: ${data.title}`)
    console.log(`   - New URL: ${data.v0_url}`)
    console.log("[PROTOTYPE-UPDATE-URL] =================================")

    return NextResponse.json({
      success: true,
      prototype: data,
      message: "Prototype URL updated successfully",
    })
  } catch (error) {
    console.error("[PROTOTYPE-UPDATE-URL] =================================")
    console.error("[PROTOTYPE-UPDATE-URL] UPDATE URL FAILED")
    console.error("[PROTOTYPE-UPDATE-URL] =================================")
    console.error("[PROTOTYPE-UPDATE-URL] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

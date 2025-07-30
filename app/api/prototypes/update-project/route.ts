import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"

export async function POST(request: NextRequest) {
  try {
    console.log("[PROTOTYPE-UPDATE-PROJECT] =================================")
    console.log("[PROTOTYPE-UPDATE-PROJECT] UPDATING PROTOTYPE PROJECT")
    console.log("[PROTOTYPE-UPDATE-PROJECT] =================================")

    const body = await request.json()
    const { prototypeId, v0ProjectId, v0Url } = body

    console.log("[PROTOTYPE-UPDATE-PROJECT] Request details:")
    console.log(`   - Prototype ID: ${prototypeId}`)
    console.log(`   - V0 Project ID: ${v0ProjectId}`)
    console.log(`   - V0 URL: ${v0Url}`)

    if (!prototypeId) {
      console.error("[PROTOTYPE-UPDATE-PROJECT] Missing prototypeId")
      return NextResponse.json({ error: "prototypeId is required" }, { status: 400 })
    }

    const supabase = createClient()

    const updateData: any = {
      updated_at: new Date().toISOString(),
    }

    if (v0ProjectId) {
      updateData.v0_project_id = v0ProjectId
    }

    if (v0Url) {
      updateData.v0_url = v0Url
    }

    console.log("[PROTOTYPE-UPDATE-PROJECT] Updating prototype project details...")
    const { data, error } = await supabase.from("prototypes").update(updateData).eq("id", prototypeId).select().single()

    if (error) {
      console.error("[PROTOTYPE-UPDATE-PROJECT] Database update failed:", error)
      return NextResponse.json({ error: "Failed to update prototype project details" }, { status: 500 })
    }

    console.log("[PROTOTYPE-UPDATE-PROJECT] Prototype project details updated successfully")
    console.log(`   - Updated prototype: ${data.title}`)
    console.log(`   - V0 Project ID: ${data.v0_project_id}`)
    console.log(`   - V0 URL: ${data.v0_url}`)
    console.log("[PROTOTYPE-UPDATE-PROJECT] =================================")

    return NextResponse.json({
      success: true,
      prototype: data,
      message: "Prototype project details updated successfully",
    })
  } catch (error) {
    console.error("[PROTOTYPE-UPDATE-PROJECT] =================================")
    console.error("[PROTOTYPE-UPDATE-PROJECT] UPDATE PROJECT FAILED")
    console.error("[PROTOTYPE-UPDATE-PROJECT] =================================")
    console.error("[PROTOTYPE-UPDATE-PROJECT] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

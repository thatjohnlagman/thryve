import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase"
import { v0Api } from "@/lib/v0-api"

export async function POST(request: NextRequest) {
  try {
    console.log("[PROTOTYPES-API] =================================")
    console.log("[PROTOTYPES-API] PROTOTYPE GENERATION REQUEST")
    console.log("[PROTOTYPES-API] =================================")

    const body = await request.json()
    const { prompt, title, description, category, priority = "Medium", trendId, userId } = body

    console.log("[PROTOTYPES-API] Request details:")
    console.log(`   - Title: "${title}"`)
    console.log(`   - Description: "${description}"`)
    console.log(`   - Category: "${category}"`)
    console.log(`   - Priority: "${priority}"`)
    console.log(`   - Trend ID: ${trendId || "None"}`)
    console.log(`   - User ID: ${userId || "None"}`)
    console.log(`   - Prompt length: ${prompt?.length || 0} characters`)

    if (!prompt) {
      console.error("[PROTOTYPES-API] Missing prompt in request")
      return NextResponse.json({ error: "Prompt is required" }, { status: 400 })
    }

    if (!userId) {
      console.error("[PROTOTYPES-API] Missing userId in request")
      return NextResponse.json({ error: "Authentication required" }, { status: 401 })
    }

    const supabase = createClient()

    // If this generation request is tied to a trend, ensure the trend's generation_type
    // does not explicitly forbid prototype creation. This is a server-side safeguard
    // to avoid creating prototypes for trends that were manually generated.
    if (trendId) {
      try {
        // First check if a prototype already exists for this trend to prevent duplicates
        console.log("[PROTOTYPES-API] Checking for existing prototypes for trend:", trendId)
        const { data: existingTrendPrototypes, error: existingError } = await supabase
          .from("prototypes")
          .select("id, status")
          .eq("trend_id", trendId)
          .eq("user_id", userId)

        if (existingError) {
          console.error("[PROTOTYPES-API] Error checking existing trend prototypes:", existingError)
        } else if (existingTrendPrototypes && existingTrendPrototypes.length > 0) {
          console.log("[PROTOTYPES-API] Prototype already exists for trend:", trendId, "Count:", existingTrendPrototypes.length)
          existingTrendPrototypes.forEach((proto, idx) => {
            console.log(`   - Existing prototype ${idx + 1}: ${proto.id} (Status: ${proto.status})`)
          })
          return NextResponse.json({ 
            success: false, 
            message: "Prototype already exists for this trend", 
            existingPrototypes: existingTrendPrototypes.length 
          })
        }

        const { data: trendRecord, error: trendError } = await supabase
          .from("trends")
          .select("generation_type")
          .eq("id", trendId)
          .single()

        if (trendError) {
          console.log("[PROTOTYPES-API] Could not fetch trend generation_type, proceeding:", trendError.message)
        } else if (trendRecord && trendRecord.generation_type === "manual") {
          console.log("[PROTOTYPES-API] Detected trend with generation_type=manual — skipping prototype creation for trendId:", trendId)
          return NextResponse.json({ success: false, message: "Trend was generated manually; automatic prototype creation skipped." })
        }
      } catch (err) {
        console.log("[PROTOTYPES-API] Error while checking trend generation_type — proceeding to avoid blocking legitimate requests:", err)
      }
    }

    console.log("[PROTOTYPES-API] Checking for existing prototype with same title...")
    const { data: existingPrototype } = await supabase
      .from("prototypes")
      .select("id, v0_project_id, v0_url, status")
      .eq("user_id", userId)
      .eq("title", title || "Generated Prototype")
      .order("created_at", { ascending: false })
      .limit(1)
      .single()

    let prototypeId: string
    let isUpdate = false

    if (existingPrototype) {
      console.log(`[PROTOTYPES-API] Found existing prototype: ${existingPrototype.id}`)
      console.log(`[PROTOTYPES-API] Old URL: ${existingPrototype.v0_url}`)
      console.log("[PROTOTYPES-API] Will generate new v0 project and update with new URL")

      prototypeId = existingPrototype.id
      isUpdate = true

      // Update the existing prototype with new prompt and reset status
      const { error: updateError } = await supabase
        .from("prototypes")
        .update({
          description: description || "Prototype updated from prompt",
          category: category || "General",
          priority,
          prompt,
          status: "Generating",
          generation_started_at: new Date().toISOString(),
          generation_completed_at: null,
          error_message: null,
        })
        .eq("id", prototypeId)

      if (updateError) {
        console.error("[PROTOTYPES-API] Failed to update existing prototype:", updateError)
        return NextResponse.json({ error: "Failed to update prototype" }, { status: 500 })
      }

      console.log("[PROTOTYPES-API] Existing prototype updated for regeneration")
    } else {
      console.log("[PROTOTYPES-API] Creating new prototype record...")

      // For trend-based prototypes, use an upsert to handle race conditions
      if (trendId) {
        console.log("[PROTOTYPES-API] Using upsert for trend-based prototype to prevent race conditions...")
        
        // First, try to find existing record
        const { data: existingRecord } = await supabase
          .from("prototypes")
          .select("*")
          .eq("trend_id", trendId)
          .eq("user_id", userId)
          .single()

        if (existingRecord) {
          console.log(`[PROTOTYPES-API] Found existing prototype: ${existingRecord.id}`)
          console.log(`   - Status: ${existingRecord.status}`)
          console.log(`   - Started: ${existingRecord.generation_started_at}`)
          
          // If it's currently generating, check timing
          if (existingRecord.status === "Generating" && existingRecord.generation_started_at) {
            const startedAt = new Date(existingRecord.generation_started_at).getTime()
            const now = Date.now()
            const timeDiff = now - startedAt
            
            // If generation started less than 5 minutes ago, don't start another one
            if (timeDiff < 5 * 60 * 1000) {
              console.log("[PROTOTYPES-API] Prototype already being generated, skipping duplicate v0 call")
              console.log(`   - Started ${Math.round(timeDiff / 1000)} seconds ago`)
              return NextResponse.json({
                success: true,
                prototypeId: existingRecord.id,
                status: "generating",
                message: "Prototype generation already in progress",
                isUpdate: false,
              })
            }
          }
          
          // Update existing record to restart generation
          const { data: prototype, error: updateError } = await supabase
            .from("prototypes")
            .update({
              title: title || "Generated Prototype",
              description: description || "Prototype generated from prompt",
              category: category || "General",
              priority,
              prompt,
              status: "Generating",
              generation_started_at: new Date().toISOString(),
            })
            .eq("id", existingRecord.id)
            .select()
            .single()

          if (updateError) {
            console.error("[PROTOTYPES-API] Database update error:", updateError)
            return NextResponse.json({ error: "Failed to update prototype record" }, { status: 500 })
          }

          prototypeId = prototype.id
          console.log(`[PROTOTYPES-API] Existing prototype updated for regeneration: ${prototypeId}`)
        } else {
          // Create new record
          const { data: prototype, error: insertError } = await supabase
            .from("prototypes")
            .insert({
              user_id: userId,
              trend_id: trendId,
              title: title || "Generated Prototype",
              description: description || "Prototype generated from prompt",
              category: category || "General",
              priority,
              prompt,
              status: "Generating",
              generation_started_at: new Date().toISOString(),
            })
            .select()
            .single()

          if (insertError) {
            console.error("[PROTOTYPES-API] Database insert error:", insertError)
            return NextResponse.json({ error: "Failed to create prototype record" }, { status: 500 })
          }

          prototypeId = prototype.id
          console.log(`[PROTOTYPES-API] New prototype record created: ${prototypeId}`)
        }
      } else {
        // For non-trend prototypes, use regular insert
        const { data: prototype, error: insertError } = await supabase
          .from("prototypes")
          .insert({
            user_id: userId,
            trend_id: null,
            title: title || "Generated Prototype",
            description: description || "Prototype generated from prompt",
            category: category || "General",
            priority,
            prompt,
            status: "Generating",
            generation_started_at: new Date().toISOString(),
          })
          .select()
          .single()

        if (insertError) {
          console.error("[PROTOTYPES-API] Database insert error:", insertError)
          return NextResponse.json({ error: "Failed to create prototype record" }, { status: 500 })
        }

        prototypeId = prototype.id
        console.log(`[PROTOTYPES-API] New prototype record created: ${prototypeId}`)
      }
    }

    console.log("[PROTOTYPES-API] Starting background v0 generation...")

    generatePrototypeAsync(prototypeId, prompt, userId)

    console.log("[PROTOTYPES-API] Response sent to client, background generation in progress")
    console.log("[PROTOTYPES-API] =================================")

    return NextResponse.json({
      success: true,
      prototypeId,
      status: "generating",
      message: isUpdate ? "Prototype update started (new URL will be generated)" : "Prototype generation started",
      isUpdate,
    })
  } catch (error) {
    console.error("[PROTOTYPES-API] =================================")
    console.error("[PROTOTYPES-API] PROTOTYPE REQUEST FAILED :/")
    console.error("[PROTOTYPES-API] =================================")
    console.error("[PROTOTYPES-API] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

async function generatePrototypeAsync(prototypeId: string, prompt: string, userId: string) {
  console.log("[BACKGROUND-V0] =================================")
  console.log("V0 gen starts here")
  console.log("[BACKGROUND-V0] =================================")
  console.log(`[BACKGROUND-V0] Prototype ID: ${prototypeId}`)
  console.log(`[BACKGROUND-V0] User ID: ${userId}`)
  console.log(`[BACKGROUND-V0] Prompt length: ${prompt.length} characters`)

  const supabase = createClient()

  try {
    console.log("[BACKGROUND-V0] Creating new v0 project...")
    const result = await v0Api.generatePrototype(prompt)

    console.log("[BACKGROUND-V0] v0 API Result:")
    console.log(`   - Status: ${result.status}`)
    console.log(`   - ID: ${result.id}`)
    console.log(`   - URL: ${result.url}`)
    console.log(`   - Files: ${result.files?.length || 0}`)
    console.log(`   - Error: ${result.error || "None"}`)

    const updateData: any = {
      generation_completed_at: new Date().toISOString(),
      status: result.status === "ready" ? "Ready" : "Failed",
    }

    if (result.status === "ready") {
      updateData.v0_project_id = result.id
      updateData.v0_url = result.url
      console.log("[BACKGROUND-V0] Prototype generated successfully with new URL!")
    } else {
      updateData.error_message = result.error || "Generation failed"
      console.error("[BACKGROUND-V0] Prototype generation failed!")
    }

    console.log("[BACKGROUND-V0] Updating database with new URL...")
    const { error: updateError } = await supabase
      .from("prototypes")
      .update(updateData)
      .eq("id", prototypeId)
      .eq("user_id", userId)

    if (updateError) {
      console.error("[BACKGROUND-V0] Failed to update prototype in database:", updateError)
    } else {
      console.log("[BACKGROUND-V0] Database updated successfully with new URL!")
      console.log("[BACKGROUND-V0] =================================")
      console.log("[BACKGROUND-V0] PROTOTYPE GENERATION COMPLETE")
      console.log("[BACKGROUND-V0] =================================")
    }
  } catch (error) {
    console.error("[BACKGROUND-V0] =================================")
    console.error("[BACKGROUND-V0] BACKGROUND GENERATION FAILED")
    console.error("[BACKGROUND-V0] =================================")
    console.error("[BACKGROUND-V0] Error type:", error instanceof Error ? error.constructor.name : typeof error)
    console.error("[BACKGROUND-V0] Error message:", error instanceof Error ? error.message : String(error))

    if (error instanceof Error && error.stack) {
      console.error("[BACKGROUND-V0] Stack trace:")
      error.stack.split("\n").forEach((line) => console.error(`   ${line}`))
    }

    console.log("[BACKGROUND-V0] Updating database with error status...")
    // Update prototype with error status
    await supabase
      .from("prototypes")
      .update({
        status: "Failed",
        error_message: error instanceof Error ? error.message : "Unknown error",
        generation_completed_at: new Date().toISOString(),
      })
      .eq("id", prototypeId)
      .eq("user_id", userId)

    console.error("[BACKGROUND-V0] Database updated with failed status")
  }
}

export async function GET(request: NextRequest) {
  try {
    console.log("[PROTOTYPES-GET] =================================")
    console.log("[PROTOTYPES-GET] FETCHING PROTOTYPES")
    console.log("[PROTOTYPES-GET] =================================")

    // Get authorization header from client
    const authHeader = request.headers.get("authorization")
    console.log("[PROTOTYPES-GET] Auth header present:", !!authHeader)

    if (!authHeader || !authHeader.startsWith("Bearer ")) {
      console.error("[PROTOTYPES-GET] Missing or invalid authorization header")
      return NextResponse.json({ error: "Authorization required" }, { status: 401 })
    }

    const token = authHeader.substring(7) // Remove "Bearer " prefix
    console.log("[PROTOTYPES-GET] Token length:", token.length)

    // Create Supabase client with the provided token
    const supabase = createClient()
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser(token)

    if (authError || !user) {
      console.error("[PROTOTYPES-GET] Authentication failed:", authError?.message)
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
    }

    console.log(`[PROTOTYPES-GET] User authenticated: ${user.id}`)

    const { searchParams } = new URL(request.url)
    const status = searchParams.get("status")
    const category = searchParams.get("category")
    const limit = Number.parseInt(searchParams.get("limit") || "10")

    console.log("[PROTOTYPES-GET] Query parameters:")
    console.log(`   - Status filter: ${status || "None"}`)
    console.log(`   - Category filter: ${category || "None"}`)
    console.log(`   - Limit: ${limit}`)

    let query = supabase
      .from("prototypes")
      .select(`
        *,
        trends (
          title,
          category,
          impact
        )
      `)
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(limit)

    if (status) {
      query = query.eq("status", status)
    }

    if (category) {
      query = query.eq("category", category)
    }

    console.log("[PROTOTYPES-GET] Executing database query...")
    const { data: prototypes, error } = await query

    if (error) {
      console.error("[PROTOTYPES-GET] Database query failed:", error)
      return NextResponse.json({ error: "Failed to fetch prototypes" }, { status: 500 })
    }

    console.log(`[PROTOTYPES-GET] Found ${prototypes?.length || 0} prototypes`)
    console.log("[PROTOTYPES-GET] =================================")

    return NextResponse.json({ prototypes })
  } catch (error) {
    console.error("[PROTOTYPES-GET] =================================")
    console.error("[PROTOTYPES-GET] GET PROTOTYPES FAILED")
    console.error("[PROTOTYPES-GET] =================================")
    console.error("[PROTOTYPES-GET] Error:", error)
    return NextResponse.json({ error: "Internal server error" }, { status: 500 })
  }
}

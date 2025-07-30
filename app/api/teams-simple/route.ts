import { NextRequest, NextResponse } from "next/server"

export async function GET() {
  console.log("[Teams-Simple] GET /api/teams-simple called")
  
  try {
    return NextResponse.json({
      message: "Teams simple API - Use client-side operations for database access"
    })
  } catch (error: any) {
    console.error("[Teams-Simple] Error in GET:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}

export async function POST(request: NextRequest) {
  console.log("[Teams-Simple] POST /api/teams-simple called")
  
  try {
    const { action, ...data } = await request.json()
    
    console.log("[Teams-Simple] Request data:", { action, data })
    
    // This is a simple API that doesn't do database operations
    // Database operations are handled client-side like in trends
    return NextResponse.json({
      message: `Teams action: ${action}`,
      success: true
    })
  } catch (error: any) {
    console.error("[Teams-Simple] Error in POST:", error)
    return NextResponse.json(
      { error: "Failed to process request" },
      { status: 500 }
    )
  }
}

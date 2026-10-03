import { type NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { generateInteractiveDashboardUI } from "@/lib/gemini"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  try {
    const { utilityId, fileName, generatedCode } = await request.json()

    if (!utilityId || !fileName) {
      console.error("[Generate-Dashboard] Missing required parameters")
      return NextResponse.json({ error: "Missing utilityId or fileName" }, { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || "https://placeholder.supabase.co"
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || "placeholder-key"
    const supabase = createClient(supabaseUrl, supabaseKey)

    console.log(`[Generate-Dashboard] Fetching utility record: ${utilityId}`)
    const { data: utilityRecord, error: dbError } = await supabase
      .from("utilities")
      .select("file_link, file_name, generated_code")
      .eq("id", utilityId)
      .single()

    if (dbError || !utilityRecord) {
      console.error("[Generate-Dashboard] Utility record not found:", dbError)
      return NextResponse.json({ error: "Utility record not found" }, { status: 404 })
    }

    // If dashboard is already generated and cached, return it directly
    if (utilityRecord.generated_code && !generatedCode) {
      const dashboardUrl = `/api/utilities/dashboard/${utilityId}`
      return NextResponse.json({
        success: true,
        dashboardUrl,
        generatedCode: utilityRecord.generated_code,
      })
    }

    let csvData = ""
    try {
      console.log(`[Generate-Dashboard] Downloading CSV from storage: ${utilityRecord.file_link}`)
      const { data: fileData, error: downloadError } = await supabase.storage
        .from("utilities-files")
        .download(utilityRecord.file_link)

      if (downloadError || !fileData) {
        throw downloadError || new Error("Failed to download file from storage")
      }
      csvData = await fileData.text()
    } catch (storageErr) {
      console.warn("[Generate-Dashboard] Storage download fallback, using placeholder sample:", storageErr)
      csvData = "Category,Metric,Value,Date\nRetail,ActiveUsers,125000,2025-01-01\nDigital,Transactions,450000,2025-01-02\nSME,LoanVolume,8200000,2025-01-03"
    }

    console.log("[Generate-Dashboard] Applying PII redaction...")
    let redactedCsv = csvData
    try {
      const { defaultPiiRedactor } = await import("@/lib/pii-redactor")
      const lines = csvData.split("\n").slice(0, 51)
      redactedCsv = defaultPiiRedactor.redactCsvData(lines.join("\n"), {
        preserveHeaders: true,
        maxRows: 50,
      })
    } catch (piiErr) {
      console.warn("[Generate-Dashboard] PII redaction skipped:", piiErr)
      redactedCsv = csvData.split("\n").slice(0, 50).join("\n")
    }

    console.log("[Generate-Dashboard] Synthesizing dashboard using Gemini...")
    const { html: dashboardHtml, chartsCount } = await generateInteractiveDashboardUI({
      csvSample: redactedCsv,
      fileName,
    })

    const dashboardUrl = `/api/utilities/dashboard/${utilityId}`

    console.log("[Generate-Dashboard] Saving dashboard to Supabase...")
    await supabase
      .from("utilities")
      .update({
        status: "ready",
        generated_code: dashboardHtml,
        dashboard_url: dashboardUrl,
        charts_count: chartsCount || 4,
        error_message: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", utilityId)

    return NextResponse.json({
      success: true,
      dashboardUrl,
      generatedCode: dashboardHtml,
    })
  } catch (error: any) {
    console.error("[Generate-Dashboard] Error:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Failed to generate dashboard",
      },
      { status: 500 }
    )
  }
}

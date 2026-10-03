import { type NextRequest, NextResponse } from "next/server"
import { createClient as createSupabaseClient } from "@supabase/supabase-js"

export const dynamic = "force-dynamic"
export const revalidate = 0

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const { id } = params
    if (!id) {
      return new NextResponse("Utility ID is required", { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey)
    const { data: utility, error } = await supabase
      .from("utilities")
      .select("id, file_name, status, generated_code")
      .eq("id", id)
      .single()

    if (error || !utility) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Dashboard Not Found</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-50 flex items-center justify-center min-h-screen p-4 text-center font-sans">
          <div class="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div class="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">!</div>
            <h1 class="text-xl font-bold text-slate-800 mb-2">Dashboard Not Found</h1>
            <p class="text-slate-500 text-sm">The requested dashboard could not be loaded.</p>
          </div>
        </body>
        </html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      )
    }

    if (utility.status === "generating-dashboard" && !utility.generated_code) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Generating Dashboard...</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-50 flex items-center justify-center min-h-screen p-4 text-center font-sans">
          <div class="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div class="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h1 class="text-lg font-bold text-slate-800 mb-1">Generating Dashboard</h1>
            <p class="text-slate-500 text-sm mb-4">Gemini AI is analyzing ${utility.file_name} and synthesizing analytics charts...</p>
            <script>setTimeout(() => window.location.reload(), 4000);</script>
          </div>
        </body>
        </html>`,
        {
          status: 200,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      )
    }

    const html = utility.generated_code || `<!DOCTYPE html>
      <html>
      <head><title>${utility.file_name} Dashboard</title><script src="https://cdn.tailwindcss.com"></script></head>
      <body class="p-8 font-sans">
        <h1 class="text-2xl font-bold text-slate-900">${utility.file_name}</h1>
        <p class="text-slate-600 mt-2">Dashboard is ready.</p>
      </body>
      </html>`

    return new NextResponse(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate",
        "Pragma": "no-cache",
        "Expires": "0",
      },
    })
  } catch (err: any) {
    console.error("[Dashboard-Preview] Error serving dashboard preview:", err)
    return new NextResponse("Internal server error", { status: 500 })
  }
}

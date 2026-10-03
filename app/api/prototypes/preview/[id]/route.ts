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
      return new NextResponse("Prototype ID is required", { status: 400 })
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
    const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
    const supabase = createSupabaseClient(supabaseUrl, serviceRoleKey)
    const { data: prototype, error } = await supabase
      .from("prototypes")
      .select("id, title, status, prompt, prototype_code, description")
      .eq("id", id)
      .single()

    if (error || !prototype) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Prototype Not Found</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-50 flex items-center justify-center min-h-screen p-4 text-center font-sans">
          <div class="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div class="w-12 h-12 bg-red-100 text-red-600 rounded-full flex items-center justify-center mx-auto mb-4 font-bold text-xl">!</div>
            <h1 class="text-xl font-bold text-slate-800 mb-2">Prototype Not Found</h1>
            <p class="text-slate-500 text-sm">The requested prototype could not be found or has not been generated yet.</p>
          </div>
        </body>
        </html>`,
        {
          status: 404,
          headers: { "Content-Type": "text/html; charset=utf-8" },
        }
      )
    }

    if (prototype.status === "Generating" && !prototype.prototype_code) {
      return new NextResponse(
        `<!DOCTYPE html>
        <html lang="en">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>Generating ${prototype.title}...</title>
          <script src="https://cdn.tailwindcss.com"></script>
        </head>
        <body class="bg-slate-50 flex items-center justify-center min-h-screen p-4 text-center font-sans">
          <div class="max-w-md bg-white p-8 rounded-2xl shadow-sm border border-slate-200">
            <div class="w-10 h-10 border-4 border-red-600 border-t-transparent rounded-full animate-spin mx-auto mb-4"></div>
            <h1 class="text-lg font-bold text-slate-800 mb-1">Generating Prototype</h1>
            <p class="text-slate-500 text-sm mb-4">Gemini AI is crafting the interactive UI for "${prototype.title}"...</p>
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

    const html = prototype.prototype_code || `<!DOCTYPE html>
      <html>
      <head><title>${prototype.title}</title><script src="https://cdn.tailwindcss.com"></script></head>
      <body class="p-8 font-sans">
        <h1 class="text-2xl font-bold text-slate-900">${prototype.title}</h1>
        <p class="text-slate-600 mt-2">${prototype.description || ""}</p>
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
    console.error("[Prototype-Preview] Error serving prototype preview:", err)
    return new NextResponse("Internal server error", { status: 500 })
  }
}

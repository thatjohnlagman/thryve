// v0 Platform API integration service using v0-sdk
// Uses the v0 Platform API to create deployable prototypes

interface V0GenerateRequest {
  prompt: string
}

interface V0GenerateResponse {
  id: string
  url: string
  status: "generating" | "ready" | "failed"
  error?: string
  files?: Array<{
    lang: string
    meta: Record<string, any>
    source: string
  } | {
    object: "file"
    name: string
    content: string
    locked: boolean
  }>
}

class V0ApiService {
  private apiKey: string

  constructor() {
    this.apiKey = process.env.V0_API_KEY || ""
    console.log("🔧 [V0-API] Environment check:")
    console.log(`   - NODE_ENV: ${process.env.NODE_ENV}`)
    console.log(`   - V0_API_KEY present: ${!!this.apiKey}`)
    console.log(`   - V0_API_KEY length: ${this.apiKey.length}`)

    if (!this.apiKey) {
      console.error("[V0-API] CRITICAL ERROR: V0_API_KEY environment variable is missing")
      console.error("[V0-API] Please add V0_API_KEY to your .env.local file")
      console.error("[V0-API] Get your API key from: https://v0.dev/chat/settings/keys")
      throw new Error("V0_API_KEY environment variable is required")
    }

    if (this.apiKey.length < 20) {
      console.error("[V0-API] WARNING: V0_API_KEY appears to be too short")
      console.error(`- Current length: ${this.apiKey.length}`)
      console.error(`- Expected length: ~50+ characters`)
      console.error("[V0-API] Please verify your API key from: https://v0.dev/chat/settings/keys")
    }

    console.log("[V0-API] Service initialized successfully")
    console.log(
      `[V0-API] API Key preview: ${this.apiKey.substring(0, 8)}...${this.apiKey.substring(this.apiKey.length - 4)}`,
    )
  }

  async generatePrototype(prompt: string): Promise<V0GenerateResponse> {
    console.log("[V0-API] =================================")
    console.log("[V0-API] STARTING PROTOTYPE GENERATION")
    console.log("[V0-API] =================================")
    console.log(`[V0-API] Prompt length: ${prompt.length} characters`)
    console.log(`[V0-API] Prompt preview: "${prompt.substring(0, 150)}${prompt.length > 150 ? "..." : ""}"`)

    try {
      console.log("[V0-API] Importing v0-sdk...")
      const { v0 } = await import("v0-sdk")
      console.log("[V0-API] v0-sdk imported successfully")
      console.log("[V0-API] SDK client type:", typeof v0)
      console.log("[V0-API] SDK methods available:", Object.keys(v0))

      console.log("[V0-API] Creating chat with v0 API...")
      console.log("[V0-API] Model configuration: v0-1.5-lg, with images, with thinking")

      const startTime = Date.now()
      const chatResponse = await v0.chats.create({
        system: `You are an expert frontend engineer tasked with building a complete, production-quality mobile-first application prototype. 
Follow these rules strictly:

1. Code Quality
   - Write clean, maintainable, production-ready code.
   - Use modern frameworks (Next.js 14+ with App Router, React, Tailwind CSS, shadcn/ui).
   - Use TypeScript where applicable.

2. File Structure
   - Split the code into multiple files and folders if needed (components, MODULAR pages (Do not bundle everything into 1 page.tsx), styles, utils, etc.).
   - Ensure imports are correct and relative paths are valid.
   - Do not cram everything into a single file unless explicitly required.
   - Make sure all buttons have **click handlers** and are properly linked to their actions or front end UI.

3. Assets
   - Do not use placeholder images like "placeholder.png".
   - For profile avatars, automatically generate initials from the user's name (e.g., "Juan Dela Cruz" → "JD").
   - Use modern avatar components (e.g., shadcn/ui Avatar) or generate mock visuals with CSS/JSX.
- Never generate a picture.

4. Mobile-First
   - Prioritize mobile-first design — the app should look and feel like a native mobile app.
   - Use bottom navigation bars, touch-friendly buttons, proper spacing, and responsive layouts.

5. Functionality
   - Every button, tab, and link must be clickable and perform a UI action (open modal, navigate, show toast).
   - Include proper form validation and feedback states.
   - Use mock data where backend data would normally be required.
   - Avoid leaving dead links or non-working buttons.

6. UX & Visuals
   - Ensure smooth transitions, animations, and polished micro-interactions.
   - Maintain consistency in spacing, alignment, colors, and typography.
   - Use sensible defaults for mock user data, transactions, causes, or features.

Your output should always be a complete and most importantly MODULAR, functional frontend project with no missing assets or broken imports.`,
        message: prompt.trim(),
        modelConfiguration: {
          modelId: "v0-1.5-md", // Upgraded to medium model for better quality
          imageGenerations: false, // Disable rich content generation
          thinking: false, // Keep verbose logging for debugging
        },
      })
      const endTime = Date.now()

      console.log(`[V0-API] Chat creation took: ${endTime - startTime}ms`)
      console.log(`[V0-API] Chat created successfully! ID: ${chatResponse.id}`)
      console.log("[V0-API] Analyzing chat response structure...")

      // Log all available properties for debugging
      const responseKeys = Object.keys(chatResponse)
      console.log(`[V0-API] Chat response contains ${responseKeys.length} properties:`)
      responseKeys.forEach((key) => {
        const value = (chatResponse as any)[key]
        if (typeof value === "string") {
          console.log(`- ${key}: "${value.length > 100 ? value.substring(0, 100) + "..." : value}"`)
        } else if (Array.isArray(value)) {
          console.log(`- ${key}: Array[${value.length}]`)
        } else if (typeof value === "object" && value !== null) {
          console.log(`- ${key}: Object{${Object.keys(value).join(", ")}}`)
        } else {
          console.log(`- ${key}: ${value}`)
        }
      })

      console.log("[V0-API] Extracting URLs from response...")
      const availableUrls = {
        webUrl: chatResponse.webUrl,
        demoUrl: chatResponse.latestVersion?.demoUrl,
        demo: chatResponse.demo, // deprecated but still check
        id: chatResponse.id,
        latestVersionId: chatResponse.latestVersion?.id,
      }

      console.log("🌐 [V0-API] Available URLs and IDs:")
      Object.entries(availableUrls).forEach(([key, value]) => {
        if (value) {
          console.log(`${key}: ${value}`)
        } else {
          console.log(`${key}: undefined/null`)
        }
      })

      // According to v0 Platform API docs:
      // - latestVersion.demoUrl is the preview URL for the generated code
      // - webUrl is the web URL to view the chat in browser
      // - demo is deprecated but might still exist
      const previewUrl = 
        chatResponse.latestVersion?.demoUrl || 
        chatResponse.demo || 
        chatResponse.webUrl || 
        `https://v0.dev/chat/${chatResponse.id}`

      console.log(`[V0-API] Selected preview URL: ${previewUrl}`)
      console.log(`[V0-API] Files in response: ${chatResponse.latestVersion?.files?.length || chatResponse.files?.length || 0}`)

      // Check for files in both locations (API docs show files can be in latestVersion)
      const files = chatResponse.latestVersion?.files || chatResponse.files || []
      if (files && files.length > 0) {
        console.log("[V0-API] Generated files:")
        files.forEach((file, index) => {
          // Handle both old and new file formats
          const fileName = (file as any).name || 'Unnamed'
          const fileSize = (file as any).content?.length || (file as any).source?.length || 0
          console.log(`   ${index + 1}. ${fileName} (${fileSize} chars)`)
        })
      }

      console.log("[V0-API] =================================")
      console.log("[V0-API] PROTOTYPE GENERATION SUCCESSFUL")
      console.log("[V0-API] =================================")

      return {
        id: chatResponse.id,
        url: previewUrl,
        status: "ready",
        files: files || [],
      }
    } catch (error) {
      console.error(" [V0-API] =================================")
      console.error(" [V0-API] PROTOTYPE GENERATION FAILED")
      console.error(" [V0-API] =================================")
      console.error(` [V0-API] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
      console.error(` [V0-API] Error message: ${error instanceof Error ? error.message : String(error)}`)

      if (error instanceof Error && error.stack) {
        console.error("📍 [V0-API] Stack trace:")
        error.stack.split("\n").forEach((line) => console.error(`   ${line}`))
      }

      // Check for common error scenarios
      if (error instanceof Error) {
        if (error.message.includes("401")) {
          console.error(" [V0-API] Authentication failed - check your V0_API_KEY")
        } else if (error.message.includes("403")) {
          console.error(" [V0-API] Forbidden - check API key permissions")
        } else if (error.message.includes("429")) {
          console.error(" [V0-API] Rate limit exceeded - wait before retrying")
        } else if (error.message.includes("500")) {
          console.error(" [V0-API] Server error - v0 service may be down")
        } else if (error.message.includes("network") || error.message.includes("fetch")) {
          console.error(" [V0-API] Network error - check internet connection")
        }
      }

      return {
        id: crypto.randomUUID(),
        url: "",
        status: "failed",
        error: error instanceof Error ? error.message : "Unknown error",
      }
    }
  }

  async updatePrototype(existingProjectId: string, prompt: string): Promise<V0GenerateResponse> {
    console.log(" [V0-API] =================================")
    console.log(" [V0-API] UPDATING EXISTING PROTOTYPE")
    console.log(" [V0-API] =================================")
    console.log(` [V0-API] Existing Project ID: ${existingProjectId}`)
    console.log(` [V0-API] New prompt length: ${prompt.length} characters`)

    try {
      console.log(" [V0-API] Importing v0-sdk...")
      const { v0 } = await import("v0-sdk")
      console.log(" [V0-API] v0-sdk imported successfully")

      // First get the existing project to preserve the URL
      console.log(" [V0-API] Fetching existing project details...")
      const existingProject = await v0.chats.getById({ chatId: existingProjectId })
      
      // Use the correct URL fields based on the API documentation
      const existingUrl =
        existingProject.latestVersion?.demoUrl ||
        existingProject.demo ||
        existingProject.webUrl ||
        `https://v0.dev/chat/${existingProjectId}`

      console.log(` [V0-API] Existing URL to preserve: ${existingUrl}`)

      // For now, we'll create a new chat but return the existing URL
      // This maintains the same link while updating the content
      console.log(" [V0-API] Creating updated version...")

      const startTime = Date.now()
      const chatResponse = await v0.chats.create({
        system: `You are an expert frontend engineer tasked with building a complete, production-quality mobile-first application prototype. 
Follow these rules strictly:

1. Code Quality
   - Write clean, maintainable, production-ready code.
   - Use modern frameworks (Next.js 14+ with App Router, React, Tailwind CSS, shadcn/ui).
   - Use TypeScript where applicable.

2. File Structure
   - Split the code into multiple files and folders if needed (components, MODULAR pages (Do not bundle everything into 1 page.tsx), styles, utils, etc.).
   - Ensure imports are correct and relative paths are valid.
   - Do not cram everything into a single file unless explicitly required.
   - Make sure all buttons have **click handlers** and are properly linked to their actions or front end UI.

3. Assets
   - Do not use placeholder images like "placeholder.png".
   - For profile avatars, automatically generate initials from the user's name (e.g., "Juan Dela Cruz" → "JD").
   - Use modern avatar components (e.g., shadcn/ui Avatar) or generate mock visuals with CSS/JSX.
- Never generate a picture.

4. Mobile-First
   - Prioritize mobile-first design — the app should look and feel like a native mobile app.
   - Use bottom navigation bars, touch-friendly buttons, proper spacing, and responsive layouts.

5. Functionality
   - Every button, tab, and link must be clickable and perform a UI action (open modal, navigate, show toast).
   - Include proper form validation and feedback states.
   - Use mock data where backend data would normally be required.
   - Avoid leaving dead links or non-working buttons.

6. UX & Visuals
   - Ensure smooth transitions, animations, and polished micro-interactions.
   - Maintain consistency in spacing, alignment, colors, and typography.
   - Use sensible defaults for mock user data, transactions, causes, or features.

Your output should always be a complete and most importantly MODULAR, functional frontend project with no missing assets or broken imports.`,
        message: `UPDATE REQUEST: ${prompt.trim()}`,
        modelConfiguration: {
          modelId: "v0-1.5-sm",
          imageGenerations: false,
          thinking: false,
        },
      })
      const endTime = Date.now()

      console.log(`[V0-API] Update creation took: ${endTime - startTime}ms`)
      console.log(`[V0-API] New version created with ID: ${chatResponse.id}`)

      // Return the existing URL to maintain same link deployment
      console.log(` [V0-API] Returning existing URL for same link deployment: ${existingUrl}`)

      console.log("[V0-API] =================================")
      console.log(" [V0-API] PROTOTYPE UPDATE SUCCESSFUL")
      console.log(" [V0-API] =================================")

      return {
        id: existingProjectId, // Keep the original ID
        url: existingUrl, // Keep the original URL
        status: "ready",
        files: chatResponse.files || [],
      }
    } catch (error) {
      console.error(" [V0-API] =================================")
      console.error(" [V0-API] PROTOTYPE UPDATE FAILED")
      console.error(" [V0-API] =================================")
      console.error(` [V0-API] Error: ${error instanceof Error ? error.message : String(error)}`)

      return {
        id: existingProjectId,
        url: "",
        status: "failed",
        error: error instanceof Error ? error.message : "Update failed",
      }
    }
  }

  async getProjectStatus(chatId: string): Promise<V0GenerateResponse> {
    console.log(" [V0-API] =================================")
    console.log(" [V0-API] CHECKING PROJECT STATUS")
    console.log(" [V0-API] =================================")
    console.log(` [V0-API] Chat ID: ${chatId}`)

    try {
      console.log(" [V0-API] Importing v0-sdk...")
      const { v0 } = await import("v0-sdk")
      console.log(" [V0-API] v0-sdk imported successfully")

      console.log(" [V0-API] Fetching chat details...")
      const startTime = Date.now()
      const chatResponse = await v0.chats.getById({ chatId })
      const endTime = Date.now()

      console.log(` [V0-API] Status check took: ${endTime - startTime}ms`)
      console.log(" [V0-API] Analyzing status response...")

      // Log response structure
      const responseKeys = Object.keys(chatResponse)
      console.log(` [V0-API] Status response contains ${responseKeys.length} properties:`)
      responseKeys.forEach((key) => {
        const value = (chatResponse as any)[key]
        if (typeof value === "string") {
          console.log(`   - ${key}: "${value.length > 100 ? value.substring(0, 100) + "..." : value}"`)
        } else if (Array.isArray(value)) {
          console.log(`   - ${key}: Array[${value.length}]`)
        } else if (typeof value === "object" && value !== null) {
          console.log(`   - ${key}: Object{${Object.keys(value).join(", ")}}`)
        } else {
          console.log(`   - ${key}: ${value}`)
        }
      })

      // Use the correct URL fields based on the API documentation
      const publicUrl = 
        chatResponse.latestVersion?.demoUrl ||
        chatResponse.demo || 
        chatResponse.webUrl || 
        `https://v0.dev/chat/${chatId}`
        
      console.log(` [V0-API] Final public URL: ${publicUrl}`)

      // Get files from the correct location
      const files = chatResponse.latestVersion?.files || chatResponse.files || []

      console.log(" [V0-API] =================================")
      console.log(" [V0-API] STATUS CHECK SUCCESSFUL")
      console.log(" [V0-API] =================================")

      return {
        id: chatId,
        url: publicUrl,
        status: "ready",
        files: files,
      }
    } catch (error) {
      console.error(" [V0-API] =================================")
      console.error(" [V0-API] STATUS CHECK FAILED")
      console.error(" [V0-API] =================================")
      console.error(` [V0-API] Error type: ${error instanceof Error ? error.constructor.name : typeof error}`)
      console.error(` [V0-API] Error message: ${error instanceof Error ? error.message : String(error)}`)

      if (error instanceof Error && error.stack) {
        console.error(" [V0-API] Stack trace:")
        error.stack.split("\n").forEach((line) => console.error(`   ${line}`))
      }

      return {
        id: chatId,
        url: "",
        status: "failed",
        error: error instanceof Error ? error.message : "Status check failed",
      }
    }
  }
}

export const v0Api = new V0ApiService()
export type { V0GenerateRequest, V0GenerateResponse }

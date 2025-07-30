import { type NextRequest, NextResponse } from "next/server"
import { Sandbox } from "@e2b/code-interpreter"
import ModelClient, { isUnexpected } from "@azure-rest/ai-inference"
import { AzureKeyCredential } from "@azure/core-auth"
import { createClient } from "@supabase/supabase-js"

export const maxDuration = 60

export async function POST(request: NextRequest) {
  console.log("POST request received")

  try {
    const body = await request.json()
    const { utilityId, fileName, generatedCode } = body

    console.log("Parameters extracted:")
    console.log("- utilityId:", utilityId)
    console.log("- fileName:", fileName)
    console.log("- generatedCode provided:", !!generatedCode)

    if (!utilityId || !fileName) {
      console.error("Missing required parameters")
      return NextResponse.json({ error: "Missing utilityId or fileName" }, { status: 400 })
    }

    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEYSUPABASE_SERVICE_ROLE_KEY!,
    )

    console.log("Fetching utility record from database...")
    const { data: utilityRecord, error: dbError } = await supabase
      .from("utilities")
      .select("file_link, file_name")
      .eq("id", utilityId)
      .single()

    if (dbError || !utilityRecord) {
      console.error("Error fetching utility record:", dbError)
      return NextResponse.json({ error: "Utility record not found" }, { status: 404 })
    }

    const filePath = utilityRecord.file_link
    console.log("Reading CSV file from Supabase storage...")
    console.log("Bucket: utilities-files")
    console.log("File path:", filePath)

    const { data: fileData, error: fileError } = await supabase.storage.from("utilities-files").download(filePath)

    if (fileError) {
      console.error("Error reading file from storage:", {
        message: fileError.message,
        statusCode: fileError.statusCode,
        error: fileError,
      })
      return NextResponse.json(
        {
          error: `Failed to read file from storage: ${fileError.message}`,
          details: fileError,
        },
        { status: 400 },
      )
    }

    if (!fileData) {
      console.error("No file data returned from storage")
      return NextResponse.json({ error: "No file data returned from storage" }, { status: 400 })
    }

    const csvData = await fileData.text()
    console.log("CSV data loaded from storage, length:", csvData.length)

    console.log("Starting dashboard generation for:", fileName)

    const githubApiKey = process.env.GITHUB_MODELS_API_KEY
    const e2bApiKey = process.env.E2B_API_KEY
    const templateId = process.env.E2B_TEMPLATE_ID

    process.env.E2B_API_KEY = e2bApiKey

    let streamlitCode = generatedCode

    if (!streamlitCode) {
      console.log("Generating Streamlit dashboard")

      const lines = csvData.split("\n").slice(0, 51)
      const csvSample = lines.join("\n")

      console.log("CSV Structure:")
      console.log("Headers:", lines[0])
      console.log("Sample rows:", lines.length - 1)

      // PII REDACTION: Redact sensitive data before sending to AI
      console.log("Applying PII redaction before sending to AI...")
      const { defaultPiiRedactor } = await import("@/lib/pii-redactor")
      const redactedCsvSample = defaultPiiRedactor.redactCsvData(csvSample, {
        preserveHeaders: true,
        maxRows: 50
      })
      
      // Log redaction statistics for monitoring
      const stats = defaultPiiRedactor.getRedactionStats(csvSample, redactedCsvSample)
      console.log("PII Redaction Stats:", {
        originalLength: stats.originalLength,
        redactedLength: stats.redactedLength,
        itemsRedacted: stats.redactionCount,
        typesFound: stats.redactionTypes
      })

      // VERBOSE LOGGING: Show exactly what data is being sent to GPT-4.1
      console.log("\n" + "=".repeat(80))
      console.log("ORIGINAL CSV DATA (BEFORE REDACTION):")
      console.log("=".repeat(80))
      const originalLines = csvSample.split('\n')
      originalLines.forEach((line, index) => {
        if (line.trim()) {
          console.log(`Row ${index}: ${line}`)
        }
      })
      
      console.log("\n" + "=".repeat(80))
      console.log("REDACTED CSV DATA (SENT TO GPT-4.1):")
      console.log("=".repeat(80))
      const redactedLines = redactedCsvSample.split('\n')
      redactedLines.forEach((line, index) => {
        if (line.trim()) {
          console.log(`Row ${index}: ${line}`)
        }
      })
      console.log("=".repeat(80) + "\n")

      // Use redacted data for AI prompt
      const csvDataForAI = redactedCsvSample

      const client = ModelClient("https://models.github.ai/inference", new AzureKeyCredential(githubApiKey))

      const prompt = `
You are an expert Python developer specializing in Streamlit dashboards. Analyze the following CSV data and create a comprehensive, professional dashboard tailored to the data's domain and content:

IMPORTANT: This CSV data has been processed for privacy protection. Some values may show as [REDACTED], [NAME], [EMAIL], [PHONE], etc. 
- Treat redacted fields as example data types and create appropriate sample visualizations
- Use the structure and non-sensitive data to understand the dataset
- Generate realistic sample data for visualization when needed

CSV STRUCTURE:
${csvDataForAI}

REQUIREMENTS:
Make sure to add a short key insight per graph, this should serve as the title/heading, while the actual title of the graph will be a subheading.

1. First, intelligently analyze the CSV data to understand:
   - The domain/industry (business, healthcare, education, sports, finance, etc.)
   - Key columns and their data types
   - Relationships between different variables
   - Time-based columns (if any)
   - Categorical vs numerical data

2. Create a modern, attractive Streamlit dashboard with multiple pages/tabs using st.tabs() or st.sidebar navigation. 
3. Use st.columns() for professional layout within each tab/page
4. MANDATORY: Organize content into separate tabs - do not put everything on a single page. Create at least 3-4 tabs for better user experience and content organization
5. Make sure the entire content (including the tabs) fits the user's visible screen.

5. Generate relevant analysis sections based on the data content. Adapt these examples to your specific data:
   - Executive Summary/Overview (Key metrics, totals, counts, etc.) - Always include actionable insights, recommendations, and explanations of what the data means
   - Temporal Analysis (if date/time columns exist) - trends, patterns over time
   - Categorical Analysis - breakdowns by categories, top performers, distributions  
   - Numerical Analysis - statistics, correlations, outliers
   - Comparative Analysis - comparisons between different segments/groups
   - Interactive Visualizations with relevant filters based on the data

5. Choose appropriate visualization libraries (all pre-installed):
   - plotly.express for interactive charts (preferred for most visualizations)
   - plotly.express for statistical plots when needed

6. Include relevant features based on your data analysis:
   - Smart filtering options (date ranges, category filters, numerical sliders, etc.)
   - Multi-select filters for categorical data
   - Metric cards with st.metric() for key performance indicators
   - Data tables with st.dataframe() showing filtered/processed data
   - Download buttons for filtered data
   - Search functionality if applicable

7. Make it responsive and professional with advanced styling:
   - MANDATORY: Set dark mode as default using st.set_page_config(page_title="...", layout="wide", initial_sidebar_state="expanded", menu_items=None) and custom CSS
   - Make sure the entire content (including the tabs) fits the user's visible screen.
   - Implement comprehensive dark theme with custom CSS using st.mark adown with unsafe_allow_html=True
   - Use high-contrast colors that work in both dark and light modes for tabs and UI elements
   - Tab styling: Use colors like #FF6B35, #2E86AB, #A23B72, #F18F01, #C73E1D that are visible in both themes
   - Background: Dark theme (#0E1117 or similar dark backgrounds)
   - Text: High contrast text colors (#FAFAFA for primary text, #CCCCCC for secondary)
   - Cards/containers: Dark containers with subtle borders (#262730 backgrounds, #404040 borders)
   - Charts: Configure plotly charts with dark themes using template="plotly_dark"
   - Ensure all metric cards, dataframes, and interactive elements are styled for dark mode
   - Add subtle animations and hover effects where appropriate
   - Use consistent spacing and typography throughout
   - Clear section headers and descriptions with proper contrast
   - Loading indicators where appropriate with dark-compatible colors
   - Helpful tooltips and explanations with proper visibility

8. Executive Summary/Overview requirements (always include this section):
   - Provide actionable insights and recommendations based on the data analysis
   - Explain what the key metrics mean in the context of the data domain
   - Include written analysis of trends, patterns, and significant findings
   - Add strategic recommendations or observations relevant to the data type
   - Highlight any alerts, anomalies, or important observations from the data
   - Use domain-appropriate language and terminology

9. The CSV file will be available as '${fileName}' in the same directory

IMPORTANT TECHNICAL REQUIREMENTS: 
- Write ONLY the complete Python/Streamlit code
- No explanations or markdown, just pure Python code
- Make sure all imports are at the top (include: streamlit, pandas, numpy, plotly.express, datetime, base64, io)
- Handle data types properly (convert date columns to datetime with pd.to_datetime, numeric columns to appropriate types)
- When filtering by dates, convert st.date_input() results to datetime using pd.to_datetime()
- Include comprehensive error handling for file loading and data processing
- Make the dashboard interactive and insightful for the specific data domain
- Use pd.to_datetime() for any date comparisons to avoid dtype errors
- Import base64 and io modules if creating download functionality
- CRITICAL: When using groupby().sum(), always specify numeric columns only to avoid datetime aggregation errors. Use .agg() with specific column mappings or select numeric columns before summing. Example: df.groupby('category')[['amount', 'quantity']].sum() instead of df.groupby('category').sum()
- For time series analysis, use .agg() with dictionary mapping: df.groupby('date').agg({'amount': 'sum', 'quantity': 'sum'}) instead of .sum() on all columns
- NEVER use st.cache (deprecated) - use st.cache_data for data caching and st.cache_resource for resource caching instead
- Add defensive programming for division operations: always check for zero denominators before division (e.g., if denominator != 0: result = numerator / denominator else: result = 0)
- Use try-except blocks around mathematical operations that might cause division by zero or other calculation errors
- Handle empty datasets gracefully with appropriate error messages
- Ensure all column references are valid and handle missing columns appropriately

Important reminders about common errors Streamlit dashboards might encounter:
- KeyError: [column_name] not in index (usually means the column name is misspelled or missing in the CSV)
- IndexError: list index out of range (often from trying to access a row/column that doesn't exist)
- ValueError: could not convert string to float (data type mismatch)
- TypeError: 'NoneType' object is not subscriptable (missing data or failed operation)
- AttributeError: 'DataFrame' object has no attribute [attribute] (wrong pandas method or typo)
- UnicodeDecodeError: 'utf-8' codec can't decode byte (CSV encoding issue)
- AssertionError: (failed assertion in code)
- st.error(...) and st.warning(...) can be used to show user-friendly error messages in the dashboard


CREATIVE FREEDOM:
- You have full freedom to create the most useful and insightful dashboard for this specific dataset
- Generate visualizations that make sense for the data type and domain
- Create meaningful derived metrics and calculated fields where appropriate
- Use your expertise to highlight the most important aspects of the data
- Adapt the dashboard structure, sections, and analysis to best serve the data's purpose

Generate the complete Streamlit application code:
`
      console.log("\n" + "-".repeat(40))
      console.log("PROMPT BEING SENT TO GPT-4.1:")
      console.log("-".repeat(40))
      console.log("Prompt length:", prompt.length, "characters")
      console.log("CSV data portion (first 500 chars):")
      console.log(csvDataForAI.substring(0, 500) + "...")
      console.log("-".repeat(40) + "\n")

      const response = await client.path("/chat/completions").post({
        body: {
          messages: [
            { role: "system", content: "You are an expert Python developer specializing in Streamlit dashboards." },
            { role: "user", content: prompt },
          ],
          temperature: 0.7,
          top_p: 1,
          model: "openai/gpt-4.1-mini",
        },
      })

      if (isUnexpected(response)) {
        console.error("GitHub Models API error:", response.body)
        return NextResponse.json(
          {
            success: false,
            error: `GitHub Models API error: ${JSON.stringify(response.body)}`,
          },
          { status: 500 },
        )
      }

      console.log("Full GitHub Models response received")
      console.log("Response type:", typeof response.body)
      console.log("Response keys:", Object.keys(response.body || {}))
      
      // Handle potential string response that needs parsing
      let responseBody = response.body
      if (typeof response.body === 'string') {
        try {
          responseBody = JSON.parse(response.body)
          console.log("Parsed string response successfully")
        } catch (e) {
          console.error("Failed to parse response string:", e)
          return NextResponse.json({ success: false, error: "Failed to parse API response" }, { status: 500 })
        }
      }

      console.log("🔍 Response body structure:")
      console.log("- Has choices:", !!responseBody.choices)
      console.log("- Choices length:", responseBody.choices?.length)
      if (responseBody.choices && responseBody.choices.length > 0) {
        console.log("- First choice has message:", !!responseBody.choices[0].message)
        console.log("- First choice has content:", !!responseBody.choices[0].message?.content)
        console.log("- Content preview:", responseBody.choices[0].message?.content?.substring(0, 100) + "...")
      }

      if (!responseBody.choices || responseBody.choices.length === 0) {
        console.error("GitHub Models API returned no choices:", responseBody)
        return NextResponse.json(
          {
            success: false,
            error: "GitHub Models API returned no response choices",
          },
          { status: 500 },
        )
      }

      if (!responseBody.choices[0].message || !responseBody.choices[0].message.content) {
        console.error("GitHub Models API returned empty message content:", responseBody.choices[0])
        return NextResponse.json(
          {
            success: false,
            error: "GitHub Models API returned empty message content",
          },
          { status: 500 },
        )
      }

      streamlitCode = responseBody.choices[0].message.content

      if (!streamlitCode) {
        return NextResponse.json(
          {
            success: false,
            error: "No code generated from GitHub Models API",
          },
          { status: 500 },
        )
      }

      streamlitCode = streamlitCode
        .replace(/```python\n?/g, "")
        .replace(/```\n?/g, "")
        .trim()

      console.log("Dashboard code generated!")
      console.log("Code length:", streamlitCode.length, "characters")
      console.log("Generated code preview:")
      console.log(streamlitCode.substring(0, 200) + "...")

      if (!streamlitCode.includes("import streamlit")) {
        console.error("Code validation failed - missing streamlit import")
        return NextResponse.json(
          {
            success: false,
            error: "Generated code is missing streamlit import - code may be malformed",
          },
          { status: 500 },
        )
      }

      console.log("Code validation passed")

      // Saving generated code to database immediately after generation
      console.log("Saving generated code to database...")
      const { error: updateError } = await supabase
        .from("utilities")
        .update({
          generated_code: streamlitCode,
          status: "generating-dashboard", // Use valid status from schema
        })
        .eq("id", utilityId)

      if (updateError) {
        console.error("Error saving generated code:", updateError)
        return NextResponse.json(
          {
            success: false,
            error: "Failed to save generated code to database",
            generatedCode: streamlitCode, // Return code even if DB save fails
          },
          { status: 500 },
        )
      }

      console.log("Generated code saved to database")
    } else {
      console.log("Using cached Streamlit code")
    }

    await supabase.from("utilities").update({ status: "deploying" }).eq("id", utilityId)

    console.log("Creating sandbox from Streamlit template...")

    try {
      const sandbox = await Sandbox.create(templateId, { 
        timeoutMs: 60 * 60 * 1000 // 1 hour timeout
      })

      console.log("Uploading CSV data...")
      await sandbox.files.write(fileName, csvData)

      console.log("Uploading generated dashboard...")
      await sandbox.files.write("app.py", streamlitCode)

      console.log("Testing Python code for runtime errors...")
      const pythonTest = await sandbox.commands.run("python -c \"import ast; ast.parse(open('app.py').read())\"")
      if (pythonTest.exitCode !== 0) {
        console.error("Python syntax error in generated code:", pythonTest.stderr)
        return NextResponse.json(
          {
            success: false,
            error: "Generated Python code has syntax errors",
          },
          { status: 500 },
        )
      }

      console.log("Testing imports...")
      const importTest = await sandbox.commands.run(
        "python -c \"import streamlit, pandas, plotly.express, matplotlib.pyplot, seaborn, datetime, base64, io; print('All imports successful')\"",
      )
      console.log("Import test result:", importTest.stdout.trim())

      console.log("Starting Streamlit dashboard...")

      const startupScript = `#!/bin/bash
echo "Starting Streamlit with monitoring..."
while true; do
    echo "$(date): Starting Streamlit..."
    streamlit run app.py --server.port=8501 --server.address=0.0.0.0 --server.headless=true --server.enableCORS=false --server.enableXsrfProtection=false
    echo "$(date): Streamlit exited with code $?, restarting in 5 seconds..."
    sleep 5
done
`

      await sandbox.files.write("start_streamlit.sh", startupScript)
      await sandbox.commands.run("chmod +x start_streamlit.sh")

      console.log("Running Streamlit with monitoring...")
      await sandbox.commands.run("./start_streamlit.sh", { background: true })

      console.log("Waiting for dashboard to initialize...")
      await new Promise((resolve) => setTimeout(resolve, 10000))

      for (let i = 0; i < 3; i++) {
        console.log(`Health check attempt ${i + 1}/3...`)

        const healthCheck = await sandbox.commands.run('curl -f http://localhost:8501/_stcore/health || echo "FAILED"')
        console.log(`Health check ${i + 1}:`, healthCheck.stdout.trim())

        if (healthCheck.stdout.includes("ok")) {
          console.log("Streamlit is running successfully!")
          break
        }

        if (i < 2) {
          console.log("Waiting before next health check...")
          await new Promise((resolve) => setTimeout(resolve, 5000))
        }
      }

      const finalProcessCheck = await sandbox.commands.run('ps aux | grep -E "(streamlit|python)" | grep -v grep')
      console.log("Final process check:", finalProcessCheck.stdout)

      const dashboardUrl = sandbox.getHost(8501)

      console.log("")
      console.log("SUCCESS! Your AI-Generated Business Dashboard is ready!")
      console.log("Dashboard URL:", dashboardUrl)

      const expiresAt = new Date(Date.now() + 60 * 60 * 1000) // 1 hour
      await supabase
        .from("utilities")
        .update({
          dashboard_url: dashboardUrl,
          sandbox_id: (sandbox as any).id || "unknown",
          status: "ready",
          dashboard_expires_at: expiresAt.toISOString(),
        })
        .eq("id", utilityId)

      return NextResponse.json({
        success: true,
        dashboardUrl: dashboardUrl,
        sandboxId: (sandbox as any).id || "unknown",
        generatedCode: generatedCode ? undefined : streamlitCode,
      })
    } catch (sandboxError) {
      console.error("Error creating sandbox:", sandboxError)

      await supabase
        .from("utilities")
        .update({
          status: "error",
          error_message: sandboxError instanceof Error ? sandboxError.message : "Sandbox creation failed",
        })
        .eq("id", utilityId)

      return NextResponse.json(
        {
          success: false,
          error: "Sandbox deployment failed, but code was saved. You can retry deployment.",
          canRetry: true,
          generatedCode: streamlitCode,
        },
        { status: 500 },
      )
    }
  } catch (error) {
    console.error("Error generating dashboard:", error)
    return NextResponse.json(
      {
        success: false,
        error: error instanceof Error ? error.message : "Unknown error occurred",
      },
      { status: 500 },
    )
  }
}

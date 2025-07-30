"use client"

import { useEffect, useState, useCallback, useRef } from "react"
import useEmblaCarousel from "embla-carousel-react"
import { ChevronLeft, ChevronRight } from "lucide-react"
import { NewsModal } from "./news-modal"
import { supabase } from "@/lib/supabase"

type NewsItem = {
  id?: string // Added id field for Supabase
  title: string
  summary: string
  source: string
  url: string
  imageUrl?: string
  publishedAt?: string
  createdAt?: number // Added createdAt for consistency
}

const NEWS_STORAGE_KEY = "bpi.news.v1"
const NEWS_REFRESH_INTERVAL_DAYS = 1 // Refresh news daily

async function loadNewsFromSupabase(): Promise<NewsItem[]> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return []

    const { data, error } = await supabase
      .from("news_events")
      .select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (error) throw error

    console.log("[NewsSection] Loaded from Supabase:", data?.length || 0, "items")

    return (data || []).map((item) => {
      const newsItem = {
        id: item.id,
        title: item.title,
        summary: item.summary,
        source: item.source,
        url: item.url,
        imageUrl: item.image_url || "", // Ensure we always have a string
        createdAt: new Date(item.created_at).getTime(),
      }

      // Debug log for image URLs
      if (item.image_url) {
        console.log("[NewsSection] Item has image_url:", item.title, "->", item.image_url)
      } else {
        console.log("[NewsSection] Item missing image_url:", item.title)
      }

      return newsItem
    })
  } catch (error) {
    console.error("[NewsSection] Failed to load from Supabase:", error)
    return []
  }
}

async function saveNewsToSupabase(newsItems: NewsItem[]): Promise<void> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return

    const limitedItems = newsItems.slice(0, 10)

    // Delete old news items to maintain limit
    const { data: existingNews } = await supabase
      .from("news_events")
      .select("id")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })

    if (existingNews && existingNews.length > 0) {
      await supabase.from("news_events").delete().eq("user_id", user.id)
    }

    const newsData = limitedItems.map((item) => {
      const imageUrl = item.imageUrl && item.imageUrl.startsWith("http") ? item.imageUrl : null

      console.log("[NewsSection] Saving item:", item.title, "with image_url:", imageUrl)

      return {
        id: item.id || crypto.randomUUID(),
        title: item.title,
        summary: item.summary,
        source: item.source,
        url: item.url,
        image_url: imageUrl, // Only save valid HTTP URLs
        user_id: user.id,
      }
    })

    const { error } = await supabase.from("news_events").insert(newsData)

    if (error) throw error
    console.log("[NewsSection] Saved", limitedItems.length, "news items to Supabase with images")
  } catch (error) {
    console.error("[NewsSection] Failed to save to Supabase:", error)
  }
}

async function checkLatestNewsDate(): Promise<Date | null> {
  try {
    const {
      data: { user },
    } = await supabase.auth.getUser()
    if (!user) return null

    const { data, error } = await supabase
      .from("news_events")
      .select("created_at")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(1)

    if (error) throw error
    return data?.[0]?.created_at ? new Date(data[0].created_at) : null
  } catch (error) {
    console.error("[NewsSection] Failed to check latest news date:", error)
    return null
  }
}

function shouldRefreshNews(latestDate: Date | null): boolean {
  if (!latestDate) return true

  const daysDiff = Math.floor((Date.now() - latestDate.getTime()) / (1000 * 60 * 60 * 24))
  return daysDiff >= NEWS_REFRESH_INTERVAL_DAYS
}

// Helper function to format date as "Dec. 06, 2025"
function formatNewsDate(dateString: string): string {
  if (!dateString) return ""

  try {
    // Handle various date formats
    let date: Date

    // If it's already a formatted string like "Today", "Yesterday", etc.
    if (
      dateString.toLowerCase().includes("today") ||
      dateString.toLowerCase().includes("yesterday") ||
      dateString.toLowerCase().includes("ago")
    ) {
      return dateString
    }

    // Try to parse as ISO string or other formats
    date = new Date(dateString)

    // Check if date is valid
    if (isNaN(date.getTime())) {
      return dateString // Return original if can't parse
    }

    // Format as "Dec. 06, 2025"
    const months = ["Jan.", "Feb.", "Mar.", "Apr.", "May", "Jun.", "Jul.", "Aug.", "Sep.", "Oct.", "Nov.", "Dec."]

    const month = months[date.getMonth()]
    const day = date.getDate().toString().padStart(2, "0")
    const year = date.getFullYear()

    return `${month} ${day}, ${year}`
  } catch (error) {
    return dateString // Return original if any error
  }
}

export function NewsSection() {
  const [items, setItems] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [modalOpen, setModalOpen] = useState(false)
  const itemsRef = useRef<NewsItem[]>([])

  const [emblaRef, emblaApi] = useEmblaCarousel({
    loop: false,
    dragFree: false,
    align: "start",
    slidesToScroll: 1,
  })

  useEffect(() => {
    let mounted = true

    const initializeNews = async () => {
      try {
        // First, try to load from Supabase
        const supabaseNews = await loadNewsFromSupabase()
    if (supabaseNews.length > 0) {
          if (mounted) {
      const initial = supabaseNews.slice(0, 6)
      setItems(initial) // Limit to 6 articles
      itemsRef.current = initial
            setLoading(false)
          }

          // Check if we need to refresh based on latest date
          const latestDate = await checkLatestNewsDate()
          if (!shouldRefreshNews(latestDate)) {
            return // Don't call API if content is fresh
          }
        }
      } catch (error) {
        console.error("[NewsSection] Error loading news:", error)
      }

      // Check if we should refresh news
      const latestDate = await checkLatestNewsDate()
      if (!shouldRefreshNews(latestDate)) {
        if (mounted) setLoading(false)
        return // Don't call API if content is fresh
      }

      // Fetch from API if no cached data or refresh needed
      try {
        console.log("[NewsSection] Calling /api/news")
        const res = await fetch("/api/news")
        console.log("[NewsSection] API response:", {
          ok: res.ok,
          status: res.status,
          statusText: res.statusText,
          contentType: res.headers.get("content-type"),
        })

        const ct = res.headers.get("content-type") || ""
  const data = ct.includes("application/json") ? await res.json() : { items: [] }

        console.log("[NewsSection] Parsed data:", {
          hasData: !!data,
          hasItems: !!data.items,
          itemsType: typeof data.items,
          itemsIsArray: Array.isArray(data.items),
          itemsLength: data.items?.length || 0,
          dataStructure: JSON.stringify(data, null, 2).substring(0, 300) + "...",
        })

        if (!res.ok && !data.items) {
          throw new Error(`HTTP ${res.status}`)
        }
        if (mounted) {
          const hadExisting = itemsRef.current.length > 0

            // If API returned an explicit error (e.g., missing keys) and NO new items, keep existing items.
          if (data.error && (!data.items || data.items.length === 0)) {
            if (!hadExisting) setError(data.error)
            return
          }
          const newsItems = (data.items || []) as NewsItem[]
          console.log("[NewsSection] Processing news items:", {
            newsItemsCount: newsItems.length,
            newsItemsType: typeof newsItems,
            isArray: Array.isArray(newsItems),
          })

          const limitedItems = newsItems.slice(0, 10).map((item) => ({
            ...item,
            id: item.id || crypto.randomUUID(),
            createdAt: Date.now(),
          }))

          console.log("[NewsSection] Setting items:", {
            limitedItemsCount: limitedItems.length,
          })

          if (limitedItems.length > 0) {
            const nextItems = limitedItems.slice(0, 6)
            setItems(nextItems)
            itemsRef.current = nextItems
            if (error) setError(null) // clear previous error when we now have items
          }

          await saveNewsToSupabase(limitedItems)
        }
      } catch (e: any) {
  console.error("[NewsSection] fetch error", e)
  if (mounted && itemsRef.current.length === 0) setError(e?.message || "Unexpected error")
      } finally {
        if (mounted) setLoading(false)
      }
    }

    initializeNews()

    return () => {
      mounted = false
    }
  }, [])

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi])
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi])

  return (
    <section className="space-y-3 mb-8">
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold">News & Events</h2>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setModalOpen(true)}
            className="text-sm sm:text-base text-gray-700 hover:text-gray-900 underline-offset-2 hover:underline"
            aria-label="View all news"
          >
            View all
          </button>

          {/* Arrows visible on sm+ screens; mobile users primarily swipe */}
          <div className="hidden sm:flex items-center gap-1">
            <button
              aria-label="Previous news"
              onClick={scrollPrev}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              aria-label="Next news"
              onClick={scrollNext}
              className="p-2 rounded-lg border border-gray-200 hover:bg-gray-50"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Swipe hint for mobile */}
      <p className="text-xs text-gray-500 sm:hidden">Swipe to explore news</p>

      {/* Embla viewport */}
      <div className="relative">
        <div className="overflow-hidden" ref={emblaRef}>
          <div className="flex gap-3">
            {loading &&
              Array.from({ length: 6 }).map((_, i) => (
                <div
                  key={i}
                  className="min-w-[78%] sm:min-w-[60%] md:min-w-[50%] lg:min-w-[40%] xl:min-w-[32%] bg-white rounded-2xl border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="h-48 bg-gray-200 animate-pulse rounded-t-2xl" />
                  <div className="p-4 space-y-3">
                    <div className="h-4 w-28 bg-gray-200 rounded animate-pulse" />
                    <div className="h-5 w-4/5 bg-gray-200 rounded animate-pulse" />
                    <div className="h-4 w-full bg-gray-200 rounded animate-pulse" />
                  </div>
                </div>
              ))}

            {!loading &&
              !error &&
              items.map((n, i) => (
                <a
                  key={n.id || i}
                  href={n.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-w-[78%] sm:min-w-[60%] md:min-w-[50%] lg:min-w-[40%] xl:min-w-[32%] bg-white rounded-2xl border border-gray-200 hover:shadow-md transition-shadow"
                >
                  <div className="aspect-[16/9] overflow-hidden rounded-t-2xl">
                    <img
                      src={
                        n.imageUrl && n.imageUrl.startsWith("http")
                          ? n.imageUrl
                          : "/placeholder.svg?height=160&width=280&query=philippine%20banking%20news"
                      }
                      alt={n.title}
                      className="h-full w-full object-cover"
                      onError={(e) => {
                        console.log("[NewsSection] Image failed to load:", n.imageUrl)
                        e.currentTarget.src = "/philippine-banking-news.png"
                      }}
                    />
                  </div>
                  <div className="p-4">
                    <div className="flex items-center justify-between">
                      <p className="text-xs text-gray-500">{n.source}</p>
                      {n.publishedAt && (
                        <p className="text-[11px] text-gray-400 ml-2 truncate max-w-[40%]">
                          {formatNewsDate(n.publishedAt)}
                        </p>
                      )}
                    </div>
                    <p className="font-semibold text-gray-900 mt-2 line-clamp-2 text-sm sm:text-base">{n.title}</p>
                    <p className="text-sm text-gray-700 mt-2 line-clamp-4">{n.summary}</p>
                  </div>
                </a>
              ))}

            {!loading && error && <div className="min-w-full text-sm text-red-600 py-8">{error}</div>}
          </div>
        </div>
        {/* Mobile arrows overlay (previously hidden) */}
        <div className="sm:hidden pointer-events-none select-none">
          <button
            aria-label="Previous news"
            onClick={scrollPrev}
            className="pointer-events-auto absolute left-1 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 shadow border border-gray-200 active:scale-95"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            aria-label="Next news"
            onClick={scrollNext}
            className="pointer-events-auto absolute right-1 top-1/2 -translate-y-1/2 p-2 rounded-full bg-white/90 shadow border border-gray-200 active:scale-95"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
          <div className="pointer-events-none absolute inset-y-0 left-0 w-6 bg-gradient-to-r from-white to-transparent rounded-l-2xl" />
          <div className="pointer-events-none absolute inset-y-0 right-0 w-6 bg-gradient-to-l from-white to-transparent rounded-r-2xl" />
        </div>
      </div>
      <NewsModal open={modalOpen} onOpenChange={setModalOpen} items={items} />
    </section>
  )
}

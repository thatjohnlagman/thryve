"use client"

import { useState, useMemo } from "react"
import {
  Eye,
  Search,
  ArrowUpDown,
  FileText,
  TrendingUp,
  Bookmark,
  Share2,
  ChevronLeft,
  ChevronRight,
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Input } from "@/components/ui/input"
import { WebBrowserModal } from "@/components/web-browser-modal"

interface Prototype {
  id: string
  title: string
  issue: string
  reason: string
  category: string
  priority: "High" | "Medium" | "Low"
  generatedAt: string
  url: string
  tags: string[]
  status: string
  description: string
}

interface PrototypeViewAllProps {
  prototypes: Prototype[]
  onBack: () => void
}

const PROTOTYPES_PER_PAGE = 3

export function PrototypeViewAll({ prototypes, onBack }: PrototypeViewAllProps) {
  const [webBrowserUrl, setWebBrowserUrl] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState("")
  const [currentPage, setCurrentPage] = useState(1)

  const { paginatedPrototypes, totalPages } = useMemo(() => {
    let filtered = [...prototypes]

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase()
      filtered = filtered.filter(
        (prototype) =>
          prototype.title.toLowerCase().includes(query) ||
          prototype.category.toLowerCase().includes(query) ||
          prototype.description.toLowerCase().includes(query),
      )
    }

    const totalPages = Math.ceil(filtered.length / PROTOTYPES_PER_PAGE)
    const startIndex = (currentPage - 1) * PROTOTYPES_PER_PAGE
    const endIndex = startIndex + PROTOTYPES_PER_PAGE
    const paginatedPrototypes = filtered.slice(startIndex, endIndex)

    return {
      allFilteredPrototypes: filtered,
      paginatedPrototypes,
      totalPages,
    }
  }, [prototypes, searchQuery, currentPage])

  const getPriorityColor = (priority: string) => {
    switch (priority) {
      case "High":
        return "text-red-600 border-red-200 bg-red-50"
      case "Medium":
        return "text-yellow-600 border-yellow-200 bg-yellow-50"
      case "Low":
        return "text-green-600 border-green-200 bg-green-50"
      default:
        return "text-gray-600 border-gray-200 bg-gray-50"
    }
  }

  return (
    <div className="min-h-screen bg-white">
      <div className="px-2 py-5 bg-white">
        <div className="h-16 flex items-center mb-4 relative">
          <Button variant="ghost" size="icon" onClick={onBack} className="text-gray-600 absolute left-0">
            <ChevronLeft className="w-6 h-6" />
          </Button>
          <div className="flex-1 flex justify-center">
            <img
              src="https://uxhbywzqivssrjfanjjp.supabase.co/storage/v1/object/public/thryve/thryve_nav_logo.svg"
              alt="thryve"
              className="h-12"
            />
          </div>
        </div>
      </div>

      <div className="px-4 pb-20">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold text-gray-900">All Prototypes</h1>
          <Button variant="ghost" size="sm" className="text-gray-600">
            <ArrowUpDown className="w-4 h-4" />
          </Button>
        </div>

        <div className="relative mb-6">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
          <Input
            placeholder="Search for prototypes"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10 py-3 rounded-full border-gray-200 bg-gray-50"
          />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {paginatedPrototypes.map((prototype) => (
            <Card key={prototype.id} className="shadow-sm hover:shadow-md transition-shadow duration-200 flex flex-col">
              <CardHeader className="pb-3">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <CardTitle className="text-lg font-semibold text-gray-900 mb-2">{prototype.title}</CardTitle>
                    <div className="flex items-center gap-2 mb-2">
                      <Badge variant="outline" className={getPriorityColor(prototype.priority)}>
                        {prototype.priority}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {prototype.category}
                      </Badge>
                    </div>
                  </div>
                  <span className="text-xs text-gray-500 max-w-20 truncate flex-shrink-0">{prototype.generatedAt}</span>
                </div>
              </CardHeader>

              <CardContent className="pt-0 flex flex-col flex-1">
                <div className="flex-1 space-y-3">
                  <div className="mb-4 border border-gray-200 rounded-lg overflow-hidden relative">
                    {prototype.status === "Ready" && prototype.url && prototype.url !== "#" ? (
                      <div className="aspect-video relative">
                        <iframe
                          src={prototype.url}
                          className="w-full h-full border-0"
                          title="Prototype Preview"
                          sandbox="allow-scripts allow-same-origin"
                        />
                        <div className="absolute inset-0 flex items-center justify-center">
                          <Button
                            size="icon"
                            onClick={() => setWebBrowserUrl(prototype.url)}
                            className="w-12 h-12 bg-black/70 hover:bg-black/80 text-white rounded-full"
                          >
                            <Eye className="w-5 h-5" />
                          </Button>
                        </div>
                      </div>
                    ) : (
                      <div className="aspect-video relative bg-gradient-to-br from-blue-900 to-blue-600 flex items-center justify-center text-white">
                        <div className="text-center p-4">
                          <h3 className="text-xl font-bold mb-2">{prototype.title.split(" & ")[0]}</h3>
                          {prototype.title.split(" & ")[1] && (
                            <h3 className="text-xl font-bold mb-2">{prototype.title.split(" & ")[1]}</h3>
                          )}
                          <p className="text-sm opacity-90">
                            {prototype.status === "Generating"
                              ? "Prototype generating..."
                              : prototype.status === "Failed"
                                ? "Generation failed"
                                : "Preview not available"}
                          </p>
                        </div>
                        {prototype.status === "Ready" && prototype.url && prototype.url !== "#" && (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <Button
                              size="icon"
                              onClick={() => setWebBrowserUrl(prototype.url)}
                              className="w-12 h-12 bg-black/70 hover:bg-black/80 text-white rounded-full"
                            >
                              <Eye className="w-5 h-5" />
                            </Button>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-2">
                    <FileText className="w-4 h-4 text-[#7A1216] mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-700">{prototype.issue}</p>
                  </div>

                  <div className="flex items-start gap-2">
                    <TrendingUp className="w-4 h-4 text-amber-600 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-gray-600">{prototype.reason}</p>
                  </div>
                </div>

                <div className="flex items-center gap-2 pt-2 mt-auto">
                  <Button
                    onClick={() => (prototype.url && prototype.url !== "#" ? setWebBrowserUrl(prototype.url) : null)}
                    disabled={!prototype.url || prototype.url === "#" || prototype.status !== "Ready"}
                    className="flex-1 bg-white hover:bg-gray-50 text-gray-900 border border-gray-200 hover:border-gray-300 disabled:bg-gray-300 disabled:text-gray-500"
                  >
                    <div
                      className={`w-2 h-2 rounded-full mr-2 ${prototype.status === "Ready" ? "bg-green-600" : "bg-gray-400"}`}
                    ></div>
                    <Eye className="w-4 h-4 mr-2" />
                    {prototype.status === "Ready"
                      ? "View Prototype"
                      : prototype.status === "Generating"
                        ? "Generating..."
                        : "Unavailable"}
                  </Button>
                  <Button variant="outline" size="icon" className="border-gray-300 bg-transparent relative">
                    <div className="w-2 h-2 bg-blue-600 rounded-full absolute top-2 right-2"></div>
                    <Bookmark className="w-4 h-4" />
                  </Button>
                  <Button variant="outline" size="icon" className="border-gray-300 bg-transparent relative">
                    <div className="w-2 h-2 bg-purple-600 rounded-full absolute top-2 right-2"></div>
                    <Share2 className="w-4 h-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {totalPages > 1 && (
          <div className="flex items-center justify-between pt-6">
            <div className="text-sm text-gray-600">
              Showing {(currentPage - 1) * PROTOTYPES_PER_PAGE + 1} to{" "}
              {Math.min(currentPage * PROTOTYPES_PER_PAGE, prototypes.length)} of {prototypes.length} prototypes
            </div>
            <div className="flex items-center gap-4">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="w-8 h-8 p-0"
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>
              <span className="text-sm text-gray-600 font-medium">
                Page {currentPage} of {totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setCurrentPage((prev) => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="w-8 h-8 p-0"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>
          </div>
        )}
      </div>

      {webBrowserUrl && (
        <WebBrowserModal url={webBrowserUrl} onClose={() => setWebBrowserUrl(null)} fileName="Prototype Preview" />
      )}
    </div>
  )
}

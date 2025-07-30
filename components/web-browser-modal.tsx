"use client"

import { X, RefreshCw, ExternalLink } from "lucide-react"
import { Button } from "@/components/ui/button"
import { useState, useEffect } from "react"

interface WebBrowserModalProps {
  url: string
  onClose: () => void
  fileName: string
}

export function WebBrowserModal({ url, onClose, fileName }: WebBrowserModalProps) {
  const [isLoading, setIsLoading] = useState(true)
  const [key, setKey] = useState(0)
  const [isDesktop, setIsDesktop] = useState(false)

  useEffect(() => {
    const checkScreenSize = () => {
      setIsDesktop(window.innerWidth >= 1024)
    }

    checkScreenSize()
    window.addEventListener('resize', checkScreenSize)
    return () => window.removeEventListener('resize', checkScreenSize)
  }, [])

  // Ensure the URL is absolute
  const absoluteUrl = url.startsWith("http") ? url : `https://${url}`

  const handleRefresh = () => {
    setIsLoading(true)
    setKey((prev) => prev + 1)
  }

  const handleLoad = () => {
    setIsLoading(false)
  }

  return (
    <div 
      className="fixed inset-0 bg-white z-50 flex flex-col" 
      style={{ 
        paddingBottom: isDesktop ? '0px' : '80px' 
      }}
    >
      {/* Header with controls */}
      <div className="flex items-center justify-between p-4 bg-white border-b border-gray-200 shadow-sm min-h-[60px]">
        <div className="flex-1 min-w-0 pr-4">
          <p className="text-sm font-medium text-gray-900 truncate">{fileName}</p>
          <p className="text-xs text-gray-500 truncate">{absoluteUrl}</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <Button variant="ghost" size="icon" onClick={handleRefresh} disabled={isLoading} title="Refresh dashboard">
            <RefreshCw className={`w-4 h-4 ${isLoading ? "animate-spin" : ""}`} />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            onClick={() => window.open(absoluteUrl, "_blank")}
            title="Open in new tab"
          >
            <ExternalLink className="w-4 h-4" />
          </Button>
          <Button variant="ghost" size="icon" onClick={onClose} title="Close dashboard">
            <X className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center justify-center p-8 bg-gray-50">
          <div className="flex flex-col items-center gap-3">
            <RefreshCw className="w-8 h-8 text-[#7A1216] animate-spin" />
            <p className="text-sm text-gray-600">Loading...</p>
          </div>
        </div>
      )}

      {/* Dashboard iframe */}
      <div className="flex-1 bg-white relative">
        <iframe
          key={key}
          src={absoluteUrl}
          className="w-full h-full border-0"
          title={`Dashboard for ${fileName}`}
          sandbox="allow-scripts allow-same-origin allow-forms allow-popups allow-downloads"
          onLoad={handleLoad}
          style={{ display: isLoading ? "none" : "block" }}
        />
      </div>
    </div>
  )
}

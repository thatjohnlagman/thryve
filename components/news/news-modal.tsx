"use client"

import Dialog from "@mui/material/Dialog"
import DialogTitle from "@mui/material/DialogTitle"
import DialogContent from "@mui/material/DialogContent"
import DialogActions from "@mui/material/DialogActions"
import Typography from "@mui/material/Typography"
import Button from "@mui/material/Button"
import Stack from "@mui/material/Stack"

type NewsItem = {
  title: string
  summary: string
  source: string
  url: string
  imageUrl?: string
  publishedAt?: string
}

interface NewsModalProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  items: NewsItem[]
}

export function NewsModal({ open, onOpenChange, items }: NewsModalProps) {
  const brand = "#E0000A"
  const subtle = "rgba(224,0,10,0.06)"
  const borderSubtle = "rgba(224,0,10,0.15)"

  return (
    <Dialog
      open={open}
      onClose={() => onOpenChange(false)}
      fullWidth
      maxWidth="lg"
      aria-describedby="news-modal-desc"
      PaperProps={{
        sx: {
          borderRadius: 3,
          m: { xs: 1.5, sm: 3 },
          overflow: "hidden",
          boxShadow: "0 10px 30px rgba(0,0,0,0.15), 0 6px 12px rgba(224,0,10,0.1)",
        },
      }}
    >
      <DialogTitle sx={{ borderBottom: "1px solid", borderColor: borderSubtle, background: "white" }}>
        <Typography component="p" variant="h6" sx={{ fontWeight: 800, color: brand }}>
          News & Events
        </Typography>
      </DialogTitle>

      <DialogContent id="news-modal-desc" dividers sx={{ background: "white", p: { xs: 1.5, sm: 2 } }}>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {items.map((n, i) => (
            <a
              key={i}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block rounded-2xl border border-gray-200 hover:shadow-md transition-shadow bg-white"
            >
              <div className="aspect-[16/9] overflow-hidden rounded-t-2xl">
                <img
                  src={
                    n.imageUrl && n.imageUrl.startsWith("http")
                      ? n.imageUrl
                      : "/placeholder.svg?height=160&width=280&query=banking%20news"
                  }
                  alt={n.title}
                  className="h-full w-full object-cover"
                  onError={(e) => {
                    console.log("[NewsModal] Image failed to load:", n.imageUrl)
                    e.currentTarget.src = "/placeholder-eyi8n.png"
                  }}
                />
              </div>
              <div className="p-3">
                <p className="text-sm text-gray-400">{n.source}</p>
                <p className="font-semibold text-gray-900 mt-1 line-clamp-2">{n.title}</p>
                <p className="text-sm text-gray-700 mt-1 line-clamp-3">{n.summary}</p>
              </div>
            </a>
          ))}
        </div>
      </DialogContent>

      <DialogActions sx={{ borderTop: "1px solid", borderColor: borderSubtle, background: "white" }}>
        <Stack direction="row" sx={{ width: "100%" }}>
          <Button
            onClick={() => onOpenChange(false)}
            variant="contained"
            sx={{
              bgcolor: brand,
              "&:hover": { bgcolor: "#B8000A" },
              textTransform: "none",
              fontWeight: 600,
              borderRadius: 2,
            }}
            fullWidth
          >
            Close
          </Button>
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

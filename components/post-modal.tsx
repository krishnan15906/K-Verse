"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { Heart, MessageCircle, Send, Bookmark, X, MoreHorizontal, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { profile } from "@/lib/profile-data"
import { normalizeImageUrl } from "@/lib/api"

type Comment = { id: string; user: string; avatar: string | null; text: string; time: string }
type Post = {
  id: string
  image_url: string
  caption: string | null
  likes: number
  time: string
  comments: Comment[]
  author: string
  author_avatar: string | null
  carousel_urls?: string[]
}

export function PostModal({ post, onClose }: { post: Post; onClose: () => void }) {
  const [liked, setLiked] = useState(false)
  const [saved, setSaved] = useState(false)
  const [comments, setComments] = useState<Comment[]>(post.comments)
  const [draft, setDraft] = useState("")
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const carouselUrls = post.carousel_urls && post.carousel_urls.length > 0 ? post.carousel_urls : [post.image_url]

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  function addComment(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text) return
    setComments((prev) => [
      ...prev,
      { id: `new-${Date.now()}`, user: profile.username, avatar: profile.avatar, text, time: "now" },
    ])
    setDraft("")
  }

  const likeCount = post.likes + (liked ? 1 : 0)

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
      aria-label={`Post by ${profile.username}`}
    >
      <button
        onClick={onClose}
        className="absolute right-4 top-4 text-background/90 transition-colors hover:text-background"
        aria-label="Close"
      >
        <X className="size-7" />
      </button>

      <div
        className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl md:flex-row"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Image side */}
        <div className="relative aspect-square w-full overflow-hidden max-h-[50vh] md:max-h-none bg-black/5 dark:bg-white/5 md:w-[55%] group">
          <Image
            src={normalizeImageUrl(carouselUrls[currentImageIndex], "/placeholder.svg")}
            alt={post.caption ?? `Post by ${post.author}`}
            fill
            className="object-cover"
            unoptimized
          />

          {/* Photo count badge */}
          {carouselUrls.length > 1 && (
            <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full z-10 font-medium select-none">
              {currentImageIndex + 1} photo
            </div>
          )}

          {carouselUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={() => setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : carouselUrls.length - 1))}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/45 hover:bg-black/75 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={() => setCurrentImageIndex((prev) => (prev < carouselUrls.length - 1 ? prev + 1 : 0))}
                className="absolute right-3 top-1/2 -translate-y-1/2 bg-black/45 hover:bg-black/75 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                aria-label="Next image"
              >
                <ChevronRight className="size-5" />
              </button>

              {/* Dot Indicators */}
              <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1.5 bg-black/35 px-2.5 py-1 rounded-full z-10">
                {carouselUrls.map((_, idx) => (
                  <div
                    key={idx}
                    className={cn(
                      "size-1.5 rounded-full transition-all",
                      currentImageIndex === idx ? "bg-white scale-125" : "bg-white/50"
                    )}
                  />
                ))}
              </div>
            </>
          )}
        </div>

        {/* Detail side */}
        <div className="flex w-full flex-col md:w-[45%]">
          {/* header */}
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="size-8 overflow-hidden rounded-full ring-2 ring-[var(--brand-via)]">
              <Image src={normalizeImageUrl(profile.avatar, "/placeholder-user.jpg")} alt="" width={32} height={32} className="object-cover" />
            </div>
            <span className="text-sm font-semibold text-foreground">{profile.username}</span>
            <MoreHorizontal className="ml-auto size-5 text-muted-foreground" />
          </div>

          {/* comments / caption */}
          <div className="flex-1 space-y-4 overflow-y-auto px-4 py-4">
            <Row avatar={profile.avatar} user={profile.username} text={post.caption} time={post.time} />
            {comments.map((c) => (
              <Row key={c.id} avatar={c.avatar} user={c.user} text={c.text} time={c.time} />
            ))}
          </div>

          {/* actions */}
          <div className="border-t border-border px-4 pt-3">
            <div className="flex items-center gap-4">
              <button onClick={() => setLiked((v) => !v)} aria-label="Like" className="transition-transform active:scale-90">
                <Heart className={cn("size-6", liked ? "fill-[var(--brand-from)] text-[var(--brand-from)]" : "text-foreground")} />
              </button>
              <MessageCircle className="size-6 text-foreground" />
              <Send className="size-6 text-foreground" />
              <button onClick={() => setSaved((v) => !v)} aria-label="Save" className="ml-auto transition-transform active:scale-90">
                <Bookmark className={cn("size-6", saved ? "fill-foreground text-foreground" : "text-foreground")} />
              </button>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{likeCount.toLocaleString()} likes</p>
            <p className="mb-3 mt-0.5 text-xs uppercase tracking-wide text-muted-foreground">{post.time} ago</p>
          </div>

          {/* add comment */}
          <form onSubmit={addComment} className="flex items-center gap-2 border-t border-border px-4 py-3">
            <input
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment..."
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!draft.trim()}
              className={cn(
                "brand-text text-sm font-semibold transition-opacity",
                !draft.trim() && "cursor-not-allowed opacity-40",
              )}
            >
              Post
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

function Row({ avatar, user, text, time }: { avatar: string | null; user: string; text: string | null; time: string }) {
  return (
    <div className="flex gap-3">
      <div className="size-8 shrink-0 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
        <Image src={normalizeImageUrl(avatar, "/placeholder-user.jpg")} alt="" width={32} height={32} className="object-cover" />
      </div>
      <div className="text-sm leading-relaxed text-foreground">
        <span className="font-semibold">{user}</span>{" "}
        <span className="whitespace-pre-line">{text}</span>
        <p className="mt-0.5 text-xs text-muted-foreground">{time}</p>
      </div>
    </div>
  )
}

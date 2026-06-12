"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Heart, MessageCircle, Send, Bookmark, MoreHorizontal, Trash2, X, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { API_URL, normalizeImageUrl } from "@/lib/api"
import { Bell } from "lucide-react"

type Comment = { id: number; user: string; avatar: string | null; text: string; time: string }
type FeedPost = {
  id: number
  image_url: string
  caption: string | null
  likes: number
  time: string
  comments: Comment[]
  author: string
  author_avatar: string | null
  location: string | null
  liked: boolean
  saved: boolean
  carousel_urls?: string[]
}

export function FeedCard({
  post,
  onUpdate,
  onDelete,
  currentUsername,
  currentAvatar,
}: {
  post: FeedPost
  onUpdate: (updated: FeedPost) => void
  onDelete?: (id: number) => void
  currentUsername?: string
  currentAvatar?: string | null
}) {
  const [liked, setLiked] = useState(post.liked ?? false)
  const [saved, setSaved] = useState(post.saved ?? false)
  const [likeCount, setLikeCount] = useState(post.likes)
  const [comments, setComments] = useState<Comment[]>(post.comments)
  const [draft, setDraft] = useState("")
  const [posting, setPosting] = useState(false)
  const [menuOpen, setMenuOpen] = useState(false)
  const [commentOpen, setCommentOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const carouselUrls = post.carousel_urls && post.carousel_urls.length > 0 ? post.carousel_urls : [post.image_url]
  const menuRef = useRef<HTMLDivElement>(null)
  const commentInputRef = useRef<HTMLInputElement>(null)

  const token = typeof window !== "undefined" ? (localStorage.getItem("ig_token") ?? "") : ""
  const isOwner = currentUsername && currentUsername === post.author
  const [showLikeAnim, setShowLikeAnim] = useState(false)
  const [likeAnimKey, setLikeAnimKey] = useState(0)
  const lastClickTimeRef = useRef<number>(0)
  const likeAnimTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    return () => {
      if (likeAnimTimerRef.current) clearTimeout(likeAnimTimerRef.current)
    }
  }, [])

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [menuOpen])

  // Auto-focus input when comment panel opens
  useEffect(() => {
    if (commentOpen) setTimeout(() => commentInputRef.current?.focus(), 50)
  }, [commentOpen])

  // ── Like ──────────────────────────────────────────────────────────────────
  async function toggleLike(triggerAnim = false) {
    const method = liked ? "DELETE" : "POST"
    const next = !liked
    const nextCount = next ? likeCount + 1 : likeCount - 1

    if (next && triggerAnim) {
      if (!showLikeAnim) {
        setShowLikeAnim(true)
        setLikeAnimKey((k) => k + 1)
        if (likeAnimTimerRef.current) clearTimeout(likeAnimTimerRef.current)
        likeAnimTimerRef.current = setTimeout(() => setShowLikeAnim(false), 700)
      }
    }

    setLiked(next)
    setLikeCount(nextCount)
    onUpdate({ ...post, liked: next, likes: nextCount, comments })
    try {
      await fetch(`${API_URL}/posts/${post.id}/like`, { method, headers: { Authorization: `Bearer ${token}` } })
    } catch {
      setLiked(liked); setLikeCount(likeCount)
    }
  }

  // ── Save ──────────────────────────────────────────────────────────────────
  async function toggleSave() {
    const next = !saved
    setSaved(next)
    onUpdate({ ...post, saved: next, comments })
    try {
      await fetch(`${API_URL}/posts/${post.id}/save`, {
        method: next ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
    } catch { setSaved(saved) }
  }

  // ── Comment ───────────────────────────────────────────────────────────────
  async function addComment(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || posting) return
    setPosting(true)
    const temp: Comment = { id: Date.now(), user: currentUsername ?? "you", avatar: currentAvatar ?? null, text, time: "just now" }
    const optimistic = [...comments, temp]
    setComments(optimistic)
    setDraft("")
    try {
      const res = await fetch(`${API_URL}/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      })
      if (res.ok) {
        const saved: Comment = await res.json()
        setComments((prev) => prev.map((c) => (c.id === temp.id ? saved : c)))
        onUpdate({ ...post, comments: [...comments, saved] })
      }
    } catch { /* keep optimistic */ } finally { setPosting(false) }
  }

  // ── Delete post ───────────────────────────────────────────────────────────
  async function handleDelete() {
    if (!window.confirm("Delete this post? This cannot be undone.")) return
    setMenuOpen(false)
    setDeleting(true)
    try {
      const res = await fetch(`${API_URL}/posts/${post.id}`, { method: "DELETE", headers: { Authorization: `Bearer ${token}` } })
      if (res.ok || res.status === 204) onDelete?.(post.id)
    } catch (err) { console.error(err) }
    finally { setDeleting(false) }
  }

  return (
    <article className={cn("rounded-2xl border border-border/40 bg-card/60 backdrop-blur-md shadow-[0_8px_30px_rgb(0,0,0,0.02)] hover:shadow-md hover:-translate-y-0.5 transition-all duration-300 ease-out", deleting && "opacity-50 pointer-events-none")}>
      {/* Header */}
      <div className="flex items-center gap-3.5 px-4.5 py-3.5">
        <span className="brand-gradient rounded-full p-[2px]">
          <span className="block rounded-full bg-card p-[2px]">
            <span className="block size-8 overflow-hidden rounded-full">
              <Image src={normalizeImageUrl(post.author_avatar, "/placeholder-user.jpg")} alt={post.author} width={32} height={32} className="size-full object-cover" />
            </span>
          </span>
        </span>
        <div className="flex flex-col justify-center leading-tight">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-semibold text-foreground hover:opacity-80 transition-opacity cursor-pointer">{post.author}</span>
            <span className="text-[10px] text-muted-foreground/60">•</span>
            <span className="text-xs text-muted-foreground">{post.time} ago</span>
          </div>
          {post.location && <p className="text-[11px] text-muted-foreground/80 mt-0.5">{post.location}</p>}
        </div>
        <div ref={menuRef} className="relative ml-auto">
          <button onClick={() => setMenuOpen((v) => !v)} className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Post options">
            <MoreHorizontal className="size-5" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-8 z-20 min-w-[150px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
              {isOwner ? (
                <button onClick={handleDelete} className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30">
                  <Trash2 className="size-4" /> Delete post
                </button>
              ) : (
                <p className="px-4 py-3 text-xs text-muted-foreground">No options available</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Image / Carousel */}
      <div className="relative aspect-square w-full overflow-hidden bg-black/5 dark:bg-white/5 group">
        <div
          onClick={() => {
            const now = Date.now()
            if (now - lastClickTimeRef.current < 300) {
              if (!showLikeAnim) {
                setShowLikeAnim(true)
                setLikeAnimKey((k) => k + 1)
                if (likeAnimTimerRef.current) clearTimeout(likeAnimTimerRef.current)
                likeAnimTimerRef.current = setTimeout(() => setShowLikeAnim(false), 700)
              }
              if (!liked) {
                toggleLike(false)
              }
            }
            lastClickTimeRef.current = now
          }}
          className="absolute inset-0 cursor-pointer"
        >
          <Image
            src={normalizeImageUrl(carouselUrls[currentImageIndex], "/placeholder.svg")}
            alt={post.caption ?? `Post by ${post.author}`}
            fill
            className="object-cover select-none transition-transform duration-500 ease-out group-hover:scale-[1.015]"
            unoptimized
          />
        </div>

        {/* Photo count badge */}
        {carouselUrls.length > 1 && (
          <div className="absolute top-3 right-3 bg-black/60 backdrop-blur-sm text-white text-xs px-2.5 py-1 rounded-full z-10 font-medium select-none">
            {currentImageIndex + 1} photo
          </div>
        )}

        {/* Left/Right Navigation Arrows */}
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

        {showLikeAnim && (
          <div key={likeAnimKey} className="absolute inset-0 flex items-center justify-center pointer-events-none z-10">
            <svg width="0" height="0" className="absolute">
              <defs>
                <linearGradient id={`brand-grad-feed-${post.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="var(--brand-from)" />
                  <stop offset="50%" stopColor="var(--brand-via)" />
                  <stop offset="100%" stopColor="var(--brand-to)" />
                </linearGradient>
              </defs>
            </svg>
            <Heart className="size-24 drop-shadow-lg animate-likePop" stroke="none" fill={`url(#brand-grad-feed-${post.id})`} />
          </div>
        )}
      </div>

      {/* Actions */}
      <div className="px-4 pt-3.5 pb-2">
        <div className="flex items-center gap-5.5 py-1">
          <button onClick={() => toggleLike(true)} aria-label={liked ? "Unlike" : "Like"} className="transition-all hover:scale-105 active:scale-95 text-foreground hover:text-[var(--brand-from)]">
            <Heart className={cn("size-6 transition-colors", liked ? "fill-[var(--brand-from)] text-[var(--brand-from)]" : "")} />
          </button>
          {/* Comment icon — toggles the comment panel */}
          <button
            onClick={() => setCommentOpen((v) => !v)}
            aria-label="Comments"
            className={cn("relative transition-all hover:scale-105 active:scale-95 text-foreground hover:text-[var(--brand-via)]", commentOpen && "text-[var(--brand-via)]")}
          >
            <MessageCircle className="size-6 transition-colors" />
            {comments.length > 0 && (
              <span className="absolute -right-1.5 -top-1.5 flex size-4 items-center justify-center rounded-full bg-[var(--brand-from)] text-[8px] font-bold text-white ring-1 ring-background">
                {comments.length > 99 ? "99+" : comments.length}
              </span>
            )}
          </button>
          <button className="transition-all hover:scale-105 active:scale-95 text-foreground hover:text-[var(--brand-via)]">
            <Send className="size-6" />
          </button>
          <button onClick={toggleSave} aria-label={saved ? "Unsave" : "Save"} className="ml-auto transition-all hover:scale-105 active:scale-95 text-foreground hover:text-primary">
            <Bookmark className={cn("size-6 transition-colors", saved ? "fill-foreground text-foreground" : "")} />
          </button>
        </div>

        <p className="mt-2.5 text-sm font-semibold text-foreground">{likeCount.toLocaleString()} likes</p>

        {/* Caption */}
        {post.caption && (
          <p className="mt-1 text-sm leading-relaxed text-foreground">
            <span className="font-semibold">{post.author}</span> <span>{post.caption}</span>
          </p>
        )}

        {/* Comment count hint when panel is closed */}
        {!commentOpen && comments.length > 0 && (
          <button
            onClick={() => setCommentOpen(true)}
            className="mt-1 block text-sm text-muted-foreground hover:text-foreground"
          >
            View all {comments.length} comment{comments.length !== 1 ? "s" : ""}
          </button>
        )}
        <div className="mb-2" />
      </div>

      {/* ── Comment panel — slides in when open ── */}
      {commentOpen && (
        <div className="border-t border-border">
          {/* Panel header */}
          <div className="flex items-center justify-between px-4 py-2">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              {comments.length} comment{comments.length !== 1 ? "s" : ""}
            </span>
            <button onClick={() => setCommentOpen(false)} className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close comments">
              <X className="size-4" />
            </button>
          </div>

          {/* Comments list */}
          <div className="max-h-48 min-h-[60px] space-y-3 overflow-y-auto px-4 pb-3">
            {comments.length === 0 ? (
              <p className="py-4 text-center text-sm text-muted-foreground">No comments yet. Be the first!</p>
            ) : (
              comments.map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="size-7 shrink-0 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                    <Image src={normalizeImageUrl(c.avatar, "/placeholder-user.jpg")} alt={c.user} width={28} height={28} className="size-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm leading-snug text-foreground">
                      <span className="font-semibold">{c.user}</span>{" "}
                      <span className="break-words">{c.text}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">{c.time}</p>
                  </div>
                </div>
              ))
            )}
          </div>

          {/* Add comment input */}
          <form onSubmit={addComment} className="flex items-center gap-2 border-t border-border px-4 py-3">
            <div className="size-7 shrink-0 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
              <Image src={normalizeImageUrl(currentAvatar, "/placeholder-user.jpg")} alt="you" width={28} height={28} className="size-full object-cover" />
            </div>
            <input
              ref={commentInputRef}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="Add a comment…"
              className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
            <button
              type="submit"
              disabled={!draft.trim() || posting}
              className={cn("brand-text text-sm font-semibold transition-opacity", (!draft.trim() || posting) && "cursor-not-allowed opacity-40")}
            >
              {posting ? "…" : "Post"}
            </button>
          </form>
        </div>
      )}
    </article>
  )
}

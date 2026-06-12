"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { X, Camera, Trash2, Eye, Heart } from "lucide-react"
import { API_URL, normalizeImageUrl } from "@/lib/api"
import { cn } from "@/lib/utils"

export type Story = {
  id: number
  user: string
  avatar: string | null
  media_url?: string | null
  liked?: boolean
  views_count?: number
  likes_count?: number
}
type Me = { username: string; avatar_url: string | null }

// ── Create Story Modal ──
export function CreateStoryModal({
  onClose,
  onCreated,
}: {
  onClose: () => void
  onCreated: () => void
}) {
  const [imageUrl, setImageUrl] = useState("")
  const [preview, setPreview] = useState("")
  const [posting, setPosting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = "" }
  }, [onClose])

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (ev) => {
      const dataUrl = ev.target?.result as string
      setImageUrl(dataUrl)
      setPreview(dataUrl)
    }
    reader.readAsDataURL(file)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    const url = imageUrl.trim()
    if (!url) { setError("Please upload a picture."); return }
    setError(null)
    setPosting(true)
    const token = localStorage.getItem("ig_token") ?? ""
    try {
      let finalUrl = url

      if (url.startsWith("data:")) {
        const blob = await (await fetch(url)).blob()
        const formData = new FormData()
        formData.append("file", blob, "story.jpg")
        const uploadRes = await fetch(`${API_URL}/posts/upload`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
          body: formData,
        })
        if (!uploadRes.ok) {
          const d = await uploadRes.json().catch(() => ({}))
          throw new Error(d.detail ?? "Upload failed")
        }
        const { url: uploaded } = await uploadRes.json()
        finalUrl = uploaded
      }

      const res = await fetch(`${API_URL}/stories?media_url=${encodeURIComponent(finalUrl)}`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail ?? `Error ${res.status}`)
      }
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to upload story")
    } finally {
      setPosting(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl flex flex-col max-h-[90vh] min-h-0">
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 className="text-base font-semibold text-foreground">Add to story</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
            <X className="size-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 px-6 py-5 overflow-y-auto flex-1 min-h-0">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{error}</p>
          )}

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => fileRef.current?.click()}
              className="w-full rounded-lg border-2 border-dashed border-border py-8 text-sm text-muted-foreground transition-colors hover:border-ring hover:text-foreground flex flex-col items-center justify-center gap-2"
            >
              <Camera className="size-8" />
              <span>Select photo from device</span>
            </button>
            <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handleFile} />
          </div>

          {preview && (
            <div className="relative aspect-[9/16] w-full max-h-[40vh] overflow-hidden rounded-xl bg-secondary mx-auto">
              <Image src={normalizeImageUrl(preview, "/placeholder.svg")} alt="Preview" fill className="object-cover" unoptimized />
            </div>
          )}

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground hover:bg-muted"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={posting || !imageUrl.trim()}
              className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground hover:opacity-90 disabled:opacity-50"
            >
              {posting ? "Sharing…" : "Share to story"}
            </button>
          </div>
        </form>
      </div>
    </div>
  )
}

// ── Story Viewer Modal ──
export function StoryViewerModal({
  story,
  onClose,
  onDeleted,
}: {
  story: Story
  onClose: () => void
  onDeleted: () => void
}) {
  const [deleting, setDeleting] = useState(false)
  const [liked, setLiked] = useState(story.liked ?? false)
  const [viewers, setViewers] = useState<{ username: string; avatar_url: string | null; liked: boolean }[]>([])
  const [loadingViewers, setLoadingViewers] = useState(false)
  const [showViewersPanel, setShowViewersPanel] = useState(false)

  const isOwnStory = story.user === "Your story"
  const token = typeof window !== "undefined" ? (localStorage.getItem("ig_token") ?? "") : ""

  // Auto-close timeout only for other people's stories when not interacting
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"

    let t: NodeJS.Timeout | null = null
    if (!isOwnStory && !showViewersPanel) {
      t = setTimeout(() => onClose(), 5000)
    }

    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
      if (t) clearTimeout(t)
    }
  }, [onClose, isOwnStory, showViewersPanel])

  // Track story view on mount (for other users' stories)
  useEffect(() => {
    if (isOwnStory || !story.id) return
    fetch(`${API_URL}/stories/${story.id}/view`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` }
    }).catch(err => console.error("Failed to view story:", err))
  }, [story.id, isOwnStory, token])

  // Fetch story viewers list (for own story)
  useEffect(() => {
    if (!isOwnStory || !story.id) return
    setLoadingViewers(true)
    fetch(`${API_URL}/stories/${story.id}/viewers`, {
      headers: { Authorization: `Bearer ${token}` }
    })
      .then(res => res.ok ? res.json() : [])
      .then(data => setViewers(data))
      .catch(err => console.error("Failed to fetch viewers:", err))
      .finally(() => setLoadingViewers(false))
  }, [story.id, isOwnStory, token])

  async function handleDelete() {
    if (!window.confirm("Delete this story?")) return
    setDeleting(true)
    try {
      const res = await fetch(`${API_URL}/stories/${story.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (res.ok || res.status === 204) {
        onDeleted()
        onClose()
      }
    } catch (err) {
      console.error(err)
    } finally {
      setDeleting(false)
    }
  }

  async function toggleLikeStory() {
    const next = !liked
    setLiked(next)
    try {
      await fetch(`${API_URL}/stories/${story.id}/like`, {
        method: next ? "POST" : "DELETE",
        headers: { Authorization: `Bearer ${token}` }
      })
    } catch (err) {
      setLiked(liked) // revert
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/90 backdrop-blur-md"
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <button onClick={onClose} className="absolute right-4 top-4 text-background/90 hover:text-background z-20">
        <X className="size-8" />
      </button>

      <div
        className="relative flex flex-col justify-center items-center h-[85vh] w-full max-w-sm overflow-hidden rounded-2xl bg-black shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* User Info Header */}
        <div className="absolute top-0 left-0 right-0 z-10 flex items-center gap-3 p-4 bg-gradient-to-b from-black/60 to-transparent">
          <div className="size-9 overflow-hidden rounded-full ring-2 ring-[var(--brand-via)]">
            <Image
              src={normalizeImageUrl(story.avatar, "/placeholder-user.jpg")}
              alt={story.user}
              width={36}
              height={36}
              className="object-cover size-full"
            />
          </div>
          <span className="text-sm font-semibold text-white">{story.user}</span>
          
          {isOwnStory && (
            <button
              onClick={handleDelete}
              disabled={deleting}
              className="ml-auto text-white/80 hover:text-red-500 transition-colors p-1"
              aria-label="Delete story"
            >
              <Trash2 className="size-5" />
            </button>
          )}
        </div>

        {/* Media */}
        <div className="relative w-full h-full flex items-center justify-center">
          <Image
            src={normalizeImageUrl(story.media_url, "/placeholder.svg")}
            alt={`Story by ${story.user}`}
            fill
            className="object-contain"
            unoptimized
          />
        </div>

        {/* Own story viewers panel overlay trigger */}
        {isOwnStory && (
          <div className="absolute bottom-4 left-0 right-0 z-20 flex justify-center">
            <button
              onClick={() => setShowViewersPanel(true)}
              className="flex items-center gap-1.5 bg-black/60 hover:bg-black/80 text-white text-xs font-semibold px-4 py-2 rounded-full border border-white/20 transition-all shadow-md cursor-pointer"
            >
              <Eye className="size-4" />
              <span>Viewers ({viewers.length})</span>
            </button>
          </div>
        )}

        {/* Other users' stories: reply input & like heart button */}
        {!isOwnStory && (
          <div className="absolute bottom-4 left-4 right-4 z-20 flex items-center gap-3 w-[calc(100%-2rem)]">
            <input
              type="text"
              placeholder={`Reply to ${story.user}…`}
              className="flex-1 bg-black/45 border border-white/25 rounded-full px-4 py-2 text-xs text-white placeholder:text-white/60 focus:outline-none focus:border-white/50 backdrop-blur-md"
              disabled
            />
            <button
              onClick={toggleLikeStory}
              className="bg-black/45 border border-white/25 text-white rounded-full p-2 hover:bg-black/75 transition-colors backdrop-blur-md cursor-pointer shrink-0"
              aria-label={liked ? "Unlike story" : "Like story"}
            >
              <Heart className={cn("size-5 transition-transform active:scale-95", liked ? "fill-[var(--brand-from)] text-[var(--brand-from)]" : "text-white")} />
            </button>
          </div>
        )}

        {/* Viewers list slide-up panel */}
        {isOwnStory && showViewersPanel && (
          <div className="absolute bottom-0 left-0 right-0 z-30 bg-card rounded-t-2xl border-t border-border flex flex-col max-h-[60%] shadow-2xl transition-transform duration-300">
            <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
              <h3 className="text-sm font-bold text-foreground">Views</h3>
              <button
                onClick={() => setShowViewersPanel(false)}
                className="text-muted-foreground hover:text-foreground rounded-full p-1 hover:bg-secondary transition-colors"
              >
                <X className="size-4" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-2 space-y-2.5">
              {loadingViewers ? (
                <p className="text-center py-6 text-xs text-muted-foreground">Loading viewers…</p>
              ) : viewers.length === 0 ? (
                <p className="text-center py-6 text-xs text-muted-foreground">No views yet</p>
              ) : (
                viewers.map((viewer, idx) => (
                  <div key={idx} className="flex items-center justify-between px-2 py-1.5 hover:bg-secondary/40 rounded-xl transition-colors">
                    <div className="flex items-center gap-3">
                      <div className="size-8 overflow-hidden rounded-full border border-border">
                        <Image
                          src={normalizeImageUrl(viewer.avatar_url, "/placeholder-user.jpg")}
                          alt={viewer.username}
                          width={32}
                          height={32}
                          className="size-full object-cover"
                          unoptimized
                        />
                      </div>
                      <span className="text-sm font-semibold text-foreground">{viewer.username}</span>
                    </div>
                    {viewer.liked && (
                      <div className="flex items-center gap-1 text-[var(--brand-from)]">
                        <Heart className="size-4 fill-[var(--brand-from)] text-[var(--brand-from)]" />
                        <span className="text-[10px] font-bold uppercase tracking-wider">Liked</span>
                      </div>
                    )}
                  </div>
                ))
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Stories Bar Component ──
export function StoriesBar() {
  const [stories, setStories] = useState<Story[]>([])
  const [me, setMe] = useState<Me | null>(null)
  
  // State for modals
  const [activeStory, setActiveStory] = useState<Story | null>(null)
  const [showCreate, setShowCreate] = useState(false)

  const fetchStories = () => {
    const token = localStorage.getItem("ig_token")
    if (!token) return
    fetch(`${API_URL}/stories`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load stories: ${r.status}`)
        return r.json()
      })
      .then((data) => {
        if (Array.isArray(data)) setStories(data)
        else throw new Error("Unexpected stories response")
      })
      .catch((err) => {
        console.error(err)
        setStories([])
      })
  }

  useEffect(() => {
    const token = localStorage.getItem("ig_token")
    if (!token) return

    // Get current user for "Your story" bubble
    fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (!r.ok) throw new Error(`Failed to load user: ${r.status}`)
        return r.json()
      })
      .then(setMe)
      .catch((err) => {
        console.error(err)
        setMe(null)
      })

    fetchStories()
  }, [])

  // Build display list: "Your story" first, then followed users' stories
  const myActiveStory = stories.find((s) => s.user === "Your story")
  const yourStory: Story = myActiveStory
    ? { ...myActiveStory }
    : { id: 0, user: "Your story", avatar: me?.avatar_url ?? null, media_url: null }
  const displayed: Story[] = me ? [yourStory, ...stories.filter((s) => s.user !== "Your story")] : stories

  const handleStoryClick = (story: Story) => {
    if (story.media_url) {
      setActiveStory(story)
    } else if (story.user === "Your story") {
      setShowCreate(true)
    }
  }

  return (
    <>
      <div className="rounded-2xl border border-border bg-card/80 backdrop-blur-sm">
        <div className="flex gap-4 overflow-x-auto px-4 py-4">
          {displayed.map((story, i) => (
            <button
              key={`${story.id}-${i}`}
              onClick={() => handleStoryClick(story)}
              className="flex w-16 shrink-0 flex-col items-center gap-1.5 focus:outline-none transition-transform duration-300 hover:scale-[1.03] active:scale-95 cursor-pointer"
            >
              <span className={i === 0 && !story.media_url ? "rounded-full p-[2px] ring-2 ring-border" : "brand-gradient rounded-full p-[2px]"}>
                <span className="block rounded-full bg-card p-[2px]">
                  <span className="block size-14 overflow-hidden rounded-full">
                    <Image
                      src={normalizeImageUrl(story.avatar, "/placeholder-user.jpg")}
                      alt={story.user}
                      width={56}
                      height={56}
                      className="size-full object-cover"
                    />
                  </span>
                </span>
              </span>
              <span className="w-full truncate text-center text-xs text-foreground">{story.user}</span>
            </button>
          ))}
        </div>
      </div>

      {showCreate && (
        <CreateStoryModal
          onClose={() => setShowCreate(false)}
          onCreated={fetchStories}
        />
      )}

      {activeStory && (
        <StoryViewerModal
          story={activeStory}
          onClose={() => setActiveStory(null)}
          onDeleted={fetchStories}
        />
      )}
    </>
  )
}

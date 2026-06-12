"use client"

import { useEffect, useState, useRef } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Grid3x3, Heart, MessageCircle, X, Bookmark, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { API_URL, normalizeImageUrl } from "@/lib/api"
import { FollowsModal } from "./follows-modal"
import { StoryViewerModal, type Story } from "./stories-bar"

type Comment = { id: number; user: string; avatar: string | null; text: string; time: string }
type Post = { id: number; image_url: string; caption: string | null; likes: number; comments: Comment[]; liked: boolean; saved: boolean; time: string; author: string; author_avatar: string | null; location: string | null; carousel_urls?: string[] }
type UserProfile = { id: number; username: string; full_name: string; avatar_url: string | null; bio: string | null; website: string | null; posts_count: number; followers_count: number; following_count: number }

export function PublicProfileContent({ username }: { username: string }) {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [following, setFollowing] = useState(false)
  const [followLoading, setFollowLoading] = useState(false)
  const [activePost, setActivePost] = useState<Post | null>(null)
  const [isOwnProfile, setIsOwnProfile] = useState(false)
  const [showFollowsModal, setShowFollowsModal] = useState<"followers" | "following" | null>(null)
  const [hasStory, setHasStory] = useState(false)
  const [storyData, setStoryData] = useState<Story | null>(null)
  const [activeStory, setActiveStory] = useState<Story | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("ig_token")
    if (!token) { router.replace("/login"); return }

    // Load the target user's profile + current user to check if it's own profile
    Promise.all([
      fetch(`${API_URL}/users/${username}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
    ])
      .then(async ([profileRes, meRes]) => {
        if (profileRes.status === 401) { router.replace("/login"); throw new Error("unauth") }
        if (profileRes.status === 404) { setError("User not found"); return }
        if (!profileRes.ok) throw new Error(`Failed to load profile: ${profileRes.status}`)

        const [targetUser, me]: [UserProfile, UserProfile] = await Promise.all([
          profileRes.json(),
          meRes.ok ? meRes.json() : Promise.resolve(null),
        ])

        setProfile(targetUser)

        if (me && me.username === targetUser.username) {
          setIsOwnProfile(true)
          router.replace("/profile")
          return
        }

        // Check follow status
        if (me) {
          const followRes = await fetch(`${API_URL}/users/${username}/is-following`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (followRes.ok) {
            const data = await followRes.json()
            setFollowing(data.following ?? false)
          }
        }

        // Load posts
        const postsRes = await fetch(`${API_URL}/profile/${username}/posts`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (postsRes.ok) setPosts(await postsRes.json())

        // Check active story
        try {
          const storyRes = await fetch(`${API_URL}/stories/user/${username}`, {
            headers: { Authorization: `Bearer ${token}` },
          })
          if (storyRes.ok) {
            const story = await storyRes.json()
            setHasStory(true)
            setStoryData(story)
          } else {
            setHasStory(false)
            setStoryData(null)
          }
        } catch (err) {
          console.error("Failed to check active story:", err)
          setHasStory(false)
          setStoryData(null)
        }
      })
      .catch((err) => {
        if (err.message !== "unauth") { console.error(err); setError(err.message) }
      })
      .finally(() => setLoading(false))
  }, [username, router])

  async function toggleFollow() {
    const token = localStorage.getItem("ig_token") ?? ""
    setFollowLoading(true)
    try {
      const method = following ? "DELETE" : "POST"
      await fetch(`${API_URL}/users/${username}/follow`, {
        method,
        headers: { Authorization: `Bearer ${token}` },
      })
      setFollowing(!following)
      setProfile((prev) =>
        prev
          ? { ...prev, followers_count: prev.followers_count + (following ? -1 : 1) }
          : prev
      )
    } catch (err) {
      console.error(err)
    } finally {
      setFollowLoading(false)
    }
  }

  if (loading) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 px-4 pt-16">
        <div className="size-36 animate-pulse rounded-full bg-secondary" />
        <div className="h-4 w-32 animate-pulse rounded bg-secondary" />
        <div className="h-3 w-48 animate-pulse rounded bg-secondary" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="mx-auto flex w-full max-w-4xl flex-col items-center gap-4 px-4 pt-16 text-center text-sm text-red-600">
        <p>{error}</p>
      </div>
    )
  }

  if (!profile) return null

  return (
    <>
      <section className="mx-auto w-full max-w-4xl px-4 pb-24 sm:pb-16 pt-6">
        {/* Header */}
        <header className="flex flex-col items-center gap-6 border-b border-border pb-8 sm:flex-row sm:items-start sm:gap-12 sm:px-6">
          {hasStory ? (
            <button
              onClick={() => setActiveStory(storyData)}
              className="brand-gradient shrink-0 rounded-full p-[3px] focus:outline-none transition-transform active:scale-95 cursor-pointer"
              aria-label="View story"
            >
              <div className="rounded-full bg-background p-[3px]">
                <div className="size-24 overflow-hidden rounded-full sm:size-36">
                  <Image
                    src={normalizeImageUrl(profile.avatar_url, "/placeholder-user.jpg")}
                    alt={profile.full_name || profile.username}
                    width={144}
                    height={144}
                    className="size-full object-cover"
                    priority
                  />
                </div>
              </div>
            </button>
          ) : (
            <div className="shrink-0 rounded-full p-[3px] bg-secondary/60 border border-border">
              <div className="rounded-full bg-background p-[3px]">
                <div className="size-24 overflow-hidden rounded-full sm:size-36">
                  <Image
                    src={normalizeImageUrl(profile.avatar_url, "/placeholder-user.jpg")}
                    alt={profile.full_name || profile.username}
                    width={144}
                    height={144}
                    className="size-full object-cover"
                    priority
                  />
                </div>
              </div>
            </div>
          )}

          <div className="flex w-full flex-col items-center gap-4 sm:items-start">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
              <h1 className="text-xl font-light text-foreground">{profile.username}</h1>
              {!isOwnProfile && (
                <button
                  onClick={toggleFollow}
                  disabled={followLoading}
                  className={`rounded-lg px-5 py-1.5 text-sm font-semibold transition-colors disabled:opacity-50 ${
                    following
                      ? "bg-secondary text-secondary-foreground hover:bg-muted"
                      : "bg-primary text-primary-foreground hover:opacity-90"
                  }`}
                >
                  {followLoading ? "…" : following ? "Following" : "Follow"}
                </button>
              )}
            </div>

            <ul className="flex items-center gap-8 text-sm">
              <li><span className="font-semibold text-foreground">{profile.posts_count ?? 0}</span> <span className="text-muted-foreground">posts</span></li>
              <li onClick={() => setShowFollowsModal("followers")} className="cursor-pointer hover:opacity-80 transition-opacity"><span className="font-semibold text-foreground">{(profile.followers_count ?? 0).toLocaleString()}</span> <span className="text-muted-foreground">followers</span></li>
              <li onClick={() => setShowFollowsModal("following")} className="cursor-pointer hover:opacity-80 transition-opacity"><span className="font-semibold text-foreground">{(profile.following_count ?? 0).toLocaleString()}</span> <span className="text-muted-foreground">following</span></li>
            </ul>

            <div className="max-w-md text-center sm:text-left">
              <p className="text-sm font-semibold text-foreground">{profile.full_name}</p>
              {profile.bio && <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-foreground">{profile.bio}</p>}
              {profile.website && (
                <a href={profile.website} target="_blank" rel="noopener noreferrer" className="brand-text mt-0.5 inline-block text-sm font-semibold">
                  {profile.website}
                </a>
              )}
            </div>
          </div>
        </header>

        {/* Tab header */}
        <nav className="flex items-center justify-center">
          <span className="-mt-px flex items-center gap-1.5 border-t-2 border-foreground py-3 text-xs font-semibold uppercase tracking-widest text-foreground">
            <Grid3x3 className="size-3.5" /> Posts
          </span>
        </nav>

        {/* Grid */}
        {posts.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">No posts yet.</p>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {posts.map((post) => (
              <button
                key={post.id}
                onClick={() => setActivePost(post)}
                className="group relative aspect-square overflow-hidden bg-secondary"
              >
                <Image src={normalizeImageUrl(post.image_url, "/placeholder.svg")} alt={post.caption ?? ""} fill className="object-cover transition-transform duration-300 group-hover:scale-105" />
                <div className="absolute inset-0 flex items-center justify-center gap-6 bg-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
                  <span className="flex items-center gap-1.5 font-semibold text-background"><Heart className="size-5 fill-background" /> {post.likes.toLocaleString()}</span>
                  <span className="flex items-center gap-1.5 font-semibold text-background"><MessageCircle className="size-5 fill-background" /> {post.comments.length}</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>

      {activePost && (
        <PostModal
          post={activePost}
          onClose={() => setActivePost(null)}
          onUpdate={(updated) => {
            setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))
            setActivePost(updated)
          }}
        />
      )}

      {showFollowsModal && profile && (
        <FollowsModal
          username={profile.username}
          type={showFollowsModal}
          onClose={() => setShowFollowsModal(null)}
        />
      )}

      {activeStory && (
        <StoryViewerModal
          story={activeStory}
          onClose={() => setActiveStory(null)}
          onDeleted={() => {
            setHasStory(false)
            setStoryData(null)
          }}
          isOwnStory={false}
        />
      )}
    </>
  )
}

// ── Post modal (read-only friendly) ──────────────────────────────────────────
function PostModal({ post, onClose, onUpdate }: { post: Post; onClose: () => void; onUpdate: (p: Post) => void }) {
  const [liked, setLiked] = useState(post.liked)
  const [saved, setSaved] = useState(post.saved)
  const [likeCount, setLikeCount] = useState(post.likes)
  const [comments, setComments] = useState<Comment[]>(post.comments)
  const [draft, setDraft] = useState("")
  const [posting, setPosting] = useState(false)
  const [currentImageIndex, setCurrentImageIndex] = useState(0)
  const carouselUrls = post.carousel_urls && post.carousel_urls.length > 0 ? post.carousel_urls : [post.image_url]

  const token = typeof window !== "undefined" ? (localStorage.getItem("ig_token") ?? "") : ""
  const [showLikeAnim, setShowLikeAnim] = useState(false)
  const [likeAnimKey, setLikeAnimKey] = useState(0)
  const lastClickTimeRef = useRef<number>(0)
  const likeAnimTimerRef = useRef<NodeJS.Timeout | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
      if (likeAnimTimerRef.current) clearTimeout(likeAnimTimerRef.current)
    }
  }, [onClose])

  async function toggleLike(triggerAnim = false) {
    const method = liked ? "DELETE" : "POST"

    if (!liked && triggerAnim) {
      if (!showLikeAnim) {
        setShowLikeAnim(true)
        setLikeAnimKey((k) => k + 1)
        if (likeAnimTimerRef.current) clearTimeout(likeAnimTimerRef.current)
        likeAnimTimerRef.current = setTimeout(() => setShowLikeAnim(false), 700)
      }
    }

    await fetch(`${API_URL}/posts/${post.id}/like`, { method, headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    const next = liked ? likeCount - 1 : likeCount + 1
    setLiked(!liked); setLikeCount(next)
    onUpdate({ ...post, liked: !liked, likes: next, comments })
  }

  async function toggleSave() {
    const method = saved ? "DELETE" : "POST"
    await fetch(`${API_URL}/posts/${post.id}/save`, { method, headers: { Authorization: `Bearer ${token}` } }).catch(() => {})
    setSaved(!saved)
    onUpdate({ ...post, saved: !saved, comments })
  }

  async function addComment(e: React.FormEvent) {
    e.preventDefault()
    const text = draft.trim()
    if (!text || posting) return
    setPosting(true)
    try {
      const res = await fetch(`${API_URL}/posts/${post.id}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ text }),
      })
      const c: Comment = await res.json()
      const updated = [...comments, c]
      setComments(updated); setDraft("")
      onUpdate({ ...post, comments: updated })
    } finally { setPosting(false) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm" onClick={onClose} role="dialog" aria-modal="true">
      <button onClick={onClose} className="absolute right-4 top-4 text-background/90 hover:text-background" aria-label="Close"><X className="size-7" /></button>
      <div className="flex max-h-[90vh] w-full max-w-4xl flex-col overflow-hidden rounded-2xl bg-card shadow-2xl md:flex-row" onClick={(e) => e.stopPropagation()}>
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
          className="relative aspect-square w-full overflow-hidden max-h-[50vh] md:max-h-none bg-black/5 dark:bg-white/5 md:w-[55%] cursor-pointer group"
        >
          <Image
            src={normalizeImageUrl(carouselUrls[currentImageIndex], "/placeholder.svg")}
            alt={post.caption ?? ""}
            fill
            className="object-cover select-none transition-transform duration-500 ease-out group-hover:scale-[1.015]"
            unoptimized
          />

          {carouselUrls.length > 1 && (
            <>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentImageIndex((prev) => (prev > 0 ? prev - 1 : carouselUrls.length - 1))
                }}
                className="absolute left-3 top-1/2 -translate-y-1/2 bg-black/45 hover:bg-black/75 text-white rounded-full p-1.5 opacity-0 group-hover:opacity-100 transition-opacity z-10 cursor-pointer"
                aria-label="Previous image"
              >
                <ChevronLeft className="size-5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation()
                  setCurrentImageIndex((prev) => (prev < carouselUrls.length - 1 ? prev + 1 : 0))
                }}
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
                  <linearGradient id={`brand-grad-public-${post.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--brand-from)" />
                    <stop offset="50%" stopColor="var(--brand-via)" />
                    <stop offset="100%" stopColor="var(--brand-to)" />
                  </linearGradient>
                </defs>
              </svg>
              <Heart className="size-24 drop-shadow-lg animate-likePop" stroke="none" fill={`url(#brand-grad-public-${post.id})`} />
            </div>
          )}
        </div>
        <div className="flex w-full flex-col md:w-[45%]">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="size-8 overflow-hidden rounded-full ring-2 ring-[var(--brand-via)]">
              <Image src={normalizeImageUrl(post.author_avatar, "/placeholder-user.jpg")} alt="" width={32} height={32} className="object-cover" />
            </div>
            <span className="text-sm font-semibold text-foreground">{post.author}</span>
          </div>
          <div className="flex-1 space-y-3 overflow-y-auto px-4 py-4">
            {post.caption && (
              <div className="flex gap-3">
                <div className="size-8 shrink-0 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <Image src={normalizeImageUrl(post.author_avatar, "/placeholder-user.jpg")} alt="" width={32} height={32} className="object-cover" />
                </div>
                <p className="text-sm text-foreground"><span className="font-semibold">{post.author}</span> {post.caption}</p>
              </div>
            )}
            {comments.map((c) => (
              <div key={c.id} className="flex gap-3">
                <div className="size-8 shrink-0 overflow-hidden rounded-full bg-black/10 dark:bg-white/10">
                  <Image src={normalizeImageUrl(c.avatar, "/placeholder-user.jpg")} alt="" width={32} height={32} className="object-cover" />
                </div>
                <p className="text-sm text-foreground"><span className="font-semibold">{c.user}</span> {c.text}</p>
              </div>
            ))}
          </div>
          <div className="border-t border-border px-4 pt-3">
            <div className="flex items-center gap-4">
              <button onClick={() => toggleLike(true)} className="transition-transform active:scale-90">
                <Heart className={cn("size-6", liked ? "fill-[var(--brand-from)] text-[var(--brand-from)]" : "text-foreground")} />
              </button>
              <MessageCircle className="size-6 text-foreground" />
              <button onClick={toggleSave} className="ml-auto transition-transform active:scale-90">
                <Bookmark className={`size-6 ${saved ? "fill-foreground text-foreground" : "text-foreground"}`} />
              </button>
            </div>
            <p className="mt-2 text-sm font-semibold text-foreground">{likeCount.toLocaleString()} likes</p>
            <p className="mb-2 text-xs text-muted-foreground uppercase tracking-wide">{post.time} ago</p>
          </div>
          <form onSubmit={addComment} className="flex items-center gap-2 border-t border-border px-4 py-3">
            <input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Add a comment..." className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground" />
            <button type="submit" disabled={!draft.trim() || posting} className="brand-text text-sm font-semibold disabled:opacity-40">Post</button>
          </form>
        </div>
      </div>
    </div>
  )
}

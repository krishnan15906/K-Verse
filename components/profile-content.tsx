"use client"

import { useEffect, useRef, useState } from "react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Settings, Grid3x3, Bookmark, UserSquare2, Heart, MessageCircle, X, Eye, EyeOff, Camera, MoreHorizontal, Trash2, ChevronLeft, ChevronRight } from "lucide-react"
import { cn } from "@/lib/utils"
import { API_URL, normalizeImageUrl } from "@/lib/api"
import { CreateStoryModal, StoryViewerModal, type Story } from "./stories-bar"
import { FollowsModal } from "./follows-modal"

type Comment = { id: number; user: string; avatar: string | null; text: string; time: string }
type Post = { id: number; image_url: string; caption: string | null; likes: number; comments: Comment[]; liked: boolean; saved: boolean; time: string; author: string; author_avatar: string | null; location: string | null; carousel_urls?: string[] }
type UserProfile = { id: number; username: string; full_name: string; avatar_url: string | null; bio: string | null; website: string | null; posts_count: number; followers_count: number; following_count: number }

// ── Edit Profile Modal ────────────────────────────────────────────────────────
function EditProfileModal({
  profile,
  onClose,
  onSaved,
  onDeleted,
}: {
  profile: UserProfile
  onClose: () => void
  onSaved: (updated: UserProfile) => void
  onDeleted: () => void
}) {
  const [fullName, setFullName] = useState(profile.full_name)
  const [username, setUsername] = useState(profile.username)
  const [bio, setBio] = useState(profile.bio ?? "")
  const [website, setWebsite] = useState(profile.website ?? "")
  const [avatarUrl, setAvatarUrl] = useState(profile.avatar_url ?? "")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [saving, setSaving] = useState(false)
  const [avatarUploading, setAvatarUploading] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const avatarFileRef = useRef<HTMLInputElement>(null)
  const [theme, setTheme] = useState<"light" | "dark">("dark")
  const [userId, setUserId] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("ig_token")
    let uid: string | null = null
    if (token) {
      try {
        const parts = token.split(".")
        if (parts.length === 3) {
          uid = JSON.parse(atob(parts[1])).sub
        }
      } catch (e) {
        console.error("Failed to decode token:", e)
      }
    }
    setUserId(uid)
    if (uid) {
      const saved = (localStorage.getItem("theme_" + uid) as "light" | "dark") || "dark"
      setTheme(saved)
    }
  }, [])

  function toggleTheme() {
    if (!userId) return
    const nextTheme = theme === "light" ? "dark" : "light"
    setTheme(nextTheme)
    localStorage.setItem("theme_" + userId, nextTheme)
    if (nextTheme === "light") {
      document.documentElement.classList.add("light")
      document.documentElement.classList.remove("dark")
    } else {
      document.documentElement.classList.add("dark")
      document.documentElement.classList.remove("light")
    }
  }

  async function handleAvatarFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    // Show local preview immediately
    const reader = new FileReader()
    reader.onload = (ev) => setAvatarUrl(ev.target?.result as string)
    reader.readAsDataURL(file)
    // Upload to backend
    const token = localStorage.getItem("ig_token") ?? ""
    setAvatarUploading(true)
    setError(null)
    try {
      const form = new FormData()
      form.append("file", file)
      const res = await fetch(`${API_URL}/users/upload-avatar`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body: form,
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail ?? `Upload failed (${res.status})`)
      }
      const { url, profile: updated } = await res.json()
      setAvatarUrl(url)
      // Immediately reflect in parent profile so header updates too
      onSaved(updated)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Avatar upload failed")
    } finally {
      setAvatarUploading(false)
      // Reset so same file can be re-selected
      if (avatarFileRef.current) avatarFileRef.current.value = ""
    }
  }
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = "" }
  }, [onClose])

  async function handleSave(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setSaving(true)

    const token = localStorage.getItem("ig_token") ?? ""
    if (!token) {
      setError("Not logged in — please refresh and log in again.")
      setSaving(false)
      return
    }

    const body: Record<string, string> = {
      full_name: fullName.trim(),
      username: username.trim(),
      bio: bio.trim(),
      website: website.trim(),
      avatar_url: avatarUrl.trim(),
    }
    if (password) body.password = password

    try {
      const res = await fetch(`${API_URL}/users/me`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify(body),
      })

      const responseText = await res.text()

      if (!res.ok) {
        let detail = `Server error ${res.status}`
        try { detail = JSON.parse(responseText)?.detail ?? detail } catch { /* ignore */ }
        throw new Error(detail)
      }

      const updated: UserProfile = JSON.parse(responseText)
      onSaved(updated)
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to save changes")
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete() {
    if (!window.confirm("Delete your account? This cannot be undone.")) return
    setDeleting(true)
    const token = localStorage.getItem("ig_token") ?? ""
    try {
      const res = await fetch(`${API_URL}/users/${profile.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${token}` },
      })
      if (!res.ok && res.status !== 204) throw new Error(`Error ${res.status}`)
      localStorage.removeItem("ig_token")
      onDeleted()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to delete account")
      setDeleting(false)
    }
  }

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="edit-profile-title"
    >
      <div className="relative w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl flex flex-col max-h-[92vh] min-h-0">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-6 py-4">
          <h2 id="edit-profile-title" className="text-base font-semibold text-foreground">Edit profile</h2>
          <button onClick={onClose} className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground" aria-label="Close">
            <X className="size-5" />
          </button>
        </div>

        {/* Scrollable Modal Content */}
        <div className="overflow-y-auto flex-1 min-h-0">
          {/* Avatar — click to change from device */}
          <div className="flex flex-col items-center gap-2 bg-secondary/40 px-6 py-5">
          <button
            type="button"
            onClick={() => avatarFileRef.current?.click()}
            className="group relative"
            aria-label="Change profile photo"
          >
            <div className="brand-gradient rounded-full p-[3px]">
              <div className="rounded-full bg-card p-[3px]">
                <div className="size-20 overflow-hidden rounded-full">
                  <Image
                    src={normalizeImageUrl(avatarUrl, "/placeholder-user.jpg")}
                    alt="Avatar preview"
                    width={80}
                    height={80}
                    className="size-full object-cover"
                    unoptimized
                  />
                </div>
              </div>
            </div>
            {/* Camera overlay */}
            <div className="absolute inset-0 flex items-center justify-center rounded-full bg-foreground/40 opacity-0 transition-opacity group-hover:opacity-100">
              {avatarUploading
                ? <div className="size-5 animate-spin rounded-full border-2 border-background border-t-transparent" />
                : <Camera className="size-5 text-background" />
              }
            </div>
          </button>
          <input
            ref={avatarFileRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarFile}
          />
          <p className="text-xs text-muted-foreground">
            {avatarUploading ? "Uploading…" : "Tap photo to change"}
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSave} className="space-y-4 px-6 py-5">
          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-600 dark:bg-red-950/30">{error}</p>
          )}

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Full name</label>
            <input
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Full name"
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Username</label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Username"
              minLength={3}
              required
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Bio</label>
            <textarea
              value={bio}
              onChange={(e) => setBio(e.target.value)}
              rows={3}
              className="w-full resize-none rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="Tell people about yourself…"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Website</label>
            <input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              className="w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
              placeholder="https://yourwebsite.com"
            />
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">New password</label>
            <div className="relative">
              <input
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                type={showPassword ? "text" : "password"}
                className="w-full rounded-lg border border-border bg-secondary/60 px-3 py-2 pr-10 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                placeholder="Leave blank to keep current"
                minLength={6}
                autoComplete="new-password"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            </div>
          </div>

          <div className="space-y-1">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">Mood / Theme</label>
            <div className="flex items-center justify-between rounded-lg border border-border bg-secondary/60 px-3 py-2">
              <span className="text-sm text-foreground">Change Theme Mode</span>
              <button
                type="button"
                onClick={toggleTheme}
                className="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-foreground hover:opacity-90 transition-opacity"
              >
                {theme === "light" ? "Dark Mode 🌙" : "Light Mode ☀️"}
              </button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center justify-between pt-2">
            <button
              type="button"
              onClick={handleDelete}
              disabled={deleting || saving}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:hover:bg-red-950/30"
            >
              {deleting ? "Deleting…" : "Delete account"}
            </button>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg bg-secondary px-4 py-2 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving || deleting || avatarUploading}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground transition-colors hover:opacity-90 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
            </div>
          </div>
        </form>
        </div>
      </div>
    </div>
  )
}

// ── Profile page ─────────────────────────────────────────────────────────────
export function ProfileContent() {
  const router = useRouter()
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [posts, setPosts] = useState<Post[]>([])
  const [savedPosts, setSavedPosts] = useState<Post[]>([])
  const [activeTab, setActiveTab] = useState<"posts" | "saved">("posts")
  const [activePost, setActivePost] = useState<Post | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [showEditModal, setShowEditModal] = useState(false)
  const [activeStory, setActiveStory] = useState<Story | null>(null)
  const [showCreateStory, setShowCreateStory] = useState(false)
  const [showFollowsModal, setShowFollowsModal] = useState<"followers" | "following" | null>(null)
  const [hasStory, setHasStory] = useState(false)
  const [myStoryData, setMyStoryData] = useState<Story | null>(null)

  async function handleAvatarClick() {
    if (hasStory && myStoryData) {
      setActiveStory(myStoryData)
    } else {
      setShowCreateStory(true)
    }
  }

  useEffect(() => {
    const token = localStorage.getItem("ig_token")
    if (!token) { router.replace("/login"); return }

    fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) { router.replace("/login"); throw new Error("unauth") }
        if (!r.ok) { throw new Error(`Failed to load profile: ${r.status}`) }
        return r.json()
      })
      .then((user: UserProfile) => {
        setProfile(user)
        
        fetch(`${API_URL}/stories/user/${user.username}`, {
          headers: { Authorization: `Bearer ${token}` }
        })
          .then((res) => res.ok ? res.json() : null)
          .then((storyData) => {
            if (storyData) {
              setHasStory(true)
              setMyStoryData(storyData)
            } else {
              setHasStory(false)
              setMyStoryData(null)
            }
          })
          .catch(() => {
            setHasStory(false)
            setMyStoryData(null)
          })

        return fetch(`${API_URL}/profile/${user.username}/posts`, {
          headers: { Authorization: `Bearer ${token}` },
        })
      })
      .then((r) => {
        if (!r.ok) { throw new Error(`Failed to load posts: ${r.status}`) }
        return r.json()
      })
      .then(setPosts)
      .catch((err) => {
        if (err.message !== "unauth") {
          console.error(err)
          setError(err.message)
        }
      })
      .finally(() => setLoading(false))
  }, [router])

  function loadSaved(username: string) {
    const token = localStorage.getItem("ig_token")
    fetch(`${API_URL}/profile/${username}/saved`, {
      headers: { Authorization: `Bearer ${token ?? ""}` },
    })
      .then((r) => {
        if (!r.ok) { throw new Error(`Failed to load saved posts: ${r.status}`) }
        return r.json()
      })
      .then(setSavedPosts)
      .catch((err) => {
        console.error(err)
        setError(err.message)
      })
  }

  function handleTabChange(tab: "posts" | "saved") {
    setActiveTab(tab)
    if (tab === "saved" && savedPosts.length === 0 && profile) loadSaved(profile.username)
  }

  const displayedPosts = activeTab === "posts" ? posts : savedPosts

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
        <p>Unable to load profile.</p>
        <p>{error}</p>
      </div>
    )
  }

  if (!profile) return null

  const followersCount = profile.followers_count ?? 0
  const followingCount = profile.following_count ?? 0

  return (
    <>
      <section className="mx-auto w-full max-w-4xl px-4 pb-24 sm:pb-16 pt-6">
        {/* Header */}
        <header className="flex flex-col items-center gap-6 border-b border-border pb-8 sm:flex-row sm:items-start sm:gap-12 sm:px-6">
          <button
            onClick={handleAvatarClick}
            className={cn(
              "shrink-0 rounded-full p-[3px] focus:outline-none transition-transform active:scale-95 cursor-pointer",
              hasStory ? "brand-gradient" : "bg-secondary/60 hover:bg-secondary border border-border"
            )}
            aria-label={hasStory ? "View story" : "Add to story"}
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

          <div className="flex w-full flex-col items-center gap-4 sm:items-start">
            <div className="flex flex-col items-center gap-3 sm:flex-row sm:gap-4">
              <h1 className="text-xl font-light text-foreground">{profile.username}</h1>
              <div className="flex flex-wrap items-center gap-2">
                <button
                  onClick={() => setShowEditModal(true)}
                  className="rounded-lg bg-secondary px-5 py-1.5 text-sm font-semibold text-secondary-foreground transition-colors hover:bg-muted"
                >
                  Edit profile
                </button>
                <button className="rounded-lg bg-secondary p-2 text-secondary-foreground transition-colors hover:bg-muted" aria-label="Settings">
                  <Settings className="size-4" />
                </button>
              </div>
            </div>

            <ul className="flex items-center gap-8 text-sm">
              <li><span className="font-semibold text-foreground">{profile.posts_count ?? 0}</span> <span className="text-muted-foreground">posts</span></li>
              <li onClick={() => setShowFollowsModal("followers")} className="cursor-pointer hover:opacity-80 transition-opacity"><span className="font-semibold text-foreground">{followersCount.toLocaleString()}</span> <span className="text-muted-foreground">followers</span></li>
              <li onClick={() => setShowFollowsModal("following")} className="cursor-pointer hover:opacity-80 transition-opacity"><span className="font-semibold text-foreground">{followingCount.toLocaleString()}</span> <span className="text-muted-foreground">following</span></li>
            </ul>

            <div className="max-w-md text-center sm:text-left">
              <p className="text-sm font-semibold text-foreground">{profile.full_name}</p>
              {profile.bio && <p className="mt-0.5 whitespace-pre-line text-sm leading-relaxed text-foreground">{profile.bio}</p>}
              {profile.website && <a href="#" className="brand-text mt-0.5 inline-block text-sm font-semibold">{profile.website}</a>}
            </div>
          </div>
        </header>

        {/* Tabs */}
        <nav className="flex items-center justify-center gap-12">
          {(["posts", "saved"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => handleTabChange(tab)}
              className={`flex items-center gap-1.5 py-3 text-xs font-semibold uppercase tracking-widest transition-colors ${
                activeTab === tab ? "-mt-px border-t-2 border-foreground text-foreground" : "text-muted-foreground hover:text-foreground"
              }`}
            >
              {tab === "posts" ? <Grid3x3 className="size-3.5" /> : <Bookmark className="size-3.5" />}
              {tab}
            </button>
          ))}
          <span className="flex items-center gap-1.5 py-3 text-xs font-semibold uppercase tracking-widest text-muted-foreground">
            <UserSquare2 className="size-3.5" /> Tagged
          </span>
        </nav>

        {/* Grid */}
        {displayedPosts.length === 0 ? (
          <p className="py-16 text-center text-sm text-muted-foreground">
            {activeTab === "posts" ? "No posts yet." : "No saved posts yet."}
          </p>
        ) : (
          <div className="grid grid-cols-3 gap-1 sm:gap-2">
            {displayedPosts.map((post) => (
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
          onDelete={(id) => {
            setPosts((prev) => prev.filter((p) => p.id !== id))
            setActivePost(null)
          }}
        />
      )}

      {showEditModal && profile && (
        <EditProfileModal
          profile={profile}
          onClose={() => setShowEditModal(false)}
          onSaved={(updated) => {
            setProfile(updated)
            setShowEditModal(false)
            // Force Next.js to re-fetch server components with the new profile data
            router.refresh()
          }}
          onDeleted={() => { localStorage.removeItem("ig_token"); window.location.href = "/login" }}
        />
      )}

      {showCreateStory && (
        <CreateStoryModal
          onClose={() => setShowCreateStory(false)}
          onCreated={() => {
            if (profile) {
              const token = localStorage.getItem("ig_token") ?? ""
              fetch(`${API_URL}/stories/user/${profile.username}`, {
                headers: { Authorization: `Bearer ${token}` }
              })
                .then((r) => r.ok ? r.json() : null)
                .then((storyData) => {
                  if (storyData) {
                    setHasStory(true)
                    setMyStoryData(storyData)
                  }
                })
                .catch(() => {})
            }
            router.refresh()
          }}
        />
      )}

      {activeStory && (
        <StoryViewerModal
          story={activeStory}
          onClose={() => setActiveStory(null)}
          onDeleted={() => {
            setHasStory(false)
            setMyStoryData(null)
            router.refresh()
          }}
          isOwnStory={true}
        />
      )}

      {showFollowsModal && profile && (
        <FollowsModal
          username={profile.username}
          type={showFollowsModal}
          onClose={() => setShowFollowsModal(null)}
        />
      )}
    </>
  )
}

// ── Post modal ────────────────────────────────────────────────────────────────
function PostModal({ post, onClose, onUpdate, onDelete }: { post: Post; onClose: () => void; onUpdate: (p: Post) => void; onDelete?: (id: number) => void }) {
  const [liked, setLiked] = useState(post.liked)
  const [saved, setSaved] = useState(post.saved)
  const [likeCount, setLikeCount] = useState(post.likes)
  const [comments, setComments] = useState<Comment[]>(post.comments)
  const [draft, setDraft] = useState("")
  const [menuOpen, setMenuOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
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

  // Close 3-dot menu on outside click
  useEffect(() => {
    if (!menuOpen) return
    function onClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false)
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [menuOpen])

  async function handleDeletePost() {
    if (!window.confirm("Delete this post? This cannot be undone.")) return
    setMenuOpen(false)
    setDeleting(true)
    const t = localStorage.getItem("ig_token") ?? ""
    try {
      const res = await fetch(`${API_URL}/posts/${post.id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${t}` },
      })
      if (res.ok || res.status === 204) {
        onDelete?.(post.id)
        onClose()
      }
    } catch (err) { console.error(err) }
    finally { setDeleting(false) }
  }

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
                  <linearGradient id={`brand-grad-profile-${post.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                    <stop offset="0%" stopColor="var(--brand-from)" />
                    <stop offset="50%" stopColor="var(--brand-via)" />
                    <stop offset="100%" stopColor="var(--brand-to)" />
                  </linearGradient>
                </defs>
              </svg>
              <Heart className="size-24 drop-shadow-lg animate-likePop" stroke="none" fill={`url(#brand-grad-profile-${post.id})`} />
            </div>
          )}
        </div>
        <div className="flex w-full flex-col md:w-[45%]">
          <div className="flex items-center gap-3 border-b border-border px-4 py-3">
            <div className="size-8 overflow-hidden rounded-full ring-2 ring-[var(--brand-via)]">
              <Image src={normalizeImageUrl(post.author_avatar, "/placeholder-user.jpg")} alt="" width={32} height={32} className="object-cover" />
            </div>
            <span className="text-sm font-semibold text-foreground">{post.author}</span>
            {/* 3-dot menu */}
            <div ref={menuRef} className="relative ml-auto">
              <button
                onClick={() => setMenuOpen((v) => !v)}
                className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground"
                aria-label="Post options"
                disabled={deleting}
              >
                <MoreHorizontal className="size-5" />
              </button>
              {menuOpen && (
                <div className="absolute right-0 top-8 z-20 min-w-[150px] overflow-hidden rounded-xl border border-border bg-card shadow-lg">
                  <button
                    onClick={handleDeletePost}
                    className="flex w-full items-center gap-2 px-4 py-3 text-sm font-medium text-red-600 transition-colors hover:bg-red-50 dark:hover:bg-red-950/30"
                  >
                    <Trash2 className="size-4" />
                    {deleting ? "Deleting…" : "Delete post"}
                  </button>
                </div>
              )}
            </div>
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

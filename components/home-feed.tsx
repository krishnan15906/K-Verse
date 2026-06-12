"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { FeedCard } from "@/components/feed-card"
import { API_URL, normalizeImageUrl } from "@/lib/api"

type Comment = { id: number; user: string; avatar: string | null; text: string; time: string }
type Post = { id: number; image_url: string; caption: string | null; likes: number; comments: Comment[]; liked: boolean; saved: boolean; time: string; author: string; author_avatar: string | null; location: string | null }

export function HomeFeed() {
  const router = useRouter()
  const [posts, setPosts] = useState<Post[]>([])
  const [loading, setLoading] = useState(true)
  const [currentUsername, setCurrentUsername] = useState<string>("")
  const [currentAvatar, setCurrentAvatar] = useState<string | null>(null)

  useEffect(() => {
    const token = localStorage.getItem("ig_token")
    if (!token) { router.replace("/login"); return }

    Promise.all([
      fetch(`${API_URL}/users/me`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`${API_URL}/posts/feed`, { headers: { Authorization: `Bearer ${token}` } }),
    ])
      .then(async ([meRes, feedRes]) => {
        if (meRes.status === 401 || feedRes.status === 401) {
          router.replace("/login")
          throw new Error("unauth")
        }
        const [me, feed] = await Promise.all([meRes.json(), feedRes.json()])
        setCurrentUsername(me.username)
        setCurrentAvatar(normalizeImageUrl(me.avatar_url, "/placeholder-user.jpg"))
        setPosts(feed)
      })
      .catch((err) => { if (err.message !== "unauth") console.error(err) })
      .finally(() => setLoading(false))
  }, [router])

  if (loading) {
    return (
      <div className="space-y-10">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-96 animate-pulse rounded-2xl bg-card/80" />
        ))}
      </div>
    )
  }

  if (posts.length === 0) {
    return (
      <p className="py-12 text-center text-sm text-muted-foreground">
        No posts yet — follow some people to see their posts here.
      </p>
    )
  }

  return (
    <div className="space-y-10">
      {posts.map((post) => (
        <FeedCard
          key={post.id}
          post={post}
          currentUsername={currentUsername}
          currentAvatar={currentAvatar}
          onUpdate={(updated) => setPosts((prev) => prev.map((p) => (p.id === updated.id ? updated : p)))}
          onDelete={(id) => setPosts((prev) => prev.filter((p) => p.id !== id))}
        />
      ))}
    </div>
  )
}

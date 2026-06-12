"use client"

import { useEffect, useState } from "react"
import Image from "next/image"
import { API_URL, normalizeImageUrl } from "@/lib/api"

type UserProfile = { id: number; username: string; full_name: string; avatar_url: string | null }
type Suggestion = { id: number; user: string; avatar: string | null; note: string }

export function FeedSidebar() {
  const [me, setMe] = useState<UserProfile | null>(null)
  const [suggestions, setSuggestions] = useState<Suggestion[]>([])
  const [followed, setFollowed] = useState<Set<number>>(new Set())

  useEffect(() => {
    const token = localStorage.getItem("ig_token")
    if (!token) return

    // Load logged-in user
    fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem("ig_token")
          window.location.href = "/login"
          return null
        }
        if (!r.ok) return null
        return r.json()
      })
      .then((data) => {
        if (data) setMe(data)
      })
      .catch(() => {
        // Ignore to prevent full-screen Next.js overlay on random dev server network glitches
      })

    // Load suggestions
    fetch(`${API_URL}/users/suggestions/list`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => {
        if (r.status === 401) {
          localStorage.removeItem("ig_token")
          window.location.href = "/login"
          return null
        }
        if (!r.ok) return null
        return r.json()
      })
      .then((data) => {
        if (Array.isArray(data)) setSuggestions(data)
      })
      .catch(() => {
        // Ignore to prevent full-screen Next.js overlay on random dev server network glitches
      })
  }, [])

  async function handleFollow(s: Suggestion) {
    const token = localStorage.getItem("ig_token")
    try {
      await fetch(`${API_URL}/users/${s.user}/follow`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token ?? ""}` },
      })
      setFollowed((prev) => new Set(prev).add(s.id))
    } catch (e) {
      console.error(e)
    }
  }

  return (
    <aside className="hidden w-72 shrink-0 lg:block">
      <div className="sticky top-20 space-y-6">
        {/* current user */}
        {me && (
          <div className="flex items-center gap-3">
            <span className="block size-12 overflow-hidden rounded-full ring-2 ring-[var(--brand-via)]">
              <Image
                src={normalizeImageUrl(me.avatar_url, "/placeholder-user.jpg")}
                alt={me.username}
                width={48}
                height={48}
                className="size-full object-cover"
              />
            </span>
            <div className="leading-tight">
              <p className="text-sm font-semibold text-foreground">{me.username}</p>
              <p className="text-sm text-muted-foreground">{me.full_name}</p>
            </div>
            <button className="brand-text ml-auto text-xs font-semibold">Switch</button>
          </div>
        )}

        {/* suggestions */}
        {suggestions.length > 0 && (
          <div>
            <div className="mb-3 flex items-center justify-between">
              <p className="text-sm font-semibold text-muted-foreground">Suggested for you</p>
              <button className="text-xs font-semibold text-foreground">See all</button>
            </div>
            <ul className="space-y-3">
              {suggestions.map((s) => (
                <li key={s.id} className="flex items-center gap-3">
                  <span className="block size-9 overflow-hidden rounded-full">
                    <Image
                      src={normalizeImageUrl(s.avatar, "/placeholder-user.jpg")}
                      alt={s.user}
                      width={36}
                      height={36}
                      className="size-full object-cover"
                    />
                  </span>
                  <div className="min-w-0 leading-tight">
                    <p className="truncate text-sm font-semibold text-foreground">{s.user}</p>
                    <p className="truncate text-xs text-muted-foreground">{s.note}</p>
                  </div>
                  <button
                    onClick={() => handleFollow(s)}
                    disabled={followed.has(s.id)}
                    className="brand-text ml-auto text-xs font-semibold disabled:opacity-50"
                  >
                    {followed.has(s.id) ? "Following" : "Follow"}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="text-xs leading-relaxed text-muted-foreground">
          About · Help · Press · API · Jobs · Privacy · Terms
          <br />
          {"@ 2026 K-Verse"}
        </p>
      </div>
    </aside>
  )
}

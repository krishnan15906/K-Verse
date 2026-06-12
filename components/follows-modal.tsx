"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { X } from "lucide-react"
import { API_URL, normalizeImageUrl } from "@/lib/api"

type UserBase = {
  id: number
  username: string
  full_name: string
  avatar_url: string | null
}

export function FollowsModal({
  username,
  type,
  onClose,
}: {
  username: string
  type: "followers" | "following"
  onClose: () => void
}) {
  const [users, setUsers] = useState<UserBase[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const overlayRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const token = localStorage.getItem("ig_token")
    if (!token) return

    setLoading(true)
    setError(null)

    fetch(`${API_URL}/users/${username}/${type}`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Error ${res.status}`)
        return res.json()
      })
      .then((data) => {
        setUsers(data)
      })
      .catch((err) => {
        console.error(err)
        setError(`Failed to load ${type}`)
      })
      .finally(() => {
        setLoading(false)
      })
  }, [username, type])

  // Close on Escape key
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => {
      document.removeEventListener("keydown", onKey)
      document.body.style.overflow = ""
    }
  }, [onClose])

  const title = type === "followers" ? "Followers" : "Following"

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === overlayRef.current) onClose()
      }}
      role="dialog"
      aria-modal="true"
    >
      <div className="relative w-full max-w-sm overflow-hidden rounded-2xl bg-card shadow-2xl flex flex-col border border-border max-h-[80vh]">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 bg-muted/40 shrink-0">
          <span className="text-sm font-semibold text-foreground">{title}</span>
          <button
            onClick={onClose}
            className="rounded-full p-1 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground cursor-pointer"
            aria-label="Close"
          >
            <X className="size-4" />
          </button>
        </div>

        {/* Content */}
        <div className="overflow-y-auto flex-1 p-2 space-y-1">
          {loading && (
            <div className="p-8 flex items-center justify-center">
              <div className="size-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          )}

          {!loading && error && (
            <p className="p-4 text-center text-xs text-red-500">{error}</p>
          )}

          {!loading && !error && users.length === 0 && (
            <p className="p-8 text-center text-sm text-muted-foreground">
              No users found.
            </p>
          )}

          {!loading &&
            !error &&
            users.map((u) => (
              <Link
                key={u.id}
                href={`/u/${u.username}`}
                onClick={onClose}
                className="flex items-center gap-3 p-2 rounded-xl hover:bg-secondary/40 transition-colors"
              >
                <div className="relative size-10 overflow-hidden rounded-full border border-border bg-secondary shrink-0">
                  <Image
                    src={normalizeImageUrl(u.avatar_url, "/placeholder-user.jpg")}
                    alt={u.username}
                    width={40}
                    height={40}
                    className="size-full object-cover"
                    unoptimized
                  />
                </div>
                <div className="min-w-0 flex-1 leading-tight">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {u.username}
                  </p>
                  <p className="truncate text-xs text-muted-foreground">
                    {u.full_name}
                  </p>
                </div>
              </Link>
            ))}
        </div>
      </div>
    </div>
  )
}

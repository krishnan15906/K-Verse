"use client"

import type React from "react"
import { useState } from "react"
import Link from "next/link"
import { Eye, EyeOff } from "lucide-react"
import { API_URL, readApiError } from "@/lib/api"
import { FloatingInput } from "@/components/floating-input"

type Fields = { identifier: string; password: string }

export function LoginForm() {
  const [fields, setFields] = useState<Fields>({ identifier: "", password: "" })
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(false)

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const { name, value } = e.target
    setFields((prev) => ({ ...prev, [name]: value }))
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!fields.identifier.trim()) { setError("Username or email is required"); return }
    if (!fields.password) { setError("Password is required"); return }

    setLoading(true)
    setError("")

    try {
      const res = await fetch(`${API_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          identifier: fields.identifier.trim(),
          password: fields.password,
        }),
      })

      if (!res.ok) {
        setError(await readApiError(res, "Login failed"))
        setLoading(false)
        return
      }

      const data = await res.json()
      localStorage.setItem("ig_token", data.access_token)
      window.location.href = "/home"
    } catch {
      setError(`Cannot reach the server at ${API_URL}. Make sure the backend is running.`)
      setLoading(false)
    }
  }

  return (
    <div className="flex w-full max-w-sm flex-col gap-4">
      <div className="flex flex-col items-center rounded-2xl border border-border bg-card/90 px-10 py-10 shadow-xl shadow-foreground/5 backdrop-blur-sm">
        <h1 className="brand-text mb-6 font-serif text-5xl font-extrabold tracking-tight">K-Verse</h1>

        <form onSubmit={handleSubmit} className="flex w-full flex-col gap-2">
          <FloatingInput
            label="Username or email"
            name="identifier"
            type="text"
            autoComplete="username"
            value={fields.identifier}
            onChange={handleChange}
          />
          <div className="relative">
            <FloatingInput
              label="Password"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={fields.password}
              onChange={handleChange}
            />
            {fields.password.length > 0 && (
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                aria-label={showPassword ? "Hide password" : "Show password"}
              >
                {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
              </button>
            )}
          </div>

          {error && (
            <p className="rounded-lg bg-red-50 px-3 py-2 text-xs font-medium text-red-600 dark:bg-red-950 dark:text-red-400">
              ⚠ {error}
            </p>
          )}

          <button
            type="submit"
            disabled={loading}
            className="brand-gradient mt-3 w-full rounded-lg px-4 py-2.5 text-sm font-semibold text-white shadow-md shadow-foreground/10 transition-all hover:brightness-105 active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-60"
          >
            {loading ? "Logging in…" : "Log in"}
          </button>
        </form>

        <a href="#reset" className="mt-5 text-xs font-medium text-muted-foreground hover:text-foreground">
          Forgot password?
        </a>
      </div>

      <div className="rounded-2xl border border-border bg-card/90 px-10 py-5 text-center shadow-lg shadow-foreground/5 backdrop-blur-sm">
        <p className="text-sm text-foreground">
          {"Don't have an account? "}
          <Link href="/" className="brand-text font-semibold hover:opacity-80">Sign up</Link>
        </p>
      </div>
    </div>
  )
}

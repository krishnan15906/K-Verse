import type React from "react"

export function AuthBackground({ children }: { children: React.ReactNode }) {
  return (
    <main className="relative flex min-h-screen items-center justify-center overflow-hidden bg-background px-4 py-10">
      {/* soft brand glow accents */}
      <div
        aria-hidden="true"
        className="brand-gradient pointer-events-none absolute -left-24 -top-24 size-72 rounded-full opacity-20 blur-3xl"
      />
      <div
        aria-hidden="true"
        className="brand-gradient pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full opacity-20 blur-3xl"
      />
      {children}
    </main>
  )
}

export const dynamic = "force-dynamic"

import { ProfileNav } from "@/components/profile-nav"
import { ProfileContent } from "@/components/profile-content"

export default function ProfilePage() {
  return (
    <main className="min-h-screen bg-background">
      <ProfileNav />
      <ProfileContent />
    </main>
  )
}

export const dynamic = "force-dynamic"

import { ProfileNav } from "@/components/profile-nav"
import { PublicProfileContent } from "@/components/public-profile-content"

export default async function UserProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  return (
    <main className="min-h-screen bg-background">
      <ProfileNav />
      <PublicProfileContent username={username} />
    </main>
  )
}

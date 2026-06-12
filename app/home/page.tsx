export const dynamic = "force-dynamic"

import { ProfileNav } from "@/components/profile-nav"
import { StoriesBar } from "@/components/stories-bar"
import { HomeFeed } from "@/components/home-feed"
import { FeedSidebar } from "@/components/feed-sidebar"

export default function HomePage() {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="brand-gradient pointer-events-none absolute -left-24 -top-24 size-72 rounded-full opacity-15 blur-3xl" />
      <div className="brand-gradient pointer-events-none absolute -bottom-24 -right-24 size-72 rounded-full opacity-15 blur-3xl" />
      <ProfileNav />
      <main className="relative mx-auto flex w-full max-w-5xl justify-center gap-10 px-4 pt-6 pb-20 sm:pb-6">
        <div className="w-full max-w-[600px] space-y-8">
          <StoriesBar />
          <HomeFeed />
        </div>
        <FeedSidebar />
      </main>
    </div>
  )
}

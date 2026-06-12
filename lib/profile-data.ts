export type Comment = {
  id: string
  user: string
  avatar: string
  text: string
  time: string
}

export type Post = {
  id: string
  image: string
  caption: string
  likes: number
  time: string
  comments: Comment[]
}

export const profile = {
  username: "maya.rivera",
  name: "Maya Rivera",
  avatar: "/profile/avatar.png",
  posts: 6,
  followers: "12.4k",
  following: 348,
  bio: "Coffee enthusiast & travel lover ✨\nCapturing little moments around the world.\nBerlin · Lisbon · Tokyo",
  website: "mayarivera.co",
}

const commenterAvatar = "/profile/commenter.png"

export const posts: Post[] = [
  {
    id: "1",
    image: "/profile/post-1.png",
    caption: "Slow mornings and good coffee. ☕",
    likes: 1243,
    time: "2h",
    comments: [
      { id: "c1", user: "leo.dev", avatar: commenterAvatar, text: "That latte art is perfect!", time: "1h" },
      { id: "c2", user: "sara.k", avatar: commenterAvatar, text: "Need this right now 😍", time: "45m" },
    ],
  },
  {
    id: "2",
    image: "/profile/post-2.png",
    caption: "Golden hour in the mountains. Worth every step.",
    likes: 3890,
    time: "1d",
    comments: [
      { id: "c3", user: "leo.dev", avatar: commenterAvatar, text: "Incredible view 🔥", time: "20h" },
    ],
  },
  {
    id: "3",
    image: "/profile/post-3.png",
    caption: "New corner of my home. Plants make everything better. 🌿",
    likes: 942,
    time: "2d",
    comments: [
      { id: "c4", user: "sara.k", avatar: commenterAvatar, text: "So cozy!", time: "1d" },
    ],
  },
  {
    id: "4",
    image: "/profile/post-4.png",
    caption: "Brunch done right.",
    likes: 1567,
    time: "3d",
    comments: [
      { id: "c5", user: "leo.dev", avatar: commenterAvatar, text: "Recipe please 🙏", time: "2d" },
    ],
  },
  {
    id: "5",
    image: "/profile/post-5.png",
    caption: "City lights never get old.",
    likes: 2103,
    time: "5d",
    comments: [],
  },
  {
    id: "6",
    image: "/profile/post-6.png",
    caption: "Take me back to this beach. 🌊",
    likes: 4521,
    time: "1w",
    comments: [
      { id: "c6", user: "sara.k", avatar: commenterAvatar, text: "Paradise 🏝️", time: "6d" },
    ],
  },
]

export type Story = {
  id: string
  user: string
  avatar: string
}

export const stories: Story[] = [
  { id: "s0", user: "Your story", avatar: "/profile/avatar.png" },
  { id: "s1", user: "leo.dev", avatar: "/profile/user-2.png" },
  { id: "s2", user: "sara.k", avatar: "/profile/user-1.png" },
  { id: "s3", user: "ana.travels", avatar: "/profile/user-3.png" },
  { id: "s4", user: "mark.shoots", avatar: "/profile/commenter.png" },
  { id: "s5", user: "noah.r", avatar: "/profile/user-2.png" },
  { id: "s6", user: "lia.makes", avatar: "/profile/user-1.png" },
  { id: "s7", user: "the.wander", avatar: "/profile/user-3.png" },
]

export type FeedPost = Post & {
  author: string
  authorAvatar: string
  location?: string
}

export const feedPosts: FeedPost[] = [
  {
    ...posts[1],
    id: "f1",
    author: "ana.travels",
    authorAvatar: "/profile/user-1.png",
    location: "Dolomites, Italy",
  },
  {
    ...posts[3],
    id: "f2",
    author: "leo.dev",
    authorAvatar: "/profile/user-2.png",
    location: "Lisbon, Portugal",
  },
  {
    ...posts[5],
    id: "f3",
    author: "mark.shoots",
    authorAvatar: "/profile/commenter.png",
    location: "Maldives",
  },
  {
    ...posts[4],
    id: "f4",
    author: "the.wander",
    authorAvatar: "/profile/user-3.png",
    location: "Tokyo, Japan",
  },
]

export type Suggestion = {
  id: string
  user: string
  avatar: string
  note: string
}

export const suggestions: Suggestion[] = [
  { id: "g1", user: "leo.dev", avatar: "/profile/user-2.png", note: "Followed by sara.k" },
  { id: "g2", user: "ana.travels", avatar: "/profile/user-1.png", note: "New to Instagram" },
  { id: "g3", user: "mark.shoots", avatar: "/profile/commenter.png", note: "Followed by leo.dev" },
  { id: "g4", user: "lia.makes", avatar: "/profile/user-3.png", note: "Suggested for you" },
  { id: "g5", user: "noah.r", avatar: "/profile/user-2.png", note: "Followed by ana.travels" },
]

export const API_URL = (() => {
  const url = process.env.NEXT_PUBLIC_API_URL

  if (!url) {
    throw new Error("NEXT_PUBLIC_API_URL is missing in environment variables")
  }

  return url.replace(/\/$/, "")
})()
export function normalizeImageUrl(url: string | null | undefined, fallback: string = "/placeholder-user.jpg"): string {
  if (!url) return fallback
  if (url.startsWith("/") || url.startsWith("data:")) return url
  if (url.includes("/uploads/")) {
    const filename = url.substring(url.indexOf("/uploads/") + 9)
    return `${API_URL}/uploads/${filename}`
  }
  return url
}

export async function readApiError(response: Response, fallback: string) {
  try {
    const data = await response.json()
    if (typeof data.detail === "string") return data.detail
    if (data.detail) return JSON.stringify(data.detail)
  } catch {
    // Response was not JSON.
  }

  return fallback
}

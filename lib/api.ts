const DEFAULT_API_URL = "http://127.0.0.1:8000"

export const API_URL = (process.env.NEXT_PUBLIC_API_URL || DEFAULT_API_URL).replace(/\/$/, "")

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

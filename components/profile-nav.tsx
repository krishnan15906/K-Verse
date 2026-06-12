"use client"

import { useEffect, useRef, useState } from "react"
import Link from "next/link"
import Image from "next/image"
import { useRouter } from "next/navigation"
import { Home, Search, LogOut, User, X, Plus, ArrowLeft, Type, Trash2, ZoomIn, Check, ChevronUp, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react"
import Cropper from "react-easy-crop"
import { API_URL, normalizeImageUrl } from "@/lib/api"
import { Bell } from "lucide-react"

type SearchResult = { id: number; user: string; avatar: string | null; note: string }

type TextOverlay = {
  id: string
  text: string
  x: number // percentage 0-100
  y: number // percentage 0-100
  color: string
  fontSize: number
  bg: boolean
  bgColor?: string
}

// ── Canvas Drawing Helper ──────────────────────────────────────────────────
async function generateEditedImage(
  imageSrc: string,
  cropAreaPixels: { x: number; y: number; width: number; height: number },
  textOverlays: TextOverlay[],
  cropAreaWidth: number
): Promise<string> {
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new window.Image()
    img.crossOrigin = "anonymous"
    img.src = imageSrc
    img.onload = () => resolve(img)
    img.onerror = (err) => reject(err)
  })

  const canvas = document.createElement("canvas")
  canvas.width = cropAreaPixels.width
  canvas.height = cropAreaPixels.height
  const ctx = canvas.getContext("2d")
  if (!ctx) throw new Error("Could not get canvas context")

  // Draw cropped region of the original image
  ctx.drawImage(
    image,
    cropAreaPixels.x,
    cropAreaPixels.y,
    cropAreaPixels.width,
    cropAreaPixels.height,
    0,
    0,
    cropAreaPixels.width,
    cropAreaPixels.height
  )

  // Draw text overlays scaled properly to the canvas resolution
  const scale = cropAreaWidth > 0 ? cropAreaPixels.width / cropAreaWidth : 1
  ctx.textAlign = "center"
  ctx.textBaseline = "middle"

  for (const overlay of textOverlays) {
    const scaledFontSize = overlay.fontSize * scale
    ctx.font = `bold ${scaledFontSize}px sans-serif`

    const x = (overlay.x / 100) * cropAreaPixels.width
    const y = (overlay.y / 100) * cropAreaPixels.height

    if (overlay.bg) {
      const metrics = ctx.measureText(overlay.text)
      const textWidth = metrics.width
      const padding = scaledFontSize * 0.25
      const bgWidth = textWidth + padding * 2
      const bgHeight = scaledFontSize + padding * 2
      ctx.fillStyle = overlay.bgColor || "rgba(0, 0, 0, 0.6)"
      ctx.fillRect(x - bgWidth / 2, y - bgHeight / 2, bgWidth, bgHeight)
    }

    ctx.fillStyle = overlay.color
    ctx.fillText(overlay.text, x, y)
  }

  return canvas.toDataURL("image/jpeg", 0.95)
}

// ── Create Post Modal ─────────────────────────────────────────────────────────
// ── Create Post Modal ─────────────────────────────────────────────────────────
function CreatePostModal({
  initialImageUrls = [],
  onClose,
  onCreated,
}: {
  initialImageUrls?: string[]
  onClose: () => void
  onCreated: () => void
}) {
  const [step, setStep] = useState<"select" | "edit" | "details">(initialImageUrls.length > 0 ? "edit" : "select")
  const [imageUrls, setImageUrls] = useState<string[]>(initialImageUrls)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [caption, setCaption] = useState("")
  const [location, setLocation] = useState("")
  const [previews, setPreviews] = useState<string[]>([])
  const [previewIndex, setPreviewIndex] = useState(0)
  const [posting, setPosting] = useState(false)
  const [renderingCanvas, setRenderingCanvas] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // react-easy-crop states (mapped by image index)
  const [crops, setCrops] = useState<{ [key: number]: { x: number; y: number } }>({})
  const [zooms, setZooms] = useState<{ [key: number]: number }>({})
  const [croppedAreaPixelsByImage, setCroppedAreaPixelsByImage] = useState<{
    [key: number]: { x: number; y: number; width: number; height: number } | null
  }>({})
  const [imageDimensions, setImageDimensions] = useState<{ [key: number]: { width: number; height: number } }>({})
  const [imageAspects, setImageAspects] = useState<{ [key: number]: number }>({})

  const [aspectMode, setAspectMode] = useState<"square" | "original" | "custom">("square")
  const [customAspect, setCustomAspect] = useState<number>(1)

  // Overlays mapped by image index: { [key: number]: TextOverlay[] }
  const [textOverlaysByImage, setTextOverlaysByImage] = useState<{ [key: number]: TextOverlay[] }>({})
  const [selectedTextId, setSelectedTextId] = useState<string | null>(null)
  const [dragState, setDragState] = useState<{
    overlayId: string
    startX: number
    startY: number
    startClientX: number
    startClientY: number
  } | null>(null)
  const [cropAreaRect, setCropAreaRect] = useState<{ width: number; height: number; left: number; top: number } | null>(null)

  // User details for Details view
  const [currentUser, setCurrentUser] = useState<{ username: string; avatar_url: string | null } | null>(null)

  const overlayRef = useRef<HTMLDivElement>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const modalAddFileRef = useRef<HTMLInputElement>(null)
  const cropperWrapperRef = useRef<HTMLDivElement>(null)

  const quickColors = ["#ffffff", "#000000", "#e1306c", "#3897f0", "#fdcb58", "#00f5d4", "#7209b7"]

  // Escape key and body lock
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") onClose() }
    document.addEventListener("keydown", onKey)
    document.body.style.overflow = "hidden"
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = "" }
  }, [onClose])

  // Fetch current user info for Details step
  useEffect(() => {
    const token = localStorage.getItem("ig_token")
    if (!token) return
    fetch(`${API_URL}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) {
          setCurrentUser({
            username: data.username,
            avatar_url: data.avatar_url,
          })
        }
      })
      .catch((err) => console.error("Failed to fetch user:", err))
  }, [])

  // Load image dimensions to calculate proper crop fallbacks when unvisited
  useEffect(() => {
    const loadDims = async () => {
      const dims: { [key: number]: { width: number; height: number } } = {}
      const aspects: { [key: number]: number } = {}
      for (let i = 0; i < imageUrls.length; i++) {
        try {
          const img = await new Promise<HTMLImageElement>((resolve, reject) => {
            const img = new window.Image()
            img.src = imageUrls[i]
            img.onload = () => resolve(img)
            img.onerror = reject
          })
          dims[i] = { width: img.naturalWidth, height: img.naturalHeight }
          aspects[i] = img.naturalWidth / img.naturalHeight
        } catch (e) {
          dims[i] = { width: 1000, height: 1000 }
          aspects[i] = 1
        }
      }
      setImageDimensions(dims)
      setImageAspects(aspects)
    }
    if (imageUrls.length > 0) {
      loadDims()
    }
  }, [imageUrls])

  // Helpers for current image crop values
  const crop = crops[currentIndex] || { x: 0, y: 0 }
  const zoom = zooms[currentIndex] || 1
  const textOverlays = textOverlaysByImage[currentIndex] || []

  const setCrop = (val: { x: number; y: number }) => {
    setCrops(prev => ({ ...prev, [currentIndex]: val }))
  }
  const setZoom = (val: number) => {
    setZooms(prev => ({ ...prev, [currentIndex]: val }))
  }
  const setCroppedAreaPixels = (val: { x: number; y: number; width: number; height: number }) => {
    setCroppedAreaPixelsByImage(prev => ({ ...prev, [currentIndex]: val }))
  }

  const firstImageAspect = imageAspects[0] || 1
  const aspect = aspectMode === "square" ? 1 : aspectMode === "original" ? firstImageAspect : customAspect

  // Sync Overlay positioning with react-easy-crop crop-area element
  const updateCropAreaRect = () => {
    if (!cropperWrapperRef.current) return
    const cropArea = cropperWrapperRef.current.querySelector(".react-easy-crop_crop-area")
    if (cropArea) {
      const parentRect = cropperWrapperRef.current.getBoundingClientRect()
      const cropRect = cropArea.getBoundingClientRect()
      setCropAreaRect({
        width: cropRect.width,
        height: cropRect.height,
        left: cropRect.left - parentRect.left,
        top: cropRect.top - parentRect.top,
      })
    }
  }

  // Observe and update crop area coordinates on any layout change
  useEffect(() => {
    if (step !== "edit" || !cropperWrapperRef.current) return
    const wrapper = cropperWrapperRef.current
    const observer = new ResizeObserver(() => {
      updateCropAreaRect()
    })
    observer.observe(wrapper)

    const cropArea = wrapper.querySelector(".react-easy-crop_crop-area")
    if (cropArea) {
      observer.observe(cropArea)
    }

    updateCropAreaRect()
    const t1 = setTimeout(updateCropAreaRect, 100)
    const t2 = setTimeout(updateCropAreaRect, 400)

    return () => {
      observer.disconnect()
      clearTimeout(t1)
      clearTimeout(t2)
    }
  }, [step, aspect, zoom, imageUrls, currentIndex])

  // Drag listeners
  useEffect(() => {
    if (!dragState) return

    const handleMove = (e: MouseEvent | TouchEvent) => {
      const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
      const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

      const dx = clientX - dragState.startClientX
      const dy = clientY - dragState.startClientY

      if (!cropAreaRect) return

      const pctX = dragState.startX + (dx / cropAreaRect.width) * 100
      const pctY = dragState.startY + (dy / cropAreaRect.height) * 100

      const newX = Math.max(0, Math.min(100, pctX))
      const newY = Math.max(0, Math.min(100, pctY))

      setTextOverlaysByImage((prev) => ({
        ...prev,
        [currentIndex]: (prev[currentIndex] || []).map((o) => (o.id === dragState.overlayId ? { ...o, x: newX, y: newY } : o))
      }))
    }

    const handleEnd = () => {
      setDragState(null)
    }

    window.addEventListener("mousemove", handleMove)
    window.addEventListener("mouseup", handleEnd)
    window.addEventListener("touchmove", handleMove, { passive: false })
    window.addEventListener("touchend", handleEnd)

    return () => {
      window.removeEventListener("mousemove", handleMove)
      window.removeEventListener("mouseup", handleEnd)
      window.removeEventListener("touchmove", handleMove)
      window.removeEventListener("touchend", handleEnd)
    }
  }, [dragState, cropAreaRect, currentIndex])

  const handleStartDrag = (e: React.MouseEvent | React.TouchEvent, overlay: TextOverlay) => {
    e.preventDefault()
    e.stopPropagation()
    const clientX = "touches" in e ? e.touches[0].clientX : e.clientX
    const clientY = "touches" in e ? e.touches[0].clientY : e.clientY

    setDragState({
      overlayId: overlay.id,
      startX: overlay.x,
      startY: overlay.y,
      startClientX: clientX,
      startClientY: clientY,
    })
    setSelectedTextId(overlay.id)
  }

  const handleRemoveImage = (idxToRemove: number) => {
    setImageUrls((prev) => {
      const nextUrls = prev.filter((_, i) => i !== idxToRemove)
      if (currentIndex >= nextUrls.length) {
        setCurrentIndex(Math.max(0, nextUrls.length - 1))
      }
      return nextUrls
    })
    const reindexState = <T,>(state: { [key: number]: T }) => {
      const nextState: { [key: number]: T } = {}
      let newIdx = 0
      for (let i = 0; i < imageUrls.length; i++) {
        if (i !== idxToRemove) {
          if (state[i] !== undefined) {
            nextState[newIdx] = state[i]
          }
          newIdx++
        }
      }
      return nextState
    }
    setCrops((prev) => reindexState(prev))
    setZooms((prev) => reindexState(prev))
    setTextOverlaysByImage((prev) => reindexState(prev))
    setCroppedAreaPixelsByImage((prev) => reindexState(prev))
    setImageAspects((prev) => reindexState(prev))
    setImageDimensions((prev) => reindexState(prev))
  }

  const handleModalAddFiles = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const urls: string[] = []
    for (const file of files) {
      const url = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target?.result as string)
        reader.readAsDataURL(file)
      })
      urls.push(url)
    }
    setImageUrls((prev) => [...prev, ...urls])
    e.target.value = ""
  }

  const onMediaLoaded = (mediaSize: { naturalWidth: number; naturalHeight: number }) => {
    const originalAspect = mediaSize.naturalWidth / mediaSize.naturalHeight
    setImageAspects((prev) => ({ ...prev, [currentIndex]: originalAspect }))
  }

  const getCropPixels = (index: number) => {
    if (croppedAreaPixelsByImage[index]) {
      return croppedAreaPixelsByImage[index]!
    }
    const dims = imageDimensions[index] || { width: 1000, height: 1000 }
    const targetAspect = aspect
    const originalAspect = dims.width / dims.height

    let cropWidth = dims.width
    let cropHeight = dims.height
    let cropX = 0
    let cropY = 0

    if (originalAspect > targetAspect) {
      cropHeight = dims.height
      cropWidth = dims.height * targetAspect
      cropX = (dims.width - cropWidth) / 2
    } else {
      cropWidth = dims.width
      cropHeight = dims.width / targetAspect
      cropY = (dims.height - cropHeight) / 2
    }

    return {
      x: Math.round(cropX),
      y: Math.round(cropY),
      width: Math.round(cropWidth),
      height: Math.round(cropHeight),
    }
  }

  const handleAddText = () => {
    const newOverlay: TextOverlay = {
      id: Math.random().toString(),
      text: "Double-click to Edit",
      x: 50,
      y: 50,
      color: "#ffffff",
      fontSize: 20,
      bg: true,
      bgColor: "rgba(0, 0, 0, 0.6)",
    }
    setTextOverlaysByImage((prev) => ({
      ...prev,
      [currentIndex]: [...(prev[currentIndex] || []), newOverlay]
    }))
    setSelectedTextId(newOverlay.id)
  }

  const handleUpdateTextProps = (props: Partial<TextOverlay>) => {
    if (!selectedTextId) return
    setTextOverlaysByImage((prev) => ({
      ...prev,
      [currentIndex]: (prev[currentIndex] || []).map((o) => (o.id === selectedTextId ? { ...o, ...props } : o))
    }))
  }

  const handleDeleteText = () => {
    if (!selectedTextId) return
    setTextOverlaysByImage((prev) => ({
      ...prev,
      [currentIndex]: (prev[currentIndex] || []).filter((o) => o.id !== selectedTextId)
    }))
    setSelectedTextId(null)
  }

  const handleBack = () => {
    if (step === "edit") {
      onClose()
    } else if (step === "details") {
      setStep("edit")
    }
  }

  const handleNext = async () => {
    if (imageUrls.length === 0) return
    setRenderingCanvas(true)
    setError(null)
    try {
      const cropWidth = cropAreaRect?.width ?? 400
      const bakedUrls: string[] = []
      for (let i = 0; i < imageUrls.length; i++) {
        const pixels = getCropPixels(i)
        const overlays = textOverlaysByImage[i] || []
        const baked = await generateEditedImage(imageUrls[i], pixels, overlays, cropWidth)
        bakedUrls.push(baked)
      }
      setPreviews(bakedUrls)
      setPreviewIndex(0)
      setStep("details")
    } catch (err) {
      console.error("Failed to render canvas:", err)
      setError("Failed to generate edited image preview. Please try again.")
    } finally {
      setRenderingCanvas(false)
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (previews.length === 0) { setError("Please provide an image."); return }
    setError(null)
    setPosting(true)
    const token = localStorage.getItem("ig_token") ?? ""
    try {
      const finalCarouselUrls: string[] = []

      // Upload each preview image
      for (let i = 0; i < previews.length; i++) {
        const previewUrl = previews[i]
        if (previewUrl.startsWith("data:")) {
          const blob = await (await fetch(previewUrl)).blob()
          const formData = new FormData()
          formData.append("file", blob, `upload_${i}.jpg`)
          const uploadRes = await fetch(`${API_URL}/posts/upload`, {
            method: "POST",
            headers: { Authorization: `Bearer ${token}` },
            body: formData,
          })
          if (!uploadRes.ok) {
            const d = await uploadRes.json().catch(() => ({}))
            throw new Error(d.detail ?? "Upload failed")
          }
          const { url: uploaded } = await uploadRes.json()
          finalCarouselUrls.push(uploaded)
        } else {
          finalCarouselUrls.push(previewUrl)
        }
      }

      const res = await fetch(`${API_URL}/posts`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({
          image_url: finalCarouselUrls[0],
          caption: caption.trim() || null,
          location: location.trim() || null,
          carousel_urls: finalCarouselUrls,
        }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.detail ?? `Error ${res.status}`)
      }
      onCreated()
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create post")
    } finally {
      setPosting(false)
    }
  }

  // Auto trigger file picker if select screen is shown (simulating direct connection to +icon)
  useEffect(() => {
    if (step === "select" && fileRef.current) {
      fileRef.current.click()
    }
  }, [step])

  const activeTextOverlay = textOverlays.find((o) => o.id === selectedTextId)

  return (
    <div
      ref={overlayRef}
      className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4 backdrop-blur-sm overflow-y-auto"
      onClick={(e) => { if (e.target === overlayRef.current) onClose() }}
      role="dialog"
      aria-modal="true"
      aria-labelledby="create-post-title"
    >
      <div
        className={`w-full overflow-hidden rounded-2xl bg-card shadow-2xl transition-all duration-300 flex flex-col max-h-[92vh] md:max-h-none ${
          step === "select" ? "max-w-md" : step === "edit" ? "max-w-2xl" : "max-w-3xl"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-border px-4 py-3 shrink-0">
          {step !== "select" ? (
            <button
              type="button"
              onClick={handleBack}
              className="flex items-center gap-1 text-sm font-semibold text-foreground hover:opacity-80 transition-opacity"
            >
              <ArrowLeft className="size-4" /> Back
            </button>
          ) : (
            <div className="w-10" />
          )}

          <h2 id="create-post-title" className="text-sm font-bold uppercase tracking-wider text-foreground">
            {step === "select" ? "Create new post" : step === "edit" ? "Edit Photo" : "New Post"}
          </h2>

          {step === "select" ? (
            <button onClick={onClose} className="rounded-full p-1 text-muted-foreground hover:bg-secondary hover:text-foreground" aria-label="Close">
              <X className="size-5" />
            </button>
          ) : step === "edit" ? (
            <button
              type="button"
              onClick={handleNext}
              disabled={renderingCanvas || imageUrls.length === 0}
              className="text-sm font-bold text-blue-500 hover:text-blue-600 disabled:opacity-50 flex items-center gap-1"
            >
              {renderingCanvas ? (
                <span className="size-4 animate-spin rounded-full border border-blue-500 border-t-transparent" />
              ) : (
                "Next"
              )}
            </button>
          ) : (
            <button
              type="button"
              onClick={handleSubmit}
              disabled={posting}
              className="text-sm font-bold text-blue-500 hover:text-blue-600 disabled:opacity-50 flex items-center gap-1"
            >
              {posting ? (
                <span className="size-4 animate-spin rounded-full border border-blue-500 border-t-transparent" />
              ) : (
                "Share"
              )}
            </button>
          )}
        </div>

        {/* Step 1: Select Image */}
        {step === "select" && (
          <div
            onClick={() => fileRef.current?.click()}
            className="flex flex-col items-center justify-center py-12 px-6 text-center space-y-4 cursor-pointer hover:bg-secondary/20 transition-colors"
          >
            <div className="brand-gradient rounded-full p-4 text-background shadow-lg">
              <Plus className="size-10 text-white" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">Click to upload photos</h3>
            <p className="text-xs text-muted-foreground max-w-xs">
              Upload files from your computer to create a post.
            </p>
            <input
              ref={fileRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const files = Array.from(e.target.files || [])
                if (files.length === 0) return
                const urlsPromise = files.map(file => {
                  return new Promise<string>((resolve) => {
                    const reader = new FileReader()
                    reader.onload = (ev) => resolve(ev.target?.result as string)
                    reader.readAsDataURL(file)
                  })
                })
                Promise.all(urlsPromise).then(urls => {
                  setImageUrls(urls)
                  setStep("edit")
                })
              }}
            />
          </div>
        )}

        {/* Step 2: Edit Image */}
        {step === "edit" && imageUrls.length > 0 && imageUrls[currentIndex] && (
          <div className="flex flex-col md:flex-row bg-card flex-1 overflow-y-auto md:overflow-visible">
            {/* Cropper Viewport */}
            <div
              className="relative w-full md:w-[60%] h-[280px] sm:h-[350px] md:h-[450px] bg-black/95 overflow-hidden flex items-center justify-center shrink-0"
              ref={cropperWrapperRef}
              onClick={() => setSelectedTextId(null)}
            >
              <Cropper
                image={imageUrls[currentIndex]}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                onCropChange={setCrop}
                onCropComplete={(croppedArea, croppedAreaPixels) => {
                  setCroppedAreaPixels(croppedAreaPixels)
                  updateCropAreaRect()
                }}
                onZoomChange={setZoom}
                onMediaLoaded={onMediaLoaded}
              />

              {/* Draggable Text Overlays */}
              {cropAreaRect && (
                <div
                  style={{
                    position: "absolute",
                    left: `${cropAreaRect.left}px`,
                    top: `${cropAreaRect.top}px`,
                    width: `${cropAreaRect.width}px`,
                    height: `${cropAreaRect.height}px`,
                    pointerEvents: "none",
                    zIndex: 10,
                  }}
                >
                  {textOverlays.map((overlay) => (
                    <div
                      key={overlay.id}
                      onMouseDown={(e) => handleStartDrag(e, overlay)}
                      onTouchStart={(e) => handleStartDrag(e, overlay)}
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedTextId(overlay.id)
                      }}
                      style={{
                        position: "absolute",
                        left: `${overlay.x}%`,
                        top: `${overlay.y}%`,
                        transform: "translate(-50%, -50%)",
                        pointerEvents: "auto",
                        cursor: "move",
                        color: overlay.color,
                        fontSize: `${overlay.fontSize}px`,
                        fontWeight: "bold",
                        padding: "4px 8px",
                        borderRadius: "4px",
                        backgroundColor: overlay.bg ? (overlay.bgColor || "rgba(0,0,0,0.6)") : "transparent",
                        border: selectedTextId === overlay.id ? "1.5px dashed var(--primary)" : "1px solid transparent",
                        whiteSpace: "nowrap",
                        userSelect: "none",
                        touchAction: "none",
                      }}
                    >
                      {overlay.text}
                    </div>
                  ))}
                </div>
              )}

              {/* Thumbnail List overlay at the bottom */}
              <div className="absolute bottom-3 left-3 right-3 z-20 flex items-center gap-2 overflow-x-auto bg-black/60 backdrop-blur-md p-2 rounded-xl">
                {imageUrls.map((url, idx) => (
                  <div
                    key={idx}
                    onClick={(e) => {
                      e.stopPropagation()
                      setCurrentIndex(idx)
                    }}
                    className={`relative size-12 rounded-lg overflow-hidden border-2 cursor-pointer shrink-0 transition-all ${
                      currentIndex === idx ? "border-blue-500 scale-105" : "border-transparent opacity-70 hover:opacity-100"
                    }`}
                  >
                    <img src={url} alt={`Thumbnail ${idx}`} className="size-full object-cover" />
                    {imageUrls.length > 1 && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation()
                          handleRemoveImage(idx)
                        }}
                        className="absolute top-0.5 right-0.5 bg-red-500 hover:bg-red-650 text-white rounded-full p-0.5 shadow transition-colors"
                        title="Remove image"
                      >
                        <X className="size-2.5" />
                      </button>
                    )}
                  </div>
                ))}
                
                {/* Add Image Button */}
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    modalAddFileRef.current?.click()
                  }}
                  className="size-12 rounded-lg border-2 border-dashed border-white/40 flex items-center justify-center bg-white/10 hover:bg-white/20 transition-all text-white/80 hover:text-white shrink-0 cursor-pointer"
                  title="Add more photos"
                >
                  <Plus className="size-5" />
                </button>
                <input
                  ref={modalAddFileRef}
                  type="file"
                  multiple
                  accept="image/*"
                  className="hidden"
                  onChange={handleModalAddFiles}
                />
              </div>
            </div>

            {/* Controls Panel */}
            <div className="w-full md:w-[40%] p-5 flex flex-col justify-between border-t md:border-t-0 md:border-l border-border md:h-[450px] overflow-y-auto">
              <div className="space-y-4">
                {/* Aspect Ratio */}
                <div className="space-y-2">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Aspect Ratio</label>
                  <div className="grid grid-cols-3 gap-2">
                    <button
                      type="button"
                      onClick={() => setAspectMode("square")}
                      className={`rounded-lg py-2 text-[11px] font-medium border transition-colors cursor-pointer ${
                        aspectMode === "square"
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "bg-secondary/40 text-foreground border-border hover:bg-secondary"
                      }`}
                    >
                      Square 1:1
                    </button>
                    <button
                      type="button"
                      onClick={() => setAspectMode("original")}
                      className={`rounded-lg py-2 text-[11px] font-medium border transition-colors cursor-pointer ${
                        aspectMode === "original"
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "bg-secondary/40 text-foreground border-border hover:bg-secondary"
                      }`}
                    >
                      Original
                    </button>
                    <button
                      type="button"
                      onClick={() => setAspectMode("custom")}
                      className={`rounded-lg py-2 text-[11px] font-medium border transition-colors cursor-pointer ${
                        aspectMode === "custom"
                          ? "bg-primary text-primary-foreground border-primary font-semibold"
                          : "bg-secondary/40 text-foreground border-border hover:bg-secondary"
                      }`}
                    >
                      Custom
                    </button>
                  </div>

                  {aspectMode === "custom" && (
                    <div className="space-y-1.5 pt-1 border border-border/40 rounded-xl p-2.5 bg-secondary/10">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Ratio Slider</label>
                        <span className="text-xs font-semibold text-foreground">{customAspect.toFixed(2)}</span>
                      </div>
                      <input
                        type="range"
                        min={0.5}
                        max={2.0}
                        step={0.05}
                        value={customAspect}
                        onChange={(e) => setCustomAspect(Number(e.target.value))}
                        className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                      />
                      <div className="flex justify-between text-[8px] text-muted-foreground font-bold leading-none">
                        <span>PORTRAIT (0.5)</span>
                        <span>SQUARE (1.0)</span>
                        <span>LANDSCAPE (2.0)</span>
                      </div>
                    </div>
                  )}
                </div>

                {/* Zoom */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Zoom</label>
                    <span className="text-xs font-semibold text-foreground">{zoom.toFixed(1)}x</span>
                  </div>
                  <div className="flex items-center gap-3">
                    <ZoomIn className="size-4 text-muted-foreground" />
                    <input
                      type="range"
                      min={1}
                      max={3}
                      step={0.1}
                      value={zoom}
                      onChange={(e) => setZoom(Number(e.target.value))}
                      className="flex-1 accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                    />
                  </div>
                </div>

                {/* Overlay Action */}
                <div className="pt-1">
                  <button
                    type="button"
                    onClick={handleAddText}
                    className="w-full flex items-center justify-center gap-2 rounded-lg bg-secondary py-2 text-xs font-semibold text-foreground border border-border hover:bg-muted transition-colors cursor-pointer"
                  >
                    <Type className="size-4" /> Add Text Overlay
                  </button>
                </div>

                {/* Editor settings for selected overlay */}
                {selectedTextId && activeTextOverlay ? (
                  <div className="rounded-xl border border-border bg-secondary/20 p-3 space-y-3">
                    <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                      <span className="text-xs font-bold uppercase tracking-wider text-foreground">Edit Text Overlay</span>
                      <button
                        type="button"
                        onClick={handleDeleteText}
                        className="text-red-500 hover:text-red-650 p-1 rounded-full hover:bg-secondary/50 transition-colors cursor-pointer"
                        title="Delete overlay"
                      >
                        <Trash2 className="size-4" />
                      </button>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Text</label>
                      <input
                        type="text"
                        value={activeTextOverlay.text}
                        onChange={(e) => handleUpdateTextProps({ text: e.target.value })}
                        className="w-full rounded-lg border border-border bg-secondary/50 px-2.5 py-1.5 text-sm text-foreground focus:border-ring focus:outline-none"
                        placeholder="Double-click to Edit"
                        autoFocus
                      />
                    </div>

                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-[10px] font-bold uppercase text-muted-foreground">Font Size</label>
                        <span className="text-xs font-semibold text-foreground">{activeTextOverlay.fontSize}px</span>
                      </div>
                      <input
                        type="range"
                        min={12}
                        max={48}
                        value={activeTextOverlay.fontSize}
                        onChange={(e) => handleUpdateTextProps({ fontSize: Number(e.target.value) })}
                        className="w-full accent-primary h-1 bg-secondary rounded-lg appearance-none cursor-pointer"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-bold uppercase text-muted-foreground">Text Color</label>
                      <div className="flex flex-wrap gap-1.5">
                        {quickColors.map((color) => (
                          <button
                            key={color}
                            type="button"
                            onClick={() => handleUpdateTextProps({ color })}
                            className={`size-6 rounded-full border shadow-sm transition-transform cursor-pointer ${
                              activeTextOverlay.color === color ? "scale-110 ring-2 ring-primary" : "hover:scale-105"
                            }`}
                            style={{ backgroundColor: color, borderColor: color === "#ffffff" ? "#ccc" : color }}
                          />
                        ))}
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-1">
                      <span className="text-xs font-semibold text-muted-foreground">Background Box</span>
                      <button
                        type="button"
                        onClick={() => handleUpdateTextProps({ bg: !activeTextOverlay.bg })}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition-all border cursor-pointer ${
                          activeTextOverlay.bg
                            ? "bg-primary text-primary-foreground border-primary"
                            : "bg-secondary text-foreground border-border hover:bg-muted"
                        }`}
                      >
                        {activeTextOverlay.bg ? "ON" : "OFF"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="text-center py-4 text-xs text-muted-foreground border border-dashed border-border rounded-xl">
                    Tap on a text overlay or add a new one to customize styles
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Step 3: Details & Preview */}
        {step === "details" && previews.length > 0 && (
          <div className="flex flex-col md:flex-row bg-card flex-1 overflow-y-auto md:overflow-visible md:h-[500px]">
            {/* Left preview (merged image carousel) */}
            <div className="relative aspect-square w-full md:w-[50%] bg-black/95 flex items-center justify-center md:border-r border-border overflow-hidden group shrink-0">
              <Image
                src={normalizeImageUrl(previews[previewIndex], "/placeholder.svg")}
                alt="Final Preview"
                fill
                className="object-contain"
                unoptimized
              />
              
              {/* Left/Right Navigation Arrows */}
              {previews.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() => setPreviewIndex((prev) => (prev > 0 ? prev - 1 : previews.length - 1))}
                    className="absolute left-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors cursor-pointer"
                  >
                    <ChevronLeft className="size-5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setPreviewIndex((prev) => (prev < previews.length - 1 ? prev + 1 : 0))}
                    className="absolute right-2 top-1/2 -translate-y-1/2 bg-black/50 hover:bg-black/80 text-white rounded-full p-1.5 transition-colors cursor-pointer"
                  >
                    <ChevronRight className="size-5" />
                  </button>
                  
                  {/* Dot Indicators */}
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/40 px-2 py-1 rounded-full">
                    {previews.map((_, idx) => (
                      <div
                        key={idx}
                        className={`size-1.5 rounded-full transition-all ${
                          previewIndex === idx ? "bg-white scale-125" : "bg-white/40"
                        }`}
                      />
                    ))}
                  </div>
                </>
              )}
            </div>

            {/* Right form info */}
            <div className="w-full md:w-[50%] p-6 flex flex-col justify-between overflow-y-auto space-y-4">
              <div className="space-y-4">
                {currentUser && (
                  <div className="flex items-center gap-3">
                    <div className="size-8 overflow-hidden rounded-full border border-border">
                      <Image
                        src={normalizeImageUrl(currentUser.avatar_url, "/placeholder-user.jpg")}
                        alt="Avatar"
                        width={32}
                        height={32}
                        className="size-full object-cover"
                        unoptimized
                      />
                    </div>
                    <span className="text-sm font-semibold text-foreground">{currentUser.username}</span>
                  </div>
                )}

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Caption</label>
                  <textarea
                    value={caption}
                    onChange={(e) => setCaption(e.target.value)}
                    rows={4}
                    placeholder="Write a caption..."
                    className="w-full resize-none rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Location</label>
                  <input
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder="Add location (optional)"
                    className="w-full rounded-lg border border-border bg-secondary/40 px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:border-ring focus:outline-none focus:ring-1 focus:ring-ring"
                  />
                </div>
              </div>

              {error && (
                <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-650 dark:bg-red-950/30">{error}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Nav ───────────────────────────────────────────────────────────────────────
export function ProfileNav() {
  const router = useRouter()
  const [searchOpen, setSearchOpen] = useState(false)
  const [createOpen, setCreateOpen] = useState(false)
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const overlayRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const unreadCount = notifications.filter((n: any) => !n.is_read).length
  const notificationRef = useRef<HTMLDivElement>(null)

  const navFileRef = useRef<HTMLInputElement>(null)
  const [navImageUrls, setNavImageUrls] = useState<string[]>([])

  const handleNavFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    if (files.length === 0) return
    const urls: string[] = []
    for (const file of files) {
      const url = await new Promise<string>((resolve) => {
        const reader = new FileReader()
        reader.onload = (ev) => resolve(ev.target?.result as string)
        reader.readAsDataURL(file)
      })
      urls.push(url)
    }
    setNavImageUrls(urls)
    setCreateOpen(true)
    e.target.value = ""
  }

  useEffect(() => {
    if (!notificationOpen) return
    function onClickOutside(e: MouseEvent) {
      if (notificationRef.current && !notificationRef.current.contains(e.target as Node)) {
        setNotificationOpen(false)
      }
    }
    document.addEventListener("mousedown", onClickOutside)
    return () => document.removeEventListener("mousedown", onClickOutside)
  }, [notificationOpen])

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => inputRef.current?.focus(), 50)
    } else {
      setQuery("")
      setResults([])
    }
  }, [searchOpen])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === "Escape") setSearchOpen(false) }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    const q = query.trim()
    if (!q) { setResults([]); return }
    debounceRef.current = setTimeout(async () => {
      const token = localStorage.getItem("ig_token") ?? ""
      setSearching(true)
      try {
        const res = await fetch(`${API_URL}/users/search?q=${encodeURIComponent(q)}&limit=8`, {
          headers: { Authorization: `Bearer ${token}` },
        })
        if (res.ok) setResults(await res.json())
      } catch { /* ignore */ } finally {
        setSearching(false)
      }
    }, 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query])
  useEffect(() => {
    const token = localStorage.getItem("ig_token")

    fetch(`${API_URL}/notifications`, {
      headers: {
        Authorization: `Bearer ${token}`,
      },
    })
      .then((res) => res.json())
      .then((data) => setNotifications(data))
      .catch(console.error)
  }, [])

  async function toggleNotifications() {
    const nextOpen = !notificationOpen
    setNotificationOpen(nextOpen)
    if (nextOpen && unreadCount > 0) {
      const token = localStorage.getItem("ig_token")
      try {
        await fetch(`${API_URL}/notifications/read`, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${token}`,
          },
        })
        setNotifications((prev: any) =>
          prev.map((n: any) => ({ ...n, is_read: true }))
        )
      } catch (err) {
        console.error("Failed to mark notifications as read:", err)
      }
    }
  }

  function handleLogout() {
    localStorage.removeItem("ig_token")
    window.location.href = "/login"
  }

  function goToUser(username: string) {
    setSearchOpen(false)
    router.push(`/u/${username}`)
  }

  return (
    <>
      <header className="sticky top-0 z-40 border-b border-border bg-card/80 backdrop-blur-md">
        <div className="mx-auto flex h-14 w-full max-w-4xl items-center justify-between px-4">
          <span className="brand-text font-serif text-2xl font-extrabold tracking-tight select-none">
            K-Verse
          </span>
 
          {/* Top Bar Nav Icons */}
          <div className="flex items-center gap-4 text-foreground">
            {/* Desktop-only Nav Icons (Part 1) */}
            <div className="hidden sm:flex items-center gap-5">
              <Link href="/home" aria-label="Home" className="transition-colors hover:text-[var(--brand-via)]">
                <Home className="size-6" />
              </Link>
              <button
                onClick={() => setSearchOpen(true)}
                aria-label="Search"
                className="transition-colors hover:text-[var(--brand-via)] cursor-pointer"
              >
                <Search className="size-6" />
              </button>
            </div>

            {/* Notification Bell (Always in top header) */}
            <div ref={notificationRef} className="relative">
              <button
                onClick={toggleNotifications}
                className="flex items-center justify-center transition-colors hover:text-[var(--brand-via)] relative cursor-pointer"
                aria-label="Notifications"
              >
                <Bell className="size-6" />
                {unreadCount > 0 && (
                  <span className="absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-red-500 text-[10px] font-bold text-white">
                    {unreadCount > 99 ? "99+" : unreadCount}
                  </span>
                )}
              </button>
              {notificationOpen && (
                <div className="absolute right-0 mt-2 w-[88vw] sm:w-80 max-w-[340px] rounded-xl border border-border bg-card shadow-lg z-50 overflow-hidden flex flex-col">
                  <div className="border-b border-border/60 px-4 py-2.5 flex items-center justify-between bg-muted/40 shrink-0">
                    <span className="text-sm font-semibold text-foreground">Notifications</span>
                  </div>
                  <div className="max-h-80 overflow-y-auto">
                    {notifications.length === 0 ? (
                      <p className="p-4 text-center text-sm text-muted-foreground">
                        No notifications yet.
                      </p>
                    ) : (
                      notifications.map((n: any) => (
                        <div key={n.id} className="flex items-center justify-between gap-3 border-b border-border/40 p-3 hover:bg-secondary/40 transition-colors">
                          <div className="flex items-center gap-3 min-w-0 flex-1">
                            <Link href={`/u/${n.actor_username}`} className="shrink-0" onClick={() => setNotificationOpen(false)}>
                              <div className="relative size-8 overflow-hidden rounded-full border border-border bg-secondary">
                                <Image
                                  src={normalizeImageUrl(n.actor_avatar, "/placeholder-user.jpg")}
                                  alt={n.actor_username || "User avatar"}
                                  width={32}
                                  height={32}
                                  className="size-full object-cover"
                                  unoptimized
                                />
                              </div>
                            </Link>
                            <div className="min-w-0 flex-1 text-xs leading-snug">
                              <Link href={`/u/${n.actor_username}`} className="font-semibold hover:underline text-foreground" onClick={() => setNotificationOpen(false)}>
                                {n.actor_username}
                              </Link>{" "}
                              <span className="text-muted-foreground">
                                {n.type === "like" && "liked your photo."}
                                {n.type === "comment" && "commented on your post."}
                                {n.type === "follow" && "started following you."}
                                {n.type === "save" && "saved your post."}
                              </span>
                              <span className="ml-1 text-[10px] text-muted-foreground whitespace-nowrap">
                                {n.time || "now"}
                              </span>
                            </div>
                          </div>

                          {/* Right preview/follow link */}
                          {n.post_image_url && (
                            <Link href="/profile" className="shrink-0 shadow-sm" onClick={() => setNotificationOpen(false)}>
                              <div className="relative size-8 overflow-hidden rounded bg-secondary border border-border">
                                <Image
                                  src={normalizeImageUrl(n.post_image_url, "/placeholder.svg")}
                                  alt="Post preview"
                                  width={32}
                                  height={32}
                                  className="size-full object-cover"
                                  unoptimized
                                />
                              </div>
                            </Link>
                          )}
                        </div>
                      ))
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Desktop-only Nav Icons (Part 2) */}
            <div className="hidden sm:flex items-center gap-5">
              {/* Create post */}
              <button
                onClick={() => navFileRef.current?.click()}
                aria-label="Create post"
                className="transition-colors hover:text-[var(--brand-via)] cursor-pointer"
              >
                <Plus className="size-6" />
              </button>
              <Link href="/profile" aria-label="My profile" className="transition-colors hover:text-[var(--brand-via)]">
                <User className="size-6" />
              </Link>
              <button onClick={handleLogout} aria-label="Log out" className="transition-colors hover:text-[var(--brand-via)] cursor-pointer">
                <LogOut className="size-6" />
              </button>
            </div>
            
            <input
              ref={navFileRef}
              type="file"
              multiple
              accept="image/*"
              className="hidden"
              onChange={handleNavFile}
            />
          </div>
        </div>
      </header>

      {/* Fixed Bottom Navigation Bar for Mobile View */}
      <nav className="fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-border bg-card/85 backdrop-blur-md px-6 text-foreground sm:hidden">
        <Link href="/home" aria-label="Home" className="transition-colors hover:text-[var(--brand-via)]">
          <Home className="size-6" />
        </Link>
        <button
          onClick={() => setSearchOpen(true)}
          aria-label="Search"
          className="transition-colors hover:text-[var(--brand-via)] cursor-pointer"
        >
          <Search className="size-6" />
        </button>
        <button
          onClick={() => navFileRef.current?.click()}
          aria-label="Create post"
          className="transition-colors hover:text-[var(--brand-via)] cursor-pointer"
        >
          <Plus className="size-6" />
        </button>
        <Link href="/profile" aria-label="My profile" className="transition-colors hover:text-[var(--brand-via)]">
          <User className="size-6" />
        </Link>
        <button onClick={handleLogout} aria-label="Log out" className="transition-colors hover:text-[var(--brand-via)] cursor-pointer">
          <LogOut className="size-6" />
        </button>
      </nav>

      {/* Search overlay */}
      {searchOpen && (
        <div
          ref={overlayRef}
          className="fixed inset-0 z-50 flex items-start justify-center bg-foreground/50 pt-20 backdrop-blur-sm px-4"
          onClick={(e) => { if (e.target === overlayRef.current) setSearchOpen(false) }}
        >
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-card shadow-2xl">
            <div className="flex items-center gap-3 border-b border-border px-4 py-3">
              <Search className="size-5 shrink-0 text-muted-foreground" />
              <input
                ref={inputRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username…"
                className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
              {query && (
                <button onClick={() => setQuery("")} className="text-muted-foreground hover:text-foreground">
                  <X className="size-4" />
                </button>
              )}
              <button
                onClick={() => setSearchOpen(false)}
                className="ml-1 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                Cancel
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto">
              {searching && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">Searching…</p>
              )}
              {!searching && query.trim() && results.length === 0 && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  No users found for &ldquo;{query}&rdquo;
                </p>
              )}
              {!searching && !query.trim() && (
                <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                  Type a username to search
                </p>
              )}
              {results.map((r) => (
                <button
                  key={r.id}
                  onClick={() => goToUser(r.user)}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-secondary"
                >
                  <div className="size-10 shrink-0 overflow-hidden rounded-full bg-secondary">
                    <Image
                      src={normalizeImageUrl(r.avatar, "/placeholder-user.jpg")}
                      alt={r.user}
                      width={40}
                      height={40}
                      className="size-full object-cover"
                    />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">{r.user}</p>
                    <p className="truncate text-xs text-muted-foreground">{r.note}</p>
                  </div>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Create post modal */}
      {createOpen && (
        <CreatePostModal
          initialImageUrls={navImageUrls}
          onClose={() => {
            setCreateOpen(false)
            setNavImageUrls([])
          }}
          onCreated={() => {
            // Hard navigate to profile so it remounts and re-fetches the new post
            window.location.href = "/profile"
          }}
        />
      )}
    </>
  )
}

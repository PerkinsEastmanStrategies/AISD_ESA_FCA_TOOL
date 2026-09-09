"use client"

import { useMemo, useState } from "react"
import { Check, Images, Search } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import type { LivelyPicture } from "@/lib/lively-pictures"

type PhotoFilter = "all" | "Facility" | "Asset" | "selected"

interface ReportPhotoPickerProps {
  photos: LivelyPicture[]
  selectedIds: string[]
  recommendedIds: string[]
  onChange: (ids: string[]) => void
  maxPhotos?: number
}

export function ReportPhotoPicker({
  photos,
  selectedIds,
  recommendedIds,
  onChange,
  maxPhotos = 20,
}: ReportPhotoPickerProps) {
  const [open, setOpen] = useState(false)
  const [hasOpened, setHasOpened] = useState(false)
  const [filter, setFilter] = useState<PhotoFilter>("all")
  const [query, setQuery] = useState("")
  const selected = useMemo(() => new Set(selectedIds), [selectedIds])

  const visiblePhotos = useMemo(() => {
    const normalizedQuery = query.trim().toLowerCase()
    return photos.filter((photo) => {
      if (filter === "selected" && !selected.has(photo.id)) return false
      if (filter !== "all" && filter !== "selected" && photo.parentType !== filter) return false
      if (!normalizedQuery) return true
      return `${photo.photoName} ${photo.parentName} ${photo.parentType}`
        .toLowerCase()
        .includes(normalizedQuery)
    })
  }, [filter, photos, query, selected])
  const displayedPhotos = visiblePhotos.slice(0, 120)

  function togglePhoto(id: string) {
    if (selected.has(id)) {
      onChange(selectedIds.filter((selectedId) => selectedId !== id))
      return
    }
    if (selectedIds.length < maxPhotos) onChange([...selectedIds, id])
  }

  function openPicker() {
    if (!hasOpened && selectedIds.length === 0) {
      onChange(recommendedIds.slice(0, maxPhotos))
    }
    setHasOpened(true)
    setOpen(true)
  }

  return (
    <>
      <Button type="button" variant="outline" onClick={openPicker} className="gap-1.5">
        <Images className="size-4" aria-hidden="true" />
        Choose photos
        {selectedIds.length > 0 ? ` (${selectedIds.length})` : ""}
      </Button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[90vh] max-w-[min(1100px,calc(100%-2rem))] grid-rows-none flex-col p-0">
          <DialogHeader className="px-5 pt-5 pr-12">
            <DialogTitle>Choose report photos</DialogTitle>
            <DialogDescription>
              Select up to {maxPhotos} photos. They will appear in this order as labeled tiles at the end of the
              report.
            </DialogDescription>
          </DialogHeader>

          <div className="flex flex-col gap-3 px-5">
            <div className="flex flex-wrap items-center gap-2">
              <div className="relative min-w-56 flex-1">
                <Search
                  className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
                  aria-hidden="true"
                />
                <Input
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Search by photo or location"
                  className="pl-8"
                />
              </div>
              {(["all", "Facility", "Asset", "selected"] as const).map((option) => (
                <Button
                  key={option}
                  type="button"
                  variant={filter === option ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(option)}
                >
                  {option === "all" ? "All" : option === "selected" ? `Selected (${selectedIds.length})` : option}
                </Button>
              ))}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-muted-foreground">
              <span>
                {selectedIds.length} of {maxPhotos} selected
                {selectedIds.length === maxPhotos ? " — remove a photo to choose another" : ""}
                {visiblePhotos.length > displayedPhotos.length
                  ? ` · Showing the first ${displayedPhotos.length}; search to narrow ${visiblePhotos.length} results`
                  : ""}
              </span>
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => onChange(recommendedIds.slice(0, maxPhotos))}
                >
                  Select 10 recommended
                </Button>
                <Button type="button" variant="ghost" size="sm" onClick={() => onChange([])}>
                  Clear
                </Button>
              </div>
            </div>
          </div>

          <div className="min-h-0 flex-1 overflow-y-auto border-y border-border px-5 py-4">
            {visiblePhotos.length > 0 ? (
              <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
                {displayedPhotos.map((photo) => {
                  const isSelected = selected.has(photo.id)
                  const atLimit = selectedIds.length >= maxPhotos && !isSelected
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      aria-pressed={isSelected}
                      disabled={atLimit}
                      onClick={() => togglePhoto(photo.id)}
                      className={`group relative overflow-hidden rounded-lg border text-left transition ${
                        isSelected
                          ? "border-primary ring-2 ring-primary/30"
                          : "border-border hover:border-primary/60 disabled:cursor-not-allowed disabled:opacity-45"
                      }`}
                    >
                      <img
                        src={photo.url}
                        alt=""
                        className="h-32 w-full bg-muted object-cover"
                        loading="lazy"
                      />
                      <span
                        className={`absolute right-2 top-2 flex size-6 items-center justify-center rounded-full border ${
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-white/80 bg-background/80 text-transparent"
                        }`}
                        aria-hidden="true"
                      >
                        <Check className="size-3.5" />
                      </span>
                      <span className="block p-2.5">
                        <span className="block truncate text-xs font-semibold text-foreground">{photo.photoName}</span>
                        <span className="mt-0.5 block truncate text-[10px] text-muted-foreground">
                          {photo.parentType} · {photo.parentName}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            ) : (
              <div className="flex min-h-48 items-center justify-center text-sm text-muted-foreground">
                No photos match this filter.
              </div>
            )}
          </div>

          <DialogFooter className="mx-0 mb-0 px-5">
            <Button type="button" onClick={() => setOpen(false)}>
              Done — use {selectedIds.length} photo{selectedIds.length === 1 ? "" : "s"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

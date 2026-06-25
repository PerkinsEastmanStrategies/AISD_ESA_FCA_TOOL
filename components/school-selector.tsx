"use client"

import { useState } from "react"
import { AlertTriangle, School2 } from "lucide-react"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { schools, DEMO_SCHOOL_ID } from "@/lib/schools-list"

interface SchoolSelectorProps {
  value: string | null
  onChange: (id: string) => void
  className?: string
  /** Emphasize the control when no school is selected yet. */
  highlighted?: boolean
}

export function SchoolSelector({ value, onChange, className, highlighted = false }: SchoolSelectorProps) {
  const [pendingId, setPendingId] = useState<string | null>(null)
  const pendingSchool = pendingId ? schools.find((s) => s.id === pendingId) : null

  function handleChange(next: string) {
    if (!next || next === value) return
    if (next !== DEMO_SCHOOL_ID) {
      setPendingId(next)
      return
    }
    onChange(next)
  }

  function confirmChange() {
    if (pendingId) {
      onChange(pendingId)
      setPendingId(null)
    }
  }

  return (
    <>
      <div
        data-guide="school-selector"
        className={`flex flex-col gap-1 rounded-lg border px-2.5 py-2 transition-colors ${
          highlighted
            ? "border-primary bg-primary/10 shadow-sm ring-2 ring-primary/25"
            : "border-border bg-muted/40"
        } ${className ?? ""}`}
      >
        <div className="flex items-center gap-1.5">
          <School2
            className={`size-3.5 shrink-0 ${highlighted ? "text-primary" : "text-muted-foreground"}`}
            aria-hidden="true"
          />
          <label
            htmlFor="app-school-select"
            className={`text-xs font-semibold uppercase tracking-wide ${
              highlighted ? "text-primary" : "text-muted-foreground"
            }`}
          >
            {highlighted ? "Select a school to begin" : "School"}
          </label>
        </div>
        <Select value={value ?? ""} onValueChange={handleChange}>
          <SelectTrigger
            id="app-school-select"
            className={`h-9 w-[min(100vw-12rem,280px)] ${
              highlighted ? "border-primary/40 bg-background font-medium" : "bg-background"
            }`}
          >
            <SelectValue placeholder="Choose a school…" />
          </SelectTrigger>
          <SelectContent>
            {schools.map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {s.name}
                {s.id === DEMO_SCHOOL_ID ? " (recommended)" : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <Dialog open={pendingId !== null} onOpenChange={(open) => !open && setPendingId(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-start gap-3">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-status-warning/15 text-status-warning">
                <AlertTriangle className="size-5" aria-hidden="true" />
              </div>
              <div className="flex flex-col gap-1">
                <DialogTitle>Switch away from Lively Middle School?</DialogTitle>
                <DialogDescription className="text-pretty">
                  Lively has the most functionality built in — including real FCA data, floor-plan project
                  selection, and renovation scoping. Use Lively to test and demo the full experience.
                  {pendingSchool ? (
                    <>
                      {" "}
                      You selected <strong className="font-medium text-foreground">{pendingSchool.name}</strong>,
                      which has limited interactive features.
                    </>
                  ) : null}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setPendingId(null)}>
              Stay on Lively
            </Button>
            <Button variant="default" onClick={confirmChange}>
              Continue with {pendingSchool?.name ?? "this school"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}

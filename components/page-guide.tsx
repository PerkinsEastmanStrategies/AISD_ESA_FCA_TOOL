"use client"

import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
import { ChevronLeft, ChevronRight, CircleHelp, X } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PAGE_GUIDES, guideSelector, type PageGuideId, type TooltipPlacement } from "@/lib/page-guides"

const SPOTLIGHT_PAD = 8

interface PageGuideProps {
  guideId: PageGuideId
  className?: string
}

function positionTooltip(
  rect: DOMRect,
  tooltipW: number,
  tooltipH: number,
  preferred: TooltipPlacement,
): { top: number; left: number } {
  const gap = 12
  const margin = 12
  const vw = window.innerWidth
  const vh = window.innerHeight

  const order: TooltipPlacement[] =
    preferred === "auto" ? ["bottom", "top", "right", "left"] : [preferred, "bottom", "top", "right", "left"]

  for (const placement of order) {
    let top = 0
    let left = 0
    if (placement === "bottom") {
      top = rect.bottom + gap
      left = rect.left + rect.width / 2 - tooltipW / 2
    } else if (placement === "top") {
      top = rect.top - gap - tooltipH
      left = rect.left + rect.width / 2 - tooltipW / 2
    } else if (placement === "right") {
      top = rect.top + rect.height / 2 - tooltipH / 2
      left = rect.right + gap
    } else {
      top = rect.top + rect.height / 2 - tooltipH / 2
      left = rect.left - gap - tooltipW
    }

    left = Math.max(margin, Math.min(left, vw - tooltipW - margin))
    top = Math.max(margin, Math.min(top, vh - tooltipH - margin))

    const fits =
      top >= margin &&
      left >= margin &&
      top + tooltipH <= vh - margin &&
      left + tooltipW <= vw - margin

    if (fits || placement === order[order.length - 1]) {
      return { top, left }
    }
  }

  return { top: vh / 2 - tooltipH / 2, left: vw / 2 - tooltipW / 2 }
}

export function PageGuide({ guideId, className }: PageGuideProps) {
  const guide = PAGE_GUIDES[guideId]
  const storageKey = `page-guide-dismissed-${guideId}`
  const [mounted, setMounted] = useState(false)
  const [active, setActive] = useState(false)
  const [step, setStep] = useState(0)
  const [rect, setRect] = useState<DOMRect | null>(null)
  const [targetMissing, setTargetMissing] = useState(false)
  const [tooltipPos, setTooltipPos] = useState({ top: 0, left: 0 })
  const tooltipRef = useRef<HTMLDivElement>(null)

  const current = guide.steps[step]
  const isFirst = step === 0
  const isLast = step === guide.steps.length - 1

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    setStep(0)
    setActive(false)
  }, [guideId])

  const measureTarget = useCallback(() => {
    if (!active) return

    const el = document.querySelector(guideSelector(current.target))
    if (!el) {
      setRect(null)
      setTargetMissing(true)
      return
    }

    setTargetMissing(false)
    el.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" })
    window.setTimeout(() => {
      setRect(el.getBoundingClientRect())
    }, 280)
  }, [active, current.target])

  useLayoutEffect(() => {
    measureTarget()
  }, [measureTarget, step])

  useEffect(() => {
    if (!active) return
    const onChange = () => measureTarget()
    window.addEventListener("resize", onChange)
    window.addEventListener("scroll", onChange, true)
    return () => {
      window.removeEventListener("resize", onChange)
      window.removeEventListener("scroll", onChange, true)
    }
  }, [active, measureTarget])

  useLayoutEffect(() => {
    if (!active || !tooltipRef.current) return
    const tooltipEl = tooltipRef.current
    const tooltipRect = tooltipEl.getBoundingClientRect()
    if (rect && !targetMissing) {
      setTooltipPos(
        positionTooltip(rect, tooltipRect.width, tooltipRect.height, current.placement ?? "auto"),
      )
    } else {
      setTooltipPos({
        top: window.innerHeight / 2 - tooltipRect.height / 2,
        left: window.innerWidth / 2 - tooltipRect.width / 2,
      })
    }
  }, [active, rect, targetMissing, current, step])

  function closeTour() {
    setActive(false)
    setStep(0)
    try {
      localStorage.setItem(storageKey, "1")
    } catch {
      /* ignore */
    }
  }

  function startTour() {
    setStep(0)
    setActive(true)
  }

  const launcher = (
    <div className={className ?? "fixed bottom-5 right-5 z-40"}>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={startTour}
        className="gap-1.5 border-primary/40 bg-card shadow-lg hover:bg-primary/5"
      >
        <CircleHelp className="size-4 text-primary" aria-hidden="true" />
        How to use this page
      </Button>
    </div>
  )

  const tour =
    active && mounted
      ? createPortal(
          <div className="fixed inset-0 z-[200]" role="dialog" aria-modal="true" aria-label={`Tour: ${guide.title}`}>
            {rect && !targetMissing ? (
              <div
                className="pointer-events-none absolute rounded-lg ring-2 ring-primary transition-all duration-300 ease-out"
                style={{
                  top: rect.top - SPOTLIGHT_PAD,
                  left: rect.left - SPOTLIGHT_PAD,
                  width: rect.width + SPOTLIGHT_PAD * 2,
                  height: rect.height + SPOTLIGHT_PAD * 2,
                  boxShadow: "0 0 0 9999px rgba(0, 0, 0, 0.65)",
                }}
              />
            ) : (
              <div className="absolute inset-0 bg-black/65" aria-hidden="true" />
            )}

            {/* Tooltip */}
            <div
              ref={tooltipRef}
              className="absolute z-[210] w-[min(calc(100vw-2rem),22rem)] rounded-lg border border-border bg-card shadow-xl"
              style={{ top: tooltipPos.top, left: tooltipPos.left }}
            >
              <div className="flex items-start justify-between gap-3 border-b border-border px-4 py-3">
                <div>
                  <p className="text-xs font-medium text-primary">{guide.title}</p>
                  <p className="text-[11px] text-muted-foreground">
                    Step {step + 1} of {guide.steps.length}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={closeTour}
                  className="rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                  aria-label="End tour"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="px-4 py-3">
                <h3 className="text-sm font-semibold text-foreground">{current.title}</h3>
                <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{current.body}</p>
                {targetMissing && (
                  <p className="mt-2 rounded-md border border-dashed border-border bg-muted/50 px-2.5 py-2 text-xs text-muted-foreground">
                    This control isn&apos;t visible right now — select a school or complete a prior step, then try again.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border px-4 py-3">
                <div className="flex items-center gap-1.5" aria-hidden="true">
                  {guide.steps.map((_, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => setStep(i)}
                      className={`size-2 rounded-full transition-colors ${
                        i === step ? "bg-primary" : "bg-primary/25 hover:bg-primary/40"
                      }`}
                      aria-label={`Go to step ${i + 1}`}
                    />
                  ))}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={isFirst}
                    onClick={() => setStep((s) => s - 1)}
                    className="gap-1"
                  >
                    <ChevronLeft className="size-4" aria-hidden="true" />
                    Previous
                  </Button>
                  {isLast ? (
                    <Button type="button" size="sm" onClick={closeTour}>
                      Done
                    </Button>
                  ) : (
                    <Button type="button" size="sm" onClick={() => setStep((s) => s + 1)} className="gap-1">
                      Next
                      <ChevronRight className="size-4" aria-hidden="true" />
                    </Button>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body,
        )
      : null

  return (
    <>
      {launcher}
      {tour}
    </>
  )
}

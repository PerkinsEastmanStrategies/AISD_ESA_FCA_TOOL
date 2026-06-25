"use client"

import { Map as MapIcon, LayoutDashboard, GitBranch, FileDown } from "lucide-react"

export type AppView = "map" | "school" | "capital" | "exports"

interface ViewSwitcherProps {
  current: AppView
  onMap: () => void
  onSchool: () => void
  onCapital: () => void
  onExports: () => void
  /** Disable the School View tab when no school is resolvable. */
  schoolDisabled?: boolean
}

const TABS: { id: AppView; label: string; icon: typeof MapIcon }[] = [
  { id: "map", label: "District Overview", icon: MapIcon },
  { id: "school", label: "School View", icon: LayoutDashboard },
  { id: "capital", label: "Capital Planning", icon: GitBranch },
  { id: "exports", label: "Exports & Reporting", icon: FileDown },
]

/** Shared primary navigation across the app. */
export function ViewSwitcher({
  current,
  onMap,
  onSchool,
  onCapital,
  onExports,
  schoolDisabled,
}: ViewSwitcherProps) {
  const handlers: Record<AppView, () => void> = {
    map: onMap,
    school: onSchool,
    capital: onCapital,
    exports: onExports,
  }

  return (
    <div
      data-guide="main-nav"
      className="inline-flex max-w-full flex-wrap items-center rounded-lg border border-border bg-muted p-1"
      role="tablist"
      aria-label="Switch view"
    >
      {TABS.map((tab) => {
        const Icon = tab.icon
        const active = current === tab.id
        const disabled = tab.id === "school" && schoolDisabled
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            disabled={disabled}
            onClick={() => !active && handlers[tab.id]()}
            className={`inline-flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors disabled:opacity-50 sm:px-3 sm:text-sm ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <Icon className="size-4 shrink-0" aria-hidden="true" />
            <span className="whitespace-nowrap">{tab.label}</span>
          </button>
        )
      })}
    </div>
  )
}

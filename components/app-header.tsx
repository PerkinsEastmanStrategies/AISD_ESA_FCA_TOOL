"use client"

import type { ReactNode } from "react"
import { ViewSwitcher, type AppView } from "@/components/view-switcher"
import { SchoolSelector } from "@/components/school-selector"

interface AppHeaderProps {
  title: string
  subtitle: string
  current: AppView
  onMap: () => void
  onSchool: () => void
  onCapital: () => void
  onExports: () => void
  schoolDisabled?: boolean
  selectedSchoolId?: string | null
  onSelectSchool?: (id: string) => void
  /** Draw extra attention to the school picker (e.g. on District Overview before a school is chosen). */
  highlightSchoolSelector?: boolean
  /** Contextual sub-navigation — shown only when provided (e.g. Map/Summary, Flow/Projects). */
  subNav?: ReactNode
}

/** Shared top banner: branding, page title, and the three primary app views. */
export function AppHeader({
  title,
  subtitle,
  current,
  onMap,
  onSchool,
  onCapital,
  onExports,
  schoolDisabled,
  selectedSchoolId,
  onSelectSchool,
  highlightSchoolSelector,
  subNav,
}: AppHeaderProps) {
  return (
    <header className="sticky top-0 z-30 shrink-0 border-b border-border bg-card">
      <div className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <img
            src="/images/aisd-logo.jpg"
            alt="Austin Independent School District logo"
            className="h-12 w-auto shrink-0"
          />
          <div className="min-w-0 border-l border-border pl-3">
            <h1 className="text-lg font-semibold leading-tight text-foreground text-balance">{title}</h1>
            <p className="text-sm leading-snug text-muted-foreground">{subtitle}</p>
          </div>
        </div>
        <div className="flex flex-wrap items-center justify-end gap-3">
          {onSelectSchool ? (
            <SchoolSelector
              value={selectedSchoolId ?? null}
              onChange={onSelectSchool}
              highlighted={highlightSchoolSelector ?? selectedSchoolId == null}
            />
          ) : null}
          <ViewSwitcher
            current={current}
            onMap={onMap}
            onSchool={onSchool}
            onCapital={onCapital}
            onExports={onExports}
            schoolDisabled={schoolDisabled}
          />
        </div>
      </div>
      {subNav ? (
        <div className="border-t border-border bg-muted/30 px-5 py-2.5">{subNav}</div>
      ) : null}
    </header>
  )
}

interface SegmentedTabsProps<T extends string> {
  tabs: { id: T; label: string; icon?: React.ComponentType<{ className?: string }> }[]
  value: T
  onChange: (id: T) => void
  ariaLabel: string
}

/** Secondary segmented control for in-context navigation below the main header. */
export function SegmentedTabs<T extends string>({ tabs, value, onChange, ariaLabel }: SegmentedTabsProps<T>) {
  return (
    <div
      className="inline-flex items-center rounded-lg border border-border bg-muted p-1"
      role="tablist"
      aria-label={ariaLabel}
    >
      {tabs.map((tab) => {
        const Icon = tab.icon
        const active = value === tab.id
        return (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={active}
            onClick={() => onChange(tab.id)}
            className={`inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
              active
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {Icon ? <Icon className="size-4" aria-hidden="true" /> : null}
            {tab.label}
          </button>
        )
      })}
    </div>
  )
}

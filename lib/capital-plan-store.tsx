"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"
import {
  DEFAULT_CAPITAL_PROJECT_TYPE,
  type CapitalProjectTypeId,
  type ProjectScopeMode,
  type RenovationAreaSelection,
} from "@/lib/capital-projects"

export interface SchoolCapitalPlanState {
  roomIds: string[]
  sqft: number
  projectType: CapitalProjectTypeId
  scopeMode: ProjectScopeMode
  appliedCost: number
  criticalItemCount: number
  selectedFcaIds: string[]
  coveredFcaIds: string[]
}

export const EMPTY_CAPITAL_PLAN: SchoolCapitalPlanState = {
  roomIds: [],
  sqft: 0,
  projectType: DEFAULT_CAPITAL_PROJECT_TYPE,
  scopeMode: "renovate",
  appliedCost: 0,
  criticalItemCount: 0,
  selectedFcaIds: [],
  coveredFcaIds: [],
}

const STORAGE_KEY = "aisd-capital-plans"

type PlanMap = Record<string, SchoolCapitalPlanState>

function loadPlans(): PlanMap {
  if (typeof window === "undefined") return {}
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    return JSON.parse(raw) as PlanMap
  } catch {
    return {}
  }
}

function savePlans(plans: PlanMap) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(plans))
  } catch {
    /* ignore */
  }
}

interface CapitalPlanContextValue {
  getPlan: (schoolId: string) => SchoolCapitalPlanState
  applyRenoSelection: (schoolId: string, selection: RenovationAreaSelection) => void
  clearPlan: (schoolId: string) => void
  setSelectedFcaIds: (schoolId: string, ids: Set<string>) => void
  toggleFcaSelection: (schoolId: string, id: string, coveredIds: Set<string>) => void
}

const CapitalPlanContext = createContext<CapitalPlanContextValue | null>(null)

export function CapitalPlanProvider({ children }: { children: ReactNode }) {
  const [plans, setPlans] = useState<PlanMap>({})

  useEffect(() => {
    setPlans(loadPlans())
  }, [])

  const persist = useCallback((updater: (prev: PlanMap) => PlanMap) => {
    setPlans((prev) => {
      const next = updater(prev)
      savePlans(next)
      return next
    })
  }, [])

  const getPlan = useCallback(
    (schoolId: string) => plans[schoolId] ?? EMPTY_CAPITAL_PLAN,
    [plans],
  )

  const applyRenoSelection = useCallback(
    (schoolId: string, selection: RenovationAreaSelection) => {
      persist((prev) => ({
        ...prev,
        [schoolId]: {
          roomIds: selection.roomIds,
          sqft: selection.sqft,
          projectType: selection.projectType,
          scopeMode: selection.scopeMode,
          appliedCost: selection.estimatedCost,
          criticalItemCount: selection.criticalItemCount,
          selectedFcaIds: selection.selectedFcaIds,
          coveredFcaIds: selection.coveredFcaIds,
        },
      }))
    },
    [persist],
  )

  const clearPlan = useCallback(
    (schoolId: string) => {
      persist((prev) => {
        const next = { ...prev }
        delete next[schoolId]
        return next
      })
    },
    [persist],
  )

  const setSelectedFcaIds = useCallback(
    (schoolId: string, ids: Set<string>) => {
      persist((prev) => ({
        ...prev,
        [schoolId]: {
          ...(prev[schoolId] ?? EMPTY_CAPITAL_PLAN),
          selectedFcaIds: [...ids],
        },
      }))
    },
    [persist],
  )

  const toggleFcaSelection = useCallback(
    (schoolId: string, id: string, coveredIds: Set<string>) => {
      if (coveredIds.has(id)) return
      persist((prev) => {
        const current = prev[schoolId] ?? EMPTY_CAPITAL_PLAN
        const nextIds = new Set(current.selectedFcaIds)
        if (nextIds.has(id)) nextIds.delete(id)
        else nextIds.add(id)
        return {
          ...prev,
          [schoolId]: { ...current, selectedFcaIds: [...nextIds] },
        }
      })
    },
    [persist],
  )

  const value = useMemo(
    () => ({
      getPlan,
      applyRenoSelection,
      clearPlan,
      setSelectedFcaIds,
      toggleFcaSelection,
    }),
    [getPlan, applyRenoSelection, clearPlan, setSelectedFcaIds, toggleFcaSelection],
  )

  return <CapitalPlanContext.Provider value={value}>{children}</CapitalPlanContext.Provider>
}

export function useCapitalPlanStore() {
  const ctx = useContext(CapitalPlanContext)
  if (!ctx) throw new Error("useCapitalPlanStore must be used within CapitalPlanProvider")
  return ctx
}

export function useCapitalPlan(schoolId: string) {
  const store = useCapitalPlanStore()
  const plan = store.getPlan(schoolId)
  return {
    plan,
    applyRenoSelection: (selection: RenovationAreaSelection) =>
      store.applyRenoSelection(schoolId, selection),
    clearPlan: () => store.clearPlan(schoolId),
    toggleFcaSelection: (id: string) =>
      store.toggleFcaSelection(schoolId, id, new Set(plan.coveredFcaIds)),
    setSelectedFcaIds: (ids: Set<string>) => store.setSelectedFcaIds(schoolId, ids),
  }
}

export function hasCapitalPlanSelections(plan: SchoolCapitalPlanState): boolean {
  return plan.roomIds.length > 0 || plan.selectedFcaIds.length > 0
}

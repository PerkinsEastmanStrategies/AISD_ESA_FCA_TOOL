/** Client-side admin auth for Exports & Reporting (browser-only for now). */

export const ADMIN_PASSWORD = "Gavin"

const STORAGE_KEY = "aisd-admin-unlocked"

export function isAdminUnlocked(): boolean {
  if (typeof window === "undefined") return false
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "1"
  } catch {
    return false
  }
}

export function unlockAdmin(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.setItem(STORAGE_KEY, "1")
  } catch {
    // ignore quota / private-mode failures; unlock still works in-memory via caller state
  }
}

export function lockAdmin(): void {
  if (typeof window === "undefined") return
  try {
    window.localStorage.removeItem(STORAGE_KEY)
  } catch {
    // ignore
  }
}

export function verifyAdminPassword(password: string): boolean {
  return password === ADMIN_PASSWORD
}

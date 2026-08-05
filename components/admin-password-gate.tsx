"use client"

import { useEffect, useState, type FormEvent, type ReactNode } from "react"
import { Lock, LogOut } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  isAdminUnlocked,
  lockAdmin,
  unlockAdmin,
  verifyAdminPassword,
} from "@/lib/admin-auth"

interface AdminPasswordGateProps {
  children: ReactNode
  /** Optional title shown on the lock screen. */
  title?: string
  /** Optional description under the title. */
  description?: string
}

/**
 * Lightweight browser-only password gate.
 * Unlock state persists in localStorage for the current browser.
 */
export function AdminPasswordGate({
  children,
  title = "Admin access required",
  description = "Enter the admin password to create reports and download assessment data.",
}: AdminPasswordGateProps) {
  const [ready, setReady] = useState(false)
  const [unlocked, setUnlocked] = useState(false)
  const [password, setPassword] = useState("")
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    setUnlocked(isAdminUnlocked())
    setReady(true)
  }, [])

  function handleSubmit(e: FormEvent) {
    e.preventDefault()
    if (verifyAdminPassword(password)) {
      unlockAdmin()
      setUnlocked(true)
      setPassword("")
      setError(null)
      return
    }
    setError("Incorrect password. Try again.")
  }

  function handleLock() {
    lockAdmin()
    setUnlocked(false)
    setPassword("")
    setError(null)
  }

  if (!ready) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center px-4 py-12">
        <p className="text-sm text-muted-foreground">Checking access…</p>
      </div>
    )
  }

  if (!unlocked) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center px-4 py-12">
        <Card className="w-full max-w-md gap-5 p-6">
          <div className="flex flex-col items-center gap-3 text-center">
            <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Lock className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-lg font-semibold text-foreground">{title}</h2>
              <p className="mt-1 text-sm text-muted-foreground">{description}</p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <div className="flex flex-col gap-2">
              <Label htmlFor="admin-password">Password</Label>
              <Input
                id="admin-password"
                type="password"
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value)
                  if (error) setError(null)
                }}
                aria-invalid={error ? true : undefined}
                placeholder="Enter admin password"
                autoFocus
              />
              {error ? (
                <p className="text-xs text-destructive" role="alert">
                  {error}
                </p>
              ) : null}
            </div>
            <Button type="submit" className="w-full">
              Unlock
            </Button>
          </form>
        </Card>
      </div>
    )
  }

  return (
    <>
      <div className="no-print mx-auto flex w-full max-w-[1200px] justify-end px-4 pt-4 sm:px-6">
        <Button
          type="button"
          variant="ghost"
          size="sm"
          onClick={handleLock}
          className="gap-1.5 text-muted-foreground"
        >
          <LogOut className="size-3.5" aria-hidden="true" />
          Lock admin
        </Button>
      </div>
      {children}
    </>
  )
}

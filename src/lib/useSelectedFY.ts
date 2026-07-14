'use client'
// The ONE selected-FY source every screen reads (chrome, optimizer, computation, …). It anchors to
// the user's slip FY (from av_salary_summary; today's FY if none), applies the chosen mode
// (current / plan-ahead), and exposes the resolved FY, its label/AY label, and the picker options.
// No screen should hardcode an FY string — read `label`/`ayLabel` from here.

import { useEffect, useState } from 'react'
import { type FY, fyLabel, ayLabel, LATEST_ENACTED_FY } from './tax-slabs.ts'
import { fyFromSlipMonth, resolveFY, fyOptions, type FYMode, type FYOption } from './fy.ts'

export interface SelectedFY {
  anchorFY: FY
  mode: FYMode
  fy: FY
  label: string   // "FY 2025-26"
  ayLabel: string // "AY 2026-27"
  options: FYOption[]
}

const MODE_KEY = 'av_selected_fy_mode'
const FY_CHANGED_EVENT = 'av-fy-changed'

// Pure resolver from stored values — kept separate so the logic is deterministic and screens agree.
export function resolveSelectedFY(summaryRaw: string | null, modeRaw: string | null, now: Date): SelectedFY {
  let anchor: FY
  let hasSlip = false // true only when the anchor came from a parsed slip, not the today's-date fallback
  try {
    const s = summaryRaw ? JSON.parse(summaryRaw) : null
    if (s && Number.isFinite(s.fyStartYear)) { anchor = s.fyStartYear; hasSlip = true }
    else { anchor = fyFromSlipMonth(now) }
  } catch {
    anchor = fyFromSlipMonth(now)
  }
  // A stored plan-ahead mode is honored only while it still resolves to a real (different) year; if
  // the anchor advanced to the latest enacted FY, fall back to current so we never show a dead label.
  const wantPlan = modeRaw === 'plan_ahead'
  const mode: FYMode = wantPlan && resolveFY(anchor, 'plan_ahead') !== anchor ? 'plan_ahead' : 'current'
  const fy = resolveFY(anchor, mode)
  return { anchorFY: anchor, mode, fy, label: fyLabel(fy), ayLabel: ayLabel(fy), options: fyOptions(anchor, hasSlip) }
}

/** Persist the chosen mode and notify same-tab listeners. */
export function setSelectedFYMode(mode: FYMode): void {
  try {
    localStorage.setItem(MODE_KEY, mode)
    window.dispatchEvent(new Event(FY_CHANGED_EVENT))
  } catch { /* ignore */ }
}

export function useSelectedFY(): SelectedFY | null {
  const [sel, setSel] = useState<SelectedFY | null>(null)
  useEffect(() => {
    const read = () => setSel(resolveSelectedFY(
      localStorage.getItem('av_salary_summary'),
      localStorage.getItem(MODE_KEY),
      new Date(),
    ))
    read()
    window.addEventListener('storage', read)
    window.addEventListener(FY_CHANGED_EVENT, read)
    return () => {
      window.removeEventListener('storage', read)
      window.removeEventListener(FY_CHANGED_EVENT, read)
    }
  }, [])
  return sel
}

export { LATEST_ENACTED_FY }

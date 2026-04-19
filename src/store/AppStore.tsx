'use client'
import React, { createContext, useContext, useState, useEffect, useCallback } from 'react'
import type { ParsedSalaryData, TaxComparison, FinancialGoal, InvestmentPlan } from '@/types'

interface AppState {
  salary: ParsedSalaryData | null
  aisData: any | null
  otherIncome: Record<string, any> | null
  taxComparison: TaxComparison | null
  investPlan: InvestmentPlan | null
  goals: FinancialGoal[]
  setSalary: (s: ParsedSalaryData | null) => void
  setAisData: (a: any | null) => void
  setOtherIncome: (o: Record<string, any> | null) => void
  setTaxComparison: (t: TaxComparison | null) => void
  setInvestPlan: (p: InvestmentPlan | null) => void
  setGoals: (g: FinancialGoal[]) => void
  clearAll: () => void
}

const AppContext = createContext<AppState | null>(null)

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [salary, setSalaryState] = useState<ParsedSalaryData | null>(null)
  const [aisData, setAisDataState] = useState<any | null>(null)
  const [otherIncome, setOtherIncomeState] = useState<Record<string, any> | null>(null)
  const [taxComparison, setTaxComparisonState] = useState<TaxComparison | null>(null)
  const [investPlan, setInvestPlanState] = useState<InvestmentPlan | null>(null)
  const [goals, setGoalsState] = useState<FinancialGoal[]>([])

  useEffect(() => {
    try {
      const s = localStorage.getItem('as_salary')
      const a = localStorage.getItem('as_ais')
      const o = localStorage.getItem('as_other_income')
      const t = localStorage.getItem('as_tax')
      const p = localStorage.getItem('as_invest')
      const g = localStorage.getItem('as_goals')
      if (s) setSalaryState(JSON.parse(s))
      if (a) setAisDataState(JSON.parse(a))
      if (o) setOtherIncomeState(JSON.parse(o))
      if (t) setTaxComparisonState(JSON.parse(t))
      if (p) setInvestPlanState(JSON.parse(p))
      if (g) setGoalsState(JSON.parse(g))
    } catch {}
  }, [])

  const setSalary = useCallback((s: ParsedSalaryData | null) => {
    setSalaryState(s)
    if (s) localStorage.setItem('as_salary', JSON.stringify(s))
    else localStorage.removeItem('as_salary')
  }, [])

  const setAisData = useCallback((a: any | null) => {
    setAisDataState(a)
    if (a) localStorage.setItem('as_ais', JSON.stringify(a))
    else localStorage.removeItem('as_ais')
  }, [])

  const setOtherIncome = useCallback((o: Record<string, any> | null) => {
    setOtherIncomeState(o)
    if (o) localStorage.setItem('as_other_income', JSON.stringify(o))
    else localStorage.removeItem('as_other_income')
  }, [])

  const setTaxComparison = useCallback((t: TaxComparison | null) => {
    setTaxComparisonState(t)
    if (t) localStorage.setItem('as_tax', JSON.stringify(t))
    else localStorage.removeItem('as_tax')
  }, [])

  const setInvestPlan = useCallback((p: InvestmentPlan | null) => {
    setInvestPlanState(p)
    if (p) localStorage.setItem('as_invest', JSON.stringify(p))
    else localStorage.removeItem('as_invest')
  }, [])

  const setGoals = useCallback((g: FinancialGoal[]) => {
    setGoalsState(g)
    localStorage.setItem('as_goals', JSON.stringify(g))
  }, [])

  const clearAll = useCallback(() => {
    setSalaryState(null); setAisDataState(null); setOtherIncomeState(null)
    setTaxComparisonState(null); setInvestPlanState(null); setGoalsState([])
    ;['as_salary','as_ais','as_other_income','as_tax','as_invest','as_goals'].forEach(k => localStorage.removeItem(k))
  }, [])

  return (
    <AppContext.Provider value={{ salary, aisData, otherIncome, taxComparison, investPlan, goals, setSalary, setAisData, setOtherIncome, setTaxComparison, setInvestPlan, setGoals, clearAll }}>
      {children}
    </AppContext.Provider>
  )
}

export function useAppStore() {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useAppStore must be inside AppProvider')
  return ctx
}

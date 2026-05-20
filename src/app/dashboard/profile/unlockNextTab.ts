const PROFILE_TABS = [
  { key:'documents' },
  { key:'salary' },
  { key:'other-income' },
  { key:'exemptions' },
  { key:'deductions' },
]

export function unlockNextTab(currentTabKey: string) {
  try {
    const currentIndex = PROFILE_TABS.findIndex(t => t.key === currentTabKey)
    if (currentIndex === -1) return
    
    const completion = JSON.parse(localStorage.getItem('av_profile_completion') || '{}')
    const nextTab = PROFILE_TABS[currentIndex + 1]
    
    if (nextTab) {
      completion[nextTab.key] = true
      localStorage.setItem('av_profile_completion', JSON.stringify(completion))
    }
  } catch (e) {
    console.error('Failed to unlock next tab:', e)
  }
}

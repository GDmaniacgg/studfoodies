export interface SavingsData {
  totalSaved: number
  currency: string
  month: string
  sessionCount: number
}

export function getSavings(): SavingsData {
  if (typeof window === 'undefined') {
    return { totalSaved: 0, currency: '$', month: '', sessionCount: 0 }
  }
  const data = localStorage.getItem('studfoodies_savings')
  const now = new Date()
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  
  if (data) {
    const parsed = JSON.parse(data)
    if (parsed.month !== currentMonth) {
      const fresh = { totalSaved: 0, currency: parsed.currency, month: currentMonth, sessionCount: 0 }
      localStorage.setItem('studfoodies_savings', JSON.stringify(fresh))
      return fresh
    }
    return parsed
  }
  
  const fresh = { totalSaved: 0, currency: '$', month: currentMonth, sessionCount: 0 }
  localStorage.setItem('studfoodies_savings', JSON.stringify(fresh))
  return fresh
}

export function addSavings(recipeCost: number, currency: string) {
  const savings = getSavings()
  const estimatedTakeoutCost = recipeCost * 2.5
  const savedThisMeal = Math.round(estimatedTakeoutCost - recipeCost)
  
  savings.totalSaved += savedThisMeal
  savings.currency = currency
  savings.sessionCount += 1
  
  localStorage.setItem('studfoodies_savings', JSON.stringify(savings))
  return savedThisMeal
}

export function resetSavings() {
  localStorage.removeItem('studfoodies_savings')
}

export interface UserProfile {
  language: string
  currency: string
  country: string
  favoriteStores?: string[]
}

export function getProfile(): UserProfile | null {
  if (typeof window === 'undefined') return null
  const data = localStorage.getItem('studfoodies_profile')
  return data ? JSON.parse(data) : null
}

export function saveProfile(profile: UserProfile) {
  localStorage.setItem('studfoodies_profile', JSON.stringify(profile))
}

export function clearProfile() {
  localStorage.removeItem('studfoodies_profile')
}

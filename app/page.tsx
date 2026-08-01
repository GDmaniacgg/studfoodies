'use client'

import { useActionState, useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { getMealPlan } from './actions/recipes'
import { getProfile, clearProfile } from '@/lib/profile'
import { translations } from '@/lib/translations'
import { getSavings, addSavings } from '@/lib/savings'

export default function Home() {
  const [data, formAction, pending] = useActionState(getMealPlan, null)
  const router = useRouter()
  const [profile, setProfile] = useState<any>(null)
  const [ready, setReady] = useState(false)
  const [openLists, setOpenLists] = useState<Record<number, boolean>>({})
  const [savings, setSavings] = useState<any>(null)

  useEffect(() => {
    const p = getProfile()
    if (!p) router.push('/onboarding')
    else { 
      setProfile(p)
      setSavings(getSavings())
      setReady(true)
    }
  }, [])

  // 🏦 Track savings when new recipes are loaded
  useEffect(() => {
    if (data?.recipes) {
      const totalCost = data.recipes.reduce((sum: number, r: any) => sum + (r.total_cost || 0), 0)
      addSavings(totalCost, data.currency)
      setSavings(getSavings())
    }
  }, [data])

  const t = (key: string) => 
    profile ? (translations[profile.language]?.[key] || translations.en[key] || key) : key

  const toggleList = (index: number) => {
    setOpenLists(prev => ({ ...prev, [index]: !prev[index] }))
  }

  if (!ready) return (
  <div className="min-h-screen bg-indigo-600 flex items-center justify-center">
    <div className="text-white text-center">
      <div className="text-4xl mb-4">🎓</div>
      <p className="font-bold">StudFoodies</p>
      <p className="text-sm text-indigo-200 mt-1">Loading...</p>
    </div>
  </div>
)


  return (
    <main className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-indigo-600 text-white p-4 sm:p-6">
        <div className="max-w-4xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold">{t('title')}</h1>
            <p className="text-indigo-200 text-sm sm:text-base mt-1">{t('subtitle')}</p>
            
            {/* 🏦 Savings badge */}
            {savings && savings.totalSaved > 0 && (
              <div className="mt-2 bg-green-500 text-white text-xs font-bold px-3 py-1 rounded-full inline-block">
                🏦 {t('saved')} {savings.totalSaved}{savings.currency} {t('thisMonth')}
              </div>
            )}

            {/* ❤️ Favorite stores badges */}
            {profile?.favoriteStores?.length > 0 && (
              <div className="mt-2 flex flex-wrap gap-1">
                {profile.favoriteStores.map((store: string) => (
                  <span key={store} className="text-xs bg-white/20 text-white px-2 py-0.5 rounded-full">
                    ❤️ {store}
                  </span>
                ))}
              </div>
            )}
          </div>
          <button onClick={() => { clearProfile(); router.push('/onboarding') }}
                  className="text-xs text-indigo-200 hover:text-white border border-indigo-400 px-3 py-1 rounded-lg">
            {t('settings')}
          </button>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 pb-12">
        {/* Form */}
        <form action={formAction} className="mt-4 sm:mt-6 p-4 sm:p-6 bg-white rounded-xl shadow-sm border">
          <div className="space-y-3">
            <input name="food" placeholder={t('food')} 
                   className="w-full p-3.5 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" required />
            <input name="budget" placeholder={t('budget')} 
                   className="w-full p-3.5 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" required />
            <input name="area" placeholder={t('area')} 
                   className="w-full p-3.5 text-sm sm:text-base border rounded-lg focus:ring-2 focus:ring-indigo-400 outline-none" required />
            {/* 🆕 Hidden input passes favorite stores to the search engine */}
            <input type="hidden" name="favoriteStores" value={JSON.stringify(profile?.favoriteStores || [])} />
            <button type="submit" disabled={pending}
                    className="w-full py-3.5 bg-indigo-600 text-white text-sm sm:text-base font-bold rounded-lg hover:bg-indigo-700 active:scale-[0.99] disabled:opacity-50 transition">
              {pending ? t('cooking') : t('search')}
            </button>
          </div>
        </form>

        {/* Results */}
        {data && (
          <div className="mt-6 space-y-6">
            
            {/* 💰 Store Prices */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold mb-3">{t('prices')}</h2>
              <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory
                              md:grid md:grid-cols-2 md:overflow-x-visible">
                {data.deals.map((deal: any, i: number) => (
                  <div key={i} className="min-w-[200px] sm:min-w-0 p-3 sm:p-4 bg-green-50 rounded-lg border border-green-200 snap-start">
                    <p className="text-sm sm:text-base font-medium line-clamp-2">{deal.title}</p>
                    {deal.price && (
                      <p className="text-green-700 font-bold text-sm sm:text-base mt-1">{deal.price}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* 📄 Weekly Leaflets */}
            {data.leaflets?.length > 0 && (
              <div>
                <h2 className="text-lg sm:text-xl font-bold mb-3">{t('leaflets')}</h2>
                <div className="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory
                                md:grid md:grid-cols-2 md:overflow-x-visible">
                  {data.leaflets.map((leaflet: any, i: number) => (
                    <div key={i} className="min-w-[200px] sm:min-w-0 p-3 sm:p-4 bg-blue-50 rounded-lg border border-blue-200 snap-start">
                      <p className="text-sm sm:text-base font-medium line-clamp-2">{leaflet.title}</p>
                      {leaflet.link && (
                        <a href={leaflet.link} target="_blank" rel="noopener noreferrer"
                           className="text-xs sm:text-sm text-blue-600 hover:underline mt-1 inline-block">
                          {t('openLeaflet')}
                        </a>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* 🍳 AI Recipes */}
            <div>
              <h2 className="text-lg sm:text-xl font-bold mb-3">{t('recipes')}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {data.recipes.map((recipe: any, i: number) => {
                  const perPortion = recipe.servings 
                    ? (recipe.total_cost / recipe.servings).toFixed(1) 
                    : '?'
                  const isOpen = openLists[i] || false
                  
                  return (
                    <div key={i} className="p-4 sm:p-5 bg-white rounded-xl shadow-sm border">
                      <h3 className="font-bold text-base sm:text-lg mb-1">{recipe.name}</h3>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs sm:text-sm text-gray-500 mb-3">
                        <span>👥 {recipe.servings || '?'}</span>
                        <span>💰 {t('total')}: {recipe.total_cost}{data.currency}</span>
                        <span className="text-green-600 font-medium">
                          💵 ~{perPortion}{data.currency} {t('perPortion')}
                        </span>
                      </div>
                      
                      <div className="mb-3">
                        <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">{t('ingredients')}:</p>
                        <ul className="text-xs sm:text-sm text-gray-600 space-y-1">
                          {recipe.ingredients?.map((ing: any, j: number) => (
                            <li key={j} className="flex justify-between">
                              <span>• {ing.name || ing}</span>
                              {ing.price && (
                                <span className="text-green-600 font-medium">~{ing.price}{data.currency}</span>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                      
                      <div>
                        <p className="text-xs sm:text-sm font-semibold text-gray-700 mb-1">{t('steps')}:</p>
                        <ol className="text-xs sm:text-sm text-gray-600 list-decimal pl-4 space-y-0.5">
                          {recipe.steps?.map((step: string, j: number) => (
                            <li key={j}>{step}</li>
                          ))}
                        </ol>
                      </div>

                      {/* 🛒 Per-recipe grocery list */}
                      <button onClick={() => toggleList(i)}
                              className="w-full mt-4 py-2 bg-green-600 text-white text-sm font-bold rounded-lg hover:bg-green-700 transition">
                        {isOpen ? t('hideList') : t('groceryList')}
                      </button>

                      {isOpen && (
                        <div className="mt-3 p-3 bg-green-50 rounded-lg border border-green-200">
                          <p className="text-xs font-semibold text-green-800 mb-2">🛒 {recipe.name}</p>
                          {recipe.ingredients?.map((ing: any, j: number) => (
                            <div key={j} className="flex items-center gap-2 py-1 border-b border-green-100 last:border-0">
                              <input type="checkbox" className="w-3 h-3 accent-green-600" />
                              <span className="text-xs flex-1">{ing.name || ing}</span>
                              {ing.price && (
                                <span className="text-xs text-green-600 font-medium">~{ing.price}{data.currency}</span>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>

          </div>
        )}
      </div>
    </main>
  )
}

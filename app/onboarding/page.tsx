'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { languages, currencies, countries, storesByCountry, translations } from '@/lib/translations'
import { saveProfile } from '@/lib/profile'

export default function Onboarding() {
  const router = useRouter()
  const [step, setStep] = useState(1)
  const [language, setLanguage] = useState('en')
  const [currency, setCurrency] = useState('EUR')
  const [country, setCountry] = useState('cz')
  const [selectedStores, setSelectedStores] = useState<string[]>([])

  const t = (key: string) => translations[language]?.[key] || translations.en[key] || key

  const finish = () => {
    saveProfile({ language, currency, country, favoriteStores: selectedStores })
    router.push('/')
  }

  const toggleStore = (storeName: string) => {
    if (selectedStores.includes(storeName)) {
      setSelectedStores(selectedStores.filter(s => s !== storeName))
    } else if (selectedStores.length < 3) {
      setSelectedStores([...selectedStores, storeName])
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-indigo-600 to-indigo-800 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-2xl p-6 sm:p-8">
        
        <div className="flex justify-center gap-2 mb-6">
          {[1, 2, 3, 4].map(s => (
            <div key={s} className={`h-2 w-10 rounded-full transition ${s <= step ? 'bg-indigo-600' : 'bg-gray-200'}`} />
          ))}
        </div>

        {step === 1 && (
          <>
            <h2 className="text-xl font-bold text-center mb-1">{t('onboardingTitle')}</h2>
            <p className="text-sm text-gray-500 text-center mb-6">{t('onboardingDesc')}</p>
            <h3 className="font-semibold mb-3">{t('lang')}</h3>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {languages.map(l => (
                <button key={l.code} onClick={() => { setLanguage(l.code); setStep(2) }}
                  className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition
                    ${language === l.code ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}>
                  <span className="text-xl">{l.flag}</span>
                  <span className="font-medium">{l.native}</span>
                  <span className="text-xs text-gray-400 ml-auto">{l.name}</span>
                </button>
              ))}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h3 className="font-semibold mb-3">{t('curr')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('currenciesMatching')} {languages.find(l => l.code === language)?.name}</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {currencies.map(c => (
                <button key={c.code} onClick={() => { setCurrency(c.code); setStep(3) }}
                  className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition
                    ${currency === c.code ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}>
                  <span className="text-xl font-bold">{c.symbol}</span>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{c.code}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(1)} className="mt-4 text-sm text-gray-500 hover:text-indigo-600">{t('back')}</button>
          </>
        )}

        {step === 3 && (
          <>
            <h3 className="font-semibold mb-3">{t('ctry')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('countriesUsing')} {currency}</p>
            <div className="space-y-2 max-h-64 overflow-y-auto">
              {countries.filter(c => c.currency === currency).map(c => (
                <button key={c.code} onClick={() => { setCountry(c.code); setStep(4) }}
                  className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition
                    ${country === c.code ? 'border-indigo-600 bg-indigo-50' : 'border-gray-200 hover:border-indigo-300'}`}>
                  <span className="text-xl">{c.flag}</span>
                  <span className="font-medium">{c.name}</span>
                  <span className="text-xs text-gray-400 ml-auto">{c.currency}</span>
                </button>
              ))}
            </div>
            <button onClick={() => setStep(2)} className="mt-4 text-sm text-gray-500 hover:text-indigo-600">{t('back')}</button>
          </>
        )}

        {step === 4 && (
          <>
            <h3 className="font-semibold mb-3">{t('favoriteStores')}</h3>
            <p className="text-sm text-gray-500 mb-4">{t('storesDesc')}</p>
            <div className="space-y-2">
              {(storesByCountry[country] || []).map(store => {
                const isSelected = selectedStores.includes(store.name)
                return (
                  <button key={store.name} onClick={() => toggleStore(store.name)}
                    className={`w-full text-left p-3 rounded-lg border flex items-center gap-3 transition
                      ${isSelected ? 'border-green-500 bg-green-50' : 'border-gray-200 hover:border-indigo-300'}`}>
                    <span>{store.logo}</span>
                    <span className="font-medium flex-1">{store.name}</span>
                    {isSelected && <span className="text-xs text-green-600 font-bold">✓</span>}
                  </button>
                )
              })}
            </div>
            {selectedStores.length > 0 && (
              <p className="text-xs text-gray-400 mt-2">{selectedStores.length}/3 {t('storesSelected')}</p>
            )}
            <div className="flex gap-3 mt-4">
              <button onClick={() => setStep(3)} className="flex-1 text-sm text-gray-500 hover:text-indigo-600 py-2">{t('back')}</button>
              <button onClick={finish} disabled={selectedStores.length === 0}
                className="flex-1 bg-indigo-600 text-white font-bold py-3 rounded-lg hover:bg-indigo-700 disabled:opacity-50 transition">
                {t('start')}
              </button>
            </div>
          </>
        )}

      </div>
    </div>
  )
}

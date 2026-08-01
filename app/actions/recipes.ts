'use server'
import { getJson } from 'serpapi'
import { generateRecipes } from '@/lib/gemini'

const countryNames: Record<string, string> = {
  'czech republic': 'cz', 'czechia': 'cz', 'česká republika': 'cz',
  'germany': 'de', 'deutschland': 'de', 'france': 'fr', 'frankreich': 'fr',
  'united kingdom': 'gb', 'uk': 'gb', 'england': 'gb', 'britain': 'gb',
  'spain': 'es', 'españa': 'es', 'italy': 'it', 'italia': 'it',
  'poland': 'pl', 'polska': 'pl', 'austria': 'at', 'österreich': 'at',
  'slovakia': 'sk', 'slovensko': 'sk', 'hungary': 'hu', 'magyarország': 'hu',
  'netherlands': 'nl', 'nederland': 'nl', 'japan': 'jp', '日本': 'jp',
  'australia': 'au', 'canada': 'ca', 'india': 'in', 'brazil': 'br', 'brasil': 'br',
  'usa': 'us', 'united states': 'us', 'america': 'us',
}

const langMap: Record<string, string> = {
  'cz': 'cs', 'de': 'de', 'fr': 'fr', 'gb': 'en', 'es': 'es',
  'it': 'it', 'pl': 'pl', 'at': 'de', 'sk': 'sk', 'hu': 'hu',
  'nl': 'nl', 'jp': 'ja', 'au': 'en', 'ca': 'en', 'in': 'hi',
  'br': 'pt', 'us': 'en',
}

const currencyMap: Record<string, string> = {
  'cz': ' Kč', 'de': '€', 'fr': '€', 'gb': '£', 'es': '€',
  'it': '€', 'pl': 'zł', 'at': '€', 'sk': '€', 'hu': 'Ft',
  'nl': '€', 'jp': '¥', 'au': 'A$', 'ca': 'C$', 'in': '₹',
  'br': 'R$', 'us': '$',
}

const recipeSites: Record<string, string[]> = {
  'cz': ['site:vareni.cz', 'site:recepty.cz', 'site:toprecepty.cz'],
  'sk': ['site:vareni.sk', 'site:recepty.sk'],
  'de': ['site:chefkoch.de', 'site:lecker.de'],
  'fr': ['site:marmiton.org', 'site:cuisineaz.com'],
  'es': ['site:recetasdeescandalo.com', 'site:directoalpaladar.com'],
  'it': ['site:giallozafferano.it', 'site:ricette.giallozafferano.it'],
  'pl': ['site:kwestiasmaku.com', 'site:przepisy.pl'],
  'hu': ['site:nosalty.hu', 'site:receptneked.hu'],
  'gb': ['site:bbcgoodfood.com', 'site:allrecipes.com'],
  'us': ['site:allrecipes.com', 'site:foodnetwork.com'],
}

async function detectCountry(location: string): Promise<string> {
  const lower = location.toLowerCase()
  
  for (const [name, code] of Object.entries(countryNames)) {
    if (lower.includes(name)) return code
  }
  
  try {
    const locations = await getLocations({ q: location, limit: 5 })
    const exactMatch = locations?.find((l: any) => 
      l.name?.toLowerCase().includes(lower) || 
      lower.includes(l.name?.toLowerCase() || '')
    )
    if (exactMatch?.country_code) {
      return exactMatch.country_code.toLowerCase()
    }
  } catch {}

  return 'us'
}

async function getLocations(params: { q: string; limit: number }) {
  const url = `https://serpapi.com/locations.json?q=${encodeURIComponent(params.q)}&limit=${params.limit}`
  const res = await fetch(url)
  return res.json()
}

const searchTerms: Record<string, (food: string) => string> = {
  'cz': (food: string) => `${food} cena sleva`,
  'de': (food: string) => `${food} preis angebot`,
  'fr': (food: string) => `${food} prix promo`,
  'es': (food: string) => `${food} precio oferta`,
  'it': (food: string) => `${food} prezzo offerta`,
  'pl': (food: string) => `${food} cena promocja`,
  'hu': (food: string) => `${food} ár akció`,
  'jp': (food: string) => `${food} 価格 セール`,
}

const leafletTerms: Record<string, (food: string, area: string) => string> = {
  'cz': (food: string, area: string) => `${food} leták akce ${area}`,
  'sk': (food: string, area: string) => `${food} leták akcia ${area}`,
  'pl': (food: string, area: string) => `${food} gazetka promocja ${area}`,
  'hu': (food: string, area: string) => `${food} akciós újság ${area}`,
  'de': (food: string, area: string) => `${food} prospekt angebot ${area}`,
  'at': (food: string, area: string) => `${food} prospekt angebot ${area}`,
}

export async function getMealPlan(prevState: any, formData: FormData) {
  const food = formData.get('food') as string
  const budget = formData.get('budget') as string
  const area = formData.get('area') as string

  const favoriteStoresStr = formData.get('favoriteStores') as string
  const favoriteStores: string[] = favoriteStoresStr ? JSON.parse(favoriteStoresStr) : []
  const profileLanguage = formData.get('profileLanguage') as string || ''
  const profileCurrencySymbol = formData.get('profileCurrencySymbol') as string || ''

  const country = await detectCountry(area)
  const lang = profileLanguage || langMap[country] || 'en'
  const currency = profileCurrencySymbol || currencyMap[country] || '$'

  const storeFilter = favoriteStores.length > 0 ? favoriteStores.join(' ') : ''
  
  const shoppingQuery = searchTerms[country]?.(food) || `${food} price`
  const shoppingQueryWithStores = storeFilter ? `${shoppingQuery} ${storeFilter}` : shoppingQuery
  
  const leafletQuery = leafletTerms[country]?.(food, area)
  const leafletQueryWithStores = leafletQuery && storeFilter 
    ? `${leafletQuery} ${storeFilter}` 
    : leafletQuery

  // Search 1: Google Shopping prices
  const shoppingResults = await getJson({
    engine: 'google_shopping',
    api_key: process.env.SERPAPI_API_KEY,
    q: shoppingQueryWithStores,
    location: area,
    gl: country,
    hl: lang,
    num: 6,
  }).catch(() => ({ shopping_results: [] }))

  // Search 2: Weekly leaflets
  const leafletResults = leafletQueryWithStores ? await getJson({
    engine: 'google',
    api_key: process.env.SERPAPI_API_KEY,
    q: leafletQueryWithStores,
    location: area,
    gl: country,
    hl: lang,
    num: 4,
  }).catch(() => ({ organic_results: [] })) : null

  // Search 3: Fetch REAL recipes from ALL local recipe sites
  let recipeContext = ''
  const sites = recipeSites[country]
  if (sites && sites.length > 0) {
    // Search multiple recipe sites at once
    const recipeSearch = await getJson({
      engine: 'google',
      api_key: process.env.SERPAPI_API_KEY,
      q: `${food} recept ${sites.slice(0, 3).join(' OR ')}`,
      location: area,
      gl: country,
      hl: lang,
      num: 8,
    }).catch(() => ({ organic_results: [] }))

    const results = (recipeSearch.organic_results || []).slice(0, 5)
    
    // Try to fetch the FULL recipe page for each result
    for (const result of results) {
      try {
        // Rotate user agents to avoid blocks
        const agents = [
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
          'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15',
          'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1',
        ]
        const agent = agents[Math.floor(Math.random() * agents.length)]
        
        const pageRes = await fetch(result.link!, {
          headers: { 
            'User-Agent': agent,
            'Accept': 'text/html,application/xhtml+xml',
            'Accept-Language': `${lang},en;q=0.9`,
          },
          signal: AbortSignal.timeout(5000),
        })
        
        if (!pageRes.ok) throw new Error(`HTTP ${pageRes.status}`)
        
        const html = await pageRes.text()
        if (html.length < 500) throw new Error('Page too short')
        
        // Extract meaningful text (remove HTML tags, scripts, nav, header, footer)
        const text = html
          .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
          .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
          .replace(/<nav[^>]*>[\s\S]*?<\/nav>/gi, '')
          .replace(/<header[^>]*>[\s\S]*?<\/header>/gi, '')
          .replace(/<footer[^>]*>[\s\S]*?<\/footer>/gi, '')
          .replace(/<[^>]+>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim()
          .slice(0, 2500)
        
        if (text.length > 200) {
          recipeContext += `\n--- RECIPE FROM: ${result.title} ---\n${text}\n`
        }
      } catch {
        // Fallback: use snippet if page fetch fails
        if (result.snippet && result.snippet.length > 50) {
          recipeContext += `\n--- ${result.title} ---\n${result.snippet}\n`
        }
      }
    }
  }

  const shoppingDeals = (shoppingResults.shopping_results?.slice(0, 6) || []).map((d: any) => ({
    ...d,
    source: d.title?.toLowerCase().includes('hotové') || d.title?.toLowerCase().includes('ready') 
      ? 'premade' 
      : d.title?.toLowerCase().includes('polotovar') || d.title?.toLowerCase().includes('mix') || d.title?.toLowerCase().includes('směs')
      ? 'semifinished'
      : 'raw'
  }))

  const leafletDeals = (leafletResults?.organic_results?.slice(0, 4) || []).map((d: any) => ({
    ...d,
    source: 'leaflet'
  }))

  const dealSummary = [
    ...shoppingDeals.map((d: any) => `${d.title} - ${d.price}`),
    ...leafletDeals.map((d: any) => `📄 ${d.title}`),
  ].join(', ') || 'No deals found'

  const recipes = await generateRecipes(food, budget, dealSummary, currency, recipeContext, lang)

  return {
    deals: shoppingDeals,
    leaflets: leafletDeals,
    recipes,
    currency,
    lastFood: food,
    lastBudget: budget,
    lastArea: area,
  }
}

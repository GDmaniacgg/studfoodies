'use server'
import { getJson } from 'serpapi'
import { generateRecipes, translateRecipes } from '@/lib/gemini'

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

// 🆕 Czech → English food translations for database search
const foodTranslations: Record<string, string> = {
  'dort': 'cake', 'pudink': 'pudding', 'špagety': 'spaghetti',
  'těstoviny': 'pasta', 'kuře': 'chicken', 'hovězí': 'beef',
  'vepřové': 'pork', 'ryba': 'fish', 'polévka': 'soup',
  'salát': 'salad', 'palacinky': 'pancakes', 'lívance': 'pancakes',
  'brambory': 'potato', 'rýže': 'rice', 'sýr': 'cheese',
  'vejce': 'eggs', 'maso': 'meat', 'guláš': 'goulash',
  'řízek': 'schnitzel', 'knedlíky': 'dumplings', 'zelí': 'cabbage',
  'mrkev': 'carrot', 'rajčata': 'tomato', 'cibule': 'onion',
  'česnek': 'garlic', 'houby': 'mushroom', 'smetana': 'cream',
  'máslo': 'butter', 'mouka': 'flour', 'cukr': 'sugar',
  'čokoláda': 'chocolate', 'jahody': 'strawberry', 'jablka': 'apple',
  'banán': 'banana', 'citron': 'lemon', 'tvaroh': 'quark',
}

function translateFood(food: string): string {
  const lower = food.toLowerCase()
  for (const [cz, en] of Object.entries(foodTranslations)) {
    if (lower.includes(cz)) {
      return lower.replace(cz, en)
    }
  }
  return lower
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

  // Search 3: Google rich recipe results as context
  let recipeContext = ''
  const recipeSearch = await getJson({
    engine: 'google',
    api_key: process.env.SERPAPI_API_KEY,
    q: `${food} recept`,
    location: area,
    gl: country,
    hl: lang,
    num: 8,
  }).catch(() => ({ organic_results: [] }))

  const results = (recipeSearch.organic_results || []).slice(0, 6)

  for (const r of results) {
    const recipe = r.rich_snippet?.top?.recipes?.recipe || 
                   r.rich_snippet?.top?.detected_extensions

    if (recipe) {
      recipeContext += `\n--- RECIPE: ${r.title} ---\n`
      if (recipe.ingredients) {
        recipeContext += `Ingredients: ${recipe.ingredients.join(', ')}\n`
      }
      if (recipe.cooking_time) {
        recipeContext += `Cooking time: ${recipe.cooking_time}\n`
      }
      recipeContext += `Description: ${r.snippet || ''}\n`
    } else if (r.snippet && r.snippet.length > 50) {
      recipeContext += `\n--- ${r.title} ---\n${r.snippet}\n`
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

  // 🆕 1. Try real recipes from the 73k database (with translation)
  const { findRecipes } = await import('@/lib/recipeDatabase')
  let recipes = findRecipes(food)
  
  // 2. If nothing found, try with translated food name (e.g. "dort" → "cake")
  if (recipes.length === 0) {
    recipes = findRecipes(translateFood(food))
  }
  
  // 3. If real recipes found, translate them to user's language
  if (recipes.length > 0) {
    recipes = await translateRecipes(recipes, lang)
  } else {
    // 4. Fall back to AI generation
    recipes = await generateRecipes(food, budget, dealSummary, currency, recipeContext, lang)
  }

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

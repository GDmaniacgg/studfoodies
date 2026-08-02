import OpenAI from 'openai'
import * as deepl from 'deepl-node'

const openai = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
})

// DeepL translator instance
const translator = new deepl.Translator(process.env.DEEPL_API_KEY || '')

export async function generateRecipes(
  favoriteFood: string,
  budget: string,
  deals: string,
  currency: string = '$',
  recipeContext: string = '',
  language: string = 'en'
) {
  const response = await openai.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    response_format: { type: "json_object" },
    messages: [{
      role: 'user',
      content: `You are a broke college student's nutritionist.

User wants to cook: ${favoriteFood}
Budget: ${budget}
Local deals: ${deals}
Currency: ${currency}

${recipeContext
  ? `REAL RECIPES FOUND ONLINE (use these as source):\n${recipeContext}`
  : 'No real recipes found online. You MUST create simple homemade recipes from scratch.'
}

LANGUAGE: Respond in ${language}. Write ALL text (recipe names, ingredients, steps) in ${language}.

RULES:
1. ${recipeContext
     ? `EXTRACT 3 real recipes for "${favoriteFood}" from the content above. Only use what's written there.`
     : `CREATE 3 simple homemade variations of "${favoriteFood}" from scratch.`
   }
2. Use the deals ONLY as price references for RAW ingredients
3. DO NOT include pre-made/frozen/instant versions
4. PRICES ARE PURE NUMBERS. NEVER write currency symbols in JSON: "price": 30 is correct, "price": 30 Kč is WRONG
5. Make recipes with 5-8 detailed steps
6. Include how many servings each recipe makes

Output ONLY valid JSON:
{"recipes": [{"name": string, "servings": number, "ingredients": [{"name": string, "price": number}], "total_cost": number, "steps": [string]}]}`
    }]
  })

  const text = response.choices[0].message.content!

  // Try direct parse first (json_object mode should return valid JSON)
  try {
    const parsed = JSON.parse(text)
    const recipes = parsed.recipes || (Array.isArray(parsed) ? parsed : [parsed])
    if (recipes.length > 0 && recipes[0].name) {
      return recipes
    }
  } catch {}

  // Fallback: extract JSON array from text
  const jsonStart = text.indexOf('[')
  const jsonEnd = text.lastIndexOf(']')

  if (jsonStart !== -1 && jsonEnd !== -1) {
    try {
      let json = text.slice(jsonStart, jsonEnd + 1)
      json = json
        .replace(/[\u0000-\u001F\u007F]/g, '')
        .replace(/'/g, '"')
        .replace(/,(\s*[\]}])/g, '$1')
        .replace(/(\{|,)\s*([a-zA-Z_][a-zA-Z0-9_]*)\s*:/g, '$1"$2":')
      return JSON.parse(json)
    } catch {}
  }

  // Last resort: return a simple default recipe
  return [{
    name: `${favoriteFood} - ${language === 'cs' ? 'jednoduše' : 'simple style'}`,
    servings: 2,
    ingredients: [{ name: favoriteFood, price: 50 }],
    total_cost: 50,
    steps: [language === 'cs' ? `Uvařte ${favoriteFood} podle chuti.` : `Cook ${favoriteFood} to your liking.`]
  }]
}

// 🆕 DeepL translation - natural, no hallucinations
export async function translateRecipes(
  recipes: any[],
  language: string
): Promise<any[]> {
  // Already in English (the database language)
  if (!language || language === 'en') return recipes

    // DeepL language codes (lowercase in new API)
  const deeplLangs: Record<string, deepl.TargetLanguageCode> = {
    cs: 'cs', de: 'de', fr: 'fr', es: 'es', it: 'it',
    pl: 'pl', hu: 'hu', nl: 'nl', ja: 'ja', ru: 'ru',
    uk: 'uk', ro: 'ro', bg: 'bg', el: 'el', tr: 'tr',
    sv: 'sv', da: 'da', fi: 'fi', pt: 'pt',
  }

  const targetLang = deeplLangs[language]
  if (!targetLang) return recipes // unsupported language

  try {
    const translated = await Promise.all(recipes.map(async (recipe) => {
      // Translate recipe name
      const nameRes = await translator.translateText(recipe.name || '', 'en', targetLang)

      // Translate each ingredient name
      const ingredients = await Promise.all((recipe.ingredients || []).map(async (ing: any) => {
        try {
          const ingRes = await translator.translateText(ing.name || '', 'en', targetLang)
          return { ...ing, name: ingRes.text }
        } catch {
          return ing // keep original if translation fails
        }
      }))

      // Translate each step
      const steps = await Promise.all((recipe.steps || []).map(async (step: string) => {
        try {
          const stepRes = await translator.translateText(step || '', 'en', targetLang)
          return stepRes.text
        } catch {
          return step
        }
      }))

      return {
        ...recipe,
        name: nameRes.text,
        ingredients,
        steps,
      }
    }))

    return translated
  } catch (err) {
    console.error('DeepL translation failed:', err)
    return recipes // fallback to original English
  }
}

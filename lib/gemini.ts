import OpenAI from 'openai'

const openai = new OpenAI({
  baseURL: 'https://api.groq.com/openai/v1',
  apiKey: process.env.GROQ_API_KEY,
})

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
     ? `EXTRACT 3 real recipes for "${favoriteFood}" from the content above. Only use what\'s written there.`
     : `CREATE 3 simple homemade variations of "${favoriteFood}" from scratch.`
   }
2. Use the deals ONLY as price references for RAW ingredients
3. DO NOT include pre-made/frozen/instant versions
4. Format prices with a space before currency: e.g. "120 ${currency}" not "120${currency}"
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

// 🆕 NEW: Translate real recipes from the database into the user's language
export async function translateRecipes(
  recipes: any[],
  language: string
): Promise<any[]> {
  // Already in the right language
  if (!language || language === 'en') return recipes

  try {
    const response = await openai.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      response_format: { type: "json_object" },
      messages: [{
        role: 'user',
        content: `Translate these cooking recipes into ${language}.

Original recipes (JSON):
${JSON.stringify(recipes)}

Translate ALL text (recipe names, ingredient names, steps) into ${language}.
- Keep the exact same JSON structure
- Keep numbers/amounts unchanged
- Use natural ${language} cooking terminology
- Keep ingredient names as real ${language} ingredient names

Output ONLY valid JSON:
{"recipes": [{"name": string, "servings": number, "ingredients": [{"name": string, "price": number}], "total_cost": number, "steps": [string]}]}`
      }]
    })

    const text = response.choices[0].message.content!
    const parsed = JSON.parse(text)
    const translated = parsed.recipes || parsed
    
    // Only return if translation looks valid
    if (Array.isArray(translated) && translated.length > 0 && translated[0].name) {
      return translated
    }
  } catch {}
  
  // If translation fails, return original recipes
  return recipes
}

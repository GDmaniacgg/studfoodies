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
  recipeContext: string = ''
) {
  const response = await openai.chat.completions.create({
    model: 'llama-3.3-70b-versatile',
    messages: [{
      role: 'user',
      content: `You are a broke college student's nutritionist.

User wants to cook: ${favoriteFood}
Budget: ${budget}
Local deals: ${deals}
Currency: ${currency}

REAL RECIPES FROM LOCAL SITES (use as reference for authentic methods):
${recipeContext || 'No local recipes found, use your traditional knowledge.'}

CRITICAL RULES:
1. Generate 3 HOMEMADE variations of "${favoriteFood}" from scratch
2. Use the deals ONLY as price references for RAW ingredients (flour, eggs, fruit, sugar, oil, meat, vegetables, spices)
3. DO NOT include pre-made/frozen/instant versions of "${favoriteFood}" as ingredients
   - Wrong: "Kynuté knedlíky plněné meruňkami 84,90 Kč" (pre-made product)
   - Right: "mouka 25 Kč", "vajíčka 60 Kč", "meruňky 40 Kč" (raw ingredients)
4. Make recipes with 5-8 detailed steps using TRADITIONAL methods from reference recipes
5. Use REAL package prices from deals for raw ingredients
6. Include how many servings each recipe makes

Output ONLY valid JSON:
[{"name": string, "servings": number, "ingredients": [{"name": string, "price": number}], "total_cost": number, "steps": [string]}]`
    }]
  })

  const text = response.choices[0].message.content!
  
  const jsonStart = text.indexOf('[')
  const jsonEnd = text.lastIndexOf(']')
  
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('AI did not return valid JSON')
  }
  
  let json = text.slice(jsonStart, jsonEnd + 1)
  
  json = json.replace(/[\u0000-\u001F\u007F]/g, '')
       .replace(/\\(?!["\\\/bfnrtu])/g, '\\\\')
  
  return JSON.parse(json)
}

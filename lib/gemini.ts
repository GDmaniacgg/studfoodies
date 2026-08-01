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
    messages: [{
      role: 'user',
      content: `You are a recipe extractor. Below are REAL recipes found online for "${favoriteFood}".

${recipeContext ? `REAL RECIPE CONTENT FROM WEBSITES:\n${recipeContext}` : 'No real recipes were found online.'}

YOUR JOB: Extract the BEST real homemade-style recipes from the content above.
- DO NOT invent or modify ingredients or steps
- DO NOT add your own recipes
- Only use what's actually written in the REAL RECIPE CONTENT
- If you find multiple recipes, pick the 3 best-sounding ones
- Use the deals list ONLY for price references on raw ingredients

Budget: ${budget}
Currency: ${currency}

LANGUAGE: Respond in ${language}. Write ALL text (recipe names, ingredients, steps) in ${language}.

CRITICAL RULES:
1. Extract 3 real homemade variations of "${favoriteFood}" from the content above
2. If the content has LESS than 3 recipes, extract what's available
3. Use the deals ONLY as price references for RAW ingredients (flour, eggs, fruit, sugar, oil, meat, vegetables, spices)
4. DO NOT include pre-made/frozen/instant versions
5. Keep original recipe steps, don't simplify
6. Include how many servings each recipe makes

Output ONLY valid JSON:
[{"name": string, "servings": number, "ingredients": [{"name": string, "price": number}], "total_cost": number, "steps": [string]}]`
    }]
  })

  
  const text = response.choices[0].message.content!
  
  // Extract just the JSON array
  const jsonStart = text.indexOf('[')
  const jsonEnd = text.lastIndexOf(']')
  
  if (jsonStart === -1 || jsonEnd === -1) {
    throw new Error('AI did not return valid JSON')
  }
  
  let json = text.slice(jsonStart, jsonEnd + 1)
  
  // 🔧 Sanitize: remove bad control characters from string values
  json = json.replace(/[\u0000-\u001F\u007F]/g, '')
       .replace(/\\(?!["\\\/bfnrtu])/g, '\\\\')
  
  return JSON.parse(json)
}

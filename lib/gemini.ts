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
  
  // Sanitize: remove bad control characters
  json = json.replace(/[\u0000-\u001F\u007F]/g, '')
       .replace(/\\(?!["\\\/bfnrtu])/g, '\\\\')
  
  return JSON.parse(json)
}

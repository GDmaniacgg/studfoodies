import rawRecipes from '@/data/recipes_raw.json'

interface RecipeIngredient {
  name: string
  price?: number
}

interface Recipe {
  name: string
  servings: number
  ingredients: RecipeIngredient[]
  total_cost: number
  steps: string[]
}

function convertRecipe(raw: any): Recipe {
  return {
    name: raw.name || raw.title || 'Unknown',
    servings: raw.servings || raw.yield || 4,
    ingredients: (raw.ingredients || []).map((i: any) => ({
      name: typeof i === 'string' ? i : (i.name || i.item || ''),
      price: 0
    })),
    total_cost: 0,
    steps: raw.steps || raw.instructions || raw.directions || [],
  }
}

export function findRecipes(food: string, count: number = 3): Recipe[] {
  const lower = food.toLowerCase()
  const foodWords = lower.split(/\s+/).filter(w => w.length > 2)
  
  const matches = rawRecipes
    .filter((r: any) => {
      const name = (r.name || r.title || '').toLowerCase()
      const ingredients = (r.ingredients || []).map((i: any) => 
        (typeof i === 'string' ? i : (i.name || i.item || '')).toLowerCase()
      ).join(' ')
      const searchText = name + ' ' + ingredients
      
      // Score matches by how many food words appear
      const score = foodWords.reduce((acc: number, word: string) => 
        acc + (searchText.includes(word) ? 1 : 0), 0)
      
      return score >= Math.min(1, foodWords.length)
    })
    .slice(0, count)
    .map(convertRecipe)
  
  return matches
}

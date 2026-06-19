// Augment Auth.js session type to include user.id
declare module "next-auth" {
  interface Session {
    user: {
      id: string
      email: string
      name?: string | null
      image?: string | null
    }
  }
}

// Dish recipe types — ingredients/steps are stored as Json (string[]) in Prisma
export interface DishRecipe {
  name: string
  kcal: number
  cookTime: number | null
  ingredients: string[]
  steps: string[]
}

export {}

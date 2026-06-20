import { NextRequest, NextResponse } from "next/server"
import { auth } from "@/lib/auth"
import { db } from "@/lib/db"
import { generateDishRecipe } from "@/lib/ai-weekly"

export async function GET(req: NextRequest): Promise<NextResponse> {
  const session = await auth()
  if (!session?.user?.id) return NextResponse.json({ error: "Unauthorized" }, { status: 401 })
  const userId = session.user.id

  const { searchParams } = req.nextUrl
  const planId = searchParams.get("planId")
  const slotId = searchParams.get("slotId")
  const dayOfWeek = Number(searchParams.get("dayOfWeek"))

  if (!planId || !slotId || isNaN(dayOfWeek)) {
    return NextResponse.json({ error: "Bad request" }, { status: 400 })
  }

  // Ownership check via plan
  const plan = await db.weeklyPlan.findUnique({
    where: { id: planId },
    select: { userId: true },
  })
  if (!plan || plan.userId !== userId) {
    return NextResponse.json({ error: "Not found" }, { status: 404 })
  }

  const dish = await db.plannedDish.findUnique({
    where: { planId_slotId_dayOfWeek: { planId, slotId, dayOfWeek } },
    select: { name: true, kcal: true, cookTime: true, portionWeight: true, ingredients: true, steps: true },
  })
  if (!dish) return NextResponse.json({ error: "Not found" }, { status: 404 })

  const ingredients = dish.ingredients as string[]
  const steps = dish.steps as string[]

  // Return cached if already generated
  if (ingredients.length > 0 && steps.length > 0) {
    return NextResponse.json({ portionWeight: dish.portionWeight, ingredients, steps })
  }

  // Generate and cache
  const recipe = await generateDishRecipe({
    name: dish.name as string,
    kcal: dish.kcal as number,
    cookTime: dish.cookTime ? `${dish.cookTime} хв` : null,
  })

  if (!recipe) {
    return NextResponse.json({ error: "Generation failed" }, { status: 500 })
  }

  await db.plannedDish.update({
    where: { planId_slotId_dayOfWeek: { planId, slotId, dayOfWeek } },
    data: { portionWeight: recipe.portionWeight, ingredients: recipe.ingredients, steps: recipe.steps },
  })

  return NextResponse.json(recipe)
}

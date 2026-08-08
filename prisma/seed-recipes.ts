import { readFileSync } from "node:fs"
import path from "node:path"
import { db } from "../src/lib/db"

// ─── Source JSON shape ────────────────────────────────────────────────────────

interface RawIngredient {
  name: string
  quantity?: number | null
  unit?: string | null
}

interface RawStep {
  description: string
  image?: string | null
}

interface RawNutrition {
  calories?: number | null
  protein?: number | null
  fat?: number | null
  carbohydrates?: number | null
}

interface RawRecipe {
  title: string
  slug: string
  cookingTime?: number | null
  amount?: number | null
  nutritionInfo?: RawNutrition | null
  image?: string | null
  ingredients?: RawIngredient[]
  steps?: RawStep[]
  tags?: string[]
}

const SOURCE_FILE = path.resolve(__dirname, "..", "silpo_recipes_full.json")

// Nutrition in the source JSON is per 100 g of the finished dish. We estimate
// a per-portion value and store THAT, so downstream (weekly plan) can compare
// against per-portion slot targets directly. See STR-151 discussion.
const MIN_PLAUSIBLE_PORTION_G = 100
const FALLBACK_PORTION_G = 300

/** Normalize a unit string: strip non-breaking spaces, trim, lowercase. */
function normalizeUnit(unit: string | null | undefined): string {
  return (unit ?? "").replace(/ /g, " ").trim().toLowerCase()
}

/**
 * Sum the mass of ingredients that carry a gram/ml-based unit and divide by the
 * number of servings to estimate the weight of a single portion in grams.
 * Units other than г/мл/кг/л are too heterogeneous to convert and are skipped.
 * Falls back to a standard 300 g portion when the estimate is implausibly low.
 */
function estimatePortionWeightG(ingredients: RawIngredient[], servings: number | null | undefined): number {
  if (!servings || servings <= 0) return FALLBACK_PORTION_G

  let totalG = 0
  for (const ing of ingredients) {
    if (ing.quantity == null) continue
    const unit = normalizeUnit(ing.unit)
    if (unit === "г" || unit === "мл") totalG += ing.quantity
    else if (unit === "кг" || unit === "л") totalG += ing.quantity * 1000
  }

  const perPortion = totalG / servings
  return perPortion < MIN_PLAUSIBLE_PORTION_G ? FALLBACK_PORTION_G : perPortion
}

/** Scale a per-100g value to a per-portion value, rounded to `decimals`. */
function scaleToPortion(per100g: number | null | undefined, portionG: number, decimals: number): number | null {
  if (per100g == null) return null
  const factor = 10 ** decimals
  return Math.round((per100g * portionG) / 100 * factor) / factor
}

async function main(): Promise<void> {
  const raw = readFileSync(SOURCE_FILE, "utf-8")
  const recipes = JSON.parse(raw) as RawRecipe[]

  if (!Array.isArray(recipes)) {
    throw new Error(`Expected a JSON array in ${SOURCE_FILE}`)
  }

  console.log(`[seed-recipes] Importing ${recipes.length} recipes from ${SOURCE_FILE}`)

  let done = 0
  for (const r of recipes) {
    if (!r.slug) {
      console.warn(`[seed-recipes] Skipping recipe without slug: ${r.title ?? "(no title)"}`)
      continue
    }

    // Nutrition is per 100 g in the source — scale to an estimated per portion.
    const portionG = estimatePortionWeightG(r.ingredients ?? [], r.amount)
    const kcalPortion = scaleToPortion(r.nutritionInfo?.calories, portionG, 0)

    const scalars = {
      title: r.title,
      cookingTime: r.cookingTime ?? null,
      servings: r.amount ?? null,
      kcal: kcalPortion == null ? null : Math.round(kcalPortion),
      protein: scaleToPortion(r.nutritionInfo?.protein, portionG, 1),
      fat: scaleToPortion(r.nutritionInfo?.fat, portionG, 1),
      carbs: scaleToPortion(r.nutritionInfo?.carbohydrates, portionG, 1),
      imageUrl: r.image ?? null,
    }

    const ingredients = (r.ingredients ?? []).map((ing, position) => ({
      name: ing.name,
      quantity: ing.quantity ?? null,
      unit: ing.unit ?? null,
      position,
    }))

    const steps = (r.steps ?? []).map((step, position) => ({
      position,
      description: step.description,
      imageUrl: step.image ?? null,
    }))

    const tagNames = Array.from(new Set(r.tags ?? [])).filter((t) => t.trim().length > 0)

    await db.$transaction(async (tx) => {
      // Upsert the recipe by its unique slug.
      const recipe = await tx.recipe.upsert({
        where: { slug: r.slug },
        create: { slug: r.slug, ...scalars },
        update: scalars,
      })

      // Idempotent re-run: wipe children before recreating.
      await tx.recipeIngredient.deleteMany({ where: { recipeId: recipe.id } })
      await tx.recipeStep.deleteMany({ where: { recipeId: recipe.id } })
      await tx.recipeTag.deleteMany({ where: { recipeId: recipe.id } })

      if (ingredients.length > 0) {
        await tx.recipeIngredient.createMany({
          data: ingredients.map((i) => ({ ...i, recipeId: recipe.id })),
        })
      }

      if (steps.length > 0) {
        await tx.recipeStep.createMany({
          data: steps.map((s) => ({ ...s, recipeId: recipe.id })),
        })
      }

      for (const name of tagNames) {
        const tag = await tx.tag.upsert({
          where: { name },
          create: { name },
          update: {},
        })
        await tx.recipeTag.create({
          data: { recipeId: recipe.id, tagId: tag.id },
        })
      }
    })

    done++
    if (done % 100 === 0) console.log(`[seed-recipes] ${done}/${recipes.length}`)
  }

  const total = await db.recipe.count()
  console.log(`[seed-recipes] Done. ${done} imported, ${total} recipes now in catalog.`)
}

main()
  .catch((err) => {
    console.error("[seed-recipes] Failed:", err)
    process.exit(1)
  })
  .finally(() => {
    void db.$disconnect()
  })

import OpenAI from "openai"
import "server-only"
import { z } from "zod"
import { db } from "@/lib/db"
import { hasHardToChewIngredient } from "@/lib/dietary-filters"

let _client: OpenAI | null = null
function getClient(): OpenAI {
  if (!_client) _client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })
  return _client
}

export interface SlotSpec {
  slotId: string
  name: string
  time: string
  targetKcal: number
}

const int = z.number().transform((v) => Math.round(v))

// Weekly plan: no ingredients/steps — generated lazily per dish
const plannedDishSchema = z.object({
  slotId: z.string(),
  dayOfWeek: int.pipe(z.number().min(0).max(6)),
  name: z.string().min(1),
  kcal: int.pipe(z.number().positive()),
  proteins: int.pipe(z.number().nonnegative()).optional().default(0),
  fats: int.pipe(z.number().nonnegative()).optional().default(0),
  carbs: int.pipe(z.number().nonnegative()).optional().default(0),
  cookTime: z.string(),
})

const coerceToString = z.preprocess(
  (v) => (typeof v === "object" && v !== null ? Object.values(v as Record<string, unknown>).filter(Boolean).join(" ") : v),
  z.string(),
)

const recipeSchema = z.object({
  portionWeight: int.pipe(z.number().positive()),
  ingredients: z.array(coerceToString).min(1),
  steps: z.array(coerceToString).min(1),
})

const weeklyPlanSchema = z.object({
  plan: z.array(plannedDishSchema),
})

export type PlannedDishAI = z.infer<typeof plannedDishSchema>

// Final dish shape returned to callers: cookTime already parsed to minutes,
// ingredients/steps as plain string arrays, and the origin marked via `source`.
export interface WeeklyPlanDish {
  slotId: string
  dayOfWeek: number
  name: string
  kcal: number
  proteins: number
  fats: number
  carbs: number
  cookTime: number | null
  ingredients: string[]
  steps: string[]
  source: "seed" | "ai"
}

async function generateWeeklyPlanAI(params: {
  slots: SlotSpec[]
  kcalFloor: number
  kcalTarget: number
  userNotes?: string
  fromStock?: string[]
}): Promise<PlannedDishAI[] | null> {
  const { slots, kcalFloor, kcalTarget, userNotes, fromStock } = params

  const slotsDesc = slots
    .map(
      (s, i) =>
        `${i + 1}. slotId="${s.slotId}" | прийом="${s.name}" | час=${s.time} | цільові_ккал=${s.targetKcal}`,
    )
    .join("\n")

  const stockLine =
    fromStock && fromStock.length > 0
      ? `Використовуй переважно ці продукти: ${fromStock.join(", ")}.`
      : ""

  const notesLine = userNotes ? `Побажання: ${userNotes}.` : ""

  const userPrompt = `Склади тижневий план харчування на 7 днів (dayOfWeek: 0=Пн, 1=Вт, 2=Ср, 3=Чт, 4=Пт, 5=Сб, 6=Нд).

Прийоми їжі (однакові щодня, ${slots.length} шт.):
${slotsDesc}

Загальний діапазон ккал на день: ${kcalFloor}–${kcalTarget} ккал.
${stockLine}
${notesLine}

ВАЖЛИВО:
- Поле "name" — це КОНКРЕТНА НАЗВА СТРАВИ (наприклад "Вівсяна каша з ягодами", "Курка з рисом", "Омлет з сиром"), НЕ назва прийому їжі ("Сніданок", "Обід" тощо).
- "kcal" — реальна калорійність цієї страви. Варіюй в межах ±40 ккал від цільових_ккал слота, але НЕ ставь однакове значення кожного дня — різні дні мають різні kcal (наприклад 600, 635, 580, 615, 640, 590, 620).
- "proteins", "fats", "carbs" — макронутрієнти в грамах (цілі числа, сума має бути приблизно відповідати kcal: білки×4 + жири×9 + вуглеводи×4 ≈ kcal).
- Страви мають бути РІЗНИМИ: не повторюй однакову страву двічі за тиждень.
- Різні прийоми їжі ОДНОГО ДНЯ не повинні мати однаковий головний білок або базу (якщо на сніданок курка — на обід не курка; якщо є рис — в іншому прийомі не рис того ж дня).
- Чергуй джерела білка по тижню: яйця, курка, риба, бобові, сир, яловичина — не більше 2 разів один білок за тиждень.
- "cookTime" — рядок з часом приготування, наприклад "15 хв", "30 хв".
- НЕ включай ingredients та steps — їх буде згенеровано окремо.

Поверни ТІЛЬКИ JSON (без markdown) у форматі:
{ "plan": [ { "slotId": "...", "dayOfWeek": 0, "name": "Назва страви", "kcal": 620, "proteins": 30, "fats": 15, "carbs": 70, "cookTime": "15 хв" }, ... ] }

Рівно ${slots.length * 7} об'єктів у масиві plan (всі ${slots.length} прийоми × 7 днів).`

  const abort = AbortSignal.timeout(90_000)

  try {
    const response = await getClient().chat.completions.create(
      {
        model: "gpt-4o-mini",
        max_tokens: 4000,
        temperature: 0.8,
        response_format: { type: "json_object" },
        messages: [
          {
            role: "system",
            content:
              "Ти кулінарний помічник. Генеруєш тижневі плани харчування з конкретними назвами страв. Використовуй ТІЛЬКИ реальні кулінарні терміни та назви страв — без вульгарних, образливих або вигаданих слів. Відповідай ВИКЛЮЧНО валідним JSON без markdown-обгортки.",
          },
          { role: "user", content: userPrompt },
        ],
      },
      { signal: abort },
    )

    const raw = response.choices[0]?.message?.content
    if (!raw) return null

    const parsed = weeklyPlanSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      console.error("[ai-weekly] Zod parse error:", parsed.error.issues)
      return null
    }

    // Attach empty ingredients/steps — generated lazily per dish
    return parsed.data.plan.map((d) => ({
      ...d,
      ingredients: [] as string[],
      steps: [] as string[],
    }))
  } catch (err) {
    console.error("[ai-weekly] generateWeeklyPlan error:", err)
    return null
  }
}

// ─── Catalog-backed weekly plan ───────────────────────────────────────────────

// The data uses three different apostrophe glyphs for "м'ясо" — match them all.
const MEAT_TAGS = ["м’ясо", "м'ясо", "мʼясо"]

// Tag categories that must never appear in any meal slot of a food plan —
// alcoholic cocktails and drinks are inappropriate as meals regardless of
// calorie fit. These are enforced both by exclusion from every slot's accepted
// tag list and by a hard NOT filter on the catalog query below.
const EXCLUDED_TAGS = ["коктейль", "напої", "напій", "алкоголь", "смузі"]

const BREAKFAST_TAGS = ["сніданок", "випічка", "оладки", "сирники", "млинці", "запіканка"]
const SNACK_TAGS = [
  "закуска", "закуски", "десерт", "салат", "салати", "фрукти", "ягоди",
  "перекус", "сендвіч",
]
const LUNCH_TAGS = [
  "перша страва", "перші страви", "суп", "супи", "борщ", "крем-суп",
  "основна страва", "основні страви", "гарнір", "риба", "птиця", "курка", "паста",
  ...MEAT_TAGS,
]
const DINNER_TAGS = [
  "вечеря", "основна страва", "основні страви", "риба", "морепродукти",
  "птиця", "курка", "салат", "овочі", "гарнір", ...MEAT_TAGS,
]
const LATE_TAGS = ["десерт", "салат", "сир", "протеїн", "закуска"]
const DEFAULT_TAGS = ["основні страви", "основна страва", "салат", "суп", "гарнір", "риба", ...MEAT_TAGS]

function acceptedTagsForSlot(slotName: string): string[] {
  const n = slotName.trim().toLowerCase()
  if (n.includes("сніда")) return BREAKFAST_TAGS
  if (n.includes("обід")) return LUNCH_TAGS
  if (n.includes("вечер")) return DINNER_TAGS
  if (n.includes("сном") || n.includes("ніч")) return LATE_TAGS
  if (n.includes("перекус") || n.includes("снек") || n.includes("ланч")) return SNACK_TAGS
  return DEFAULT_TAGS
}

// Minimal structural shape of a catalog recipe row with its relations.
interface CatalogRecipe {
  slug: string
  title: string
  kcal: number | null
  protein: number | null
  fat: number | null
  carbs: number | null
  cookingTime: number | null
  ingredients: { name: string; quantity: number | null; unit: string | null }[]
  steps: { description: string }[]
}

function formatIngredient(i: { name: string; quantity: number | null; unit: string | null }): string {
  const parts = [i.name.trim()]
  if (i.quantity != null) parts.push(String(i.quantity))
  if (i.unit && i.unit.trim()) parts.push(i.unit.trim())
  return parts.join(" ")
}

function catalogToDish(r: CatalogRecipe, slotId: string, dayOfWeek: number): WeeklyPlanDish {
  return {
    slotId,
    dayOfWeek,
    name: r.title,
    kcal: r.kcal ?? 0,
    proteins: Math.round(r.protein ?? 0),
    fats: Math.round(r.fat ?? 0),
    carbs: Math.round(r.carbs ?? 0),
    cookTime: r.cookingTime ?? null,
    ingredients: r.ingredients.map(formatIngredient),
    steps: r.steps.map((s) => s.description),
    source: "seed",
  }
}

function shuffle<T>(arr: T[]): void {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[arr[i], arr[j]] = [arr[j], arr[i]]
  }
}

function parseCookTimeStr(raw: string): number | null {
  const match = raw.match(/\d+/)
  return match ? parseInt(match[0], 10) : null
}

/**
 * Build a weekly plan, preferring dishes from the recipe catalog and falling
 * back to OpenAI only for slot/day cells the catalog cannot fill.
 *
 * Catalog selection per slot: recipes tagged for that meal, with per-portion
 * kcal within ±15% of the slot target, excluding anything containing a
 * hard-to-chew ingredient, and without repeating a recipe across the week.
 */
export async function generateWeeklyPlan(params: {
  slots: SlotSpec[]
  kcalFloor: number
  kcalTarget: number
  userNotes?: string
  fromStock?: string[]
}): Promise<WeeklyPlanDish[] | null> {
  const { slots } = params
  const DAYS = 7
  const usedSlugs = new Set<string>()
  const results: WeeklyPlanDish[] = []
  const uncovered: { slotId: string; dayOfWeek: number }[] = []

  for (const slot of slots) {
    const lo = Math.round(slot.targetKcal * 0.85)
    const hi = Math.round(slot.targetKcal * 1.15)
    const tags = acceptedTagsForSlot(slot.name)

    let candidates: CatalogRecipe[] = []
    try {
      const recipes = await db.recipe.findMany({
        where: {
          kcal: { gte: lo, lte: hi },
          tags: { some: { tag: { name: { in: tags } } } },
          // Never surface cocktails/drinks in a meal slot, even if the recipe
          // also carries an otherwise-accepted tag.
          NOT: { tags: { some: { tag: { name: { in: EXCLUDED_TAGS } } } } },
        },
        include: {
          ingredients: { orderBy: { position: "asc" } },
          steps: { orderBy: { position: "asc" } },
        },
        take: 200,
      })
      candidates = recipes.filter((r) => !hasHardToChewIngredient(r.ingredients.map((i) => i.name)))
    } catch (err) {
      console.error("[ai-weekly] catalog query failed:", err)
      candidates = []
    }

    shuffle(candidates)

    for (let day = 0; day < DAYS; day++) {
      const pick = candidates.find((r) => !usedSlugs.has(r.slug))
      if (!pick) {
        uncovered.push({ slotId: slot.slotId, dayOfWeek: day })
        continue
      }
      usedSlugs.add(pick.slug)
      results.push(catalogToDish(pick, slot.slotId, day))
    }
  }

  // Fill any cells the catalog could not cover via the existing OpenAI path.
  if (uncovered.length > 0) {
    const ai = await generateWeeklyPlanAI(params)
    if (ai) {
      const byCell = new Map<string, PlannedDishAI>()
      for (const d of ai) byCell.set(`${d.slotId}:${d.dayOfWeek}`, d)
      for (const cell of uncovered) {
        const d = byCell.get(`${cell.slotId}:${cell.dayOfWeek}`)
        if (!d) continue
        results.push({
          slotId: cell.slotId,
          dayOfWeek: cell.dayOfWeek,
          name: d.name,
          kcal: d.kcal,
          proteins: d.proteins,
          fats: d.fats,
          carbs: d.carbs,
          cookTime: parseCookTimeStr(d.cookTime),
          ingredients: [],
          steps: [],
          source: "ai",
        })
      }
    }
  }

  return results.length > 0 ? results : null
}

// ─── Lazy recipe generation ───────────────────────────────────────────────────

export async function generateDishRecipe(params: {
  name: string
  kcal: number
  cookTime: string | null
}): Promise<{ portionWeight: number; ingredients: string[]; steps: string[] } | null> {
  const { name, kcal, cookTime } = params

  const prompt = `Склади рецепт для страви "${name}" на 1 порцію (~${kcal} ккал${cookTime ? `, час приготування: ${cookTime}` : ""}).

Поверни ТІЛЬКИ JSON без markdown:
{ "portionWeight": 320, "ingredients": ["150г курячого філе", "2 яйця", ...], "steps": ["Крок 1...", "Крок 2...", ...] }

ВАЖЛИВО:
- portionWeight — загальна вага готової 1 порції в грамах (ціле число).
- ingredients — масив РЯДКІВ (не об'єктів), кількості розраховані рівно на 1 порцію.
- steps — масив РЯДКІВ, 4–6 кроків приготування українською.`

  const abort = AbortSignal.timeout(30_000)

  try {
    const response = await getClient().chat.completions.create(
      {
        model: "gpt-4o-mini",
        max_tokens: 800,
        temperature: 0.7,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: "Ти кулінарний помічник. Використовуй ТІЛЬКИ реальні кулінарні терміни — без вульгарних або вигаданих слів. Відповідай ВИКЛЮЧНО валідним JSON." },
          { role: "user", content: prompt },
        ],
      },
      { signal: abort },
    )

    const raw = response.choices[0]?.message?.content
    if (!raw) return null

    const parsed = recipeSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) {
      console.error("[ai-weekly] recipe Zod error:", parsed.error.issues)
      return null
    }
    return parsed.data
  } catch (err) {
    console.error("[ai-weekly] generateDishRecipe error:", err)
    return null
  }
}

export async function regenerateSinglePlannedDish(params: {
  slotName: string
  slotTime: string
  targetKcal: number
  dayOfWeek: number
  currentName: string
  userNote?: string
  fromStock?: string[]
}): Promise<PlannedDishAI | null> {
  const { slotName, slotTime, targetKcal, dayOfWeek, currentName, userNote, fromStock } = params

  const dayNames = ["Понеділок", "Вівторок", "Середа", "Четвер", "П'ятниця", "Субота", "Неділя"]

  const stockLine =
    fromStock && fromStock.length > 0
      ? `Використовуй переважно ці продукти: ${fromStock.join(", ")}.`
      : ""

  const noteLine = userNote ? `Побажання: ${userNote}.` : ""

  const userPrompt = [
    `День: ${dayNames[dayOfWeek]}.`,
    `Прийом їжі: ${slotName} (${slotTime}), ціль ${targetKcal} ккал (±40 ккал).`,
    `Поточна страва (яку треба замінити): ${currentName}.`,
    stockLine,
    noteLine,
    `Запропонуй ІНШУ страву. JSON: { "slotId": "", "dayOfWeek": ${dayOfWeek}, "name": string, "kcal": number, "proteins": number, "fats": number, "carbs": number, "cookTime": string, "ingredients": string[], "steps": string[] }`,
  ]
    .filter(Boolean)
    .join(" ")

  try {
    const response = await getClient().chat.completions.create({
      model: "gpt-4o-mini",
      max_tokens: 600,
      temperature: 0.8,
      response_format: { type: "json_object" },
      messages: [
        {
          role: "system",
          content: "Ти кулінарний помічник. Відповідай ВИКЛЮЧНО валідним JSON.",
        },
        { role: "user", content: userPrompt },
      ],
    })

    const raw = response.choices[0]?.message?.content
    if (!raw) return null

    const parsed = plannedDishSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null

    return parsed.data
  } catch {
    return null
  }
}

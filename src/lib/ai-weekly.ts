import OpenAI from "openai"
import "server-only"
import { z } from "zod"

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

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

export async function generateWeeklyPlan(params: {
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
    const response = await client.chat.completions.create(
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
    const response = await client.chat.completions.create(
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
    const response = await client.chat.completions.create({
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

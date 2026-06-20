import OpenAI from "openai"
import "server-only"
import { z } from "zod"

const client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY })

const dishSchema = z.object({
  name: z.string().min(1),
  kcal: z.number().int().positive(),
  cookTime: z.string().min(1),
  ingredients: z.array(z.string()).min(1),
  steps: z.array(z.string()).min(1),
})

export type GeneratedDish = z.infer<typeof dishSchema>

export async function regenerateDish(params: {
  slotName: string
  slotTime: string
  targetKcal: number
  currentDishName: string
  fromStock?: string[]
}): Promise<GeneratedDish | null> {
  const { slotName, slotTime, targetKcal, currentDishName, fromStock } = params

  const stockLine =
    fromStock && fromStock.length > 0
      ? `Використовуй переважно ці продукти: ${fromStock.join(", ")}.`
      : ""

  const userPrompt = [
    `Прийом їжі: ${slotName} (${slotTime}).`,
    `Цільова калорійність: ${targetKcal} ккал (±40 ккал).`,
    `Поточна страва (яку треба замінити): ${currentDishName}.`,
    stockLine,
    `Запропонуй ІНШУ страву. Відповідай ВИКЛЮЧНО JSON:`,
    `{ "name": string, "kcal": number, "cookTime": string, "ingredients": string[], "steps": string[] }`,
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

    const parsed = dishSchema.safeParse(JSON.parse(raw))
    if (!parsed.success) return null

    return parsed.data
  } catch {
    return null
  }
}

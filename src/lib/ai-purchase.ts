import OpenAI from "openai"
import { z } from "zod"

let _openai: OpenAI | null = null
function getClient(): OpenAI {
  if (!_openai) _openai = new OpenAI()
  return _openai
}

const itemSchema = z.object({
  name: z.string(),
  qty: z.string().nullable().optional(),
})

export async function aggregateShoppingList(
  ingredients: string[],
): Promise<{ name: string; qty: string | null }[]> {
  if (ingredients.length === 0) return []

  const response = await getClient().chat.completions.create({
    model: "gpt-4o-mini",
    max_tokens: 1200,
    temperature: 0.1,
    response_format: { type: "json_object" },
    messages: [
      {
        role: "system",
        content: `Ти складаєш список покупок на тиждень на основі інгредієнтів рецептів.

Правила:
- Об'єднай однакові або схожі продукти (наприклад, "курячого філе", "куряче філе", "філе курки" → одна позиція "Куряче філе")
- Підсумуй кількості де можливо (150г + 200г + 100г = 450г)
- Назви у називному відмінку, з великої літери ("Оливкова олія", "Куряче філе")
- "qty" — скільки купити, наприклад "450г", "3 шт", "1 упаковка", "за смаком". Може бути null.
- Спеції "за смаком" — без кількості (qty: null)
- Не включай воду
- Поверни JSON: {"items": [{"name": "...", "qty": "..."}]}`,
      },
      {
        role: "user",
        content: `Список інгредієнтів на тиждень:\n${ingredients.join("\n")}`,
      },
    ],
  })

  const raw = response.choices[0]?.message?.content ?? ""
  try {
    const parsed = JSON.parse(raw)
    const items = z.array(itemSchema).parse(parsed.items ?? [])
    return items.map((i) => ({ name: i.name, qty: i.qty ?? null }))
  } catch {
    return []
  }
}

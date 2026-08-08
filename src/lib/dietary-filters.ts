// Keywords for foods that are hard to chew for users wearing aligners
// (nuts, seeds, crunchy/hard items, hard candy). Matched case-insensitively
// against ingredient names. Deliberately kept as a simple, extendable list —
// add new stems here as we discover more problematic ingredients.
export const HARD_TO_CHEW_KEYWORDS: readonly string[] = [
  "горіх", // walnuts / nuts (stem covers горіхи, горіховий, ...)
  "мигдал", // almond
  "фісташ", // pistachio
  "кеш'ю", // cashew (typographic apostrophe)
  "кешью", // cashew (plain spelling)
  "арахіс", // peanut
  "насінн", // seeds (насіння, насінник)
  "сухар", // rusks / croutons
  "чіпс", // chips
  "хрумк", // crunchy (хрумкий, хрумкі)
  "льодяник", // hard candy / lollipop
  "карамель", // (hard) caramel
] as const

/**
 * True when the given text contains any hard-to-chew keyword.
 * Comparison is case-insensitive.
 */
export function isHardToChew(text: string): boolean {
  const lower = text.toLowerCase()
  return HARD_TO_CHEW_KEYWORDS.some((keyword) => lower.includes(keyword))
}

/**
 * True when any ingredient name in the list is hard to chew.
 */
export function hasHardToChewIngredient(ingredientNames: readonly string[]): boolean {
  return ingredientNames.some(isHardToChew)
}

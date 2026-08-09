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

// ─── Per-user dietary restrictions ────────────────────────────────────────────

// Maps a managed restriction flag (stored in Profile.dietaryRestrictions) to the
// ingredient-name stems it excludes. Matched case-insensitively as substrings.
// Deliberately small on purpose — extend by adding entries here. `vegetarian`
// has no keyword list: meat exclusion is enforced at the tag/query level.
export const RESTRICTION_KEYWORDS: Record<string, readonly string[]> = {
  soft_food: HARD_TO_CHEW_KEYWORDS, // aligners/braces: reuse the existing list
  no_nuts: ["горіх", "мигдал", "фісташ", "кеш'ю", "кешью", "арахіс"], // nut allergy
  no_dairy: ["молок", "сир", "сметан", "вершк", "йогурт", "кефір", "масло", "творог"],
  no_gluten: ["пшениц", "борошн", "хліб", "макарон", "паст", "манк", "сухар", "панірув", "булгур", "кускус"],
}

// Canonical set of managed restriction flags, in display order. `vegetarian`
// is enforced at the tag level and so has no keyword entry above, but is still
// a valid flag. Used to validate form input and render settings checkboxes.
export const DIETARY_RESTRICTIONS = [
  { value: "soft_food", label: "М'яка їжа (елайнери/брекети)" },
  { value: "no_nuts", label: "Без горіхів (алергія)" },
  { value: "vegetarian", label: "Вегетаріанство (без м'яса/риби/птиці)" },
  { value: "no_dairy", label: "Без молочних продуктів" },
  { value: "no_gluten", label: "Без глютену" },
] as const

export const DIETARY_RESTRICTION_VALUES = DIETARY_RESTRICTIONS.map((r) => r.value)

/**
 * Build the flat list of excluded ingredient-name stems for a set of
 * restriction flags. Unknown flags are ignored. Empty input → empty list
 * (i.e. no filtering — the full catalog stays available).
 */
export function buildExcludedKeywords(restrictions: readonly string[]): string[] {
  return [...new Set(restrictions.flatMap((r) => RESTRICTION_KEYWORDS[r] ?? []))]
}

/**
 * True when any ingredient name contains one of the given excluded keywords.
 * Empty keyword list → always false.
 */
export function hasExcludedIngredient(
  ingredientNames: readonly string[],
  excludedKeywords: readonly string[],
): boolean {
  if (excludedKeywords.length === 0) return false
  return ingredientNames.some((name) => {
    const lower = name.toLowerCase()
    return excludedKeywords.some((keyword) => lower.includes(keyword))
  })
}

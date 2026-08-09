import "server-only"
import { callSilpoTool } from "@/lib/silpo-mcp-client"

/** One aggregated shopping-list line to resolve against the Silpo catalog. */
export interface SilpoCartItem {
  name: string
  qty?: string | null
}

/**
 * Extract a plain JS object from an MCP tool result. Prefers `structuredContent`
 * and falls back to parsing the first text block as JSON, so we tolerate both
 * shapes the Silpo tools may return.
 */
function unwrap(result: unknown): Record<string, unknown> {
  if (!result || typeof result !== "object") return {}
  const r = result as Record<string, unknown>

  if (r.structuredContent && typeof r.structuredContent === "object") {
    return r.structuredContent as Record<string, unknown>
  }
  const content = r.content
  if (Array.isArray(content)) {
    for (const block of content) {
      if (block && typeof block === "object" && (block as Record<string, unknown>).type === "text") {
        const text = (block as Record<string, unknown>).text
        if (typeof text === "string") {
          try {
            const parsed = JSON.parse(text)
            if (parsed && typeof parsed === "object") return parsed as Record<string, unknown>
          } catch {
            /* not JSON — ignore */
          }
        }
      }
    }
  }
  return r
}

/** Find the first defined value across a list of candidate keys. */
function pick<T = unknown>(obj: Record<string, unknown>, keys: string[]): T | undefined {
  for (const key of keys) {
    if (obj[key] !== undefined && obj[key] !== null) return obj[key] as T
  }
  return undefined
}

/**
 * Build a real Silpo cart from the aggregated weekly-plan shopping list and
 * return a checkout web link. Follows the official MCP tool flow described in
 * STR-154. Returns null on any failure so callers can fall back to the plain
 * text list without surfacing an error to the user.
 */
export async function buildSilpoCart(
  userId: string,
  items: SilpoCartItem[],
): Promise<string | null> {
  if (items.length === 0) {
    console.warn("[silpo-cart] empty items list — nothing to build")
    return null
  }

  try {
    // 1. Resolve the user's active cart id.
    const cart = unwrap(await callSilpoTool(userId, "silpo_get_my_shopping_cart"))
    const cartId = pick<string>(cart, ["cartId", "id"])
    if (!cartId) {
      console.warn("[silpo-cart] no cartId in silpo_get_my_shopping_cart response", cart)
      return null
    }

    // 2. Cart details → branch / delivery context.
    const cartDetails = unwrap(
      await callSilpoTool(userId, "silpo_get_shopping_cart_by_id", { cartId }),
    )
    const branchId = pick<string>(cartDetails, ["branchId", "branchGuid"])
    const deliveryType = pick<string>(cartDetails, ["deliveryType"])
    if (!branchId) {
      console.warn(
        "[silpo-cart] no branchId in silpo_get_shopping_cart_by_id response (continuing without it)",
        cartDetails,
      )
    }

    // 3. Validate delivery slot availability (best-effort; ignore failures).
    if (branchId) {
      await callSilpoTool(userId, "silpo_get_time_slots", {
        branchId,
        ...(deliveryType ? { deliveryType } : {}),
      }).catch(() => undefined)
    }

    // 4. Resolve catalog products for every ingredient in one batch.
    const batch = unwrap(
      await callSilpoTool(userId, "silpo_find_products_batch", {
        ...(branchId ? { branchId } : {}),
        queries: items.map((i) => i.name),
      }),
    )
    console.log(
      "[silpo-cart] raw silpo_find_products_batch response",
      JSON.stringify(batch),
    )
    const products = extractProducts(batch)
    if (products.length === 0) {
      console.warn(
        "[silpo-cart] no products resolved from silpo_find_products_batch response",
        batch,
      )
      return null
    }

    // 5. Add all resolved products to the cart.
    await callSilpoTool(userId, "silpo_add_or_update_cart_products", {
      cartId,
      products: products.map((p) => ({ ...p, quantity: 1 })),
    })

    // 6. Re-read the cart to obtain the checkout link.
    const finalCart = unwrap(
      await callSilpoTool(userId, "silpo_get_shopping_cart_by_id", { cartId }),
    )
    const checkoutUrl = pick<string>(finalCart, ["checkoutWebLink", "checkoutUrl", "webLink"])
    if (!checkoutUrl) {
      console.warn(
        "[silpo-cart] no checkout link in final silpo_get_shopping_cart_by_id response",
        finalCart,
      )
      return null
    }
    return checkoutUrl
  } catch (err) {
    console.error("[silpo-cart] build failed", err)
    return null
  }
}

/** Normalise the products array from a find-products-batch response. */
function extractProducts(batch: Record<string, unknown>): Array<{
  productId: string
  companyId?: string
  branchId?: string
}> {
  const raw =
    pick<unknown[]>(batch, ["products", "results", "items"]) ??
    (Array.isArray(batch) ? (batch as unknown[]) : [])
  if (!Array.isArray(raw)) return []

  const out: Array<{ productId: string; companyId?: string; branchId?: string }> = []
  for (const entry of raw) {
    if (!entry || typeof entry !== "object") continue
    const e = entry as Record<string, unknown>
    // Some batch shapes nest the best match under `product`/`bestMatch`.
    const match = (pick<Record<string, unknown>>(e, ["product", "bestMatch"]) ?? e) as Record<
      string,
      unknown
    >
    const productId = pick<string>(match, ["productId", "id"])
    if (!productId) continue
    out.push({
      productId,
      companyId: pick<string>(match, ["companyId"]),
      branchId: pick<string>(match, ["branchId"]),
    })
  }
  return out
}

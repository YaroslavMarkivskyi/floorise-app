import "server-only"

// Anthropic API wrapper — server-side only.
// Key is read from process.env.ANTHROPIC_API_KEY; never expose to client.

export async function generateDish(prompt: string, signal?: AbortSignal): Promise<string> {
  const res = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    signal,
    headers: {
      "x-api-key": process.env.ANTHROPIC_API_KEY!,
      "anthropic-version": "2023-06-01",
      "content-type": "application/json",
    },
    body: JSON.stringify({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 1024,
      messages: [{ role: "user", content: prompt }],
    }),
  })

  if (!res.ok) {
    throw new Error(`Anthropic API error: ${res.status}`)
  }

  const data = (await res.json()) as { content: Array<{ type: string; text: string }> }
  return data.content[0]?.text ?? ""
}

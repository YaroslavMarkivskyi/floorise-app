import "server-only"

// Telegram Bot API wrapper — server-side only.
// Token is read from process.env.TELEGRAM_BOT_TOKEN; never expose to client.

const BASE = `https://api.telegram.org/bot${process.env.TELEGRAM_BOT_TOKEN}`

async function call(method: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(`${BASE}/${method}`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`Telegram API error: ${res.status}`)
}

export async function sendMessage(chatId: string, text: string): Promise<void> {
  await call("sendMessage", { chat_id: chatId, text, parse_mode: "HTML" })
}

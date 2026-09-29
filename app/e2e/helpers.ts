const mailpit = process.env.LOCAL_MAILPIT_URL ?? "http://127.0.0.1:54324";

async function messageIds(address: string): Promise<string[]> {
  const list = await fetch(
    `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
  );
  const { messages = [] } = (await list.json()) as { messages?: { ID: string }[] };
  return messages.map((m) => m.ID);
}

/** IDs of emails already delivered to `address`, so a later wait can ignore them. */
export async function existingEmailIds(address: string): Promise<Set<string>> {
  return new Set(await messageIds(address));
}

/**
 * Waits for a NEW email to `address` (not one in `ignore`) and returns the
 * sign-in link inside it.
 */
export async function waitForSignInLink(
  address: string,
  ignore: Set<string> = new Set(),
): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const fresh = (await messageIds(address)).filter((id) => !ignore.has(id));
    if (fresh.length > 0) {
      const detail = await fetch(`${mailpit}/api/v1/message/${fresh[0]}`);
      const { HTML, Text } = (await detail.json()) as { HTML: string; Text: string };
      const match = `${HTML} ${Text}`.match(/https?:\/\/[^\s"'<>]+\/auth\/confirm\?[^\s"'<>]+/);
      if (match) return match[0].replace(/&amp;/g, "&");
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`No sign-in email arrived for ${address}`);
}

export function uniqueEmail(label: string) {
  return `${label}-${Date.now()}-${Math.floor(Math.random() * 1e6)}@example.test`;
}

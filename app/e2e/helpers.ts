const mailpit = process.env.LOCAL_MAILPIT_URL ?? "http://127.0.0.1:54324";

/** Waits for the newest email to `address` and returns the sign-in link inside it. */
export async function waitForSignInLink(address: string): Promise<string> {
  const deadline = Date.now() + 15_000;
  while (Date.now() < deadline) {
    const list = await fetch(
      `${mailpit}/api/v1/search?query=${encodeURIComponent(`to:${address}`)}`,
    );
    const { messages = [] } = (await list.json()) as {
      messages?: { ID: string }[];
    };
    if (messages.length > 0) {
      const detail = await fetch(`${mailpit}/api/v1/message/${messages[0].ID}`);
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

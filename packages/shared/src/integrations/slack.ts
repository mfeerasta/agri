// Minimal Slack/Discord-compatible incoming-webhook poster.
// Discord accepts the same {content} shape so a single helper covers both.

export interface SlackPostInput {
  webhookUrl: string;
  text: string;
  username?: string;
  iconEmoji?: string;
}

export interface SlackPostResult {
  ok: boolean;
  detail?: string;
}

export async function postSlackMessage(input: SlackPostInput): Promise<SlackPostResult> {
  try {
    const res = await fetch(input.webhookUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        text: input.text,
        content: input.text, // Discord-compatible
        username: input.username,
        icon_emoji: input.iconEmoji,
      }),
    });
    if (!res.ok) return { ok: false, detail: `HTTP ${res.status}` };
    return { ok: true };
  } catch (err) {
    return { ok: false, detail: (err as Error).message };
  }
}

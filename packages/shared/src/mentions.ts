/**
 * Mention parser. Markdown-style `@[Display Name](user-uuid)` tokens.
 * Returns plaintext with the bracket syntax flattened to `@Display Name`
 * plus a deduped list of UUIDs.
 */

const MENTION_RE = /@\[([^\]]+)\]\(([0-9a-fA-F-]{36})\)/g;

export interface ParsedMentions {
  plainText: string;
  mentions: string[];
}

export function parseMentions(body: string): ParsedMentions {
  const ids = new Set<string>();
  const plainText = body.replace(MENTION_RE, (_full, name: string, id: string) => {
    ids.add(id);
    return `@${name}`;
  });
  return { plainText, mentions: [...ids] };
}

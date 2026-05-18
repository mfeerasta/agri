/**
 * One-off: render docs/mf-brief.md and docs/release-notes-v1.0.md to PDF using
 * @react-pdf/renderer. Run with:
 *   pnpm --filter @zameen/web exec tsx scripts/build-mf-brief.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, renderToFile } from '@react-pdf/renderer';

const DEEP_GREEN = '#1B4332';
const OCHRE = '#D4A574';
const INK = '#1a1a1a';
const MUTED = '#555';

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, color: INK, lineHeight: 1.5, fontFamily: 'Helvetica' },
  brand: { color: OCHRE, fontSize: 9, letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' },
  h1: { fontSize: 22, color: DEEP_GREEN, marginBottom: 12, fontFamily: 'Helvetica-Bold' },
  h2: { fontSize: 13, color: DEEP_GREEN, marginTop: 14, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  p: { marginBottom: 6 },
  li: { marginLeft: 12, marginBottom: 3 },
  footer: { position: 'absolute', bottom: 28, left: 48, right: 48, fontSize: 8, color: MUTED, borderTop: `1pt solid ${OCHRE}`, paddingTop: 6 },
});

interface Block {
  kind: 'h1' | 'h2' | 'p' | 'li';
  text: string;
}

function parseMarkdown(src: string): Block[] {
  const out: Block[] = [];
  for (const rawLine of src.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith('# ')) out.push({ kind: 'h1', text: line.slice(2) });
    else if (line.startsWith('## ')) out.push({ kind: 'h2', text: line.slice(3) });
    else if (/^[-*]\s/.test(line)) out.push({ kind: 'li', text: line.replace(/^[-*]\s/, '') });
    else if (/^\d+\.\s/.test(line)) out.push({ kind: 'li', text: line.replace(/^\d+\.\s/, '') });
    else out.push({ kind: 'p', text: line });
  }
  return out;
}

function renderDoc(title: string, blocks: Block[]) {
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A4', style: styles.page },
      React.createElement(Text, { style: styles.brand }, 'Zameen · Rupafab Agri'),
      React.createElement(
        View,
        null,
        ...blocks.map((b, i) => {
          if (b.kind === 'h1') return React.createElement(Text, { key: i, style: styles.h1 }, b.text);
          if (b.kind === 'h2') return React.createElement(Text, { key: i, style: styles.h2 }, b.text);
          if (b.kind === 'li') return React.createElement(Text, { key: i, style: styles.li }, `• ${b.text}`);
          return React.createElement(Text, { key: i, style: styles.p }, b.text);
        }),
      ),
      React.createElement(Text, { style: styles.footer, fixed: true }, `${title} · agri.feerasta.ai`),
    ),
  );
}

async function build(mdPath: string, pdfPath: string, title: string): Promise<void> {
  const md = readFileSync(mdPath, 'utf8');
  const blocks = parseMarkdown(md);
  await renderToFile(renderDoc(title, blocks) as never, pdfPath);
  process.stdout.write(`wrote ${pdfPath}\n`);
}

async function main(): Promise<void> {
  const docs = resolve(process.cwd(), '../../docs');
  await build(`${docs}/mf-brief.md`, `${docs}/mf-brief.pdf`, 'Executive brief');
  await build(`${docs}/release-notes-v1.0.md`, `${docs}/release-notes-v1.0.pdf`, 'Release notes v1.0');
}

main().catch((err) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});

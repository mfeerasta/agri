/**
 * Render docs/worker-handbook-ur.md to PDF using @react-pdf/renderer.
 * Urdu Nastaliq script with RTL layout. Run with:
 *   pnpm --filter @zameen/web exec tsx scripts/build-worker-handbook.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, renderToFile } from '@react-pdf/renderer';

const DEEP_GREEN = '#1B4332';
const OCHRE = '#D4A574';
const INK = '#1a1a1a';
const MUTED = '#555';

// Noto Nastaliq Urdu, served from Google Fonts static. Registered at build time.
Font.register({
  family: 'NotoNastaliqUrdu',
  fonts: [
    { src: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoNastaliqUrdu/NotoNastaliqUrdu-Regular.ttf' },
    {
      src: 'https://cdn.jsdelivr.net/gh/googlefonts/noto-fonts@main/hinted/ttf/NotoNastaliqUrdu/NotoNastaliqUrdu-Bold.ttf',
      fontWeight: 'bold',
    },
  ],
});

const styles = StyleSheet.create({
  page: {
    padding: 56,
    fontSize: 13,
    color: INK,
    lineHeight: 1.9,
    fontFamily: 'NotoNastaliqUrdu',
    textAlign: 'right',
  },
  brand: {
    color: OCHRE,
    fontSize: 9,
    letterSpacing: 2,
    marginBottom: 8,
    textTransform: 'uppercase',
    fontFamily: 'Helvetica',
    textAlign: 'left',
  },
  h1: {
    fontSize: 26,
    color: DEEP_GREEN,
    marginBottom: 14,
    fontFamily: 'NotoNastaliqUrdu',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  h2: {
    fontSize: 17,
    color: DEEP_GREEN,
    marginTop: 18,
    marginBottom: 8,
    fontFamily: 'NotoNastaliqUrdu',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  h3: {
    fontSize: 14,
    color: DEEP_GREEN,
    marginTop: 12,
    marginBottom: 6,
    fontFamily: 'NotoNastaliqUrdu',
    fontWeight: 'bold',
    textAlign: 'right',
  },
  p: { marginBottom: 8, textAlign: 'right' },
  li: { marginRight: 16, marginBottom: 5, textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 56,
    right: 56,
    fontSize: 8,
    color: MUTED,
    borderTop: `1pt solid ${OCHRE}`,
    paddingTop: 6,
    fontFamily: 'Helvetica',
  },
});

interface Block {
  kind: 'h1' | 'h2' | 'h3' | 'p' | 'li';
  text: string;
}

function parseMarkdown(src: string): Block[] {
  const out: Block[] = [];
  for (const rawLine of src.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    if (line.startsWith('### ')) out.push({ kind: 'h3', text: line.slice(4) });
    else if (line.startsWith('## ')) out.push({ kind: 'h2', text: line.slice(3) });
    else if (line.startsWith('# ')) out.push({ kind: 'h1', text: line.slice(2) });
    else if (/^[-*]\s/.test(line)) out.push({ kind: 'li', text: line.replace(/^[-*]\s/, '') });
    else if (/^\d+\.\s/.test(line)) out.push({ kind: 'li', text: line.replace(/^\d+\.\s/, '') });
    else out.push({ kind: 'p', text: line });
  }
  return out;
}

function renderDoc(title: string, blocks: Block[]): React.ReactElement {
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
          if (b.kind === 'h3') return React.createElement(Text, { key: i, style: styles.h3 }, b.text);
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
  await build(`${docs}/worker-handbook-ur.md`, `${docs}/worker-handbook-ur.pdf`, 'Worker handbook');
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});

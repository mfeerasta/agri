/**
 * Render docs/supervisor-manual.md to PDF. Bilingual (English + Urdu) document.
 * Run with:
 *   pnpm --filter @zameen/web exec tsx scripts/build-supervisor-manual.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, renderToFile } from '@react-pdf/renderer';

const DEEP_GREEN = '#1B4332';
const OCHRE = '#D4A574';
const INK = '#1a1a1a';
const MUTED = '#555';

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

// A character is Urdu if it falls in the Arabic Unicode range.
function isUrduText(text: string): boolean {
  return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(text);
}

const styles = StyleSheet.create({
  page: { padding: 48, fontSize: 11, color: INK, lineHeight: 1.5, fontFamily: 'Helvetica' },
  brand: { color: OCHRE, fontSize: 9, letterSpacing: 2, marginBottom: 6, textTransform: 'uppercase' },
  h1: { fontSize: 22, color: DEEP_GREEN, marginBottom: 12, fontFamily: 'Helvetica-Bold' },
  h2: { fontSize: 14, color: DEEP_GREEN, marginTop: 14, marginBottom: 6, fontFamily: 'Helvetica-Bold' },
  h3: { fontSize: 12, color: DEEP_GREEN, marginTop: 10, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  p: { marginBottom: 5 },
  pUrdu: { marginBottom: 5, fontFamily: 'NotoNastaliqUrdu', fontSize: 12, lineHeight: 1.9, textAlign: 'right' },
  li: { marginLeft: 12, marginBottom: 3 },
  liUrdu: { marginRight: 12, marginBottom: 3, fontFamily: 'NotoNastaliqUrdu', fontSize: 12, lineHeight: 1.9, textAlign: 'right' },
  h2Urdu: { fontSize: 16, color: DEEP_GREEN, marginTop: 14, marginBottom: 6, fontFamily: 'NotoNastaliqUrdu', fontWeight: 'bold', textAlign: 'right' },
  h3Urdu: { fontSize: 13, color: DEEP_GREEN, marginTop: 10, marginBottom: 4, fontFamily: 'NotoNastaliqUrdu', fontWeight: 'bold', textAlign: 'right' },
  footer: {
    position: 'absolute',
    bottom: 28,
    left: 48,
    right: 48,
    fontSize: 8,
    color: MUTED,
    borderTop: `1pt solid ${OCHRE}`,
    paddingTop: 6,
  },
});

interface Block {
  kind: 'h1' | 'h2' | 'h3' | 'p' | 'li';
  text: string;
  rtl: boolean;
}

function parseMarkdown(src: string): Block[] {
  const out: Block[] = [];
  for (const rawLine of src.split('\n')) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    // Skip table separators and pipe rows for the PDF, render as plain text rows.
    if (/^\|?\s*-+/.test(line) && line.includes('-')) continue;
    let kind: Block['kind'] = 'p';
    let text = line;
    if (line.startsWith('### ')) {
      kind = 'h3';
      text = line.slice(4);
    } else if (line.startsWith('## ')) {
      kind = 'h2';
      text = line.slice(3);
    } else if (line.startsWith('# ')) {
      kind = 'h1';
      text = line.slice(2);
    } else if (/^[-*]\s/.test(line)) {
      kind = 'li';
      text = line.replace(/^[-*]\s/, '');
    } else if (/^\d+\.\s/.test(line)) {
      kind = 'li';
      text = line.replace(/^\d+\.\s/, '');
    } else if (line.startsWith('|')) {
      kind = 'li';
      text = line.replace(/\|/g, ' · ').replace(/^\s+|\s+$/g, '');
    }
    out.push({ kind, text, rtl: isUrduText(text) });
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
          if (b.kind === 'h2') return React.createElement(Text, { key: i, style: b.rtl ? styles.h2Urdu : styles.h2 }, b.text);
          if (b.kind === 'h3') return React.createElement(Text, { key: i, style: b.rtl ? styles.h3Urdu : styles.h3 }, b.text);
          if (b.kind === 'li') return React.createElement(Text, { key: i, style: b.rtl ? styles.liUrdu : styles.li }, `• ${b.text}`);
          return React.createElement(Text, { key: i, style: b.rtl ? styles.pUrdu : styles.p }, b.text);
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
  await build(`${docs}/supervisor-manual.md`, `${docs}/supervisor-manual.pdf`, 'Supervisor manual');
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});

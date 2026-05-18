/**
 * Render docs/quick-reference-card.md to a double-sided A5 landscape PDF.
 * Side A is Urdu, Side B is Roman Urdu + English. Run with:
 *   pnpm --filter @zameen/web exec tsx scripts/build-quick-reference.ts
 */

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import React from 'react';
import { Document, Page, Text, View, StyleSheet, Font, renderToFile } from '@react-pdf/renderer';

const DEEP_GREEN = '#1B4332';
const OCHRE = '#D4A574';
const INK = '#1a1a1a';

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

function isUrduText(text: string): boolean {
  return /[؀-ۿݐ-ݿﭐ-﷿ﹰ-﻿]/.test(text);
}

const styles = StyleSheet.create({
  page: { padding: 28, color: INK, fontFamily: 'Helvetica', fontSize: 11, lineHeight: 1.5 },
  pageUrdu: { padding: 28, color: INK, fontFamily: 'NotoNastaliqUrdu', fontSize: 13, lineHeight: 1.9, textAlign: 'right' },
  brand: { color: OCHRE, fontSize: 8, letterSpacing: 2, textTransform: 'uppercase', fontFamily: 'Helvetica' },
  h1: { fontSize: 22, color: DEEP_GREEN, marginBottom: 8, fontFamily: 'Helvetica-Bold' },
  h1Urdu: { fontSize: 26, color: DEEP_GREEN, marginBottom: 8, fontFamily: 'NotoNastaliqUrdu', fontWeight: 'bold', textAlign: 'right' },
  h2: { fontSize: 14, color: DEEP_GREEN, marginTop: 8, marginBottom: 4, fontFamily: 'Helvetica-Bold' },
  h2Urdu: { fontSize: 18, color: DEEP_GREEN, marginTop: 8, marginBottom: 4, fontFamily: 'NotoNastaliqUrdu', fontWeight: 'bold', textAlign: 'right' },
  p: { marginBottom: 3 },
  pUrdu: { marginBottom: 3, textAlign: 'right' },
  li: { marginLeft: 10, marginBottom: 2 },
  liUrdu: { marginRight: 10, marginBottom: 2, textAlign: 'right' },
});

interface Block {
  kind: 'h1' | 'h2' | 'h3' | 'p' | 'li';
  text: string;
  rtl: boolean;
}

function parseSection(lines: string[]): Block[] {
  const out: Block[] = [];
  for (const rawLine of lines) {
    const line = rawLine.trimEnd();
    if (!line.trim()) continue;
    let kind: Block['kind'] = 'p';
    let text = line;
    if (line.startsWith('### ')) {
      kind = 'h2';
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
    }
    out.push({ kind, text, rtl: isUrduText(text) });
  }
  return out;
}

function splitSides(md: string): { sideA: Block[]; sideB: Block[] } {
  // Side A starts at "## Side A" and Side B at "## Side B".
  const lines = md.split('\n');
  let aStart = -1;
  let bStart = -1;
  for (let i = 0; i < lines.length; i += 1) {
    if (/^##\s+Side A/i.test(lines[i])) aStart = i;
    if (/^##\s+Side B/i.test(lines[i])) bStart = i;
  }
  if (aStart < 0 || bStart < 0) throw new Error('Could not locate Side A and Side B in markdown');
  const aLines = lines.slice(aStart + 1, bStart);
  const bLines = lines.slice(bStart + 1);
  return { sideA: parseSection(aLines), sideB: parseSection(bLines) };
}

function renderBlock(b: Block, key: number): React.ReactElement {
  if (b.kind === 'h1') return React.createElement(Text, { key, style: b.rtl ? styles.h1Urdu : styles.h1 }, b.text);
  if (b.kind === 'h2' || b.kind === 'h3') return React.createElement(Text, { key, style: b.rtl ? styles.h2Urdu : styles.h2 }, b.text);
  if (b.kind === 'li') return React.createElement(Text, { key, style: b.rtl ? styles.liUrdu : styles.li }, `• ${b.text}`);
  return React.createElement(Text, { key, style: b.rtl ? styles.pUrdu : styles.p }, b.text);
}

function renderDoc(sideA: Block[], sideB: Block[]): React.ReactElement {
  // A5 landscape: 595 x 420 pt (A5 is 420 x 595 portrait).
  return React.createElement(
    Document,
    null,
    React.createElement(
      Page,
      { size: 'A5', orientation: 'landscape', style: styles.pageUrdu },
      React.createElement(Text, { style: styles.brand }, 'Zameen · Rupafab Agri'),
      React.createElement(View, null, ...sideA.map((b, i) => renderBlock(b, i))),
    ),
    React.createElement(
      Page,
      { size: 'A5', orientation: 'landscape', style: styles.page },
      React.createElement(Text, { style: styles.brand }, 'Zameen · Rupafab Agri'),
      React.createElement(View, null, ...sideB.map((b, i) => renderBlock(b, i))),
    ),
  );
}

async function build(mdPath: string, pdfPath: string): Promise<void> {
  const md = readFileSync(mdPath, 'utf8');
  const { sideA, sideB } = splitSides(md);
  await renderToFile(renderDoc(sideA, sideB) as never, pdfPath);
  process.stdout.write(`wrote ${pdfPath}\n`);
}

async function main(): Promise<void> {
  const docs = resolve(process.cwd(), '../../docs');
  await build(`${docs}/quick-reference-card.md`, `${docs}/quick-reference-card.pdf`);
}

main().catch((err: unknown) => {
  process.stderr.write(`${err instanceof Error ? err.stack : String(err)}\n`);
  process.exit(1);
});

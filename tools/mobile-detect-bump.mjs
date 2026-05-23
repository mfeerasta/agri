#!/usr/bin/env node
// Scans commits since the last mobile-* tag and emits GITHUB_OUTPUT lines
// indicating whether mobile-field and/or mobile-ops should be version-bumped.
//
// Commit message convention:
//   mobile(field): ...      -> bumps field, patch
//   mobile(ops): ...        -> bumps ops, patch
//   mobile(field)!: ...     -> major
//   mobile(field,feat): ... -> minor
//   mobile: ...             -> bumps both, patch

import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

const git = (args) => execFileSync('git', args, { encoding: 'utf8' }).trim();

function lastTag(prefix) {
  try {
    return git(['describe', '--tags', '--abbrev=0', `--match=${prefix}-v*`]);
  } catch {
    return '';
  }
}

function commitsSince(tag) {
  const args = ['log', '--pretty=%s'];
  args.push(tag ? `${tag}..HEAD` : 'HEAD');
  return git(args).split('\n').filter(Boolean);
}

function classify(msgs, app) {
  let bump = null;
  const re = /^mobile(?:\(([^)]+)\))?(!)?:/;
  for (const m of msgs) {
    const match = m.match(re);
    if (!match) continue;
    const scope = (match[1] || '').toLowerCase();
    const breaking = match[2] === '!';
    const parts = scope.split(',').map((s) => s.trim());
    const touchesApp = !scope || parts.includes(app) || parts.includes('all');
    if (!touchesApp) continue;
    let level = 'patch';
    if (breaking) level = 'major';
    else if (parts.includes('feat')) level = 'minor';
    bump = pickHigher(bump, level);
  }
  return bump;
}

function pickHigher(a, b) {
  const order = { patch: 1, minor: 2, major: 3 };
  if (!a) return b;
  if (!b) return a;
  return order[a] >= order[b] ? a : b;
}

function currentVersion(app) {
  const pkg = JSON.parse(readFileSync(resolve(`apps/mobile-${app}/package.json`), 'utf8'));
  return pkg.version;
}

function bumpVersion(v, level) {
  const [maj, min, pat] = v.split('.').map((n) => parseInt(n, 10));
  if (level === 'major') return `${maj + 1}.0.0`;
  if (level === 'minor') return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

for (const app of ['field', 'ops']) {
  const tag = lastTag(`mobile-${app}`);
  const msgs = commitsSince(tag);
  const level = classify(msgs, app);
  if (level) {
    const cur = currentVersion(app);
    const next = bumpVersion(cur, level);
    process.stdout.write(`${app}=true\n`);
    process.stdout.write(`${app}_bump=${level}\n`);
    process.stdout.write(`${app}_new=${next}\n`);
  } else {
    process.stdout.write(`${app}=false\n`);
  }
}

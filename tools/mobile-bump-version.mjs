#!/usr/bin/env node
// Bumps version across capacitor.config.ts, package.json, android build.gradle,
// and iOS project.pbxproj for a given app (field|ops) at a given semver level.
//
// Usage: node tools/mobile-bump-version.mjs <app> <patch|minor|major>

import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const [, , app, level] = process.argv;
if (!['field', 'ops'].includes(app)) {
  console.error('app must be field or ops');
  process.exit(1);
}
if (!['patch', 'minor', 'major'].includes(level)) {
  console.error('level must be patch|minor|major');
  process.exit(1);
}

const base = resolve(`apps/mobile-${app}`);
const pkgPath = `${base}/package.json`;
const pkg = JSON.parse(readFileSync(pkgPath, 'utf8'));
const [maj, min, pat] = pkg.version.split('.').map((n) => parseInt(n, 10));
let nextVer;
if (level === 'major') nextVer = `${maj + 1}.0.0`;
else if (level === 'minor') nextVer = `${maj}.${min + 1}.0`;
else nextVer = `${maj}.${min}.${pat + 1}`;

// package.json
pkg.version = nextVer;
writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n');

// capacitor.config.ts (optional version field)
const capPath = `${base}/capacitor.config.ts`;
if (existsSync(capPath)) {
  let cap = readFileSync(capPath, 'utf8');
  if (/version:\s*['"][^'"]+['"]/.test(cap)) {
    cap = cap.replace(/version:\s*['"][^'"]+['"]/, `version: '${nextVer}'`);
  } else {
    // inject below appName line
    cap = cap.replace(/appName:\s*'([^']+)',/, (m) => `${m}\n  version: '${nextVer}',`);
  }
  writeFileSync(capPath, cap);
}

// Android build.gradle
const gradlePath = `${base}/android/app/build.gradle`;
if (existsSync(gradlePath)) {
  let g = readFileSync(gradlePath, 'utf8');
  g = g.replace(/versionName\s+"[^"]+"/, `versionName "${nextVer}"`);
  // bump versionCode by 1
  g = g.replace(/versionCode\s+(\d+)/, (_, code) => `versionCode ${parseInt(code, 10) + 1}`);
  writeFileSync(gradlePath, g);
}

// iOS project.pbxproj
const pbxPath = `${base}/ios/App/App.xcodeproj/project.pbxproj`;
if (existsSync(pbxPath)) {
  let p = readFileSync(pbxPath, 'utf8');
  p = p.replace(/MARKETING_VERSION = [^;]+;/g, `MARKETING_VERSION = ${nextVer};`);
  p = p.replace(/CURRENT_PROJECT_VERSION = (\d+);/g, (_, code) =>
    `CURRENT_PROJECT_VERSION = ${parseInt(code, 10) + 1};`);
  writeFileSync(pbxPath, p);
}

console.log(`bumped ${app} -> ${nextVer}`);

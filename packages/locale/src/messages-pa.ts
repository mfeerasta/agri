// Punjabi (Shahmukhi) bundle. The canonical strings live alongside the
// other bundles in messages.ts so the Field PWA only loads one chunk;
// this file re-exports them for ergonomic per-locale imports and lets
// future translators edit a single language without scrolling through
// the combined file.
//
// Fallback chain (see t.ts): pa -> ur -> en.

import { MESSAGES } from './messages.js';

export const PA = MESSAGES.pa;
export default PA;

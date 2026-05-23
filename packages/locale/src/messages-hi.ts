// Hindi (Devanagari) bundle. Canonical strings live in messages.ts; this
// re-export gives translators a per-language entry point.
//
// Fallback chain: hi -> en.

import { MESSAGES } from './messages.js';

export const HI = MESSAGES.hi;
export default HI;

// Roman Urdu bundle. Used by SMS to basic-phone workers (GSM-7 only)
// and by literate-but-not-Nastaliq-readers. Canonical strings live in
// messages.ts; this re-export gives translators a focused file.
//
// Note: filename is kebab-case (locked convention), import path uses a
// dash even though the locale code is roman_ur.
//
// Fallback chain: roman_ur -> en.

import { MESSAGES } from './messages.js';

export const ROMAN_UR = MESSAGES.roman_ur;
export default ROMAN_UR;

# Localization

Zameen ships in three locales. Order of priority:

1. **ur** (Urdu, Nastaliq script). Primary for the Field PWA and worker-facing surfaces.
2. **roman_ur** (Roman Urdu, Latin script). For Supervisor and Farm Manager input convenience.
3. **en** (English). For the Director, Accountant, and Ops dashboard.

Translation bundles live in `packages/locale/src/{ur,roman_ur,en}.ts`. Every string used in the Field PWA must have an `ur` translation in the same PR. CI fails on missing keys.

## Font stack

- `ur`: `'Noto Nastaliq Urdu', 'Jameel Noori Nastaleeq', serif`. Nastaliq line height is 1.9 by default; do not collapse it. Test in Chrome on Android Snapdragon 4-series and on Safari iOS at minimum.
- `en`: `'Inter Tight', 'Inter', system-ui, -apple-system, sans-serif`.
- Monospace and tabular data: `'JetBrains Mono', 'SF Mono', monospace`. All financial figures use the monospace font so columns align.

Noto Nastaliq Urdu is self-hosted from `/fonts/noto-nastaliq-urdu-v22/` and subset to the Unicode ranges actually used (Arabic, Arabic Supplement, Arabic Extended-A, ASCII for mixed strings). Subset target: under 180 KB woff2 per weight.

## RTL handling rules

Default for `lang="ur"` is `dir="rtl"` on the `<html>` element. Tailwind RTL plugin handles layout mirroring. Exceptions, which stay LTR even inside an RTL block:

- Numeric inputs (`<input type="number">`, `<input inputMode="decimal">`).
- Currency display (`Rs. 12,345.00`, even inside `dir="rtl"`).
- Timestamps and dates.
- Asset IDs, vendor codes, GPS coordinates, photo URLs.
- Phone numbers, OTP entry.

Implementation: wrap LTR fragments in `<bdo dir="ltr">` or use CSS `unicode-bidi: isolate; direction: ltr;` on the container.

## Number formatting

- Default digits: Western Arabic (0 to 9).
- Toggle in user settings: Eastern Arabic-Indic digits (۰ to ۹) for users who prefer them. Toggle is per-user, not per-locale.
- Thousands separator: comma (`12,345`).
- Decimal separator: period (`12,345.50`).
- Pakistani grouping for lac and crore (1,23,45,678) is available in `formatPkr(.., 'lac_crore', ..)` and used in the dashboard mode; not used inline in forms.

## Currency

- Prefix `Rs.` with a trailing space. Always two decimal places in the database. Display in `plain` mode shows full digits; `lac_crore` mode collapses to `Rs. 1.23 crore` or `Rs. 45.67 lac` above the thresholds.
- No FX, no symbol other than `Rs.`. See ADR 0002.
- Negative amounts: leading minus, never parentheses (Pakistani convention).

## Dates

- Default: `DD-MMM-YYYY` (`17-May-2026`).
- Optional Hijri toggle in user settings, used for religious dates (Eid, Muharram observance). Implementation: `Intl.DateTimeFormat` with `calendar: 'islamic-umalqura'`.
- Time of day: 12-hour with `am`/`pm` for `en`, 12-hour with `صبح`/`شام` for `ur`.
- The platform stores everything as `timestamptz` in UTC and renders in `Asia/Karachi` (PKT, UTC+5, no DST).

## Unit defaults

- Area: `acre` default; `kanal` and `marla` available. Conversions in `@zameen/shared/units`.
- Weight: `kg` for input forms; `mann` (= 40 kg, Punjab convention) toggleable in display.
- Volume: `litre` for diesel and milk. No gallons.
- Currency: PKR only.

## Voice input

- Phase 1: browser `SpeechRecognition` API with `lang = 'ur-PK'`. Fallback to `'en-IN'` if Urdu recognition is not available on the device. Confidence threshold 0.6; below that the result is shown as draft for the user to confirm.
- Phase 3: Whisper-class STT, server-side, with Urdu language hint. Audio chunk uploaded as Opus over WebSocket. Streaming partials.
- Voice replaces text entirely on the worker path for `comment`, `vendor_name`, `description`, `notes`.

## Urdu farm-terms glossary

Eighty-plus terms used across the Field PWA and reports. Nastaliq, Roman transliteration, English.

### Land and tenure

| Nastaliq | Roman | English |
|---|---|---|
| لگان | lagaan | land rent or revenue |
| فرد | fard | revenue record extract |
| خسرہ | khasra | plot survey number |
| خطونی | khatooni | land holding register |
| ایکڑ | acre | acre |
| کنال | kanal | one eighth of an acre |
| مرلہ | marla | one twentieth of a kanal |
| رقبہ | raqba | area |
| موضع | mauza | revenue village |
| پٹواری | patwari | land record keeper |
| تحصیل | tehsil | sub-district |
| نمبردار | numberdar | village headman |
| ٹھیکہ | theka | lease |

### Crops and produce

| Nastaliq | Roman | English |
|---|---|---|
| فصل | fasal | crop |
| کاشت | kasht | cultivation |
| کھیتی | kheti | farming |
| ربیع | rabi | Rabi season (Oct to Apr) |
| خریف | kharif | Kharif season (May to Sep) |
| گندم | gandum | wheat |
| مکئی | makai | maize |
| چاول | chawal | rice |
| کپاس | kapas | cotton |
| گنا | ganna | sugarcane |
| سرسوں | sarson | mustard |
| چنا | chana | chickpea |
| مسور | masoor | lentil |
| دھان | dhan | paddy |
| بھوسا | bhusa | wheat straw |
| توڑی | toori | chopped fodder |
| چارہ | chara | green fodder |
| بیج | beej | seed |
| پنیری | paneeri | seedling |
| پیداوار | paidawar | yield |
| فی ایکڑ | per acre | per acre |
| فی من | per mann | per mann |

### Inputs and operations

| Nastaliq | Roman | English |
|---|---|---|
| کھاد | khaad | fertilizer |
| یوریا | urea | urea |
| ڈی اے پی | DAP | DAP |
| سپرے | spray | pesticide spray |
| دوا | dawa | medicine or chemical |
| پانی | paani | water, irrigation |
| نہر | nehar | canal |
| وارابندی | warabandi | canal water rotation schedule |
| ٹیوب ویل | tube well | tube well |
| ہل | hal | plough |
| رجر | rajar | ridger |
| روٹاویٹر | rotavator | rotavator |
| کلٹیویٹر | cultivator | cultivator |
| ہارویسٹر | harvester | combine harvester |
| ٹریکٹر | tractor | tractor |
| ٹرالی | trolley | trailer |
| ڈیزل | diesel | diesel |
| تیل | tail | oil or fuel |
| میٹر | meter | hour meter or fuel meter |
| مرمت | marammat | repair |
| پرزہ | purza | spare part |
| میکینک | mechanic | mechanic |
| گیراج | garage | workshop |

### Livestock and dairy

| Nastaliq | Roman | English |
|---|---|---|
| جانور | jaanwar | animal |
| گائے | gaay | cow |
| بھینس | bhains | buffalo |
| بکری | bakri | goat |
| بھیڑ | bhed | sheep |
| دودھ | doodh | milk |
| دہی | dahi | yoghurt |
| گھی | ghee | clarified butter |
| سانڈ | saand | bull |
| بچھڑا | bachhra | calf |
| دودھیل | doodhel | lactating |
| خشک | khushk | dry (non-lactating) |
| چارہ | chara | fodder |
| وند | wand | concentrate feed |
| ڈاکٹر | doctor | vet |
| ٹیکہ | teeka | vaccination or injection |

### Trade and money

| Nastaliq | Roman | English |
|---|---|---|
| منڈی | mandi | wholesale market |
| آڑھتی | arhti | commission agent |
| بوری | bori | sack (typically 100 kg) |
| من | mann | 40 kg (Punjab) |
| کلو | kilo | kilogram |
| لیٹر | litre | litre |
| روپے | rupay | rupees |
| لاکھ | lakh | hundred thousand |
| کروڑ | crore | ten million |
| پیسے | paise | paisa |
| نقد | naqd | cash |
| ادھار | udhaar | credit |
| رسید | raseed | receipt |
| بل | bill | invoice |
| کمیشن | commission | commission |
| کسر | kasur | trade weight deduction |
| بردانہ | bardana | sacking deduction |

### People and labour

| Nastaliq | Roman | English |
|---|---|---|
| مزدور | mazdoor | labourer |
| دیہاڑی | dihari | daily wage |
| منشی | munshi | clerk |
| منیجر | manager | manager |
| مالک | maalik | owner |
| ٹھیکیدار | thekedar | contractor |
| ڈرائیور | driver | driver |
| چوکیدار | chowkidar | watchman |
| حاضری | hazri | attendance |
| چھٹی | chutti | leave |

## Validation in code

Every string surfaced to a user passes through `t(key, locale)` from `@zameen/locale`. Hard-coded user-facing strings fail the lint rule `no-hardcoded-strings` in the Field PWA package. The Ops dashboard is exempt because Accountant-facing copy is `en`-only.

Snapshot tests of the Field PWA home, diesel purchase form, and approval list render in all three locales and are committed under `apps/field/__snapshots__/`.

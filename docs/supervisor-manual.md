# Supervisor Manual · سپروائزر ہدایت نامہ

Zameen platform · Rupafab Agri · Rabi 2025-26
زمین پلیٹ فارم · روپا فیب ایگری · ربی 2025-26

This manual is bilingual. English on the left of each section, Urdu translation in the same section so you can switch contexts comfortably.

یہ ہدایت نامہ دو زبانوں میں ہے۔ پہلے انگریزی، پھر اردو۔

## 1. Role overview

You are the bridge between workers and the farm manager. You assign work, inspect quality, log issues, and validate piece-rate claims. You approve small-ticket items directly and escalate the rest.

### کردار

آپ ورکروں اور فارم منیجر کے درمیان ربط ہیں۔ آپ کام بانٹتے ہیں، معیار جانچتے ہیں، مسائل لکھتے ہیں، اور ٹھیکہ مزدوری کی تصدیق کرتے ہیں۔ چھوٹے فیصلے خود کریں، بڑے فارم منیجر تک پہنچائیں۔

## 2. Daily routine

### Morning (06:00 - 08:00)

- Open the ops app at ops.agri.feerasta.ai on your phone or tablet.
- Check yesterday's pending tasks on the dashboard.
- Verify worker attendance on the labor screen. Anyone missing or late should be called within 15 minutes.
- Assign today's tasks via `/assign`. Set priority, expected hours, and the field id.
- Walk to the diesel tank, log the morning reading on the diesel screen.

### Midday (12:00 - 13:00)

- Check the live task progress on the dashboard. Anything red, intervene.
- Spot inspection of two fields. Use `/inspect/[cropPlanId]` and photograph stage progress.
- Review diesel logs submitted in the morning. Confirm or flag.

### Evening (17:00 - 19:00)

- Walk every active field one final time.
- Reconcile diesel: physical dip reading minus opening minus issued equals expected.
- Close out repairs raised during the day. Either resolve, escalate, or hand off to morning.
- Send the daily summary to the farm manager via the ops app digest.

### روزانہ کا معمول

#### صبح

- آپس ایپ کھولیں: ops.agri.feerasta.ai
- کل کے باقی کام دیکھیں۔
- ورکروں کی حاضری چیک کریں۔ غیر حاضر یا دیر کرنے والے کو 15 منٹ کے اندر فون کریں۔
- آج کے کام بانٹیں `/assign` سے۔ ترجیح، اندازاً گھنٹے، اور فیلڈ نمبر لکھیں۔
- ڈیزل ٹینک کی صبح کی ریڈنگ ڈیزل اسکرین پر لکھیں۔

#### دوپہر

- ڈیش بورڈ پر کام کی پیش رفت دیکھیں۔ سرخ نشان والے کاموں پر فوراً ہاتھ ڈالیں۔
- دو فیلڈز کا معائنہ کریں۔ `/inspect/[cropPlanId]` کے ذریعے تصویر کے ساتھ۔
- صبح بھیجے گئے ڈیزل اندراج چیک کریں۔ منظور کریں یا اعتراض لگائیں۔

#### شام

- ہر فعال فیلڈ کا آخری چکر۔
- ڈیزل ملان: اصل ریڈنگ منفی ابتدائی منفی جاری شدہ برابر متوقع۔
- دن میں اٹھائی گئی مرمت کی درخواستیں بند کریں۔ یا حل، یا منتقل، یا کل صبح۔
- آپس ایپ سے فارم منیجر کو روزانہ خلاصہ بھیجیں۔

## 3. Task assignment

Path: ops app → Assign (`/assign`).

- Pick the field. Each field has a stable code (F1 to F16).
- Pick the activity from the crop plan dropdown. The system pulls the current stage.
- Add workers. Drag and drop or pick from list.
- Set expected hours. Be honest, the platform tracks variance.
- Add a note in Urdu if needed. Workers will see it on their field app home screen.
- Submit. Workers receive a push notification immediately.

If a worker is already busy on another task, the system warns you. Override only with a reason.

### کام تفویض کرنا

- فیلڈ چنیں (F1 سے F16)۔
- فصل کی منصوبہ بندی سے سرگرمی چنیں۔
- ورکر شامل کریں۔
- متوقع گھنٹے درست لکھیں۔ پلیٹ فارم فرق نوٹ کرتا ہے۔
- اردو میں نوٹ لکھ سکتے ہیں۔
- بھیجیں۔ ورکر کے فون پر فوراً اطلاع پہنچے گی۔

ایک ورکر پہلے سے مصروف ہو تو نظام آگاہ کرے گا۔ صرف وجہ کے ساتھ آگے بڑھیں۔

## 4. Inspection workflow

Path: ops app → field card → "Inspect" or `/inspect/[cropPlanId]`.

- Pick the inspection type: stage check, pest scout, water check, harvest readiness.
- Take at least three photos: wide, mid, close-up.
- Note observations. Voice input is supported.
- Flag any pest, disease, or stress.
- Submit. The record is permanent and timestamped.

If you flag a critical pest or disease, the farm manager receives an immediate alert.

### معائنہ

- معائنہ کی قسم چنیں۔
- کم از کم تین تصویریں: دور، درمیانی، قریب۔
- آواز سے یا لکھ کر مشاہدات۔
- کیڑا، بیماری، یا تناؤ ہو تو نشان لگائیں۔
- بھیجیں۔

کیڑے یا بیماری کا نشان لگاتے ہی فارم منیجر کو فوری اطلاع جاتی ہے۔

## 5. Issuing inputs

When fertiliser, pesticide, or seed leaves the store for a field, log it on `/issue`.

- Pick the source (store) and the destination (field id and crop plan).
- Pick the item from the inventory dropdown. Quantity in the unit shown.
- Take a photo of the bag, drum, or container before it leaves the store.
- Confirm. The system posts a cost allocation to the field's crop plan automatically.

Never issue without a photo. Audit will pull a sample and check.

### مواد جاری کرنا

- جب کھاد، سپرے، یا بیج گودام سے فیلڈ کے لیے نکلے، `/issue` پر لکھیں۔
- ماخذ (گودام) اور منزل (فیلڈ اور فصل) چنیں۔
- چیز اور مقدار چنیں۔
- گودام سے نکلنے سے پہلے تھیلے یا ڈرم کی تصویر لیں۔
- تصدیق کریں۔

تصویر کے بغیر کبھی نہ جاری کریں۔

## 6. Approval thresholds and escalation

| Type | Up to | Approver |
|---|---|---|
| Repair quote | Rs. 5,000 | Supervisor (you) |
| Repair quote | Rs. 25,000 | Farm manager |
| Repair quote | Above Rs. 25,000 | MF |
| Diesel purchase | Rs. 10,000 | Supervisor (you) |
| Diesel purchase | Rs. 50,000 | Farm manager |
| Diesel purchase | Above Rs. 50,000 | MF |
| Input issuance | Any | Auto-approved with photo |
| Inventory write-off | Any | Farm manager |
| Asset disposal | Any | MF |
| Salary advance | Up to Rs. 10,000 | Farm manager |
| Salary advance | Above Rs. 10,000 | MF |

If you are unsure, escalate. Cost of escalation is zero. Cost of an unapproved write is real.

### اجازت کی حدود

| قسم | حد | اجازت دینے والا |
|---|---|---|
| مرمت | پانچ ہزار تک | سپروائزر |
| مرمت | پچیس ہزار تک | فارم منیجر |
| مرمت | پچیس ہزار سے زیادہ | ایم ایف |
| ڈیزل | دس ہزار تک | سپروائزر |
| ڈیزل | پچاس ہزار تک | فارم منیجر |
| ڈیزل | پچاس ہزار سے زیادہ | ایم ایف |
| تنخواہ پیشگی | دس ہزار تک | فارم منیجر |
| تنخواہ پیشگی | زیادہ | ایم ایف |

شک ہو تو اوپر بھیجیں۔ کوئی نقصان نہیں۔

## 7. Diesel and repair triage

### Diesel anomalies you should investigate yourself

- Daily consumption above the field's average for the same activity.
- Logged litres do not match physical tank dip.
- Two purchases on the same day from different pumps.

### Diesel issues to escalate immediately

- Variance above 5 percent on any reconciliation.
- A worker logs diesel for a tractor that is not running today.
- Receipt photo missing or unreadable on a purchase above Rs. 10,000.

### Repair triage

- Minor (under Rs. 5,000): approve and dispatch a worker.
- Medium (Rs. 5,000 to Rs. 25,000): collect at least two quotes, submit to farm manager.
- Major (above Rs. 25,000): collect three quotes, attach asset history, submit to MF via the approval engine.
- Critical safety (regardless of cost): stop the asset, escalate to farm manager and MF in parallel.

### ڈیزل اور مرمت کا فیصلہ

- معمول سے زیادہ خرچ خود تفتیش کریں۔
- پانچ فیصد سے زیادہ فرق ہو تو فارم منیجر کو بتائیں۔
- مرمت پانچ ہزار سے کم: خود کر دیں۔
- پچیس ہزار تک: دو قیمتیں لے کر فارم منیجر کو۔
- زیادہ: تین قیمتیں اور تاریخ کے ساتھ ایم ایف کو۔

## 8. Worker management

- Attendance review every morning at 08:00.
- Piece-rate validation: count of units must match field-level evidence (sacks, rows, area).
- Mark "training mode" for any new worker for their first seven days. Their logs go to a separate bucket and do not affect P&L.
- Payroll prep: every Friday, run the labor report and review piece-rate vs day-rate workers.

### ورکر انتظام

- ہر صبح آٹھ بجے حاضری دیکھیں۔
- ٹھیکہ مزدوری کی گنتی فیلڈ سے ملائیں۔
- نئے ورکر کو پہلے سات دن تربیتی موڈ پر رکھیں۔
- ہر جمعے کو لیبر رپورٹ بنائیں۔

## 9. Reporting up

- Daily digest to MF via WhatsApp at 19:30. Auto-generated, you can edit before send.
- Weekly summary to farm manager every Friday by 17:00.
- Monthly P&L commentary for your fields, due first Monday of the month.

### اوپر رپورٹ

- روزانہ خلاصہ MF کو شام ساڑھے سات بجے۔
- ہر جمعے فارم منیجر کو۔
- ہر مہینے کے پہلے سوموار کو فیلڈ P&L پر تبصرہ۔

## 10. Anomaly response

| Anomaly | First action | Within |
|---|---|---|
| Diesel variance above 5% | Re-dip the tank with a second witness | 1 hour |
| Worker not on geofence at clock-in | Call worker, then supervisor of next shift | 15 min |
| Pest flag on inspection | Photograph spread, isolate field activity, call farm manager | 30 min |
| Tractor stops mid-task | Mark asset down on `/repair`, reassign workers to a fallback task | 30 min |
| Weather alert (frost, heavy rain) | Trigger contingency plan, confirm with farm manager | 1 hour |

### غیر معمولی صورت حال

- ڈیزل میں پانچ فیصد سے زیادہ فرق: گواہ کے ساتھ دوبارہ پیمائش، ایک گھنٹے میں۔
- جیو فینس کے باہر سے حاضری: ورکر کو پندرہ منٹ میں فون۔
- کیڑے کی موجودگی: تصویر، فیلڈ بند، فارم منیجر کو آدھے گھنٹے میں۔
- ٹریکٹر بند ہو جائے: ایپ پر اندراج، متبادل کام، آدھے گھنٹے میں۔
- موسم کی وارننگ: ہنگامی منصوبہ، فارم منیجر کو ایک گھنٹے میں۔

## 11. Emergency procedures

### Tractor breakdown mid-sowing

1. Stop the tractor where it is, do not push.
2. Photo of the failure point.
3. Open `/repair`, severity critical.
4. Reassign workers to manual operations or to the next field on the plan.
5. Call the farm manager. Do not wait for the app to route.

### Frost warning issued

1. Activate field-by-field contingency: cover seedlings, run sprinkler in pre-dawn hours, light smudge fires if approved.
2. Workers report to fields one hour earlier the next morning.
3. Photographs at first light for damage assessment.
4. Submit damage report by 10:00.

### ہنگامی صورت

- ٹریکٹر کام کے دوران بند: وہیں روک دیں، تصویر، شدید درجہ کی مرمت، ورکر دوسرے کام پر، فارم منیجر کو فون۔
- پالا پڑنے کی وارننگ: پودوں کو ڈھانپیں، اسپرے، صبح ایک گھنٹہ پہلے کام، تصویر، دس بجے تک نقصان کی رپورٹ۔

## 12. Cheat sheet

One page to keep in your pocket.

### Morning
- Attendance check by 08:00
- Diesel opening reading
- Assign today's tasks
- Walk one field

### Midday
- Live progress scan
- Two inspections
- Verify diesel logs

### Evening
- Final field walk
- Diesel reconciliation
- Close out repairs
- Daily digest to MF

### Numbers to know
- Repair under 5k: you approve
- Repair under 25k: farm manager
- Repair above 25k: MF
- Diesel variance over 5%: stop and escalate
- Critical pest: photo, isolate, call

### Apps
- ops.agri.feerasta.ai (you)
- field.agri.feerasta.ai (workers)
- approve.agri.feerasta.ai (farm manager, MF)

### پاکٹ شیٹ

#### صبح
- آٹھ بجے تک حاضری
- ڈیزل کی ابتدائی ریڈنگ
- آج کے کام تفویض
- ایک فیلڈ کا چکر

#### دوپہر
- پیش رفت دیکھیں
- دو معائنے
- ڈیزل اندراج کی تصدیق

#### شام
- آخری چکر
- ڈیزل ملان
- مرمت بند کریں
- روزانہ خلاصہ MF کو

/**
 * Seed bilingual signing templates for the four common Pakistan
 * agribusiness document kinds. Run after the main seed so entity rows exist.
 */
import { db, sql } from './index.js';
import { signingTemplates, entities } from './schema/index.js';
import { eq } from 'drizzle-orm';

const LEASE_EN = `LEASE OF AGRICULTURAL LAND

This Lease Agreement is made on {{lease_date}} between {{landowner_name}} (Landowner, CNIC {{landowner_cnic}}) of {{landowner_address}} AND {{tenant_name}} (Tenant, CNIC {{tenant_cnic}}) of {{tenant_address}}.

1. Land. {{area_acres}} acres in Mauza {{mauza}}, Tehsil {{tehsil}}, District {{district}}, Khasra {{khasra}}.
2. Term. From {{start_date}} to {{end_date}}.
3. Rent. PKR {{annual_rent_pkr}} per annum, payable {{rent_schedule}}.
4. Stamp paper. This agreement is to be engrossed on Punjab non-judicial stamp paper of denomination PKR {{stamp_denom}}.
5. Governing law. Punjab Tenancy Act 1887 and the Punjab Land Revenue Act 1967.
6. Dispute resolution. Courts at {{dispute_venue}} shall have exclusive jurisdiction.`;

const LEASE_UR = `زرعی زمین کا اجارہ نامہ

یہ معاہدہ بتاریخ {{lease_date}} بین {{landowner_name}} (مالک، شناختی کارڈ {{landowner_cnic}}) اور {{tenant_name}} (کرایہ دار، شناختی کارڈ {{tenant_cnic}}) کے درمیان طے پایا۔

1۔ زمین: {{area_acres}} ایکڑ، موضع {{mauza}}، تحصیل {{tehsil}}، ضلع {{district}}، خسرہ {{khasra}}۔
2۔ مدت: {{start_date}} سے {{end_date}} تک۔
3۔ کرایہ: روپے {{annual_rent_pkr}} سالانہ، قابلِ ادائیگی بشرائط {{rent_schedule}}۔
4۔ اسٹامپ پیپر: یہ معاہدہ پنجاب کے غیر عدالتی اسٹامپ پیپر بمالیت {{stamp_denom}} روپے پر تحریر ہو گا۔
5۔ قانون: پنجاب ٹیننسی ایکٹ 1887 اور پنجاب لینڈ ریونیو ایکٹ 1967۔
6۔ تنازع: عدالتیں {{dispute_venue}} مجاز ہوں گی۔`;

const FORWARD_EN = `FORWARD CONTRACT FOR CROP SALE

Between {{seller_name}} (Seller) and {{buyer_name}} (Buyer) on {{contract_date}}.

1. Crop. {{crop}} of grade {{grade}}.
2. Quantity. {{quantity_kg}} kg.
3. Price. PKR {{price_per_40kg}} per 40 kg, payable on delivery.
4. Delivery. At {{delivery_location}} (Mandi {{mandi}}) on or before {{delivery_date}}.
5. Quality. Moisture max {{moisture_pct}}%, foreign matter max {{foreign_matter_pct}}%.
6. Force majeure. Pest outbreak, flood, or government procurement order suspends performance.
7. Governing law. Punjab Sale of Goods Act and Contract Act 1872. Courts at {{dispute_venue}}.`;

const FORWARD_UR = `فصل کی فروخت کا فارورڈ معاہدہ

فروخت کنندہ {{seller_name}} اور خریدار {{buyer_name}} کے درمیان بتاریخ {{contract_date}}۔

1۔ فصل: {{crop}}، درجہ {{grade}}۔
2۔ مقدار: {{quantity_kg}} کلوگرام۔
3۔ قیمت: 40 کلو کے {{price_per_40kg}} روپے، ترسیل پر قابلِ ادا۔
4۔ ترسیل: {{delivery_location}} (منڈی {{mandi}}) بتاریخ {{delivery_date}} یا قبل۔
5۔ معیار: نمی زیادہ سے زیادہ {{moisture_pct}}٪، غیر اجناس زیادہ سے زیادہ {{foreign_matter_pct}}٪۔
6۔ ہنگامی صورتحال: کیڑے، سیلاب، یا حکومتی خریداری کا حکم معاہدہ معطل کر سکتا ہے۔
7۔ قانون: پنجاب سیل آف گڈز ایکٹ اور کنٹریکٹ ایکٹ 1872۔`;

const VENDOR_EN = `VENDOR SUPPLY AGREEMENT

Between {{buyer_entity}} (Buyer) and {{vendor_name}} (Vendor) on {{agreement_date}}.

1. Scope: {{scope}}.
2. Payment terms: {{payment_terms_days}} days after delivery, net of advance.
3. Quality: Goods to match Vendor's specification sheet attached.
4. Penalty: 0.5% per week of late delivery, capped at 10% of order value.
5. Term: {{term_months}} months from agreement date.
6. Governing law: Contract Act 1872. Courts at {{dispute_venue}}.`;

const VENDOR_UR = `فراہم کنندہ معاہدہ

خریدار {{buyer_entity}} اور فراہم کنندہ {{vendor_name}} کے درمیان بتاریخ {{agreement_date}}۔

1۔ دائرہ کار: {{scope}}۔
2۔ ادائیگی: ترسیل کے {{payment_terms_days}} دن بعد، پیشگی منہا کر کے۔
3۔ معیار: فراہم کنندہ کی تصریح شیٹ کے مطابق۔
4۔ جرمانہ: ہر ہفتے تاخیر پر 0.5٪، حد 10٪ مالیت آرڈر۔
5۔ مدت: معاہدہ کی تاریخ سے {{term_months}} ماہ۔`;

const EMPLOY_EN = `EMPLOYMENT CONTRACT

Between {{employer_entity}} (Employer) and {{employee_name}} (Employee, CNIC {{employee_cnic}}) on {{start_date}}.

1. Designation: {{designation}}.
2. Reporting: {{reports_to}}.
3. Compensation: PKR {{monthly_salary_pkr}} per month, paid on or before the 7th of the following month.
4. Probation: 3 months. Either party may terminate with 7 days' notice during probation.
5. Notice: 30 days' written notice after probation.
6. Confidentiality and IP: All farm data and improvements remain property of the Employer.
7. Governing law: Punjab Industrial and Commercial Employment (Standing Orders) Ordinance 1968. Courts at {{dispute_venue}}.`;

const EMPLOY_UR = `ملازمت کا معاہدہ

آجر {{employer_entity}} اور ملازم {{employee_name}} (شناختی کارڈ {{employee_cnic}}) کے درمیان بتاریخ {{start_date}}۔

1۔ عہدہ: {{designation}}۔
2۔ افسرِ بالا: {{reports_to}}۔
3۔ تنخواہ: ماہانہ {{monthly_salary_pkr}} روپے، اگلے ماہ کی 7 تاریخ تک قابلِ ادا۔
4۔ آزمائشی مدت: 3 ماہ۔ آزمائش کے دوران 7 دن کا نوٹس کافی ہے۔
5۔ بعد ازاں نوٹس: 30 دن تحریری۔
6۔ راز داری اور دانشورانہ ملکیت: تمام فارم ڈیٹا آجر کی ملکیت ہے۔
7۔ قانون: پنجاب انڈسٹریل اینڈ کمرشل ایمپلائمنٹ (سٹینڈنگ آرڈرز) آرڈیننس 1968۔`;

async function main() {
  const [agri] = await db.select({ id: entities.id }).from(entities).where(eq(entities.code, 'AGRI'));
  if (!agri) {
    console.error('AGRI entity not found. Run the main seed first.');
    process.exit(1);
  }

  const templates = [
    {
      name: 'Standard land lease (Punjab)',
      documentKind: 'lease_contract',
      bodyHtml: LEASE_EN,
      bodyHtmlUr: LEASE_UR,
      variableSchema: {
        type: 'object',
        required: ['landowner_name', 'tenant_name', 'area_acres', 'annual_rent_pkr', 'start_date', 'end_date'],
      },
    },
    {
      name: 'Forward contract (mandi delivery)',
      documentKind: 'forward_contract',
      bodyHtml: FORWARD_EN,
      bodyHtmlUr: FORWARD_UR,
      variableSchema: {
        type: 'object',
        required: ['seller_name', 'buyer_name', 'crop', 'quantity_kg', 'price_per_40kg', 'delivery_date'],
      },
    },
    {
      name: 'Vendor supply agreement',
      documentKind: 'vendor_agreement',
      bodyHtml: VENDOR_EN,
      bodyHtmlUr: VENDOR_UR,
      variableSchema: { type: 'object', required: ['vendor_name', 'scope', 'payment_terms_days'] },
    },
    {
      name: 'Employment contract',
      documentKind: 'employment_contract',
      bodyHtml: EMPLOY_EN,
      bodyHtmlUr: EMPLOY_UR,
      variableSchema: {
        type: 'object',
        required: ['employee_name', 'designation', 'monthly_salary_pkr', 'start_date'],
      },
    },
  ];

  for (const t of templates) {
    await db.insert(signingTemplates).values({
      entityId: agri.id,
      name: t.name,
      documentKind: t.documentKind,
      bodyHtml: t.bodyHtml,
      bodyHtmlUr: t.bodyHtmlUr,
      variableSchema: t.variableSchema,
      defaultConsentText:
        'I consent under section 7 of the Electronic Transactions Ordinance 2002 to sign this document electronically.',
      defaultConsentTextUr:
        'میں الیکٹرانک ٹرانزیکشنز آرڈیننس 2002 کی دفعہ 7 کے تحت دستخط کی رضامندی دیتا/دیتی ہوں۔',
      isActive: true,
    });
  }

  console.log(`Seeded ${templates.length} signing templates for entity ${agri.id}.`);
  await sql.end();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

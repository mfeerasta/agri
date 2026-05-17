/**
 * Shared import-target metadata. Defines schema fields + example headers
 * per import target. Kept synchronous and serializable so client + server
 * can reuse without circular deps.
 */
export type ImportTargetKey =
  | 'fields'
  | 'workers'
  | 'inputs'
  | 'vendors'
  | 'buyers'
  | 'diesel-purchases';

export interface ImportFieldSpec {
  key: string;
  label: string;
  required: boolean;
  hint?: string;
}

export interface ImportTargetSpec {
  key: ImportTargetKey;
  label: string;
  description: string;
  templatePath: string;
  fields: ImportFieldSpec[];
}

export const IMPORT_TARGETS: Record<ImportTargetKey, ImportTargetSpec> = {
  fields: {
    key: 'fields',
    label: 'Fields',
    description: 'Land parcels with geometry, acres, khasra.',
    templatePath: '/import-templates/fields.csv',
    fields: [
      { key: 'code', label: 'Field code', required: true },
      { key: 'name', label: 'Name', required: false },
      { key: 'nameUr', label: 'Name (Urdu)', required: false },
      { key: 'acres', label: 'Acres', required: true },
      { key: 'geometry', label: 'Geometry GeoJSON', required: true, hint: 'GeoJSON polygon as JSON string' },
      { key: 'khasra', label: 'Khasra numbers', required: false, hint: 'Comma-separated' },
      { key: 'tenure', label: 'Tenure', required: false, hint: 'owned / leased_in / leased_out / sharecropped' },
      { key: 'blockCode', label: 'Block code', required: true },
    ],
  },
  workers: {
    key: 'workers',
    label: 'Workers',
    description: 'Field labour roster.',
    templatePath: '/import-templates/workers.csv',
    fields: [
      { key: 'code', label: 'Worker code', required: true },
      { key: 'fullName', label: 'Full name', required: true },
      { key: 'fullNameUr', label: 'Full name (Urdu)', required: false },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'cnicLast4', label: 'CNIC last 4', required: false },
      { key: 'workerType', label: 'Worker type', required: true, hint: 'permanent / seasonal / daily_wage / contract / piece_rate' },
      { key: 'dailyWage', label: 'Daily wage (PKR)', required: false },
      { key: 'monthlySalary', label: 'Monthly salary (PKR)', required: false },
      { key: 'hireDate', label: 'Hire date', required: true, hint: 'YYYY-MM-DD' },
    ],
  },
  inputs: {
    key: 'inputs',
    label: 'Inputs (master)',
    description: 'Fertiliser, pesticide, seed master.',
    templatePath: '/import-templates/inputs.csv',
    fields: [
      { key: 'type', label: 'Type', required: true, hint: 'fertilizer / pesticide / seed / other' },
      { key: 'name', label: 'Name', required: true },
      { key: 'nameUr', label: 'Name (Urdu)', required: false },
      { key: 'brand', label: 'Brand', required: false },
      { key: 'unit', label: 'Unit', required: true, hint: 'kg / litre / bag / piece' },
      { key: 'unitSizeKg', label: 'Unit size (kg)', required: false },
    ],
  },
  vendors: {
    key: 'vendors',
    label: 'Vendors',
    description: 'Suppliers and trade partners.',
    templatePath: '/import-templates/vendors.csv',
    fields: [
      { key: 'code', label: 'Vendor code', required: true },
      { key: 'name', label: 'Name', required: true },
      { key: 'nameUr', label: 'Name (Urdu)', required: false },
      { key: 'category', label: 'Category', required: false },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'ntn', label: 'NTN', required: false },
      { key: 'creditTermsDays', label: 'Credit days', required: false },
    ],
  },
  buyers: {
    key: 'buyers',
    label: 'Buyers',
    description: 'Produce buyers (mandi, mill, direct).',
    templatePath: '/import-templates/buyers.csv',
    fields: [
      { key: 'code', label: 'Buyer code', required: true },
      { key: 'name', label: 'Name', required: true },
      { key: 'category', label: 'Category', required: true, hint: 'mandi / mill / direct' },
      { key: 'phone', label: 'Phone', required: false },
      { key: 'address', label: 'Address', required: false },
    ],
  },
  'diesel-purchases': {
    key: 'diesel-purchases',
    label: 'Diesel purchases (historic)',
    description: 'Backfill from the manual diesel book.',
    templatePath: '/import-templates/diesel-purchases.csv',
    fields: [
      { key: 'vendor', label: 'Vendor name', required: true },
      { key: 'purchasedAt', label: 'Purchase date', required: true, hint: 'YYYY-MM-DD' },
      { key: 'quantityLiters', label: 'Quantity (litres)', required: true },
      { key: 'rateLiterPkr', label: 'Rate per litre (PKR)', required: true },
      { key: 'totalPkr', label: 'Total (PKR)', required: true },
    ],
  },
};

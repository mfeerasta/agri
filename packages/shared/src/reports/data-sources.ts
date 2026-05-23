// custom report data-source registry. each source declares its columns + types.
// the engine uses this to validate filters, group-by, and aggregations before
// translating into a typed query.

export type ReportColumnType = 'text' | 'numeric' | 'integer' | 'date' | 'timestamp' | 'boolean' | 'uuid';

export interface ReportColumn {
  name: string;
  type: ReportColumnType;
  aggregatable?: boolean;
  groupable?: boolean;
  filterable?: boolean;
  label?: string;
}

export interface ReportDataSource {
  id: string;
  label: string;
  description: string;
  module: string;
  columns: ReportColumn[];
  // sql view or table name in the zameen schema. engine uses this when
  // building the typed drizzle query.
  view: string;
}

export const REPORT_DATA_SOURCES: ReportDataSource[] = [
  {
    id: 'field_pnl',
    label: 'Field P&L',
    description: 'Field-level profit and loss with revenue, cost pools, and margin per acre',
    module: 'finance',
    view: 'zameen.v_field_pnl',
    columns: [
      { name: 'field_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'field_name', type: 'text', groupable: true, filterable: true },
      { name: 'crop_plan_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'season', type: 'text', groupable: true, filterable: true },
      { name: 'acres', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'revenue_pkr', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'total_cost_pkr', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'gross_margin_pkr', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'margin_per_acre_pkr', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'yield_kg', type: 'numeric', aggregatable: true, filterable: true },
    ],
  },
  {
    id: 'cost_allocations',
    label: 'Cost Allocations',
    description: 'Raw cost rows by pool, field, and crop plan',
    module: 'finance',
    view: 'zameen.cost_allocations',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'cost_pool', type: 'text', groupable: true, filterable: true },
      { name: 'field_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'crop_plan_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'amount_pkr', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'source_module', type: 'text', groupable: true, filterable: true },
      { name: 'created_at', type: 'timestamp', groupable: true, filterable: true },
    ],
  },
  {
    id: 'harvest_records',
    label: 'Harvest Records',
    description: 'Per-harvest yield and revenue',
    module: 'crops',
    view: 'zameen.harvest_records',
    columns: [
      { name: 'id', type: 'uuid' },
      { name: 'crop_plan_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'gross_yield_kg', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'revenue_pkr', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'harvested_at', type: 'timestamp', groupable: true, filterable: true },
    ],
  },
  {
    id: 'worker_attendance',
    label: 'Worker Attendance',
    description: 'Daily attendance and wage rows',
    module: 'labor',
    view: 'zameen.worker_attendance',
    columns: [
      { name: 'worker_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'attendance_date', type: 'date', groupable: true, filterable: true },
      { name: 'status', type: 'text', groupable: true, filterable: true },
      { name: 'wage_pkr', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'hours_worked', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'field_id', type: 'uuid', groupable: true, filterable: true },
    ],
  },
  {
    id: 'diesel_consumption',
    label: 'Diesel Consumption',
    description: 'Daily diesel use, hour-meter, allocation',
    module: 'diesel',
    view: 'zameen.diesel_daily_logs',
    columns: [
      { name: 'log_date', type: 'date', groupable: true, filterable: true },
      { name: 'asset_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'field_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'liters_used', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'hours_run', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'cost_pkr', type: 'numeric', aggregatable: true, filterable: true },
    ],
  },
  {
    id: 'inventory_levels',
    label: 'Inventory Levels',
    description: 'Current stock by SKU and store',
    module: 'inventory',
    view: 'zameen.v_inventory_levels',
    columns: [
      { name: 'sku_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'sku_name', type: 'text', groupable: true, filterable: true },
      { name: 'store_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'qty_on_hand', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'value_pkr', type: 'numeric', aggregatable: true, filterable: true },
    ],
  },
  {
    id: 'safety_incidents',
    label: 'Safety Incidents',
    description: 'HR safety incident log',
    module: 'hr',
    view: 'zameen.safety_incidents',
    columns: [
      { name: 'incident_date', type: 'date', groupable: true, filterable: true },
      { name: 'severity', type: 'text', groupable: true, filterable: true },
      { name: 'worker_id', type: 'uuid', filterable: true },
      { name: 'field_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'lost_days', type: 'integer', aggregatable: true, filterable: true },
    ],
  },
  {
    id: 'compliance_documents',
    label: 'Compliance Documents',
    description: 'Document inventory with expiry windows',
    module: 'compliance',
    view: 'zameen.compliance_documents',
    columns: [
      { name: 'doc_type', type: 'text', groupable: true, filterable: true },
      { name: 'status', type: 'text', groupable: true, filterable: true },
      { name: 'expires_on', type: 'date', groupable: true, filterable: true },
      { name: 'created_at', type: 'timestamp', filterable: true },
    ],
  },
  {
    id: 'ar_aging',
    label: 'AR Aging',
    description: 'Receivables aging by customer and bucket',
    module: 'finance',
    view: 'zameen.v_ar_aging',
    columns: [
      { name: 'customer_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'customer_name', type: 'text', groupable: true, filterable: true },
      { name: 'bucket', type: 'text', groupable: true, filterable: true },
      { name: 'amount_pkr', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'days_overdue', type: 'integer', aggregatable: true, filterable: true },
    ],
  },
  {
    id: 'weather_history',
    label: 'Weather History',
    description: 'Per-day weather records by field',
    module: 'weather',
    view: 'zameen.weather_hourly',
    columns: [
      { name: 'field_id', type: 'uuid', groupable: true, filterable: true },
      { name: 'observed_at', type: 'timestamp', groupable: true, filterable: true },
      { name: 'temp_c', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'rainfall_mm', type: 'numeric', aggregatable: true, filterable: true },
      { name: 'humidity_pct', type: 'numeric', aggregatable: true, filterable: true },
    ],
  },
];

export function getDataSource(id: string): ReportDataSource | undefined {
  return REPORT_DATA_SOURCES.find((s) => s.id === id);
}

export function getColumn(sourceId: string, columnName: string): ReportColumn | undefined {
  return getDataSource(sourceId)?.columns.find((c) => c.name === columnName);
}

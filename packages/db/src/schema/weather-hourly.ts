import { decimal, numeric, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { zameen } from './_schema.js';
import { entities } from './core.js';

export const weatherHourly = zameen.table('weather_hourly', {
  id: uuid('id').primaryKey().defaultRandom(),
  entityId: uuid('entity_id').notNull().references(() => entities.id, { onDelete: 'cascade' }),
  forecastTime: timestamp('forecast_time', { withTimezone: true }).notNull(),
  fetchedAt: timestamp('fetched_at', { withTimezone: true }).notNull().defaultNow(),
  tempC: decimal('temp_c', { precision: 5, scale: 2 }),
  rainfallMm: numeric('rainfall_mm', { precision: 6, scale: 3 }),
  humidityPct: decimal('humidity_pct', { precision: 5, scale: 2 }),
  windKph: decimal('wind_kph', { precision: 6, scale: 2 }),
  windGustKph: decimal('wind_gust_kph', { precision: 6, scale: 2 }),
  uvIndex: decimal('uv_index', { precision: 4, scale: 2 }),
  soilMoisture0to10: numeric('soil_moisture_0to10', { precision: 5, scale: 3 }),
  cloudCoverPct: decimal('cloud_cover_pct', { precision: 5, scale: 2 }),
  source: text('source').notNull().default('open-meteo'),
});

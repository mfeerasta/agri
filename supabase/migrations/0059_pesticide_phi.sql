-- Add PHI and chemistry metadata to inputs (for pesticide log warnings).
-- Add recommended seeding rate to crop_profiles (for seed log sanity flag).

alter table zameen.inputs
  add column if not exists pre_harvest_interval_days int;

alter table zameen.inputs
  add column if not exists active_ingredient text;

alter table zameen.inputs
  add column if not exists epa_class text;

alter table zameen.crop_profiles
  add column if not exists recommended_seeding_rate_kg_per_acre numeric(10, 4);

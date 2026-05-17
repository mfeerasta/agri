-- Smoke tests for a freshly restored zameen schema.
-- Each \echo line is parsed by dr-drill.sh; any FAIL string causes drill failure.
\set ON_ERROR_STOP on
\timing off

do $$
declare
  v_entities int;
  v_approvals int;
  v_audit int;
  v_unbalanced int;
begin
  select count(*) into v_entities from zameen.entities;
  if v_entities <= 0 then
    raise notice 'FAIL: entities count is %', v_entities;
  else
    raise notice 'PASS: entities=%', v_entities;
  end if;

  select count(*) into v_approvals from zameen.approval_requests;
  if v_approvals < 0 then
    raise notice 'FAIL: approval_requests inaccessible';
  else
    raise notice 'PASS: approval_requests=%', v_approvals;
  end if;

  select count(*) into v_audit from zameen.audit_log;
  if v_audit < 0 then
    raise notice 'FAIL: audit_log inaccessible';
  else
    raise notice 'PASS: audit_log=%', v_audit;
  end if;

  -- Journals must balance per entry
  select count(*) into v_unbalanced
  from (
    select journal_entry_id, sum(debit_pkr) as d, sum(credit_pkr) as c
    from zameen.journal_entry_lines
    group by journal_entry_id
    having abs(coalesce(sum(debit_pkr),0) - coalesce(sum(credit_pkr),0)) > 0.005
  ) s;
  if v_unbalanced > 0 then
    raise notice 'FAIL: % unbalanced journal entries', v_unbalanced;
  else
    raise notice 'PASS: journals balanced';
  end if;
end$$;

-- FK violation check (catches truncated dumps)
do $$
declare
  v_orphan_fields int;
  v_orphan_approvals int;
begin
  select count(*) into v_orphan_fields
    from zameen.fields f
    left join zameen.entities e on e.id = f.entity_id
    where e.id is null;
  if v_orphan_fields > 0 then
    raise notice 'FAIL: % orphan fields', v_orphan_fields;
  else
    raise notice 'PASS: no orphan fields';
  end if;

  select count(*) into v_orphan_approvals
    from zameen.approval_requests a
    left join zameen.entities e on e.id = a.entity_id
    where e.id is null;
  if v_orphan_approvals > 0 then
    raise notice 'FAIL: % orphan approval_requests', v_orphan_approvals;
  else
    raise notice 'PASS: no orphan approval_requests';
  end if;
end$$;

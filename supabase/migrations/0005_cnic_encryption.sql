-- CNIC field-level encryption using pgcrypto.
-- The symmetric key is read from `current_setting('app.cnic_key', true)`. Inject via:
--   alter database postgres set app.cnic_key = '<32-byte-base64>';
-- Decryption is only callable via a SECURITY DEFINER wrapper restricted to HR roles.

create extension if not exists pgcrypto;

create or replace function zameen.encrypt_cnic(p_plain text)
returns text
language plpgsql
as $$
declare
  k text := current_setting('app.cnic_key', true);
begin
  if p_plain is null then return null; end if;
  if k is null then
    raise exception 'app.cnic_key not configured';
  end if;
  return encode(pgp_sym_encrypt(p_plain, k, 'cipher-algo=aes256'), 'base64');
end;
$$;

create or replace function zameen.decrypt_cnic(p_cipher text)
returns text
language plpgsql
security definer
set search_path = pg_catalog, public, zameen
as $$
declare
  k text := current_setting('app.cnic_key', true);
  caller_ok boolean;
begin
  if p_cipher is null then return null; end if;
  if k is null then
    raise exception 'app.cnic_key not configured';
  end if;

  -- Restrict to HR-capable roles (director, farm_manager, super_admin).
  select
    auth.user_has_role('director')
    or auth.user_has_role('farm_manager')
    or auth.user_has_role('super_admin')
  into caller_ok;

  if not coalesce(caller_ok, false) then
    raise exception 'not authorized to decrypt CNIC';
  end if;

  return pgp_sym_decrypt(decode(p_cipher, 'base64'), k);
end;
$$;

revoke all on function zameen.decrypt_cnic(text) from public;
grant execute on function zameen.decrypt_cnic(text) to authenticated;

-- Policy hardening: the cnic_encrypted column should not be selectable directly.
-- We model this by revoking direct grants and forcing access through the function.
revoke select (cnic_encrypted) on zameen.users from anon, authenticated;
grant select (cnic_encrypted) on zameen.users to service_role;

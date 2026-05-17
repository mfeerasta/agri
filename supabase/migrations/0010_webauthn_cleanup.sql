-- Cleanup expired WebAuthn challenges every 10 minutes.

do $$
begin
  if not exists (
    select 1 from cron.job where jobname = 'webauthn-challenge-cleanup'
  ) then
    perform cron.schedule(
      'webauthn-challenge-cleanup',
      '*/10 * * * *',
      $cron$delete from zameen.webauthn_challenges where expires_at < now()$cron$
    );
  end if;
end$$;

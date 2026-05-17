import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
  type GenerateRegistrationOptionsOpts,
  type VerifiedRegistrationResponse,
  type VerifiedAuthenticationResponse,
} from '@simplewebauthn/server';
import type {
  AuthenticationResponseJSON,
  PublicKeyCredentialCreationOptionsJSON,
  PublicKeyCredentialRequestOptionsJSON,
  RegistrationResponseJSON,
  AuthenticatorTransportFuture,
} from '@simplewebauthn/server/script/deps';
import { createSupabaseServiceClient } from './supabase/service';

export interface WebAuthnCredentialRow {
  id: string;
  user_id: string;
  credential_id: string;
  public_key: string;
  counter: number;
  transports: string[] | null;
  device_label: string | null;
  last_used_at: string | null;
  created_at: string;
}

interface ChallengeRow {
  challenge: string;
  user_id: string | null;
  kind: 'registration' | 'authentication';
  expires_at: string;
}

export function getRpId(): string {
  const fromEnv = process.env.NEXT_PUBLIC_APPROVE_HOST;
  if (fromEnv && fromEnv.length > 0) return fromEnv;
  if (process.env.NODE_ENV !== 'production') return 'localhost';
  return 'approve.agri.feerasta.ai';
}

export function getOrigin(): string {
  const rpId = getRpId();
  if (rpId === 'localhost') return 'http://localhost:3003';
  return `https://${rpId}`;
}

function b64ToBuffer(b64: string): Buffer {
  return Buffer.from(b64, 'base64');
}

function bufferToB64(buf: Buffer | Uint8Array): string {
  return Buffer.from(buf).toString('base64');
}

async function storeChallenge(challenge: string, userId: string | null, kind: 'registration' | 'authentication'): Promise<void> {
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase
    .from('webauthn_challenges')
    .insert({ challenge, user_id: userId, kind });
  if (error) throw new Error(`Failed to store challenge: ${error.message}`);
}

async function consumeChallenge(challenge: string, kind: 'registration' | 'authentication'): Promise<ChallengeRow | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('webauthn_challenges')
    .select('challenge, user_id, kind, expires_at')
    .eq('challenge', challenge)
    .eq('kind', kind)
    .maybeSingle();
  if (error || !data) return null;
  await supabase.from('webauthn_challenges').delete().eq('challenge', challenge);
  if (new Date(data.expires_at).getTime() < Date.now()) return null;
  return data as ChallengeRow;
}

async function loadUserCredentials(userId: string): Promise<WebAuthnCredentialRow[]> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('webauthn_credentials')
    .select('id, user_id, credential_id, public_key, counter, transports, device_label, last_used_at, created_at')
    .eq('user_id', userId);
  if (error) throw new Error(`Failed to load credentials: ${error.message}`);
  return (data ?? []) as WebAuthnCredentialRow[];
}

async function loadCredentialByCredentialId(credentialId: string): Promise<WebAuthnCredentialRow | null> {
  const supabase = createSupabaseServiceClient();
  const { data, error } = await supabase
    .from('webauthn_credentials')
    .select('id, user_id, credential_id, public_key, counter, transports, device_label, last_used_at, created_at')
    .eq('credential_id', credentialId)
    .maybeSingle();
  if (error || !data) return null;
  return data as WebAuthnCredentialRow;
}

export async function generateRegistrationOpts(
  userId: string,
  userName: string,
  userPhone: string,
): Promise<PublicKeyCredentialCreationOptionsJSON> {
  const rpId = getRpId();
  const existing = await loadUserCredentials(userId);
  const opts: GenerateRegistrationOptionsOpts = {
    rpName: 'Zameen Approver',
    rpID: rpId,
    userID: new TextEncoder().encode(userId),
    userName: userPhone || userName || userId,
    userDisplayName: userName || userPhone || 'Approver',
    attestationType: 'none',
    authenticatorSelection: {
      residentKey: 'preferred',
      userVerification: 'required',
    },
    excludeCredentials: existing.map((c) => ({
      id: c.credential_id,
      transports: (c.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
    })),
  };
  const options = await generateRegistrationOptions(opts);
  await storeChallenge(options.challenge, userId, 'registration');
  return options;
}

export async function verifyRegistration(
  userId: string,
  response: RegistrationResponseJSON,
  deviceLabel?: string,
): Promise<{ ok: true; credentialId: string } | { ok: false; error: string }> {
  const clientChallenge = JSON.parse(
    Buffer.from(response.response.clientDataJSON, 'base64').toString('utf-8'),
  ).challenge as string;

  const row = await consumeChallenge(clientChallenge, 'registration');
  if (!row || row.user_id !== userId) return { ok: false, error: 'Challenge invalid or expired' };

  let verified: VerifiedRegistrationResponse;
  try {
    verified = await verifyRegistrationResponse({
      response,
      expectedChallenge: clientChallenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRpId(),
      requireUserVerification: true,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Verification failed' };
  }
  if (!verified.verified || !verified.registrationInfo) return { ok: false, error: 'Not verified' };

  const { credential } = verified.registrationInfo;
  const supabase = createSupabaseServiceClient();
  const { error } = await supabase.from('webauthn_credentials').insert({
    user_id: userId,
    credential_id: credential.id,
    public_key: `\\x${Buffer.from(credential.publicKey).toString('hex')}`,
    counter: credential.counter,
    transports: response.response.transports ?? null,
    device_label: deviceLabel ?? null,
  });
  if (error) return { ok: false, error: `Insert failed: ${error.message}` };
  return { ok: true, credentialId: credential.id };
}

export async function generateAuthOpts(): Promise<PublicKeyCredentialRequestOptionsJSON> {
  const options = await generateAuthenticationOptions({
    rpID: getRpId(),
    userVerification: 'required',
  });
  await storeChallenge(options.challenge, null, 'authentication');
  return options;
}

export async function verifyAuthentication(
  response: AuthenticationResponseJSON,
): Promise<{ ok: true; userId: string } | { ok: false; error: string }> {
  const clientChallenge = JSON.parse(
    Buffer.from(response.response.clientDataJSON, 'base64').toString('utf-8'),
  ).challenge as string;

  const row = await consumeChallenge(clientChallenge, 'authentication');
  if (!row) return { ok: false, error: 'Challenge invalid or expired' };

  const cred = await loadCredentialByCredentialId(response.id);
  if (!cred) return { ok: false, error: 'Unknown credential' };

  const publicKeyHex = cred.public_key.startsWith('\\x') ? cred.public_key.slice(2) : cred.public_key;
  const publicKeyBytes = Buffer.from(publicKeyHex, 'hex');

  let verified: VerifiedAuthenticationResponse;
  try {
    verified = await verifyAuthenticationResponse({
      response,
      expectedChallenge: clientChallenge,
      expectedOrigin: getOrigin(),
      expectedRPID: getRpId(),
      credential: {
        id: cred.credential_id,
        publicKey: new Uint8Array(publicKeyBytes),
        counter: Number(cred.counter),
        transports: (cred.transports ?? undefined) as AuthenticatorTransportFuture[] | undefined,
      },
      requireUserVerification: true,
    });
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Verification failed' };
  }
  if (!verified.verified) return { ok: false, error: 'Not verified' };

  const supabase = createSupabaseServiceClient();
  await supabase
    .from('webauthn_credentials')
    .update({
      counter: verified.authenticationInfo.newCounter,
      last_used_at: new Date().toISOString(),
    })
    .eq('credential_id', cred.credential_id);

  return { ok: true, userId: cred.user_id };
}

export async function listUserCredentials(userId: string): Promise<WebAuthnCredentialRow[]> {
  return loadUserCredentials(userId);
}

// Suppress unused-import lint where types are only used as values.
export type { RegistrationResponseJSON, AuthenticationResponseJSON };
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const _b64 = { b64ToBuffer, bufferToB64 };

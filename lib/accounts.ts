import { cookies } from 'next/headers';
import crypto from 'crypto';

// Armazena os tokens das contas Google conectadas, por workspace.
// Para o MVP usamos cookies httpOnly criptografados (sem expor no cliente).
// Em produção com múltiplos usuários, migrar para banco de dados.

const COOKIE_PREFIX = 'gacct_';
const ALGO = 'aes-256-gcm';

function getKey() {
  const secret = process.env.TOKEN_SECRET || 'dev-secret-change-me-please-32bytes!!';
  return crypto.createHash('sha256').update(secret).digest();
}

export function encrypt(data: any): string {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, getKey(), iv);
  const json = JSON.stringify(data);
  const enc = Buffer.concat([cipher.update(json, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, enc]).toString('base64');
}

export function decrypt(payload: string): any {
  try {
    const buf = Buffer.from(payload, 'base64');
    const iv = buf.subarray(0, 12);
    const tag = buf.subarray(12, 28);
    const enc = buf.subarray(28);
    const decipher = crypto.createDecipheriv(ALGO, getKey(), iv);
    decipher.setAuthTag(tag);
    const dec = Buffer.concat([decipher.update(enc), decipher.final()]);
    return JSON.parse(dec.toString('utf8'));
  } catch {
    return null;
  }
}

export function saveAccount(workspace: string, account: { email: string; tokens: any }) {
  const c = cookies();
  c.set(COOKIE_PREFIX + workspace, encrypt(account), {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 60 * 60 * 24 * 90, // 90 dias
  });
}

export function getAccount(workspace: string): { email: string; tokens: any } | null {
  const c = cookies();
  const raw = c.get(COOKIE_PREFIX + workspace)?.value;
  if (!raw) return null;
  return decrypt(raw);
}

export function removeAccount(workspace: string) {
  cookies().delete(COOKIE_PREFIX + workspace);
}

export function listConnectedWorkspaces(workspaces: string[]) {
  return workspaces.map((ws) => {
    const acct = getAccount(ws);
    return { workspace: ws, connected: !!acct, email: acct?.email || null };
  });
}

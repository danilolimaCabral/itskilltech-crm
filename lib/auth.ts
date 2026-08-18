import crypto from 'crypto';
import {
  createTenantSession,
  deleteTenantSession,
  getTenantSessionByTokenHash,
} from '@/lib/db';

export const SESSION_COOKIE = 'crm_session';
const SESSION_TTL_MS = 1000 * 60 * 60 * 24 * 30;
const PASSWORD_ITERATIONS = 210000;

export type CrmSession = {
  id: string;
  user_id: string;
  username: string;
  display_name: string;
  role: 'master' | 'operator';
  workspace: string;
  expires_at: number;
};

function tokenHash(token: string) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function readCookie(request: Request, name: string) {
  const raw = request.headers.get('cookie') || '';
  const match = raw.split(';').map((part) => part.trim()).find((part) => part.startsWith(`${name}=`));
  return match ? decodeURIComponent(match.slice(name.length + 1)) : null;
}

export function hashPassword(password: string) {
  const salt = crypto.randomBytes(16).toString('base64url');
  const digest = crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64url'), PASSWORD_ITERATIONS, 32, 'sha256').toString('base64url');
  return `pbkdf2$${PASSWORD_ITERATIONS}$${salt}$${digest}`;
}

export function verifyPassword(password: string, storedHash: string) {
  try {
    const [scheme, iterationsText, salt, expected] = storedHash.split('$');
    if (scheme !== 'pbkdf2' || !iterationsText || !salt || !expected) return false;
    const actual = crypto.pbkdf2Sync(password, Buffer.from(salt, 'base64url'), Number(iterationsText), 32, 'sha256').toString('base64url');
    return crypto.timingSafeEqual(Buffer.from(actual), Buffer.from(expected));
  } catch {
    return false;
  }
}

export async function startSession(user: { id: string; username: string; display_name?: string; role: 'master' | 'operator'; workspace: string }) {
  const token = crypto.randomBytes(32).toString('base64url');
  const now = Date.now();
  const session: CrmSession = {
    id: crypto.randomUUID(),
    user_id: user.id,
    username: user.username,
    display_name: user.display_name || user.username,
    role: user.role,
    workspace: user.workspace,
    expires_at: now + SESSION_TTL_MS,
  };
  await createTenantSession({ ...session, token_hash: tokenHash(token), created_at: now });
  return { token, session };
}

export async function getSession(request: Request): Promise<CrmSession | null> {
  const token = readCookie(request, SESSION_COOKIE);
  if (!token) return null;
  const session = await getTenantSessionByTokenHash(tokenHash(token));
  if (!session || Number(session.expires_at) <= Date.now() || !session.active) return null;
  return {
    id: session.id,
    user_id: session.user_id,
    username: session.username,
    display_name: session.display_name || session.username,
    role: session.role === 'master' ? 'master' : 'operator',
    workspace: session.workspace,
    expires_at: Number(session.expires_at),
  };
}

export async function endSession(request: Request) {
  const token = readCookie(request, SESSION_COOKIE);
  if (token) await deleteTenantSession(tokenHash(token));
}

export async function resolveWorkspace(request: Request, requestedWorkspace?: string | null) {
  const session = await getSession(request);
  if (!session) return { session: null, workspace: null, error: 'Sessão inválida ou expirada.' };
  const requested = requestedWorkspace?.trim();
  if (session.role !== 'master' && requested && requested !== session.workspace) {
    return { session, workspace: null, error: 'Acesso negado a este workspace.' };
  }
  return { session, workspace: requested || session.workspace, error: null };
}

export function sessionCookie(token: string) {
  return {
    name: SESSION_COOKIE,
    value: token,
    options: {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax' as const,
      maxAge: SESSION_TTL_MS / 1000,
      path: '/',
    },
  };
}

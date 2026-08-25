import { NextRequest, NextResponse } from 'next/server';
import crypto from 'crypto';
import {
  createPasswordRecoveryCode,
  ensurePasswordRecoveryTable,
  getPasswordRecoveryCode,
  getTenantUserByUsername,
  updateTenantUserPassword,
  usePasswordRecoveryCode,
} from '@/lib/db';
import { hashPassword } from '@/lib/auth';

export const dynamic = 'force-dynamic';

function sha256(value: string) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

export async function POST(request: NextRequest) {
  try {
    await ensurePasswordRecoveryTable();
    const body = await request.json();
    const action = String(body.action || 'verify');
    const configuredCode = process.env.CRM_RECOVERY_CODE || '';
    if (!configuredCode) return NextResponse.json({ error: 'Recuperação não configurada pelo administrador.' }, { status: 503 });

    if (action === 'verify') {
      const username = String(body.username || '').trim().toLowerCase();
      const code = String(body.code || '').trim();
      const user = await getTenantUserByUsername(username);
      if (!user || !user.active || !code || !crypto.timingSafeEqual(Buffer.from(sha256(code)), Buffer.from(sha256(configuredCode)))) {
        return NextResponse.json({ error: 'Usuário ou código inválido.' }, { status: 400 });
      }
      const token = crypto.randomBytes(32).toString('base64url');
      await createPasswordRecoveryCode({ id: sha256(token), user_id: user.id, code_hash: sha256(configuredCode), expires_at: Date.now() + 15 * 60 * 1000, created_at: Date.now() });
      return NextResponse.json({ ok: true, recoveryToken: token });
    }

    if (action === 'reset') {
      const token = String(body.recoveryToken || '');
      const password = String(body.password || '');
      if (password.length < 10) return NextResponse.json({ error: 'A nova senha deve ter ao menos 10 caracteres.' }, { status: 400 });
      const record = await getPasswordRecoveryCode(sha256(token));
      if (!record || record.used_at || Number(record.expires_at) <= Date.now()) return NextResponse.json({ error: 'Código expirado ou já utilizado.' }, { status: 400 });
      await updateTenantUserPassword(record.user_id, hashPassword(password));
      await usePasswordRecoveryCode(record.id);
      return NextResponse.json({ ok: true });
    }

    return NextResponse.json({ error: 'Operação inválida.' }, { status: 400 });
  } catch (error) {
    console.error('[auth/recover]', error);
    return NextResponse.json({ error: 'Não foi possível concluir a recuperação.' }, { status: 500 });
  }
}

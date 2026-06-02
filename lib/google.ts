import { google } from 'googleapis';

// Escopos: ler e enviar e-mails + dados básicos do perfil + Google Calendar
export const GMAIL_SCOPES = [
  'https://www.googleapis.com/auth/gmail.readonly',
  'https://www.googleapis.com/auth/gmail.send',
  'https://www.googleapis.com/auth/userinfo.email',
  'https://www.googleapis.com/auth/userinfo.profile',
  'https://www.googleapis.com/auth/calendar',
  'https://www.googleapis.com/auth/calendar.events',
];

export function getBaseUrl() {
  return process.env.NEXTAUTH_URL || 'http://localhost:3000';
}

export function createOAuthClient() {
  return new google.auth.OAuth2(
    process.env.GOOGLE_CLIENT_ID,
    process.env.GOOGLE_CLIENT_SECRET,
    `${getBaseUrl()}/api/auth/google/callback`
  );
}

// Gera a URL para o usuário autorizar (passa o workspace no state)
export function getAuthUrl(workspace: string) {
  const client = createOAuthClient();
  return client.generateAuthUrl({
    access_type: 'offline',      // garante refresh_token
    prompt: 'consent',           // força retorno do refresh_token
    scope: GMAIL_SCOPES,
    state: workspace,
  });
}

// Troca o código de autorização por tokens
export async function exchangeCode(code: string) {
  const client = createOAuthClient();
  const { tokens } = await client.getToken(code);
  return tokens;
}

// Cria um cliente Gmail autenticado a partir dos tokens salvos
export function gmailClient(tokens: any) {
  const client = createOAuthClient();
  client.setCredentials(tokens);
  return google.gmail({ version: 'v1', auth: client });
}

// Cria um cliente Google Calendar autenticado a partir dos tokens salvos
export function calendarClient(tokens: any) {
  const client = createOAuthClient();
  client.setCredentials(tokens);
  return google.calendar({ version: 'v3', auth: client });
}

// Pega o e-mail do usuário autenticado
export async function getUserEmail(tokens: any) {
  const client = createOAuthClient();
  client.setCredentials(tokens);
  const oauth2 = google.oauth2({ version: 'v2', auth: client });
  const { data } = await oauth2.userinfo.get();
  return data.email || '';
}

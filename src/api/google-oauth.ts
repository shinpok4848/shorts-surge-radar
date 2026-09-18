const GIS_SCRIPT_URL = 'https://accounts.google.com/gsi/client';
const YOUTUBE_SCOPES = [
  'https://www.googleapis.com/auth/youtube.readonly',
  'https://www.googleapis.com/auth/yt-analytics.readonly',
].join(' ');

interface TokenResponse {
  access_token?: string;
  expires_in?: number;
  error?: string;
  error_description?: string;
}

interface TokenClient {
  requestAccessToken(options?: { prompt?: string }): void;
}

interface GoogleOAuth2Api {
  initTokenClient(config: {
    client_id: string;
    scope: string;
    callback: (response: TokenResponse) => void;
    error_callback?: (error: { type?: string; message?: string }) => void;
    include_granted_scopes?: boolean;
    prompt?: string;
  }): TokenClient;
  revoke(token: string, done?: () => void): void;
}

declare global {
  interface Window {
    google?: { accounts?: { oauth2?: GoogleOAuth2Api } };
  }
}

export interface GoogleSession {
  accessToken: string;
  expiresAt: number;
}

export class GoogleOAuthError extends Error {
  constructor(message: string, public readonly code: string) {
    super(message);
    this.name = 'GoogleOAuthError';
  }
}

let scriptPromise: Promise<void> | null = null;
let currentSession: GoogleSession | null = null;

function loadGoogleIdentityServices(): Promise<void> {
  if (window.google?.accounts?.oauth2) return Promise.resolve();
  if (scriptPromise) return scriptPromise;

  scriptPromise = new Promise((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${GIS_SCRIPT_URL}"]`);
    const script = existing ?? document.createElement('script');
    const handleLoad = () => window.google?.accounts?.oauth2
      ? resolve()
      : reject(new GoogleOAuthError('Google 인증 모듈을 초기화하지 못했습니다.', 'GIS_INIT_FAILED'));
    const handleError = () => reject(new GoogleOAuthError('Google 인증 모듈을 불러오지 못했습니다.', 'GIS_LOAD_FAILED'));
    script.addEventListener('load', handleLoad, { once: true });
    script.addEventListener('error', handleError, { once: true });
    if (!existing) {
      script.src = GIS_SCRIPT_URL;
      script.async = true;
      script.defer = true;
      document.head.append(script);
    }
  });

  return scriptPromise;
}

function validateClientId(clientId: string): string {
  const clean = clientId.trim();
  if (!clean) {
    throw new GoogleOAuthError(
      'Google OAuth 클라이언트가 아직 설정되지 않았습니다. 지금은 Studio CSV 또는 데모 진단을 사용할 수 있습니다.',
      'GOOGLE_OAUTH_NOT_CONFIGURED',
    );
  }
  if (!clean.endsWith('.apps.googleusercontent.com')) {
    throw new GoogleOAuthError('Google OAuth 클라이언트 ID 형식이 올바르지 않습니다.', 'GOOGLE_CLIENT_ID_INVALID');
  }
  return clean;
}

export async function connectGoogleChannel(clientId: string): Promise<GoogleSession> {
  const validClientId = validateClientId(clientId);
  await loadGoogleIdentityServices();
  const oauth = window.google?.accounts?.oauth2;
  if (!oauth) throw new GoogleOAuthError('Google 인증 모듈을 사용할 수 없습니다.', 'GIS_UNAVAILABLE');

  return new Promise<GoogleSession>((resolve, reject) => {
    let settled = false;
    const finishError = (error: GoogleOAuthError) => {
      if (settled) return;
      settled = true;
      reject(error);
    };
    const client = oauth.initTokenClient({
      client_id: validClientId,
      scope: YOUTUBE_SCOPES,
      include_granted_scopes: true,
      callback: (response) => {
        if (settled) return;
        if (response.error || !response.access_token) {
          finishError(new GoogleOAuthError(
            response.error_description ?? 'Google 채널 연결이 승인되지 않았습니다.',
            response.error ?? 'GOOGLE_AUTH_FAILED',
          ));
          return;
        }
        settled = true;
        currentSession = {
          accessToken: response.access_token,
          expiresAt: Date.now() + Math.max(60, response.expires_in ?? 3600) * 1000,
        };
        resolve(currentSession);
      },
      error_callback: (error) => {
        const code = error.type === 'popup_closed' ? 'GOOGLE_POPUP_CLOSED' : 'GOOGLE_POPUP_FAILED';
        const message = error.type === 'popup_closed'
          ? 'Google 연결 창이 닫혔습니다.'
          : error.message ?? 'Google 연결 창을 열지 못했습니다.';
        finishError(new GoogleOAuthError(message, code));
      },
    });
    client.requestAccessToken({ prompt: 'consent' });
  });
}

export function activeGoogleSession(): GoogleSession | null {
  if (!currentSession || currentSession.expiresAt <= Date.now() + 30_000) return null;
  return currentSession;
}

export async function disconnectGoogleChannel(): Promise<void> {
  const token = currentSession?.accessToken;
  currentSession = null;
  if (!token || !window.google?.accounts?.oauth2) return;
  await new Promise<void>((resolve) => window.google?.accounts?.oauth2?.revoke(token, resolve));
}

import { randomUUID, timingSafeEqual } from 'node:crypto';

export const TEACHER_COOKIE = 'teacher_session';

export function verifyTeacherPin(candidate, expected) {
  const provided = String(candidate ?? '');
  const configured = String(expected ?? '');
  if (!provided || !configured) return false;
  const providedBuffer = Buffer.from(provided);
  const configuredBuffer = Buffer.from(configured);
  if (providedBuffer.length !== configuredBuffer.length) return false;
  return timingSafeEqual(providedBuffer, configuredBuffer);
}

export function extractCookieValue(cookieHeader = '', name) {
  const cookies = String(cookieHeader)
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean);
  const prefix = `${name}=`;
  const match = cookies.find((cookie) => cookie.startsWith(prefix));
  return match ? decodeURIComponent(match.slice(prefix.length)) : '';
}

export function createTeacherSessionStore({ ttlMs = 4 * 60 * 60 * 1000 } = {}) {
  const sessions = new Map();

  function cleanup() {
    const now = Date.now();
    for (const [token, expiresAt] of sessions) {
      if (expiresAt <= now) sessions.delete(token);
    }
  }

  return {
    create() {
      cleanup();
      const token = randomUUID();
      sessions.set(token, Date.now() + ttlMs);
      return token;
    },
    has(token) {
      cleanup();
      return Boolean(token && sessions.has(token));
    },
    delete(token) {
      sessions.delete(token);
    }
  };
}

export function createLoginRateLimiter({ maxAttempts = 5, windowMs = 10 * 60 * 1000 } = {}) {
  const attempts = new Map();

  function currentRecord(key) {
    const now = Date.now();
    const record = attempts.get(key);
    if (!record || record.expiresAt <= now) {
      const fresh = { count: 0, expiresAt: now + windowMs };
      attempts.set(key, fresh);
      return fresh;
    }
    return record;
  }

  return {
    consume(key = 'unknown') {
      const record = currentRecord(String(key));
      record.count += 1;
      return {
        allowed: record.count <= maxAttempts,
        remaining: Math.max(0, maxAttempts - record.count),
        retryAfterMs: Math.max(0, record.expiresAt - Date.now())
      };
    },
    reset(key = 'unknown') {
      attempts.delete(String(key));
    }
  };
}

export function teacherCookie(token, { maxAgeSeconds = 4 * 60 * 60, secure = false } = {}) {
  const parts = [
    `${TEACHER_COOKIE}=${encodeURIComponent(token)}`,
    'HttpOnly',
    'SameSite=Lax',
    'Path=/',
    `Max-Age=${maxAgeSeconds}`
  ];
  if (secure) parts.push('Secure');
  return parts.join('; ');
}

export function expiredTeacherCookie() {
  return `${TEACHER_COOKIE}=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0`;
}

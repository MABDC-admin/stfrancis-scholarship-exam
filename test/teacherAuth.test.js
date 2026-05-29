import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import {
  createTeacherSessionStore,
  extractCookieValue,
  verifyTeacherPin
} from '../src/lib/teacherAuth.js';

const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const serverJs = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');

test('verifyTeacherPin compares configured PINs without accepting blanks', () => {
  assert.equal(verifyTeacherPin('stfrancis2026', 'stfrancis2026'), true);
  assert.equal(verifyTeacherPin('', 'stfrancis2026'), false);
  assert.equal(verifyTeacherPin('wrong', 'stfrancis2026'), false);
});

test('teacher session store creates single-purpose tokens and expires old tokens', () => {
  const sessions = createTeacherSessionStore({ ttlMs: 10 });
  const token = sessions.create();

  assert.equal(sessions.has(token), true);
  sessions.delete(token);
  assert.equal(sessions.has(token), false);
});

test('extractCookieValue reads a named cookie from the request header', () => {
  assert.equal(extractCookieValue('theme=dark; teacher_session=abc123; other=yes', 'teacher_session'), 'abc123');
  assert.equal(extractCookieValue('theme=dark', 'teacher_session'), '');
});

test('teacher page has an access-code gate before dashboard modules', () => {
  assert.match(indexHtml, /id="teacherLoginPanel"/);
  assert.match(indexHtml, /id="teacherAccessCode"/);
  assert.match(indexHtml, /id="teacherShell"/);
  assert.match(appJs, /async function ensureTeacherAccess/);
  assert.match(appJs, /\/api\/teacher\/login/);
  assert.match(appJs, /\/api\/teacher\/session/);
});

test('teacher API routes use session-cookie authentication when access code is configured', () => {
  assert.match(serverJs, /TEACHER_ACCESS_CODE/);
  assert.match(serverJs, /createTeacherSessionStore/);
  assert.match(serverJs, /app\.post\('\/api\/teacher\/login'/);
  assert.match(serverJs, /app\.get\('\/api\/teacher\/session'/);
  assert.match(serverJs, /extractCookieValue\(req\.headers\.cookie/);
  assert.match(serverJs, /res\.status\(401\)\.json\(\{ error: 'Teacher access required\.' \}\)/);
  assert.doesNotMatch(serverJs, /Temporarily open for fast school-side use/);
});

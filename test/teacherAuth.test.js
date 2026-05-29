import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createTeacherSessionStore,
  extractCookieValue,
  verifyTeacherPin
} from '../src/lib/teacherAuth.js';

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

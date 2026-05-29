import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const appJs = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('student unanswered confirmation uses a custom modal instead of browser confirm', () => {
  assert.equal(appJs.includes('confirm(`You still have'), false);
  assert.match(indexHtml, /id="unansweredModal"/);
  assert.match(indexHtml, /role="dialog"/);
  assert.match(appJs, /showUnansweredModal\(unanswered\)/);
  assert.match(appJs, /unansweredCount/);
});

test('unanswered confirmation modal has centered dark styling and required actions', () => {
  assert.match(indexHtml, /id="closeUnansweredModal"/);
  assert.match(indexHtml, /id="confirmSubmitAnyway"/);
  assert.match(indexHtml, /id="reviewUnansweredQuestions"/);
  assert.match(stylesCss, /\.modal-backdrop/);
  assert.match(stylesCss, /place-items:\s*center/);
  assert.match(stylesCss, /--modal-dark/);
  assert.match(stylesCss, /var\(--teal\)/);
  assert.match(stylesCss, /var\(--coral\)/);
});

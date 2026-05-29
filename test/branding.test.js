import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');

test('school logo is included in the header and start panel', () => {
  assert.equal(existsSync(new URL('../public/assets/sfxsai-school-logo.png', import.meta.url)), true);
  assert.match(indexHtml, /assets\/sfxsai-school-logo\.png/);
  assert.match(indexHtml, /class="school-logo"/);
  assert.match(indexHtml, /class="intro-logo"/);
  assert.match(stylesCss, /\.brand-lockup/);
});

test('student start copy explains five scholarship slots per grade level', () => {
  assert.match(indexHtml, /Each grade level has 5 scholarship slots/);
});

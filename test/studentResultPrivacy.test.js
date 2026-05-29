import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const serverJs = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('student submission API response does not include score fields', () => {
  const responseBlock = serverJs.match(/res\.status\(201\)\.json\(\{[\s\S]*?\n\s*\}\);/)?.[0] ?? '';

  assert.match(responseBlock, /submittedAt/);
  assert.doesNotMatch(responseBlock, /\bscore:/);
  assert.doesNotMatch(responseBlock, /\bmaxScore:/);
  assert.doesNotMatch(responseBlock, /\bpercentage:/);
});

test('student result panel confirms submission without rendering score or percentage', () => {
  const submitBlock = appJs.match(/resultPanel'\)\.innerHTML = `[\s\S]*?`;/)?.[0] ?? '';

  assert.match(submitBlock, /Submitted/);
  assert.doesNotMatch(submitBlock, /result\.score/);
  assert.doesNotMatch(submitBlock, /result\.percentage/);
  assert.doesNotMatch(submitBlock, /score-ring/);
});

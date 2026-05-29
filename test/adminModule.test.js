import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const serverJs = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');

test('teacher view includes an admin module for clearing results only', () => {
  assert.match(indexHtml, /id="adminModule"/);
  assert.match(indexHtml, /Delete all submissions and results/);
  assert.match(indexHtml, /This does not delete the exam/);
  assert.match(indexHtml, /id="deleteAllResults"/);
});

test('admin module calls a delete submissions endpoint and refreshes dashboard data', () => {
  assert.match(appJs, /function deleteAllResults/);
  assert.match(appJs, /confirm\('Delete all submissions and results\?/);
  assert.match(appJs, /api\('\/api\/teacher\/submissions'/);
  assert.match(appJs, /method:\s*'DELETE'/);
  assert.match(appJs, /loadDashboard\(\{ refreshQuestions: false \}\)/);
});

test('server exposes a delete endpoint that clears submissions without saving exam', () => {
  assert.match(serverJs, /app\.delete\('\/api\/teacher\/submissions'/);
  const routeStart = serverJs.indexOf("app.delete('/api/teacher/submissions'");
  const routeEnd = serverJs.indexOf('\n});', routeStart);
  const routeBlock = serverJs.slice(routeStart, routeEnd);
  assert.match(routeBlock, /await store\.clearSubmissions\(\)/);
  assert.doesNotMatch(routeBlock, /saveExam/);
});

test('admin module has distinct warning styling', () => {
  assert.match(stylesCss, /\.admin-module/);
  assert.match(stylesCss, /\.danger-button/);
});

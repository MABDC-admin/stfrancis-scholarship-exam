import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const serverJs = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');

test('server exposes production entry routes for student and teacher pages', () => {
  assert.match(serverJs, /app\.get\(\[['"]\/student['"],\s*['"]\/teacher['"]\]/);
  assert.match(serverJs, /sendFile\(resolve\(publicDir,\s*['"]index\.html['"]\)\)/);
});

test('app chooses the visible page from the production URL path', () => {
  assert.match(appJs, /function\s+routeMode/);
  assert.match(appJs, /window\.location\.pathname/);
  assert.match(appJs, /\/teacher/);
  assert.match(appJs, /\/student/);
  assert.match(appJs, /switchMode\(routeMode\(\)\)/);
});

test('student and teacher production pages hide the mode selector', () => {
  assert.match(indexHtml, /class="mode-switch"/);
  assert.match(appJs, /document\.body\.classList\.toggle\('route-locked'/);
  assert.match(stylesCss, /\.route-locked\s+\.mode-switch\s*\{[\s\S]*?display:\s*none/);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('teacher dashboard keeps navigation focused on grade workspaces only', () => {
  assert.match(indexHtml, /class="teacher-shell"/);
  assert.match(indexHtml, /class="teacher-side-nav"/);
  assert.match(indexHtml, /Grade Workspaces/);
  assert.doesNotMatch(indexHtml, /Teacher Modules/);
  for (const label of ['Dashboard', 'Question Bank', 'Exam Builder', 'Examinees', 'Live Monitoring', 'Submissions', 'Scores & Results', 'Reports', 'Resources']) {
    assert.doesNotMatch(indexHtml, new RegExp(`>${label.replace('&', '&amp;|&')}<`));
  }
});

test('teacher dashboard exposes a grade-level module for each scholarship level', () => {
  assert.match(indexHtml, /class="grade-module-nav"/);
  for (const gradeLevel of ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']) {
    assert.match(indexHtml, new RegExp(`<button[^>]+data-grade="${gradeLevel}"[\\s\\S]*?${gradeLevel}`));
  }
  assert.doesNotMatch(indexHtml, /href="#dashboardSummary" data-grade=/);
});

test('question review is exposed as its own side navigation module', () => {
  assert.match(indexHtml, /id="questionReview"/);
  assert.match(indexHtml, /class="teacher-tool-nav"/);
  assert.match(indexHtml, /data-teacher-tool="questionReview"[\s\S]*?Question Review/);
  assert.doesNotMatch(indexHtml, /href="#questionReview"/);
});

test('question review is not rendered inside each grade workspace flow', () => {
  const workspaceStart = indexHtml.indexOf('id="gradeWorkspaceContent"');
  const workspaceEnd = indexHtml.indexOf('id="questionReview"', workspaceStart);
  const workspaceBlock = indexHtml.slice(workspaceStart, workspaceEnd);

  assert.ok(workspaceStart > -1, 'grade workspace content wrapper is present');
  assert.doesNotMatch(workspaceBlock, /Question Review/);
  assert.match(indexHtml, /id="questionReview" class="question-review panel hidden"/);
  assert.match(appJs, /function showTeacherModule/);
  assert.match(appJs, /showTeacherModule\('workspace'\)/);
  assert.match(appJs, /loadQuestionEditor\(\)/);
});

test('teacher dashboard requests data for the active grade workspace', () => {
  assert.match(appJs, /selectedTeacherGrade:\s*'Grade 7'/);
  assert.match(appJs, /gradeLevel=\$\{encodeURIComponent\(state\.selectedTeacherGrade\)\}/);
  assert.match(appJs, /renderWorkspaceDashboard/);
});

test('changing grade workspaces updates data without auto-scrolling the page', () => {
  const focusStart = appJs.indexOf('function focusTeacherGrade');
  const focusEnd = appJs.indexOf('\n}\n\nfunction populateExamineeSelect', focusStart);
  const focusBlock = appJs.slice(focusStart, focusEnd);

  assert.match(focusBlock, /loadDashboard\(\{ refreshQuestions: false \}\)/);
  assert.match(focusBlock, /previousScrollY/);
  assert.match(focusBlock, /teacherStableScrollY/);
  assert.match(focusBlock, /preserveTeacherScroll/);
  assert.doesNotMatch(focusBlock, /scrollIntoView/);
  assert.match(appJs, /mousedown[\s\S]*?preventDefault/);
  assert.match(appJs, /scroll[\s\S]*?teacherStableScrollY/);
  assert.match(appJs, /setInterval[\s\S]*?teacherStableScrollY/);
  assert.match(appJs, /function preserveTeacherScroll/);
  assert.match(appJs, /setTimeout[\s\S]*?window\.scrollTo/);
});

test('teacher layout uses a wide application shell for dashboard work', () => {
  assert.doesNotMatch(indexHtml, /\.shell\{width:min\(1180px/);
  assert.doesNotMatch(stylesCss, /\.shell\s*\{[\s\S]*?1180px/);
  assert.match(stylesCss, /\.shell\s*\{[\s\S]*?width:\s*calc\(100% - 24px\)/);
  assert.match(stylesCss, /\.shell\s*\{[\s\S]*?max-width:\s*1680px/);
});

test('grade level cards avoid duplicate module shortcuts already covered by navigation', () => {
  assert.doesNotMatch(appJs, /grade-module-actions/);
  assert.doesNotMatch(stylesCss, /\.grade-module-actions/);
});

test('teacher side navigation has responsive layout styling', () => {
  assert.match(stylesCss, /\.teacher-shell/);
  assert.match(stylesCss, /\.teacher-side-nav/);
  assert.match(stylesCss, /\.grade-module-nav/);
  assert.match(stylesCss, /\.teacher-tool-nav/);
  assert.match(stylesCss, /overflow-anchor:\s*none/);
  assert.match(stylesCss, /position:\s*sticky/);
});

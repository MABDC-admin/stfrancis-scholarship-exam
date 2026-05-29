import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const stylesCss = readFileSync(new URL('../public/styles.css', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

test('teacher dashboard has hierarchical grade and examinee dropdowns', () => {
  assert.match(indexHtml, /id="workspaceGradeSelect"/);
  assert.match(indexHtml, /id="examineeSelect"/);
  assert.match(indexHtml, /id="examineeDetail"/);
  for (const gradeLevel of ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']) {
    assert.match(indexHtml, new RegExp(`<option>${gradeLevel}</option>`));
  }
});

test('teacher workspace header removes bulky search sort load and import controls', () => {
  for (const removedId of ['studentSearch', 'studentSort', 'loadDashboard', 'docxUpload']) {
    assert.doesNotMatch(indexHtml, new RegExp(`id="${removedId}"`));
  }
  for (const removedText of ['Search', 'Sort', 'Load Dashboard', 'Import DOCX']) {
    assert.doesNotMatch(indexHtml, new RegExp(`>${removedText}<`));
  }
});

test('teacher dashboard auto-loads when switching to teacher mode', () => {
  assert.match(appJs, /mode === 'teacher'/);
  assert.match(appJs, /loadDashboard\(\{ refreshQuestions: false \}\)/);
});

test('teacher dashboard populates examinees from the selected grade workspace', () => {
  assert.match(appJs, /populateExamineeSelect\(students\)/);
  assert.match(appJs, /selectedExamineeId/);
  assert.match(appJs, /renderSelectedExaminee\(students\)/);
  assert.match(appJs, /workspaceGradeSelect/);
  assert.match(appJs, /examineeSelect/);
});

test('selected examinee detail renders metadata, score, progress, timestamp, and answers', () => {
  assert.match(appJs, /Student ID/);
  assert.match(appJs, /Progress Status/);
  assert.match(appJs, /Completed At/);
  assert.match(appJs, /Score Breakdown/);
  assert.match(appJs, /Question Responses/);
  assert.match(appJs, /answer-table/);
});

test('examinee detail view has responsive accessible card styling', () => {
  assert.match(stylesCss, /\.workspace-picker/);
  assert.match(stylesCss, /\.examinee-detail/);
  assert.match(stylesCss, /\.detail-metadata/);
  assert.match(stylesCss, /\.detail-score-card/);
  assert.match(stylesCss, /\.detail-empty/);
});

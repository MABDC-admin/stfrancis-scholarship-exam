import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDashboardModel } from '../src/lib/dashboardModel.js';
import { buildResultsCsv, csvFileName } from '../src/lib/reports.js';

const serverJs = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

const exam = {
  title: 'Scholarship Exam',
  totalPoints: 2,
  questions: [{ id: 'q1' }, { id: 'q2' }]
};

const submissions = [
  {
    id: 1,
    studentName: 'Ana, Cruz',
    studentEmail: 'ana@example.com',
    section: 'Grade 7',
    score: 2,
    maxScore: 2,
    percentage: 100,
    submittedAt: '2026-05-29T09:00:00.000Z',
    details: [{ timeTakenSeconds: 10 }, { timeTakenSeconds: 11 }]
  },
  {
    id: 2,
    studentName: 'Ben Santos',
    studentEmail: 'ben@example.com',
    section: 'Grade 8',
    score: 1,
    maxScore: 2,
    percentage: 50,
    submittedAt: '2026-05-29T09:05:00.000Z',
    details: [{ timeTakenSeconds: 6 }, { timeTakenSeconds: 7 }]
  }
];

test('buildResultsCsv exports a readable grade-scoped results report', () => {
  const dashboard = buildDashboardModel({ exam, submissions, gradeLevel: 'Grade 7' });
  const csv = buildResultsCsv(dashboard);

  assert.match(csv, /^Student ID,Student Name,Email,Grade Level,Score,Max Score,Percentage,Scholarship Status,Rank,Submitted At,Time Taken Seconds/m);
  assert.match(csv, /1,"Ana, Cruz",ana@example\.com,Grade 7,2,2,100,accepted,1,2026-05-29T09:00:00\.000Z,21/);
  assert.doesNotMatch(csv, /Ben Santos/);
});

test('csvFileName produces safe workspace filenames', () => {
  assert.equal(csvFileName('Grade 7'), 'stfrancis-grade-7-results.csv');
  assert.equal(csvFileName('All Grades'), 'stfrancis-all-grades-results.csv');
});

test('teacher workspace exposes a protected CSV export route and button', () => {
  assert.match(serverJs, /app\.get\('\/api\/teacher\/reports\/results\.csv', requireTeacher/);
  assert.match(serverJs, /buildResultsCsv/);
  assert.match(serverJs, /Content-Disposition/);
  assert.match(indexHtml, /id="exportResults"/);
  assert.match(appJs, /function exportResultsCsv/);
  assert.match(appJs, /\/api\/teacher\/reports\/results\.csv\?gradeLevel=/);
});

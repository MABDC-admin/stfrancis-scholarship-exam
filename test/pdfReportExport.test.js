import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { buildDashboardModel } from '../src/lib/dashboardModel.js';
import { buildResultsPdf, pdfFileName } from '../src/lib/pdfReport.js';

const serverJs = readFileSync(new URL('../src/server.js', import.meta.url), 'utf8');
const indexHtml = readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
const appJs = readFileSync(new URL('../public/app.js', import.meta.url), 'utf8');

const exam = {
  title: 'Scholarship Entrance Exam',
  totalPoints: 3,
  questions: [{ id: 'q1' }, { id: 'q2' }, { id: 'q3' }]
};

const submissions = [
  {
    id: 1,
    studentName: 'Ana Cruz',
    studentEmail: 'ana@example.com',
    section: 'Grade 7',
    score: 3,
    maxScore: 3,
    percentage: 100,
    scholarshipStatus: 'accepted',
    scholarshipRank: 1,
    submittedAt: '2026-05-29T09:00:00.000Z',
    details: [{ timeTakenSeconds: 20 }, { timeTakenSeconds: 10 }, { timeTakenSeconds: 5 }]
  }
];

test('buildResultsPdf creates a branded PDF buffer for a grade workspace', async () => {
  const dashboard = buildDashboardModel({ exam, submissions, gradeLevel: 'Grade 7' });
  const pdf = await buildResultsPdf(dashboard);

  assert.ok(Buffer.isBuffer(pdf));
  assert.equal(pdf.subarray(0, 4).toString('utf8'), '%PDF');
  assert.ok(pdf.length > 1000);
});

test('pdfFileName produces safe workspace filenames', () => {
  assert.equal(pdfFileName('Grade 7'), 'stfrancis-grade-7-results.pdf');
  assert.equal(pdfFileName('All Grades'), 'stfrancis-all-grades-results.pdf');
});

test('teacher workspace exposes a protected branded PDF export route and button', () => {
  assert.match(serverJs, /app\.get\('\/api\/teacher\/reports\/results\.pdf', requireTeacher/);
  assert.match(serverJs, /buildResultsPdf/);
  assert.match(serverJs, /application\/pdf/);
  assert.match(serverJs, /sfxsai-school-logo\.png/);
  assert.match(indexHtml, /id="exportPdf"/);
  assert.match(appJs, /function exportResultsPdf/);
  assert.match(appJs, /\/api\/teacher\/reports\/results\.pdf\?gradeLevel=/);
});

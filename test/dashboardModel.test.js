import test from 'node:test';
import assert from 'node:assert/strict';
import {
  buildDashboardModel,
  filterAndSortStudents,
  performanceLevel,
  rankScholarshipApplicants
} from '../src/lib/dashboardModel.js';

const exam = {
  title: 'MAPEH 4',
  status: 'active',
  totalPoints: 10,
  updatedAt: '2026-05-29T07:00:00.000Z',
  questions: [
    { id: 'q1', type: 'multiple-choice', points: 5 },
    { id: 'q2', type: 'short-answer', points: 5 }
  ]
};

const submissions = [
  {
    id: 1,
    studentName: 'Ana Cruz',
    studentEmail: 'ana@example.com',
    section: 'Grade 7',
    score: 9,
    maxScore: 10,
    percentage: 90,
    submittedAt: '2026-05-29T09:00:00.000Z',
    details: [{ timeTakenSeconds: 10 }, { timeTakenSeconds: 20 }]
  },
  {
    id: 2,
    studentName: 'Ben Santos',
    studentEmail: 'ben@example.com',
    section: 'Grade 7',
    score: 5,
    maxScore: 10,
    percentage: 50,
    submittedAt: '2026-05-29T08:00:00.000Z',
    details: [{ timeTakenSeconds: 5 }, { timeTakenSeconds: 8 }]
  }
];

test('buildDashboardModel computes overview, test statuses, students, and activity', () => {
  const model = buildDashboardModel({ exam, submissions, expectedStudents: 4 });

  assert.equal(model.overview.totalStudents, 2);
  assert.equal(model.overview.averageScore, 70);
  assert.equal(model.overview.completionRate, 50);
  assert.equal(model.tests[0].status, 'active');
  assert.equal(model.students[0].timeTakenSeconds, 30);
  assert.equal(model.recentActivity[0].studentName, 'Ana Cruz');
});

test('filterAndSortStudents filters by search and status then sorts by performance', () => {
  const students = buildDashboardModel({ exam, submissions, expectedStudents: 2 }).students;
  const filtered = filterAndSortStudents(students, {
    search: 'ben',
    status: 'completed',
    sort: 'performance-asc'
  });

  assert.equal(filtered.length, 1);
  assert.equal(filtered[0].studentEmail, 'ben@example.com');
});

test('performanceLevel maps score bands to accessible labels and colors', () => {
  assert.deepEqual(performanceLevel(92), { label: 'Excellent', tone: 'excellent', color: '#22C55E' });
  assert.deepEqual(performanceLevel(76), { label: 'Proficient', tone: 'proficient', color: '#14B8A6' });
  assert.deepEqual(performanceLevel(60), { label: 'Developing', tone: 'developing', color: '#F59E0B' });
  assert.deepEqual(performanceLevel(40), { label: 'Needs Support', tone: 'support', color: '#FB7185' });
});

test('rankScholarshipApplicants accepts top 5 students per grade level at or above 75 percent', () => {
  const ranked = rankScholarshipApplicants([
    { id: 1, studentName: 'A', section: 'Grade 7', percentage: 99, submittedAt: '2026-05-29T01:00:00.000Z' },
    { id: 2, studentName: 'B', section: 'Grade 7', percentage: 92, submittedAt: '2026-05-29T01:00:00.000Z' },
    { id: 3, studentName: 'C', section: 'Grade 7', percentage: 88, submittedAt: '2026-05-29T01:00:00.000Z' },
    { id: 4, studentName: 'D', section: 'Grade 7', percentage: 83, submittedAt: '2026-05-29T01:00:00.000Z' },
    { id: 5, studentName: 'E', section: 'Grade 7', percentage: 80, submittedAt: '2026-05-29T01:00:00.000Z' },
    { id: 6, studentName: 'F', section: 'Grade 7', percentage: 79, submittedAt: '2026-05-29T01:00:00.000Z' },
    { id: 7, studentName: 'G', section: 'Grade 7', percentage: 74, submittedAt: '2026-05-29T01:00:00.000Z' },
    { id: 8, studentName: 'H', section: 'Grade 8', percentage: 78, submittedAt: '2026-05-29T01:00:00.000Z' }
  ]);

  assert.deepEqual(
    ranked.map((student) => [student.studentName, student.scholarshipRank, student.scholarshipStatus]),
    [
      ['A', 1, 'accepted'],
      ['B', 2, 'accepted'],
      ['C', 3, 'accepted'],
      ['D', 4, 'accepted'],
      ['E', 5, 'accepted'],
      ['F', 6, 'waitlisted'],
      ['G', null, 'not-qualified'],
      ['H', 1, 'accepted']
    ]
  );
});

test('buildDashboardModel exposes scholarship program totals', () => {
  const model = buildDashboardModel({ exam, submissions, expectedStudents: 4 });

  assert.equal(model.scholarship.passingScore, 75);
  assert.equal(model.scholarship.availableSlots, 20);
  assert.equal(model.scholarship.availableSlotsPerGrade, 5);
  assert.equal(model.scholarship.acceptedStudents, 1);
  assert.equal(model.students[0].scholarshipStatus, 'accepted');
  assert.equal(model.students[1].scholarshipStatus, 'not-qualified');
});

test('buildDashboardModel always exposes Grade 7 to Grade 10 dashboard summaries', () => {
  const model = buildDashboardModel({
    exam,
    submissions: [
      { ...submissions[0], section: 'Grade 7', percentage: 90 },
      { ...submissions[1], section: 'Grade 10', percentage: 50 }
    ],
    expectedStudents: 8
  });

  assert.deepEqual(
    model.gradeLevels.map((grade) => grade.name),
    ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']
  );
  assert.equal(model.gradeLevels[0].totalStudents, 1);
  assert.equal(model.gradeLevels[0].averageScore, 90);
  assert.equal(model.gradeLevels[0].qualifiedStudents, 1);
  assert.equal(model.gradeLevels[0].availableSlots, 5);
  assert.equal(model.gradeLevels[0].remainingSlots, 4);
  assert.equal(model.gradeLevels[3].totalStudents, 1);
  assert.equal(model.gradeLevels[3].averageScore, 50);
});

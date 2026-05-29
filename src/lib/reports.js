const RESULTS_HEADERS = [
  'Student ID',
  'Student Name',
  'Email',
  'Grade Level',
  'Score',
  'Max Score',
  'Percentage',
  'Scholarship Status',
  'Rank',
  'Submitted At',
  'Time Taken Seconds'
];

function csvCell(value) {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

export function buildResultsCsv(dashboard) {
  const rows = [RESULTS_HEADERS];
  for (const student of dashboard.students ?? []) {
    rows.push([
      student.id,
      student.studentName,
      student.studentEmail,
      student.section,
      student.score,
      student.maxScore,
      student.percentage,
      student.scholarshipStatus,
      student.scholarshipRank ?? '',
      student.submittedAt,
      student.timeTakenSeconds
    ]);
  }

  return `${rows.map((row) => row.map(csvCell).join(',')).join('\n')}\n`;
}

export function csvFileName(gradeLevel = 'All Grades') {
  const safeGrade = String(gradeLevel || 'All Grades')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
  return `stfrancis-${safeGrade || 'all-grades'}-results.csv`;
}

export const PALETTE = {
  blue: '#2563EB',
  teal: '#14B8A6',
  coral: '#FB7185',
  green: '#22C55E',
  amber: '#F59E0B',
  ink: '#111827'
};

export const SCHOLARSHIP_CONFIG = {
  passingScore: 75,
  availableSlots: 5,
  gradeLevels: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']
};

export function performanceLevel(percentage) {
  const value = Number(percentage ?? 0);
  if (value >= 90) return { label: 'Excellent', tone: 'excellent', color: PALETTE.green };
  if (value >= 75) return { label: 'Proficient', tone: 'proficient', color: PALETTE.teal };
  if (value >= 60) return { label: 'Developing', tone: 'developing', color: PALETTE.amber };
  return { label: 'Needs Support', tone: 'support', color: PALETTE.coral };
}

function sumTime(details = []) {
  return details.reduce((sum, item) => sum + Number(item.timeTakenSeconds ?? 0), 0);
}

export function rankScholarshipApplicants(students, {
  passingScore = SCHOLARSHIP_CONFIG.passingScore,
  availableSlots = SCHOLARSHIP_CONFIG.availableSlots
} = {}) {
  const ranked = [...students].sort((a, b) => {
    const scoreDiff = Number(b.percentage ?? 0) - Number(a.percentage ?? 0);
    if (scoreDiff !== 0) return scoreDiff;
    return new Date(a.submittedAt ?? 0).getTime() - new Date(b.submittedAt ?? 0).getTime();
  });

  return ranked.map((student, index) => {
    const rank = Number(student.percentage ?? 0) >= passingScore ? index + 1 : null;
    let scholarshipStatus = 'not-qualified';
    if (rank && rank <= availableSlots) scholarshipStatus = 'accepted';
    else if (rank) scholarshipStatus = 'waitlisted';

    return {
      ...student,
      scholarshipRank: rank,
      scholarshipStatus
    };
  });
}

export function buildDashboardModel({ exam, submissions, expectedStudents }) {
  const completed = submissions.length;
  const studentTarget = Math.max(Number(expectedStudents ?? completed), completed, 1);
  const averageScore = completed
    ? Math.round(submissions.reduce((sum, submission) => sum + Number(submission.percentage ?? 0), 0) / completed)
    : 0;

  const baseStudents = submissions.map((submission) => ({
    id: submission.id,
    studentName: submission.studentName,
    studentEmail: submission.studentEmail ?? '',
    section: submission.section ?? '',
    status: 'completed',
    score: submission.score,
    maxScore: submission.maxScore,
    percentage: submission.percentage,
    level: performanceLevel(submission.percentage),
    submittedAt: submission.submittedAt,
    timeTakenSeconds: sumTime(submission.details),
    answers: submission.details
  }));
  const rankedStudents = rankScholarshipApplicants(baseStudents);
  const studentsById = new Map(rankedStudents.map((student) => [student.id, student]));
  const students = baseStudents.map((student) => studentsById.get(student.id));
  const acceptedStudents = rankedStudents.filter((student) => student.scholarshipStatus === 'accepted').length;
  const qualifiedStudents = rankedStudents.filter((student) => student.scholarshipRank).length;

  return {
    overview: {
      totalStudents: completed,
      averageScore,
      completionRate: Math.round((completed / studentTarget) * 100),
      activeTests: exam ? 1 : 0
    },
    scholarship: {
      passingScore: SCHOLARSHIP_CONFIG.passingScore,
      availableSlots: SCHOLARSHIP_CONFIG.availableSlots,
      acceptedStudents,
      qualifiedStudents,
      remainingSlots: Math.max(0, SCHOLARSHIP_CONFIG.availableSlots - acceptedStudents),
      gradeLevels: SCHOLARSHIP_CONFIG.gradeLevels
    },
    tests: exam ? [{
      id: 'mapeh-4th-quarter',
      title: exam.title,
      status: exam.status ?? 'active',
      totalPoints: exam.totalPoints,
      questionCount: exam.questions?.length ?? 0,
      completedStudents: completed,
      averageScore,
      updatedAt: exam.updatedAt ?? null
    }] : [],
    students,
    recentActivity: [...students]
      .sort((a, b) => new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime())
      .slice(0, 8)
      .map((student) => ({
        id: student.id,
        studentName: student.studentName,
        studentEmail: student.studentEmail,
        message: `${student.studentName} submitted ${exam?.title ?? 'the exam'}`,
        percentage: student.percentage,
        submittedAt: student.submittedAt
      }))
  };
}

export function filterAndSortStudents(students, { search = '', status = 'all', sort = 'name-asc' } = {}) {
  const needle = search.trim().toLowerCase();
  const filtered = students.filter((student) => {
    const matchesSearch = !needle ||
      student.studentName.toLowerCase().includes(needle) ||
      student.studentEmail.toLowerCase().includes(needle) ||
      student.section.toLowerCase().includes(needle);
    const matchesStatus = status === 'all' || student.status === status;
    return matchesSearch && matchesStatus;
  });

  return filtered.sort((a, b) => {
    if (sort === 'performance-desc') return b.percentage - a.percentage;
    if (sort === 'performance-asc') return a.percentage - b.percentage;
    if (sort === 'recent') return new Date(b.submittedAt).getTime() - new Date(a.submittedAt).getTime();
    return a.studentName.localeCompare(b.studentName);
  });
}

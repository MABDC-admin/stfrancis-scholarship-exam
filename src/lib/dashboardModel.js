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
  availableSlotsPerGrade: 5,
  gradeLevels: ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10']
};

SCHOLARSHIP_CONFIG.availableSlots = SCHOLARSHIP_CONFIG.availableSlotsPerGrade * SCHOLARSHIP_CONFIG.gradeLevels.length;

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

function buildGradeLevelSummaries(students) {
  return SCHOLARSHIP_CONFIG.gradeLevels.map((gradeLevel) => {
    const gradeStudents = students.filter((student) => student.section === gradeLevel);
    const totalStudents = gradeStudents.length;
    const averageScore = totalStudents
      ? Math.round(gradeStudents.reduce((sum, student) => sum + Number(student.percentage ?? 0), 0) / totalStudents)
      : 0;
    const acceptedStudents = gradeStudents.filter((student) => student.scholarshipStatus === 'accepted').length;
    const qualifiedStudents = gradeStudents.filter((student) => student.scholarshipRank).length;

    return {
      name: gradeLevel,
      availableSlots: SCHOLARSHIP_CONFIG.availableSlotsPerGrade,
      totalStudents,
      averageScore,
      qualifiedStudents,
      acceptedStudents,
      remainingSlots: Math.max(0, SCHOLARSHIP_CONFIG.availableSlotsPerGrade - acceptedStudents),
      completionRate: totalStudents ? 100 : 0,
      level: performanceLevel(averageScore)
    };
  });
}

export function rankScholarshipApplicants(students, {
  passingScore = SCHOLARSHIP_CONFIG.passingScore,
  availableSlotsPerGrade = SCHOLARSHIP_CONFIG.availableSlotsPerGrade
} = {}) {
  const gradeRankings = new Map();
  for (const gradeLevel of SCHOLARSHIP_CONFIG.gradeLevels) {
    const ranked = students
      .filter((student) => student.section === gradeLevel && Number(student.percentage ?? 0) >= passingScore)
      .sort((a, b) => {
        const scoreDiff = Number(b.percentage ?? 0) - Number(a.percentage ?? 0);
        if (scoreDiff !== 0) return scoreDiff;
        return new Date(a.submittedAt ?? 0).getTime() - new Date(b.submittedAt ?? 0).getTime();
      });
    ranked.forEach((student, index) => {
      gradeRankings.set(student.id, index + 1);
    });
  }

  return students.map((student) => {
    const rank = gradeRankings.get(student.id) ?? null;
    let scholarshipStatus = 'not-qualified';
    if (rank && rank <= availableSlotsPerGrade) scholarshipStatus = 'accepted';
    else if (rank) scholarshipStatus = 'waitlisted';

    return {
      ...student,
      scholarshipRank: rank,
      scholarshipStatus
    };
  });
}

export function buildDashboardModel({ exam, submissions, expectedStudents, gradeLevel = '' }) {
  const activeGradeLevel = SCHOLARSHIP_CONFIG.gradeLevels.includes(gradeLevel) ? gradeLevel : '';
  const workspaceSubmissions = activeGradeLevel
    ? submissions.filter((submission) => submission.section === activeGradeLevel)
    : submissions;
  const workspaceGradeLevels = activeGradeLevel ? [activeGradeLevel] : SCHOLARSHIP_CONFIG.gradeLevels;
  const workspaceSlots = SCHOLARSHIP_CONFIG.availableSlotsPerGrade * workspaceGradeLevels.length;
  const completed = workspaceSubmissions.length;
  const studentTarget = Math.max(Number(expectedStudents ?? completed), completed, 1);
  const averageScore = completed
    ? Math.round(workspaceSubmissions.reduce((sum, submission) => sum + Number(submission.percentage ?? 0), 0) / completed)
    : 0;

  const baseStudents = workspaceSubmissions.map((submission) => ({
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
  const acceptedStudents = rankedStudents.filter((student) => (
    workspaceGradeLevels.includes(student.section) && student.scholarshipStatus === 'accepted'
  )).length;
  const qualifiedStudents = rankedStudents.filter((student) => (
    workspaceGradeLevels.includes(student.section) && student.scholarshipRank
  )).length;

  return {
    workspace: {
      gradeLevel: activeGradeLevel || 'All Grades',
      isGradeScoped: Boolean(activeGradeLevel)
    },
    overview: {
      totalStudents: completed,
      averageScore,
      completionRate: Math.round((completed / studentTarget) * 100),
      activeTests: exam ? 1 : 0
    },
    scholarship: {
      passingScore: SCHOLARSHIP_CONFIG.passingScore,
      availableSlots: workspaceSlots,
      availableSlotsPerGrade: SCHOLARSHIP_CONFIG.availableSlotsPerGrade,
      acceptedStudents,
      qualifiedStudents,
      remainingSlots: Math.max(0, workspaceSlots - acceptedStudents),
      gradeLevels: workspaceGradeLevels
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
    gradeLevels: buildGradeLevelSummaries(students).filter((grade) => workspaceGradeLevels.includes(grade.name)),
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

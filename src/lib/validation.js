export const GRADE_LEVELS = ['Grade 7', 'Grade 8', 'Grade 9', 'Grade 10'];

export function validateStudentSubmission(payload, exam) {
  const studentName = String(payload?.studentName ?? '').trim();
  const section = String(payload?.section ?? '').trim();
  const answers = payload?.answers;

  if (!studentName) return { ok: false, error: 'Student name is required.' };
  if (!GRADE_LEVELS.includes(section)) return { ok: false, error: 'Select a valid grade level.' };
  if (!answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return { ok: false, error: 'Answers must be submitted as an object.' };
  }

  const questionIds = new Set((exam?.questions ?? []).map((question) => question.id));
  const unknownAnswerIds = Object.keys(answers).filter((id) => !questionIds.has(id));
  if (unknownAnswerIds.length > 0) {
    return { ok: false, error: 'Submission contains answers for unknown questions.' };
  }

  return { ok: true };
}

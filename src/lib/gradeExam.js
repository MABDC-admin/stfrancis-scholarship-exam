export function questionsForGrade(exam, gradeLevel) {
  const questions = exam?.questions ?? [];
  const selectedGrade = String(gradeLevel ?? '').trim();
  if (!selectedGrade) return questions;

  const gradeQuestions = questions.filter((question) => question.gradeLevel === selectedGrade);
  return gradeQuestions.length ? gradeQuestions : questions;
}

export function examForGrade(exam, gradeLevel) {
  if (!exam) return null;
  const questions = questionsForGrade(exam, gradeLevel);
  return {
    ...exam,
    gradeLevel: String(gradeLevel ?? '').trim() || null,
    totalPoints: questions.reduce((sum, question) => sum + Number(question.points ?? 1), 0),
    questions
  };
}

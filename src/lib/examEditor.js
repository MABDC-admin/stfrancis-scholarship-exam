function cleanText(value, fallback = '') {
  return String(value ?? fallback).trim();
}

function normalizeChoices(choices) {
  const entries = Object.entries(choices ?? {})
    .map(([key, value]) => [String(key).trim().toLowerCase(), cleanText(value)])
    .filter(([key, value]) => /^[a-z]$/.test(key) && value);
  return Object.fromEntries(entries);
}

export function normalizeEditableExam(input) {
  const title = cleanText(input?.title, 'Scholarship Entrance Exam');
  const questions = (input?.questions ?? []).map((question, index) => {
    const id = cleanText(question.id, `q${String(index + 1).padStart(2, '0')}`);
    const prompt = cleanText(question.prompt);
    const section = cleanText(question.section, 'General');
    const choices = normalizeChoices(question.choices);
    const correctAnswer = cleanText(question.correctAnswer).toLowerCase();
    const points = Math.max(1, Number(question.points ?? 1));

    if (!prompt) throw new Error(`Question ${index + 1} needs a prompt.`);
    if (Object.keys(choices).length < 2) throw new Error(`Question ${index + 1} needs at least two choices.`);
    if (!choices[correctAnswer]) throw new Error(`Question ${index + 1} needs a correct answer that matches a choice.`);

    return {
      id,
      gradeLevel: cleanText(question.gradeLevel),
      section,
      type: 'multiple-choice',
      prompt,
      choices,
      correctAnswer,
      acceptedAnswers: [],
      points
    };
  });

  if (questions.length === 0) throw new Error('Exam needs at least one question.');

  return {
    title,
    source: cleanText(input?.source, 'Teacher edited exam'),
    totalPoints: questions.reduce((sum, question) => sum + question.points, 0),
    questions
  };
}

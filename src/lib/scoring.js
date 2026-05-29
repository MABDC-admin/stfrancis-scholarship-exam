export function normalizeAnswer(value) {
  return String(value ?? '')
    .toLowerCase()
    .replace(/[’']/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

export function isAnswerCorrect(question, answer) {
  const normalizedAnswer = normalizeAnswer(answer);
  if (!normalizedAnswer) return false;

  if (question.type === 'multiple-choice' || question.type === 'true-false') {
    return normalizedAnswer === normalizeAnswer(question.correctAnswer);
  }

  const acceptedAnswers = [question.correctAnswer, ...(question.acceptedAnswers ?? [])]
    .filter(Boolean)
    .map(normalizeAnswer);

  return acceptedAnswers.some((acceptedAnswer) => normalizedAnswer === acceptedAnswer);
}

export function gradeSubmission(questions, answers, timings = {}) {
  const items = questions.map((question) => {
    const studentAnswer = answers?.[question.id] ?? '';
    const isCorrect = isAnswerCorrect(question, studentAnswer);
    const points = Number(question.points ?? 1);

    return {
      questionId: question.id,
      type: question.type,
      prompt: question.prompt,
      promptHtml: question.promptHtml ?? null,
      choices: question.choices ?? null,
      attachments: question.attachments ?? [],
      studentAnswer,
      correctAnswer: question.correctAnswer,
      acceptedAnswers: question.acceptedAnswers ?? [],
      isCorrect,
      earnedPoints: isCorrect ? points : 0,
      maxPoints: points,
      timeTakenSeconds: Number(timings?.[question.id] ?? 0)
    };
  });

  const score = items.reduce((sum, item) => sum + item.earnedPoints, 0);
  const maxScore = items.reduce((sum, item) => sum + item.maxPoints, 0);
  const percentage = maxScore === 0 ? 0 : Math.round((score / maxScore) * 100);

  return { score, maxScore, percentage, items };
}

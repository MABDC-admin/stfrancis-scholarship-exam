import { createHash } from 'node:crypto';
import { PRODUCTION_GRADE_LEVELS } from './productionSchema.js';

const productionGradeNames = PRODUCTION_GRADE_LEVELS.map((grade) => grade.name);

function json(value) {
  return JSON.stringify(value ?? null);
}

function normalizeGradeLevel(value) {
  return productionGradeNames.includes(value) ? value : '';
}

export async function syncQuestionBankFromExam(client, exam) {
  await client.query(
    `UPDATE stfrancis_question_bank
     SET is_active = false, updated_at = now()
     WHERE grade_level = ANY($1::text[])`,
    [productionGradeNames]
  );

  for (const question of exam?.questions ?? []) {
    const gradeLevel = normalizeGradeLevel(question.gradeLevel);
    if (!gradeLevel) continue;

    await client.query(
      `INSERT INTO stfrancis_question_bank
        (grade_level, question_id, type, prompt, choices, correct_answer, accepted_answers, points, attachments, source, is_active, updated_at)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7::jsonb, $8, $9::jsonb, $10, true, now())
       ON CONFLICT (grade_level, question_id) DO UPDATE SET
         type = excluded.type,
         prompt = excluded.prompt,
         choices = excluded.choices,
         correct_answer = excluded.correct_answer,
         accepted_answers = excluded.accepted_answers,
         points = excluded.points,
         attachments = excluded.attachments,
         source = excluded.source,
         is_active = true,
         updated_at = excluded.updated_at`,
      [
        gradeLevel,
        question.id,
        question.type ?? 'multiple-choice',
        question.promptHtml ?? question.prompt ?? '',
        json(question.choices ?? {}),
        String(question.correctAnswer ?? ''),
        json(question.acceptedAnswers ?? []),
        Number(question.points ?? 1),
        json(question.attachments ?? []),
        exam.source ?? exam.title ?? ''
      ]
    );
  }
}

export async function recordNormalizedSubmission(client, {
  submissionId,
  studentName,
  studentEmail = '',
  section = '',
  startedAt = null,
  submittedAt,
  grading
}) {
  const gradeLevel = normalizeGradeLevel(section) || 'Grade 7';
  const examineeResult = await client.query(
    `INSERT INTO stfrancis_examinees
      (student_name, student_email, grade_level, section, status, updated_at)
     VALUES ($1, $2, $3, $4, 'submitted', now())
     ON CONFLICT (lower(trim(student_email)), grade_level)
       WHERE trim(student_email) <> ''
       DO UPDATE SET
         student_name = excluded.student_name,
         section = excluded.section,
         status = excluded.status,
         updated_at = excluded.updated_at
     RETURNING id`,
    [studentName, studentEmail, gradeLevel, section]
  );
  const examineeId = Number(examineeResult.rows[0].id);
  const sessionHash = createHash('sha256')
    .update(`submission:${submissionId}:${studentName}:${submittedAt}`)
    .digest('hex');

  await client.query(
    `INSERT INTO stfrancis_exam_sessions
      (examinee_id, session_token_hash, grade_level, status, started_at, expires_at, submitted_at)
     VALUES ($1, $2, $3, $4, $5, $6, $7)`,
    [examineeId, sessionHash, gradeLevel, 'completed', startedAt ?? submittedAt, submittedAt, submittedAt]
  );

  for (const item of grading.items ?? []) {
    await client.query(
      `INSERT INTO stfrancis_submission_answers
        (submission_id, question_id, selected_answer, correct_answer, is_correct, points_awarded, max_points, time_taken_seconds)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       ON CONFLICT (submission_id, question_id) DO UPDATE SET
         selected_answer = excluded.selected_answer,
         correct_answer = excluded.correct_answer,
         is_correct = excluded.is_correct,
         points_awarded = excluded.points_awarded,
         max_points = excluded.max_points,
         time_taken_seconds = excluded.time_taken_seconds`,
      [
        submissionId,
        item.questionId,
        String(item.studentAnswer ?? ''),
        String(item.correctAnswer ?? ''),
        Boolean(item.isCorrect),
        Number(item.earnedPoints ?? 0),
        Number(item.maxPoints ?? 0),
        Number(item.timeTakenSeconds ?? 0)
      ]
    );
  }

  await client.query(
    `INSERT INTO stfrancis_admin_audit_logs (action, metadata)
     VALUES ($1, $2::jsonb)`,
    ['submission.recorded', json({ submissionId, examineeId, gradeLevel })]
  );
}

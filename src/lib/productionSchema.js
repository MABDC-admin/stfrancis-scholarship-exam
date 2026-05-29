export const PRODUCTION_GRADE_LEVELS = [
  { name: 'Grade 7', scholarshipSlots: 5, passingPercentage: 75 },
  { name: 'Grade 8', scholarshipSlots: 5, passingPercentage: 75 },
  { name: 'Grade 9', scholarshipSlots: 5, passingPercentage: 75 },
  { name: 'Grade 10', scholarshipSlots: 5, passingPercentage: 75 }
];

export async function ensureProductionSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stfrancis_grade_levels (
      id BIGSERIAL PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      scholarship_slots INTEGER NOT NULL DEFAULT 5,
      passing_percentage INTEGER NOT NULL DEFAULT 75,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS stfrancis_question_bank (
      id BIGSERIAL PRIMARY KEY,
      grade_level TEXT NOT NULL REFERENCES stfrancis_grade_levels(name) ON UPDATE CASCADE,
      question_id TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'multiple-choice',
      prompt TEXT NOT NULL,
      choices JSONB NOT NULL DEFAULT '{}'::jsonb,
      correct_answer TEXT NOT NULL,
      accepted_answers JSONB NOT NULL DEFAULT '[]'::jsonb,
      points INTEGER NOT NULL DEFAULT 1,
      attachments JSONB NOT NULL DEFAULT '[]'::jsonb,
      source TEXT DEFAULT '',
      is_active BOOLEAN NOT NULL DEFAULT true,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (grade_level, question_id)
    );

    CREATE TABLE IF NOT EXISTS stfrancis_examinees (
      id BIGSERIAL PRIMARY KEY,
      student_name TEXT NOT NULL,
      student_email TEXT NOT NULL DEFAULT '',
      grade_level TEXT NOT NULL REFERENCES stfrancis_grade_levels(name) ON UPDATE CASCADE,
      section TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'registered',
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE TABLE IF NOT EXISTS stfrancis_exam_sessions (
      id BIGSERIAL PRIMARY KEY,
      examinee_id BIGINT REFERENCES stfrancis_examinees(id) ON DELETE SET NULL,
      session_token_hash TEXT NOT NULL,
      grade_level TEXT NOT NULL REFERENCES stfrancis_grade_levels(name) ON UPDATE CASCADE,
      status TEXT NOT NULL DEFAULT 'in-progress',
      started_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      expires_at TIMESTAMPTZ NOT NULL,
      submitted_at TIMESTAMPTZ,
      focus_warnings INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS stfrancis_submission_answers (
      id BIGSERIAL PRIMARY KEY,
      submission_id BIGINT NOT NULL REFERENCES stfrancis_submissions(id) ON DELETE CASCADE,
      question_id TEXT NOT NULL,
      selected_answer TEXT NOT NULL DEFAULT '',
      correct_answer TEXT NOT NULL DEFAULT '',
      is_correct BOOLEAN NOT NULL DEFAULT false,
      points_awarded INTEGER NOT NULL DEFAULT 0,
      max_points INTEGER NOT NULL DEFAULT 1,
      time_taken_seconds INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (submission_id, question_id)
    );

    CREATE TABLE IF NOT EXISTS stfrancis_admin_audit_logs (
      id BIGSERIAL PRIMARY KEY,
      actor TEXT NOT NULL DEFAULT 'teacher',
      action TEXT NOT NULL,
      metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );

    CREATE INDEX IF NOT EXISTS idx_stfrancis_question_bank_grade
      ON stfrancis_question_bank (grade_level, is_active);
    CREATE INDEX IF NOT EXISTS idx_stfrancis_examinees_grade
      ON stfrancis_examinees (grade_level, status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_stfrancis_examinees_email_grade
      ON stfrancis_examinees (lower(trim(student_email)), grade_level)
      WHERE trim(student_email) <> '';
    CREATE INDEX IF NOT EXISTS idx_stfrancis_exam_sessions_grade_status
      ON stfrancis_exam_sessions (grade_level, status);
    CREATE INDEX IF NOT EXISTS idx_stfrancis_submission_answers_submission
      ON stfrancis_submission_answers (submission_id);
    CREATE INDEX IF NOT EXISTS idx_stfrancis_admin_audit_logs_created
      ON stfrancis_admin_audit_logs (created_at DESC);
  `);

  for (const grade of PRODUCTION_GRADE_LEVELS) {
    await pool.query(
      `INSERT INTO stfrancis_grade_levels (name, scholarship_slots, passing_percentage, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (name) DO UPDATE SET
         scholarship_slots = excluded.scholarship_slots,
         passing_percentage = excluded.passing_percentage,
         updated_at = excluded.updated_at`,
      [grade.name, grade.scholarshipSlots, grade.passingPercentage]
    );
  }
}

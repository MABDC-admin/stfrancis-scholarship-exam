import initSqlJs from 'sql.js';
import pg from 'pg';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gradeSubmission } from './lib/scoring.js';
import { questionsForGrade } from './lib/gradeExam.js';
import { ensureProductionSchema } from './lib/productionSchema.js';

const { Pool } = pg;

function readRows(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.bind(params);
  const rows = [];
  while (stmt.step()) rows.push(stmt.getAsObject());
  stmt.free();
  return rows;
}

function run(db, sql, params = []) {
  const stmt = db.prepare(sql);
  stmt.run(params);
  stmt.free();
}

function ensureSchema(db) {
  db.run(`
    CREATE TABLE IF NOT EXISTS exams (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      title TEXT NOT NULL,
      total_points INTEGER NOT NULL,
      payload TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS submissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      student_name TEXT NOT NULL,
      student_email TEXT DEFAULT '',
      section TEXT NOT NULL,
      answers TEXT NOT NULL,
      details TEXT NOT NULL,
      score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      percentage INTEGER NOT NULL,
      started_at TEXT,
      submitted_at TEXT NOT NULL
    );
  `);

  const submissionColumns = readRows(db, 'PRAGMA table_info(submissions)').map((row) => row.name);
  if (!submissionColumns.includes('student_email')) {
    db.run("ALTER TABLE submissions ADD COLUMN student_email TEXT DEFAULT ''");
  }
}

function saveToDisk(db, dbPath) {
  mkdirSync(dirname(dbPath), { recursive: true });
  writeFileSync(dbPath, Buffer.from(db.export()));
}

function backupDatabase(dbPath) {
  if (!existsSync(dbPath)) return '';
  const backupDir = join(dirname(dbPath), 'backups');
  mkdirSync(backupDir, { recursive: true });
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const backupPath = join(backupDir, `exam-${timestamp}.sqlite`);
  writeFileSync(backupPath, readFileSync(dbPath));
  return backupPath;
}

function normalizeApplicant(value) {
  return String(value ?? '').trim().toLowerCase();
}

export async function createExamStore({ dbPath = resolve('data/exam.sqlite') } = {}) {
  if (process.env.DATABASE_URL) return createPostgresExamStore({ connectionString: process.env.DATABASE_URL });
  return createSqliteExamStore({ dbPath });
}

async function createSqliteExamStore({ dbPath = resolve('data/exam.sqlite') } = {}) {
  const SQL = await initSqlJs();
  const database = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database();
  ensureSchema(database);
  saveToDisk(database, dbPath);

  function persist() {
    saveToDisk(database, dbPath);
  }

  return {
    storageBackend: 'sqlite',

    async healthCheck() {
      readRows(database, 'SELECT 1 AS ok');
      return { ok: true, storage: 'sqlite' };
    },

    saveExam(exam, { backup = false } = {}) {
      if (backup) backupDatabase(dbPath);
      const payload = JSON.stringify(exam);
      run(
        database,
        `INSERT INTO exams (id, title, total_points, payload, updated_at)
         VALUES (1, ?, ?, ?, ?)
         ON CONFLICT(id) DO UPDATE SET
           title = excluded.title,
           total_points = excluded.total_points,
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
        [exam.title, exam.totalPoints, payload, new Date().toISOString()]
      );
      persist();
      return exam;
    },

    getExam() {
      const row = readRows(database, 'SELECT payload FROM exams WHERE id = 1')[0];
      return row ? JSON.parse(row.payload) : null;
    },

    saveSubmission({ studentName, studentEmail = '', section = '', answers, timings = {}, startedAt = null }) {
      const exam = this.getExam();
      if (!exam) throw new Error('No exam has been imported yet.');

      const grading = gradeSubmission(questionsForGrade(exam, section), answers, timings);
      const submittedAt = new Date().toISOString();
      run(
        database,
        `INSERT INTO submissions
          (student_name, student_email, section, answers, details, score, max_score, percentage, started_at, submitted_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          studentName,
          studentEmail,
          section,
          JSON.stringify(answers),
          JSON.stringify(grading.items),
          grading.score,
          grading.maxScore,
          grading.percentage,
          startedAt,
          submittedAt
        ]
      );
      const insertedId = Number(
        readRows(database, "SELECT seq AS id FROM sqlite_sequence WHERE name = 'submissions'")[0]?.id ?? 0
      );
      persist();

      return {
        id: insertedId,
        studentName,
        studentEmail,
        section,
        submittedAt,
        ...grading
      };
    },

    listSubmissions() {
      return readRows(
        database,
        `SELECT id, student_name, student_email, section, answers, details, score, max_score, percentage, started_at, submitted_at
         FROM submissions
         ORDER BY submitted_at DESC`
      ).map((row) => ({
        id: Number(row.id),
        studentName: row.student_name,
        studentEmail: row.student_email ?? '',
        section: row.section,
        answers: JSON.parse(row.answers),
        details: JSON.parse(row.details),
        score: Number(row.score),
        maxScore: Number(row.max_score),
        percentage: Number(row.percentage),
        startedAt: row.started_at,
        submittedAt: row.submitted_at
      }));
    },

    hasSubmissionForApplicant({ studentName, studentEmail = '', section = '' }) {
      const normalizedEmail = normalizeApplicant(studentEmail);
      const normalizedName = normalizeApplicant(studentName);
      const normalizedSection = normalizeApplicant(section);
      return this.listSubmissions().some((submission) => {
        if (normalizedEmail && normalizeApplicant(submission.studentEmail) === normalizedEmail) return true;
        return normalizeApplicant(submission.studentName) === normalizedName &&
          normalizeApplicant(submission.section) === normalizedSection;
      });
    },

    clearSubmissions() {
      database.run('DELETE FROM submissions');
      persist();
    }
  };
}

async function ensurePostgresSchema(pool) {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS stfrancis_exams (
      id INTEGER PRIMARY KEY CHECK (id = 1),
      title TEXT NOT NULL,
      total_points INTEGER NOT NULL,
      payload JSONB NOT NULL,
      updated_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stfrancis_submissions (
      id BIGSERIAL PRIMARY KEY,
      student_name TEXT NOT NULL,
      student_email TEXT DEFAULT '',
      section TEXT NOT NULL,
      answers JSONB NOT NULL,
      details JSONB NOT NULL,
      score INTEGER NOT NULL,
      max_score INTEGER NOT NULL,
      percentage INTEGER NOT NULL,
      started_at TIMESTAMPTZ,
      submitted_at TIMESTAMPTZ NOT NULL
    );

    CREATE TABLE IF NOT EXISTS stfrancis_exam_backups (
      id BIGSERIAL PRIMARY KEY,
      exam_payload JSONB,
      submissions_payload JSONB NOT NULL DEFAULT '[]'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `);
  await ensureProductionSchema(pool);
}

function parseJsonColumn(value) {
  return typeof value === 'string' ? JSON.parse(value) : value;
}

function mapPostgresSubmission(row) {
  return {
    id: Number(row.id),
    studentName: row.student_name,
    studentEmail: row.student_email ?? '',
    section: row.section,
    answers: parseJsonColumn(row.answers),
    details: parseJsonColumn(row.details),
    score: Number(row.score),
    maxScore: Number(row.max_score),
    percentage: Number(row.percentage),
    startedAt: row.started_at ? new Date(row.started_at).toISOString() : null,
    submittedAt: new Date(row.submitted_at).toISOString()
  };
}

async function createPostgresExamStore({ connectionString }) {
  const pool = new Pool({ connectionString });
  await ensurePostgresSchema(pool);

  return {
    storageBackend: 'postgresql',

    async healthCheck() {
      await pool.query('SELECT 1 AS ok');
      return { ok: true, storage: 'postgresql' };
    },

    async saveExam(exam, { backup = false } = {}) {
      if (backup) {
        const current = await this.getExam();
        const submissions = await this.listSubmissions();
        await pool.query(
          `INSERT INTO stfrancis_exam_backups (exam_payload, submissions_payload)
           VALUES ($1::jsonb, $2::jsonb)`,
          [current ? JSON.stringify(current) : null, JSON.stringify(submissions)]
        );
      }

      await pool.query(
        `INSERT INTO stfrancis_exams (id, title, total_points, payload, updated_at)
         VALUES (1, $1, $2, $3::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET
           title = excluded.title,
           total_points = excluded.total_points,
           payload = excluded.payload,
           updated_at = excluded.updated_at`,
        [exam.title, exam.totalPoints, JSON.stringify(exam)]
      );
      return exam;
    },

    async getExam() {
      const result = await pool.query('SELECT payload FROM stfrancis_exams WHERE id = 1');
      return result.rows[0] ? parseJsonColumn(result.rows[0].payload) : null;
    },

    async saveSubmission({ studentName, studentEmail = '', section = '', answers, timings = {}, startedAt = null }) {
      const exam = await this.getExam();
      if (!exam) throw new Error('No exam has been imported yet.');

      const grading = gradeSubmission(questionsForGrade(exam, section), answers, timings);
      const submittedAt = new Date().toISOString();
      const result = await pool.query(
        `INSERT INTO stfrancis_submissions
          (student_name, student_email, section, answers, details, score, max_score, percentage, started_at, submitted_at)
         VALUES ($1, $2, $3, $4::jsonb, $5::jsonb, $6, $7, $8, $9, $10)
         RETURNING id`,
        [
          studentName,
          studentEmail,
          section,
          JSON.stringify(answers),
          JSON.stringify(grading.items),
          grading.score,
          grading.maxScore,
          grading.percentage,
          startedAt,
          submittedAt
        ]
      );

      return {
        id: Number(result.rows[0].id),
        studentName,
        studentEmail,
        section,
        submittedAt,
        ...grading
      };
    },

    async listSubmissions() {
      const result = await pool.query(
        `SELECT id, student_name, student_email, section, answers, details, score, max_score, percentage, started_at, submitted_at
         FROM stfrancis_submissions
         ORDER BY submitted_at DESC`
      );
      return result.rows.map(mapPostgresSubmission);
    },

    async hasSubmissionForApplicant({ studentName, studentEmail = '', section = '' }) {
      const normalizedEmail = normalizeApplicant(studentEmail);
      const normalizedName = normalizeApplicant(studentName);
      const normalizedSection = normalizeApplicant(section);
      const result = await pool.query(
        `SELECT 1
         FROM stfrancis_submissions
         WHERE ($1 <> '' AND lower(trim(student_email)) = $1)
            OR (lower(trim(student_name)) = $2 AND lower(trim(section)) = $3)
         LIMIT 1`,
        [normalizedEmail, normalizedName, normalizedSection]
      );
      return result.rowCount > 0;
    },

    async clearSubmissions() {
      await pool.query('DELETE FROM stfrancis_submissions');
    },

    async close() {
      await pool.end();
    }
  };
}

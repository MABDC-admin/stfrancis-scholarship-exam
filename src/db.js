import initSqlJs from 'sql.js';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { gradeSubmission } from './lib/scoring.js';

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
  const SQL = await initSqlJs();
  const database = existsSync(dbPath) ? new SQL.Database(readFileSync(dbPath)) : new SQL.Database();
  ensureSchema(database);
  saveToDisk(database, dbPath);

  function persist() {
    saveToDisk(database, dbPath);
  }

  return {
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

      const grading = gradeSubmission(exam.questions, answers, timings);
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

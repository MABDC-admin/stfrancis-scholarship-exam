import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureProductionSchema, PRODUCTION_GRADE_LEVELS } from '../src/lib/productionSchema.js';

test('production grade levels define scholarship rules for Grade 7 to Grade 10', () => {
  assert.deepEqual(PRODUCTION_GRADE_LEVELS, [
    { name: 'Grade 7', scholarshipSlots: 5, passingPercentage: 75 },
    { name: 'Grade 8', scholarshipSlots: 5, passingPercentage: 75 },
    { name: 'Grade 9', scholarshipSlots: 5, passingPercentage: 75 },
    { name: 'Grade 10', scholarshipSlots: 5, passingPercentage: 75 }
  ]);
});

test('ensureProductionSchema creates normalized production tables and seeds grade levels', async () => {
  const queries = [];
  const pool = {
    async query(sql, params = []) {
      queries.push({ sql, params });
      return { rows: [], rowCount: 0 };
    }
  };

  await ensureProductionSchema(pool);

  const ddl = queries[0].sql;
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS stfrancis_grade_levels/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS stfrancis_question_bank/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS stfrancis_examinees/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS stfrancis_exam_sessions/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS stfrancis_submission_answers/);
  assert.match(ddl, /CREATE TABLE IF NOT EXISTS stfrancis_admin_audit_logs/);
  assert.doesNotMatch(ddl, /UNIQUE \(student_email, grade_level\)/);
  assert.match(ddl, /CREATE UNIQUE INDEX IF NOT EXISTS idx_stfrancis_examinees_email_grade/);

  const seedCalls = queries.slice(1);
  assert.equal(seedCalls.length, 4);
  assert.deepEqual(seedCalls.map((call) => call.params), [
    ['Grade 7', 5, 75],
    ['Grade 8', 5, 75],
    ['Grade 9', 5, 75],
    ['Grade 10', 5, 75]
  ]);
  assert.ok(seedCalls.every((call) => /ON CONFLICT \(name\) DO UPDATE/.test(call.sql)));
});

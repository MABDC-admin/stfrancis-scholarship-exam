# St. Francis Scholarship Entrance Exam Platform

Interactive scholarship entrance exam app for Grade 7 to Grade 10 applicants.

## What Is Included

- Student exam interface with timer, Grade 7-10 applicant intake, progress tracking, one-question flow, answer feedback, and responsive layout.
- Teacher dashboard with student submissions, scores, percentage bars, item-by-item answer comparison, and question review/edit tools.
- Enhanced teacher analytics with test status cards, completion rate, recent activity, searchable/sortable student results, per-question timing, and color-coded performance levels.
- Scholarship ranking rules: applicants need at least 75%, and the top 5 passing students are marked accepted.
- Dynamic question support for multiple choice, short answer, and true/false, plus rich prompt HTML and image/audio/video attachment metadata.
- DOCX importer for the original exam paper.
- PostgreSQL storage in production when `DATABASE_URL` is set, with local SQLite fallback through `sql.js` at `data/exam.sqlite`.
- Teacher dashboard is temporarily open for fast school-side use. Add the production access code before public rollout.
- DOCX imports create a timestamped database backup before replacing the exam and clearing submissions.
- Student submissions validate applicant grade level and question IDs, and duplicate applicant attempts are rejected.
- Seed exam data at `data/questions.json`, extracted from the DOCX file.

## Run Locally

```bash
npm install
npm start
```

Open:

```text
http://localhost:3000
```

If port `3000` is busy:

```powershell
$env:PORT='3001'; npm start
```

## Re-import The DOCX

```bash
npm run import:docx -- "C:\Users\GIGABYTE\Downloads\MAPEH 4TH QUARTER.docx" data/questions.json
```

The app also supports DOCX upload from the teacher dashboard.

## Review And Edit Questions

Open the teacher dashboard, click `Load Dashboard`, then use `Question Review` to edit imported prompts, choices, correct answers, sections, and points. Saving question changes creates a database backup and clears existing submissions so scores remain consistent.

## Test

```bash
npm test
```

## Security Notes

- Student `/api/exam` responses do not include correct answers.
- Teacher endpoints are temporarily open for fast school-side use. Restore access-code protection before production.
- Production can use PostgreSQL by setting `DATABASE_URL`; the current server uses the local Supabase Postgres container while remaining available at the IP plus port URL.
- Exam sessions are timed, single-use tokens.
- Helmet security headers are enabled.
- The student UI blocks context menu and copy during the exam and records focus warnings.
- Student-facing exam API removes answer keys before sending questions to the browser.
- Direct high-port HTTP deployment disables forced HTTPS upgrades so CSS and JS assets load correctly until a reverse proxy with TLS is added.

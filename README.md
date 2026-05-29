# St. Francis Scholarship Entrance Exam Platform

Interactive scholarship entrance exam app for Grade 7 to Grade 10 applicants.

## What Is Included

- Student exam interface with timer, Grade 7-10 applicant intake, progress tracking, one-question flow, answer feedback, and responsive layout.
- Teacher dashboard with student submissions, scores, percentage bars, and item-by-item answer comparison.
- Enhanced teacher analytics with test status cards, completion rate, recent activity, searchable/sortable student results, per-question timing, and color-coded performance levels.
- Scholarship ranking rules: applicants need at least 75%, and the top 5 passing students are marked accepted.
- Dynamic question support for multiple choice, short answer, and true/false, plus rich prompt HTML and image/audio/video attachment metadata.
- DOCX importer for the original exam paper.
- SQLite storage through `sql.js`, persisted at `data/exam.sqlite`.
- Teacher dashboard login uses an HTTP-only session cookie after PIN verification.
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

Teacher dashboard PIN:

```text
stfrancis2026
```

Override it with:

```powershell
$env:TEACHER_PIN='your-new-pin'; npm start
```

## Re-import The DOCX

```bash
npm run import:docx -- "C:\Users\GIGABYTE\Downloads\MAPEH 4TH QUARTER.docx" data/questions.json
```

The app also supports DOCX upload from the teacher dashboard.

## Test

```bash
npm test
```

## Security Notes

- Student `/api/exam` responses do not include correct answers.
- Teacher endpoints require a teacher session cookie created by `/api/teacher/login`.
- Exam sessions are timed, single-use tokens.
- Helmet security headers are enabled.
- The student UI blocks context menu and copy during the exam and records focus warnings.
- Student-facing exam API removes answer keys before sending questions to the browser.
- Direct high-port HTTP deployment disables forced HTTPS upgrades so CSS and JS assets load correctly until a reverse proxy with TLS is added.

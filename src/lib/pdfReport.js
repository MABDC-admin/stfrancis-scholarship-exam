import PDFDocument from 'pdfkit';
import { existsSync } from 'node:fs';

const COLORS = {
  blue: '#2563EB',
  teal: '#0F9F95',
  coral: '#FB7185',
  green: '#16A34A',
  amber: '#F59E0B',
  ink: '#111827',
  muted: '#64748B',
  line: '#D8E5EA',
  pale: '#F5FAFC'
};

function safeFilePart(value) {
  return String(value || 'All Grades')
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '') || 'all-grades';
}

function formatDate(value) {
  if (!value) return 'Not submitted';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit'
  });
}

function statusLabel(status) {
  if (status === 'accepted') return 'Accepted';
  if (status === 'waitlisted') return 'Qualified';
  return 'Not Qualified';
}

function statusColor(status) {
  if (status === 'accepted') return COLORS.green;
  if (status === 'waitlisted') return COLORS.amber;
  return COLORS.coral;
}

function drawRoundedRect(doc, x, y, width, height, color) {
  doc.roundedRect(x, y, width, height, 8).fill(color);
}

function drawHeader(doc, dashboard, logoPath) {
  const { workspace } = dashboard;
  const left = doc.page.margins.left;
  const top = 32;
  const right = doc.page.width - doc.page.margins.right;
  const width = right - left;

  doc.save();
  drawRoundedRect(doc, left, top, width, 94, COLORS.ink);
  doc.rect(left, top + 86, width * 0.38, 8).fill(COLORS.blue);
  doc.rect(left + width * 0.38, top + 86, width * 0.32, 8).fill(COLORS.teal);
  doc.rect(left + width * 0.70, top + 86, width * 0.30, 8).fill(COLORS.coral);

  if (logoPath && existsSync(logoPath)) {
    try {
      doc.image(logoPath, left + 16, top + 14, { width: 58, height: 58 });
    } catch {
      doc.circle(left + 45, top + 44, 28).fill('#FFFFFF');
    }
  } else {
    doc.circle(left + 45, top + 44, 28).fill('#FFFFFF');
  }

  doc
    .fillColor('#FFFFFF')
    .font('Helvetica-Bold')
    .fontSize(12)
    .text('SAINT FRANCIS XAVIER SMART ACADEMY INC.', left + 88, top + 20, { width: width - 110 })
    .fontSize(24)
    .text('Scholarship Entrance Exam Results', left + 88, top + 38, { width: width - 110 });

  doc
    .font('Helvetica')
    .fontSize(9)
    .fillColor('#DFF7F5')
    .text(`${workspace.gradeLevel} Workspace | Generated ${formatDate(new Date().toISOString())}`, left + 88, top + 68);
  doc.restore();
  doc.y = top + 122;
}

function drawSummaryCard(doc, x, y, width, label, value, accent) {
  doc.save();
  doc.roundedRect(x, y, width, 58, 8).fill('#FFFFFF').stroke(COLORS.line);
  doc.rect(x, y, 5, 58).fill(accent);
  doc
    .fillColor(COLORS.muted)
    .font('Helvetica-Bold')
    .fontSize(8)
    .text(label.toUpperCase(), x + 16, y + 14, { width: width - 28 })
    .fillColor(COLORS.ink)
    .fontSize(18)
    .text(String(value), x + 16, y + 29, { width: width - 28 });
  doc.restore();
}

function drawSummary(doc, dashboard) {
  const { overview, scholarship } = dashboard;
  const left = doc.page.margins.left;
  const gap = 10;
  const cardWidth = (doc.page.width - doc.page.margins.left - doc.page.margins.right - gap * 3) / 4;
  const y = doc.y;

  drawSummaryCard(doc, left, y, cardWidth, 'Applicants', overview.totalStudents, COLORS.blue);
  drawSummaryCard(doc, left + (cardWidth + gap), y, cardWidth, 'Average', `${overview.averageScore}%`, COLORS.teal);
  drawSummaryCard(doc, left + (cardWidth + gap) * 2, y, cardWidth, 'Accepted', `${scholarship.acceptedStudents}/${scholarship.availableSlots}`, COLORS.green);
  drawSummaryCard(doc, left + (cardWidth + gap) * 3, y, cardWidth, 'Passing Score', `${scholarship.passingScore}%`, COLORS.coral);
  doc.y = y + 82;
}

function drawTableHeader(doc, columns, x, y) {
  doc.save();
  doc.roundedRect(x, y, columns.reduce((sum, column) => sum + column.width, 0), 28, 6).fill(COLORS.ink);
  let cursor = x;
  for (const column of columns) {
    doc
      .fillColor('#FFFFFF')
      .font('Helvetica-Bold')
      .fontSize(8)
      .text(column.label, cursor + 6, y + 10, { width: column.width - 10 });
    cursor += column.width;
  }
  doc.restore();
}

function drawStudentRow(doc, columns, student, index, x, y) {
  const rowHeight = 38;
  const bg = index % 2 === 0 ? '#FFFFFF' : COLORS.pale;
  doc.save();
  doc.roundedRect(x, y, columns.reduce((sum, column) => sum + column.width, 0), rowHeight, 4).fill(bg).stroke(COLORS.line);

  const row = {
    rank: student.scholarshipRank ? `#${student.scholarshipRank}` : '-',
    name: student.studentName,
    email: student.studentEmail || '-',
    score: `${student.score}/${student.maxScore}`,
    percentage: `${student.percentage}%`,
    status: statusLabel(student.scholarshipStatus),
    submitted: formatDate(student.submittedAt)
  };

  let cursor = x;
  for (const column of columns) {
    const isStatus = column.key === 'status';
    doc
      .fillColor(isStatus ? statusColor(student.scholarshipStatus) : COLORS.ink)
      .font(isStatus || column.key === 'name' ? 'Helvetica-Bold' : 'Helvetica')
      .fontSize(column.key === 'submitted' ? 7 : 8)
      .text(String(row[column.key] ?? ''), cursor + 6, y + 10, {
        width: column.width - 10,
        height: rowHeight - 12,
        ellipsis: true
      });
    cursor += column.width;
  }
  doc.restore();
  return rowHeight;
}

function ensureSpace(doc, neededHeight, headerCallback) {
  const bottom = doc.page.height - doc.page.margins.bottom;
  if (doc.y + neededHeight <= bottom) return;
  doc.addPage();
  headerCallback();
}

function drawResultsTable(doc, dashboard) {
  const left = doc.page.margins.left;
  const columns = [
    { key: 'rank', label: 'Rank', width: 42 },
    { key: 'name', label: 'Student', width: 116 },
    { key: 'email', label: 'Email', width: 130 },
    { key: 'score', label: 'Score', width: 52 },
    { key: 'percentage', label: '%', width: 42 },
    { key: 'status', label: 'Status', width: 74 },
    { key: 'submitted', label: 'Submitted', width: 82 }
  ];

  doc
    .fillColor(COLORS.ink)
    .font('Helvetica-Bold')
    .fontSize(14)
    .text('Applicant Results', left, doc.y);
  doc.y += 12;

  const redrawHeader = () => {
    doc.y = doc.page.margins.top;
    drawTableHeader(doc, columns, left, doc.y);
    doc.y += 34;
  };

  drawTableHeader(doc, columns, left, doc.y);
  doc.y += 34;

  const students = dashboard.students ?? [];
  if (!students.length) {
    doc
      .roundedRect(left, doc.y, columns.reduce((sum, column) => sum + column.width, 0), 54, 6)
      .fill('#FFFFFF')
      .stroke(COLORS.line);
    doc
      .fillColor(COLORS.muted)
      .font('Helvetica')
      .fontSize(10)
      .text('No submitted applicants yet for this workspace.', left + 14, doc.y + 20);
    doc.y += 74;
    return;
  }

  students.forEach((student, index) => {
    ensureSpace(doc, 46, redrawHeader);
    const height = drawStudentRow(doc, columns, student, index, left, doc.y);
    doc.y += height + 5;
  });
}

function drawFooter(doc) {
  const y = doc.page.height - 42;
  doc
    .save()
    .strokeColor(COLORS.line)
    .moveTo(doc.page.margins.left, y)
    .lineTo(doc.page.width - doc.page.margins.right, y)
    .stroke()
    .fillColor(COLORS.muted)
    .font('Helvetica')
    .fontSize(8)
    .text('Prepared for scholarship committee review. Student score visibility remains hidden from applicants.', doc.page.margins.left, y + 10)
    .restore();
}

export function pdfFileName(gradeLevel = 'All Grades') {
  return `stfrancis-${safeFilePart(gradeLevel)}-results.pdf`;
}

export async function buildResultsPdf(dashboard, { logoPath } = {}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({
      size: 'A4',
      margin: 36,
      info: {
        Title: 'St. Francis Scholarship Entrance Exam Results',
        Author: 'Saint Francis Xavier Smart Academy Inc.'
      }
    });
    const chunks = [];

    doc.on('data', (chunk) => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    drawHeader(doc, dashboard, logoPath);
    drawSummary(doc, dashboard);
    drawResultsTable(doc, dashboard);
    drawFooter(doc);
    doc.end();
  });
}

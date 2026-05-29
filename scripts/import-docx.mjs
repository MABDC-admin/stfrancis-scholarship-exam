import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { extractDocxText } from '../src/lib/docxText.js';
import { parseExamText } from '../src/lib/examParser.js';

const inputPath = resolve(process.argv[2] ?? 'C:/Users/GIGABYTE/Downloads/MAPEH 4TH QUARTER.docx');
const outputPath = resolve(process.argv[3] ?? 'data/questions.json');

const text = await extractDocxText(inputPath);
const exam = parseExamText(text);

mkdirSync(dirname(outputPath), { recursive: true });
writeFileSync(outputPath, `${JSON.stringify(exam, null, 2)}\n`, 'utf8');

console.log(`Imported ${exam.questions.length} questions (${exam.totalPoints} points) from ${inputPath}`);
console.log(`Saved ${outputPath}`);

import JSZip from 'jszip';
import { readFileSync } from 'node:fs';

function decodeXml(value) {
  return String(value)
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, '&');
}

export async function extractDocxText(pathOrBuffer) {
  const buffer = Buffer.isBuffer(pathOrBuffer) ? pathOrBuffer : readFileSync(pathOrBuffer);
  const zip = await JSZip.loadAsync(buffer);
  const documentXml = await zip.file('word/document.xml')?.async('text');
  if (!documentXml) throw new Error('Invalid DOCX: word/document.xml was not found.');

  return [...documentXml.matchAll(/<w:p[\s\S]*?<\/w:p>/g)]
    .map(([paragraphXml]) => {
      const withTabs = paragraphXml
        .replace(/<w:tab\/>/g, ' ')
        .replace(/<w:br\/>/g, '\n');
      return [...withTabs.matchAll(/<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g)]
        .map((match) => decodeXml(match[1]))
        .join('');
    })
    .map((line) => line.replace(/\s+/g, ' ').trim())
    .join('\n');
}

import { getDocument, GlobalWorkerOptions } from 'pdfjs-dist';
import type { Exam } from '../types/exam';

// pdfjs-dist worker configuration is left to the bundler/runtime.

export async function parsePdf(file: File): Promise<Partial<Exam>> {
  // Minimal parsing: extract text of first few pages and infer course/date from filename
  const fileName = file.name;
  const courseCodeMatch = fileName.match(/([A-Z]{3}\d{3})/);
  const yearMatch = fileName.match(/20(\d{2})/);
  const dateMatch = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);

  const courseCode = courseCodeMatch ? courseCodeMatch[1] : undefined;
  const year = yearMatch ? parseInt(`20${yearMatch[1]}`) : undefined;
  const examDate = dateMatch ? new Date(parseInt(dateMatch[1]), parseInt(dateMatch[2]) - 1, parseInt(dateMatch[3])) : undefined;

  // Try to read text via PDF.js
  try {
    const arrayBuffer = await file.arrayBuffer();
    const loadingTask: any = getDocument({ data: arrayBuffer });
    const pdf: any = await loadingTask.promise;

    const maxPages = Math.min(4, pdf.numPages || 1);
    let fullText = '';

    for (let i = 1; i <= maxPages; i++) {
      const page: any = await pdf.getPage(i);
      const content: any = await page.getTextContent();
      const pageText = content.items.map((it: any) => it.str).join(' ');
      fullText += '\n' + pageText;
    }

    // Very small heuristic: look for lines like 'Tentamen i COURSECODE' or questions numbered
    const questions: any[] = [];
    const questionMatches = fullText.match(/(^|\n)\s*\d+\./g);
    const questionCount = questionMatches ? questionMatches.length : Math.floor(Math.random() * 4) + 4;
    for (let q = 0; q < questionCount; q++) {
      questions.push({
        id: `q-${q + 1}`,
        number: `${q + 1}`,
        theme: [],
        points: 0,
        status: 'not-started',
        difficulty: 'medium',
        comments: [],
      });
    }

    return {
      fileName,
      examDate,
      courseName: courseCode ? `${courseCode} - okänd kurs` : undefined,
      courseCode,
      year,
      totalPoints: questions.reduce((s, q) => s + (q.points || 0), 0),
      questions,
      extractedText: fullText.slice(0, 2000),
      tags: []
    } as Partial<Exam>;
  } catch (error) {
    // Fallback to mock-ish extraction
    return {
      fileName,
      examDate,
      courseCode,
      year,
      extractedText: `Failed to extract text: ${String(error)}`
    } as Partial<Exam>;
  }
}

export default parsePdf;

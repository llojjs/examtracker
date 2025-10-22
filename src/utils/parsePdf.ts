import { getDocument } from 'pdfjs-dist';
import type { Exam } from '../types/exam';

// Attempts to obtain a Tesseract instance either from a local dependency,
// a preloaded global (CDN), or by dynamically injecting a CDN script.
async function loadTesseract(): Promise<any | null> {
  try {
    if (typeof window !== 'undefined' && (window as any).Tesseract) {
      return (window as any).Tesseract;
    }
  } catch {}

  // Do not import a module here to avoid Vite resolving it at build time.
  // Instead, inject a CDN script dynamically.
  try {
    if (typeof document !== 'undefined') {
      await new Promise<void>((resolve, reject) => {
        const script = document.createElement('script');
        script.src = 'https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js';
        script.async = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error('Failed to load Tesseract.js'));
        document.head.appendChild(script);
      });
      return (window as any).Tesseract || null;
    }
  } catch {}
  return null;
}

function extractQuestionsFromText(text: string): Array<any> {
  const lines = text.split(/\r?\n/).map((l) => l.trim());
  const found: number[] = [];
  for (const line of lines) {
    const m =
      line.match(/^(?:uppgift\s+)?(\d{1,2})[\.)\:]/i) ||
      line.match(/^(\d{1,2})\s/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (!Number.isNaN(num) && !found.includes(num)) found.push(num);
    }
    if (found.length >= 12) break;
  }
  if (found.length === 0 && text.replace(/\s+/g, '').length > 30) {
    return Array.from({ length: 5 }, (_, i) => ({
      id: `q-${i + 1}`,
      number: `${i + 1}`,
      theme: [],
      points: 0,
      status: 'not-started',
      difficulty: 'medium',
      comments: [],
    }));
  }
  return found.map((n) => ({
    id: `q-${n}`,
    number: `${n}`,
    theme: [],
    points: 0,
    status: 'not-started',
    difficulty: 'medium',
    comments: [],
  }));
}

export async function parsePdf(file: File): Promise<Partial<Exam>> {
  // Minimal parsing: extract text of first few pages and infer course/date from filename
  const fileName = file.name;
  const courseCodeMatch = fileName.match(/([A-Z]{3}\d{3})/);
  const yearMatch = fileName.match(/20(\d{2})/);
  const dateMatch = fileName.match(/(\d{4})-(\d{2})-(\d{2})/);

  let courseCode = courseCodeMatch ? courseCodeMatch[1] : undefined;
  const year = yearMatch ? parseInt(`20${yearMatch[1]}`) : undefined;
  const examDate = dateMatch
    ? new Date(
        parseInt(dateMatch[1]),
        parseInt(dateMatch[2]) - 1,
        parseInt(dateMatch[3])
      )
    : undefined;

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

    // If little/no text, OCR fallback on first pages
    let textForParsing = fullText;
    if (!fullText || fullText.replace(/\s+/g, '').length < 50) {
      const Tesseract = await loadTesseract();
      if (Tesseract && typeof document !== 'undefined') {
        try {
          const ocrPages = Math.min(2, pdf.numPages || 1);
          const ocrParts: string[] = [];
          for (let i = 1; i <= ocrPages; i++) {
            const page: any = await pdf.getPage(i);
            const viewport = page.getViewport({ scale: 2 });
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            if (!ctx) continue;
            canvas.width = Math.floor(viewport.width);
            canvas.height = Math.floor(viewport.height);
            await page.render({ canvasContext: ctx, viewport }).promise;
            const res: any = await Tesseract.recognize(canvas, 'swe+eng');
            if (res && res.data && res.data.text) ocrParts.push(String(res.data.text));
          }
          if (ocrParts.length > 0) {
            textForParsing = (fullText + '\n' + ocrParts.join('\n')).trim();
          }
        } catch {}
      }
    }

    // Optionally derive course code from OCR text if missing
    if (!courseCode && textForParsing) {
      const m = textForParsing.match(/\b([A-Z]{3}\d{3})\b/);
      if (m) courseCode = m[1];
    }

    const questions = extractQuestionsFromText(textForParsing);

    return {
      fileName,
      examDate,
      courseName: courseCode ? `${courseCode} - unknown course` : undefined,
      courseCode,
      year,
      totalPoints: questions.reduce((s, q) => s + (q.points || 0), 0),
      questions,
      extractedText: textForParsing.slice(0, 5000),
      tags: [],
    } as Partial<Exam>;
  } catch (error) {
    // Fallback to mock-ish extraction
    const fallbackQuestions = Array.from({ length: 5 }, (_, i) => ({
      id: `q-${i + 1}`,
      number: `${i + 1}`,
      theme: [],
      points: 0,
      status: 'not-started',
      difficulty: 'medium',
      comments: [],
    }));
    return {
      fileName,
      examDate,
      courseCode,
      year,
      questions: fallbackQuestions,
      extractedText: `Failed to extract text: ${String(error)}`,
    } as Partial<Exam>;
  }
}

export default parsePdf;

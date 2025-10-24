import { Exam } from '../../types/exam';
import { db } from '../db';
import { STORAGE_KEYS } from './keys';

export function saveExams(exams: Exam[]): void {
  try {
    const serializable = exams.map(({ fileBlob, ...e }) => e);
    localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(serializable));
    void saveExamsAsync(exams).catch(err => console.warn('IndexedDB saveExamsAsync failed:', err));
  } catch (error) {
    console.error('Failed to save exams:', error);
  }
}

export function loadExams(): Exam[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.EXAMS);
    if (!data) return [];
    const exams = JSON.parse(data);
    return exams.map((exam: any) => ({
      ...exam,
      uploadDate: new Date(exam.uploadDate),
      examDate: exam.examDate ? new Date(exam.examDate) : undefined,
      questions: exam.questions.map((q: any) => ({
        ...q,
        comments: q.comments.map((c: any) => ({ ...c, timestamp: new Date(c.timestamp) })),
      })),
    }));
  } catch (error) {
    console.error('Failed to load exams:', error);
    return [];
  }
}

export async function saveExamsAsync(exams: Exam[]): Promise<void> {
  try {
    await db.exams.clear();
    if (exams.length > 0) await db.exams.bulkAdd(exams as any);
  } catch (error) {
    console.error('Failed to save exams to IndexedDB:', error);
    saveExams(exams);
  }
}

export async function loadExamsAsync(): Promise<Exam[]> {
  try {
    const items = await db.exams.toArray();
    if (!items || items.length === 0) return loadExams();
    return items.map((exam: any) => {
      const restored: Exam = {
        ...exam,
        uploadDate: new Date(exam.uploadDate),
        examDate: exam.examDate ? new Date(exam.examDate) : undefined,
        questions: (exam.questions || []).map((q: any) => ({
          ...q,
          comments: (q.comments || []).map((c: any) => ({ ...c, timestamp: new Date(c.timestamp) })),
        })),
      } as Exam;
      // Recreate fresh Blob URL if we have the file blob
      if (restored.fileBlob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        try { restored.fileUrl = URL.createObjectURL(restored.fileBlob as any); } catch {}
      } else {
        // If no blob exists but a stored URL remains, drop dead blob: URLs
        if (typeof (restored as any).fileUrl === 'string' && (restored as any).fileUrl.startsWith('blob:')) {
          delete (restored as any).fileUrl;
        }
      }
      return restored;
    });
  } catch (error) {
    console.error('Failed to load exams from IndexedDB:', error);
    return loadExams();
  }
}


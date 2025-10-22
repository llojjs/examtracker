import { Exam, UserSettings, UserProgress, CourseChecklist } from '../types/exam';
import { db } from './db';

const STORAGE_KEYS = {
  EXAMS: 'examtracker-exams',
  SETTINGS: 'examtracker-settings',
  PROGRESS: 'examtracker-progress',
  COURSE_TASKS: 'examtracker-course-tasks'
};

export function saveExams(exams: Exam[]): void {
  try {
    // Strip non-serializable fields (Blob) for localStorage fallback
    const serializable = exams.map(({ fileBlob, ...e }) => e);
    localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(serializable));
    // Also persist to IndexedDB asynchronously for gradual migration
    // fire-and-forget; the async function already falls back to localStorage on error
    // (no await to avoid blocking callers)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    saveExamsAsync(exams).catch(err => console.warn('IndexedDB saveExamsAsync failed:', err));
  } catch (error) {
    console.error('Failed to save exams:', error);
  }
}

export function loadExams(): Exam[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.EXAMS);
    if (!data) return [];
    
    const exams = JSON.parse(data);
    // Convert date strings back to Date objects
    return exams.map((exam: any) => ({
      ...exam,
      uploadDate: new Date(exam.uploadDate),
      examDate: exam.examDate ? new Date(exam.examDate) : undefined,
      questions: exam.questions.map((q: any) => ({
        ...q,
        comments: q.comments.map((c: any) => ({
          ...c,
          timestamp: new Date(c.timestamp)
        }))
      }))
    }));
  } catch (error) {
    console.error('Failed to load exams:', error);
    return [];
  }
}

// Async IndexedDB (Dexie) helpers — fall back to localStorage on errors
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
          comments: (q.comments || []).map((c: any) => ({ ...c, timestamp: new Date(c.timestamp) }))
        }))
      } as Exam;
      // Recreate a fresh Blob URL if we have the file blob
      if (restored.fileBlob && typeof URL !== 'undefined' && typeof URL.createObjectURL === 'function') {
        try {
          restored.fileUrl = URL.createObjectURL(restored.fileBlob as any);
        } catch {}
      }
      return restored;
    });
  } catch (error) {
    console.error('Failed to load exams from IndexedDB:', error);
    return loadExams();
  }
}

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    // Persist to IndexedDB as well (non-blocking)
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    saveSettingsAsync(settings).catch(err => console.warn('IndexedDB saveSettingsAsync failed:', err));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export function loadSettings(): UserSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      return {
        theme: 'light',
        language: 'sv',
        fontSize: 16,
        compactView: false,
        deepOcr: false
      };
    }
    const parsed = JSON.parse(data);
    // Backfill defaults for new settings
    if (typeof parsed.deepOcr !== 'boolean') parsed.deepOcr = false;
    return parsed;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return {
      theme: 'light',
      language: 'sv',
      fontSize: 16,
      compactView: false,
      deepOcr: false
    };
  }
}

export async function saveSettingsAsync(settings: UserSettings): Promise<void> {
  try {
    await db.settings.clear();
    await db.settings.add(settings as any);
  } catch (error) {
    console.error('Failed to save settings to IndexedDB:', error);
    saveSettings(settings);
  }
}

export async function loadSettingsAsync(): Promise<UserSettings> {
  try {
    const items = await db.settings.toArray();
    if (!items || items.length === 0) return loadSettings();
    return items[0] as UserSettings;
  } catch (error) {
    console.error('Failed to load settings from IndexedDB:', error);
    return loadSettings();
  }
}

export function saveProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
    // Also persist progress to IndexedDB asynchronously
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    saveProgressAsync(progress).catch(err => console.warn('IndexedDB saveProgressAsync failed:', err));
  } catch (error) {
    console.error('Failed to save progress:', error);
  }
}

export function loadProgress(): UserProgress {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (!data) {
      return {
        totalXP: 0,
        level: 0,
        currentStreak: 0,
        longestStreak: 0,
        badges: [],
        unlockedBadgeIds: []
      };
    }
    const progress = JSON.parse(data);
    return {
      totalXP: progress.totalXP || 0,
      level: progress.level || Math.floor((progress.totalXP || 0) / 100),
      currentStreak: progress.currentStreak || 0,
      longestStreak: progress.longestStreak || 0,
      badges: progress.badges || [],
      unlockedBadgeIds: progress.unlockedBadgeIds || [],
      lastStudyDate: progress.lastStudyDate ? new Date(progress.lastStudyDate) : undefined
    };
  } catch (error) {
    console.error('Failed to load progress:', error);
    return {
      totalXP: 0,
      level: 0,
      currentStreak: 0,
      longestStreak: 0,
      badges: [],
      unlockedBadgeIds: []
    };
  }
}

export async function saveProgressAsync(progress: UserProgress): Promise<void> {
  try {
    await db.progress.clear();
    await db.progress.add(progress as any);
  } catch (error) {
    console.error('Failed to save progress to IndexedDB:', error);
    saveProgress(progress);
  }
}

export async function loadProgressAsync(): Promise<UserProgress> {
  try {
    const items = await db.progress.toArray();
    if (!items || items.length === 0) return loadProgress();
    const p = items[0] as any;
    return {
      totalXP: p.totalXP || 0,
      level: p.level || Math.floor((p.totalXP || 0) / 100),
      currentStreak: p.currentStreak || 0,
      longestStreak: p.longestStreak || 0,
      badges: p.badges || [],
      unlockedBadgeIds: p.unlockedBadgeIds || [],
      lastStudyDate: p.lastStudyDate ? new Date(p.lastStudyDate) : undefined
    };
  } catch (error) {
    console.error('Failed to load progress from IndexedDB:', error);
    return loadProgress();
  }
}

export function saveCourseTasks(courseTasks: CourseChecklist[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COURSE_TASKS, JSON.stringify(courseTasks));
    // Also persist course tasks to IndexedDB asynchronously
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    saveCourseTasksAsync(courseTasks).catch(err => console.warn('IndexedDB saveCourseTasksAsync failed:', err));
  } catch (error) {
    console.error('Failed to save course tasks:', error);
  }
}

export function loadCourseTasks(): CourseChecklist[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.COURSE_TASKS);
    if (!data) return [];
    
    const courseTasks = JSON.parse(data);
    // Convert date strings back to Date objects
    return courseTasks.map((ct: any) => ({
      ...ct,
      tasks: ct.tasks.map((task: any) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        deadline: task.deadline ? new Date(task.deadline) : undefined
      }))
    }));
  } catch (error) {
    console.error('Failed to load course tasks:', error);
    return [];
  }
}

export function exportData(): string {
  const exams = loadExams();
  const settings = loadSettings();
  const progress = loadProgress();
  const courseTasks = loadCourseTasks();
  
  return JSON.stringify({
    exams,
    settings,
    progress,
    courseTasks,
    exportDate: new Date(),
    version: '1.0'
  }, null, 2);
}

export function importData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    
    if (data.exams) {
      saveExams(data.exams);
    }
    if (data.settings) {
      saveSettings(data.settings);
    }
    if (data.progress) {
      saveProgress(data.progress);
    }
    if (data.courseTasks) {
      saveCourseTasks(data.courseTasks);
    }
    
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

export async function saveCourseTasksAsync(courseTasks: CourseChecklist[]): Promise<void> {
  try {
    await db.courseTasks.clear();
    if (courseTasks.length > 0) await db.courseTasks.bulkAdd(courseTasks as any);
  } catch (error) {
    console.error('Failed to save course tasks to IndexedDB:', error);
    saveCourseTasks(courseTasks);
  }
}

export async function loadCourseTasksAsync(): Promise<CourseChecklist[]> {
  try {
    const items = await db.courseTasks.toArray();
    if (!items || items.length === 0) return loadCourseTasks();
    return items as CourseChecklist[];
  } catch (error) {
    console.error('Failed to load course tasks from IndexedDB:', error);
    return loadCourseTasks();
  }
}

// Dev-only helper: attempt to persist the raw PDF to a local uploads/ folder
// via Vite's middleware endpoint (POST /api/upload). If the endpoint doesn't
// exist (e.g., in production static hosting), this safely no-ops and returns null.
export async function savePdfToServer(
  file: Blob,
  opts: { filename: string; id?: string }
): Promise<string | null> {
  try {
    if (typeof fetch === 'undefined') return null;
    const params = new URLSearchParams();
    params.set('filename', opts.filename || 'upload.pdf');
    if (opts.id) params.set('id', opts.id);
    const base = ((import.meta as any)?.env?.VITE_API_URL as string) || '';
    const token = ((import.meta as any)?.env?.VITE_API_TOKEN as string) || '';
    const url = `${base ? base.replace(/\/$/, '') : ''}/api/upload?${params.toString()}`;
    const headers: Record<string,string> = { 'Content-Type': (file as any)?.type || 'application/pdf' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: file,
    });
    if (!res.ok) return null;
    const data = await res.json().catch(() => ({} as any));
    return (data && (data.path || data.filePath)) ? (data.path || data.filePath) : null;
  } catch (err) {
    // Endpoint missing or request blocked: ignore
    return null;
  }
}





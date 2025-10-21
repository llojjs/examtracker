import { db } from './db';

const KEYS = {
  EXAMS: 'examtracker-exams',
  SETTINGS: 'examtracker-settings',
  PROGRESS: 'examtracker-progress',
  COURSE_TASKS: 'examtracker-course-tasks',
  MIGRATED_FLAG: 'examtracker-migrated-v1'
};

function reviveExamDates(exam: any) {
  return {
    ...exam,
    uploadDate: new Date(exam.uploadDate),
    examDate: exam.examDate ? new Date(exam.examDate) : undefined,
    questions: (exam.questions || []).map((q: any) => ({
      ...q,
      comments: (q.comments || []).map((c: any) => ({ ...c, timestamp: new Date(c.timestamp) })),
      deadline: q.deadline ? new Date(q.deadline) : undefined
    }))
  };
}

export async function migrateLocalStorageToIndexedDB(): Promise<void> {
  try {
    if (localStorage.getItem(KEYS.MIGRATED_FLAG)) {
      return; // already migrated
    }

    // Exams
    const examsRaw = localStorage.getItem(KEYS.EXAMS);
    if (examsRaw) {
      const exams = JSON.parse(examsRaw);
      const count = await db.exams.count();
      if (count === 0 && Array.isArray(exams) && exams.length > 0) {
        const revived = exams.map(reviveExamDates);
        await db.exams.bulkAdd(revived as any);
        console.info(`Migrated ${revived.length} exams to IndexedDB`);
      }
    }

    // Settings
    const settingsRaw = localStorage.getItem(KEYS.SETTINGS);
    if (settingsRaw) {
      const settings = JSON.parse(settingsRaw);
      const existing = await db.settings.toArray();
      if (existing.length === 0) {
        await db.settings.add(settings as any);
        console.info('Migrated settings to IndexedDB');
      }
    }

    // Progress
    const progressRaw = localStorage.getItem(KEYS.PROGRESS);
    if (progressRaw) {
      const progress = JSON.parse(progressRaw);
      const existing = await db.progress.toArray();
      if (existing.length === 0) {
        await db.progress.add(progress as any);
        console.info('Migrated progress to IndexedDB');
      }
    }

    // Course tasks
    const tasksRaw = localStorage.getItem(KEYS.COURSE_TASKS);
    if (tasksRaw) {
      const tasks = JSON.parse(tasksRaw);
      const count = await db.courseTasks.count();
      if (count === 0 && Array.isArray(tasks) && tasks.length > 0) {
        await db.courseTasks.bulkAdd(tasks as any);
        console.info(`Migrated ${tasks.length} course task entries to IndexedDB`);
      }
    }

    // Mark migrated
    localStorage.setItem(KEYS.MIGRATED_FLAG, new Date().toISOString());

  } catch (error) {
    console.error('Migration to IndexedDB failed:', error);
    // don't throw — app should continue using localStorage fallback
  }
}

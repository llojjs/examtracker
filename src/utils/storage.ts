import { Exam, UserSettings, UserProgress } from '../types/exam';

const STORAGE_KEYS = {
  EXAMS: 'examtracker-exams',
  SETTINGS: 'examtracker-settings',
  PROGRESS: 'examtracker-progress'
};

export function saveExams(exams: Exam[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.EXAMS, JSON.stringify(exams));
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

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
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
        compactView: false
      };
    }
    return JSON.parse(data);
  } catch (error) {
    console.error('Failed to load settings:', error);
    return {
      theme: 'light',
      language: 'sv',
      fontSize: 16,
      compactView: false
    };
  }
}

export function saveProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
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
        badges: []
      };
    }
    const progress = JSON.parse(data);
    return {
      totalXP: progress.totalXP || 0,
      level: progress.level || Math.floor((progress.totalXP || 0) / 100),
      currentStreak: progress.currentStreak || 0,
      longestStreak: progress.longestStreak || 0,
      badges: progress.badges || [],
      lastStudyDate: progress.lastStudyDate ? new Date(progress.lastStudyDate) : undefined
    };
  } catch (error) {
    console.error('Failed to load progress:', error);
    return {
      totalXP: 0,
      level: 0,
      currentStreak: 0,
      longestStreak: 0,
      badges: []
    };
  }
}

export function exportData(): string {
  const exams = loadExams();
  const settings = loadSettings();
  const progress = loadProgress();
  
  return JSON.stringify({
    exams,
    settings,
    progress,
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
    
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}

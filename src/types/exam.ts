export type ExamStatus = 'not-started' | 'in-progress' | 'solved' | 'review';
export type QuestionDifficulty = 'easy' | 'medium' | 'hard' | 'very-hard';

export interface Question {
  id: string;
  number: string; // e.g., "1", "2a", "3b"
  theme: string[];
  points: number;
  status: ExamStatus;
  difficulty?: QuestionDifficulty;
  timeSpent?: number; // minutes
  attempts?: number;
  tags?: string[];
  notes?: string; // markdown
  comments: Comment[];
  solutionImage?: string;
  page?: number; // PDF page number
  confidence?: number; // OCR confidence 0-100
}

export interface Comment {
  id: string;
  text: string;
  timestamp: Date;
  pinned?: boolean;
}

export interface Exam {
  id: string;
  fileName: string;
  fileUrl?: string; // Local blob URL or actual URL
  uploadDate: Date;
  examDate?: Date;
  courseName: string;
  courseCode: string;
  year?: number;
  totalPoints?: number;
  questions: Question[];
  extractedText?: string;
  tags?: string[];
}

export interface CourseStats {
  courseCode: string;
  courseName: string;
  totalExams: number;
  totalQuestions: number;
  solvedQuestions: number;
  commonThemes: { theme: string; count: number }[];
  averageDifficulty: number;
  totalTimeSpent: number;
}

export interface UserSettings {
  theme: 'light' | 'dark';
  language: 'sv' | 'en';
  fontSize: number;
  compactView: boolean;
  colorTheme?: string;
}

export interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  unlockedAt?: Date;
}

export interface UserProgress {
  totalXP: number;
  level: number;
  currentStreak: number;
  longestStreak: number;
  lastStudyDate?: Date;
  badges: Badge[];
}

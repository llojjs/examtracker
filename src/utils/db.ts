import Dexie, { Table } from 'dexie';
import { Exam, UserSettings, UserProgress, CourseChecklist } from '../types/exam';

export class AppDB extends Dexie {
  exams!: Table<Exam, string>;
  settings!: Table<UserSettings, number>;
  progress!: Table<UserProgress, number>;
  courseTasks!: Table<CourseChecklist, number>;

  constructor() {
    super('ExamTrackerDB');
    this.version(1).stores({
      exams: '&id,courseCode,uploadDate,examDate',
      settings: '++id',
      progress: '++id',
      courseTasks: '++id,courseCode'
    });

    this.exams = this.table('exams');
    this.settings = this.table('settings');
    this.progress = this.table('progress');
    this.courseTasks = this.table('courseTasks');
  }
}

export const db = new AppDB();

export async function clearAll() {
  await Promise.all([
    db.exams.clear(),
    db.settings.clear(),
    db.progress.clear(),
    db.courseTasks.clear()
  ]);
}

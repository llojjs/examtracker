import { loadExams } from './exams';
import { loadSettings } from './settings';
import { loadProgress } from './progress';
import { loadCourseTasks, saveCourseTasks } from './courseTasks';
import { saveExams } from './exams';
import { saveSettings } from './settings';
import { saveProgress } from './progress';

export function exportData(): string {
  const exams = loadExams();
  const settings = loadSettings();
  const progress = loadProgress();
  const courseTasks = loadCourseTasks();
  return JSON.stringify({ exams, settings, progress, courseTasks, exportDate: new Date(), version: '1.0' }, null, 2);
}

export function importData(jsonString: string): boolean {
  try {
    const data = JSON.parse(jsonString);
    if (data.exams) saveExams(data.exams);
    if (data.settings) saveSettings(data.settings);
    if (data.progress) saveProgress(data.progress);
    if (data.courseTasks) saveCourseTasks(data.courseTasks);
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
}


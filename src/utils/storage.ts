// Aggregated storage API that preserves existing imports
export { saveExams, loadExams, saveExamsAsync, loadExamsAsync } from './storage/exams';
export { saveSettings, loadSettings, saveSettingsAsync, loadSettingsAsync } from './storage/settings';
export { saveProgress, loadProgress, saveProgressAsync, loadProgressAsync } from './storage/progress';
export { saveCourseTasks, loadCourseTasks, saveCourseTasksAsync, loadCourseTasksAsync } from './storage/courseTasks';
export { exportData, importData } from './storage/transfer';
export { savePdfToServer, deletePdfFromServerById, deletePdfFromServerByPath } from './storage/pdfServer';


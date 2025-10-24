import { CourseChecklist } from '../../types/exam';
import { db } from '../db';
import { STORAGE_KEYS } from './keys';

export function saveCourseTasks(courseTasks: CourseChecklist[]): void {
  try {
    localStorage.setItem(STORAGE_KEYS.COURSE_TASKS, JSON.stringify(courseTasks));
    void saveCourseTasksAsync(courseTasks).catch(err => console.warn('IndexedDB saveCourseTasksAsync failed:', err));
  } catch (error) {
    console.error('Failed to save course tasks:', error);
  }
}

export function loadCourseTasks(): CourseChecklist[] {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.COURSE_TASKS);
    if (!data) return [];
    const courseTasks = JSON.parse(data);
    return courseTasks.map((ct: any) => ({
      ...ct,
      tasks: ct.tasks.map((task: any) => ({
        ...task,
        createdAt: new Date(task.createdAt),
        deadline: task.deadline ? new Date(task.deadline) : undefined,
      })),
    }));
  } catch (error) {
    console.error('Failed to load course tasks:', error);
    return [];
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


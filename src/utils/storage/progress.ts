import { UserProgress } from '../../types/exam';
import { db } from '../db';
import { STORAGE_KEYS } from './keys';

export function saveProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(STORAGE_KEYS.PROGRESS, JSON.stringify(progress));
    void saveProgressAsync(progress).catch(err => console.warn('IndexedDB saveProgressAsync failed:', err));
  } catch (error) {
    console.error('Failed to save progress:', error);
  }
}

export function loadProgress(): UserProgress {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.PROGRESS);
    if (!data) {
      return { totalXP: 0, level: 0, currentStreak: 0, longestStreak: 0, badges: [], unlockedBadgeIds: [] };
    }
    const progress = JSON.parse(data);
    return {
      totalXP: progress.totalXP || 0,
      level: progress.level || Math.floor((progress.totalXP || 0) / 100),
      currentStreak: progress.currentStreak || 0,
      longestStreak: progress.longestStreak || 0,
      badges: progress.badges || [],
      unlockedBadgeIds: progress.unlockedBadgeIds || [],
      lastStudyDate: progress.lastStudyDate ? new Date(progress.lastStudyDate) : undefined,
    };
  } catch (error) {
    console.error('Failed to load progress:', error);
    return { totalXP: 0, level: 0, currentStreak: 0, longestStreak: 0, badges: [], unlockedBadgeIds: [] };
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
      lastStudyDate: p.lastStudyDate ? new Date(p.lastStudyDate) : undefined,
    };
  } catch (error) {
    console.error('Failed to load progress from IndexedDB:', error);
    return loadProgress();
  }
}


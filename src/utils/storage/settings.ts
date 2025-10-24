import { UserSettings } from '../../types/exam';
import { db } from '../db';
import { STORAGE_KEYS } from './keys';

export function saveSettings(settings: UserSettings): void {
  try {
    localStorage.setItem(STORAGE_KEYS.SETTINGS, JSON.stringify(settings));
    void saveSettingsAsync(settings).catch(err => console.warn('IndexedDB saveSettingsAsync failed:', err));
  } catch (error) {
    console.error('Failed to save settings:', error);
  }
}

export function loadSettings(): UserSettings {
  try {
    const data = localStorage.getItem(STORAGE_KEYS.SETTINGS);
    if (!data) {
      return { theme: 'light', language: 'sv', fontSize: 16, compactView: false, deepOcr: false };
    }
    const parsed = JSON.parse(data);
    if (typeof parsed.deepOcr !== 'boolean') parsed.deepOcr = false;
    return parsed;
  } catch (error) {
    console.error('Failed to load settings:', error);
    return { theme: 'light', language: 'sv', fontSize: 16, compactView: false, deepOcr: false };
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


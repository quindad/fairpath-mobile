import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildStudyPlan, COMPANION_ACTIONS, type StudyPlan } from './learning-companion.ts';
import type { Enrollment, NativeCourse } from './enrollment.ts';
import type { TrackStep } from '../entrepreneurship/tracks.ts';

export const ACADEMY_WORKSHEET_CONSENT_KEY = 'fairpath.academy.signal_worksheet_consent.v1';

export function worksheetStorageKey(stepId: TrackStep): string {
  return `fairpath.academy.lesson_worksheet.${stepId}`;
}

/** Consent copy — companion actions with pending approval never charge credits from this screen. */
export function signalWorksheetConsentLine(): string {
  const pending = COMPANION_ACTIONS.filter((a) => a.status === 'pending_approval').map((a) => a.label);
  return `This worksheet uses built-in study steps only — no AI credits. Companion actions that need founder approval${pending.length ? ` (${pending.join(', ')})` : ''} stay off here.`;
}

export function studyPlanForLesson(course: NativeCourse, enrollment: Enrollment, passed: boolean): StudyPlan {
  return buildStudyPlan(course, enrollment, passed);
}

export function includedCompanionActions() {
  return COMPANION_ACTIONS.filter((a) => a.status === 'included');
}

export async function loadWorksheetConsent(): Promise<boolean> {
  try {
    const raw = await AsyncStorage.getItem(ACADEMY_WORKSHEET_CONSENT_KEY);
    return raw === '1';
  } catch {
    return false;
  }
}

export async function saveWorksheetConsent(granted: boolean): Promise<boolean> {
  try {
    await AsyncStorage.setItem(ACADEMY_WORKSHEET_CONSENT_KEY, granted ? '1' : '0');
    return true;
  } catch {
    return false;
  }
}

export async function loadLessonWorksheetNotes(stepId: TrackStep): Promise<string> {
  try {
    const raw = await AsyncStorage.getItem(worksheetStorageKey(stepId));
    return typeof raw === 'string' ? raw.slice(0, 4000) : '';
  } catch {
    return '';
  }
}

export async function saveLessonWorksheetNotes(stepId: TrackStep, notes: string): Promise<boolean> {
  try {
    await AsyncStorage.setItem(worksheetStorageKey(stepId), notes.slice(0, 4000));
    return true;
  } catch {
    return false;
  }
}

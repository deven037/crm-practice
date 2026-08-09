import AsyncStorage from '@react-native-async-storage/async-storage';

export interface Prefs {
  emailNotifs: boolean;
  pushNotifs: boolean;
  weeklyDigest: boolean;
  density: 'comfortable' | 'compact';
}

export const DEFAULT_PREFS: Prefs = { emailNotifs: true, pushNotifs: false, weeklyDigest: true, density: 'comfortable' };

const PREFS_KEY = 'crm.prefs';

/** AsyncStorage-backed equivalent of the web app's localStorage-backed getValue/setValue —
 * pure UI display preferences, not security-sensitive, so SecureStore would be overkill. */
export async function getPrefs(): Promise<Prefs> {
  const raw = await AsyncStorage.getItem(PREFS_KEY);
  if (!raw) return DEFAULT_PREFS;
  try {
    return { ...DEFAULT_PREFS, ...JSON.parse(raw) };
  } catch {
    return DEFAULT_PREFS;
  }
}

export async function setPrefs(prefs: Prefs): Promise<void> {
  await AsyncStorage.setItem(PREFS_KEY, JSON.stringify(prefs));
}

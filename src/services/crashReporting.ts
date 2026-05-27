import AsyncStorage from '@react-native-async-storage/async-storage';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

const CRASH_LOG_KEY = '@subtrack_crash_logs';
const MAX_LOGS = 20;

type CrashLog = {
  message: string;
  stack?: string;
  fatal?: boolean;
  createdAt: string;
  platform: string;
  appVersion?: string;
};

function toCrashLog(error: unknown, fatal?: boolean): CrashLog {
  const err = error instanceof Error ? error : new Error(String(error));
  return {
    message: err.message,
    stack: err.stack,
    fatal,
    createdAt: new Date().toISOString(),
    platform: Platform.OS,
    appVersion: Constants.expoConfig?.version,
  };
}

async function recordCrash(error: unknown, fatal?: boolean) {
  const nextLog = toCrashLog(error, fatal);
  try {
    const raw = await AsyncStorage.getItem(CRASH_LOG_KEY);
    const existing = raw ? JSON.parse(raw) as CrashLog[] : [];
    await AsyncStorage.setItem(
      CRASH_LOG_KEY,
      JSON.stringify([nextLog, ...existing].slice(0, MAX_LOGS))
    );
  } catch {
    // Crash reporting must never crash the app.
  }

  console.error('Captured app error:', nextLog);
}

export async function getCrashLogs() {
  const raw = await AsyncStorage.getItem(CRASH_LOG_KEY);
  return raw ? JSON.parse(raw) as CrashLog[] : [];
}

export function installCrashReporting() {
  const globalErrorUtils = (globalThis as any).ErrorUtils;
  const previousHandler = globalErrorUtils?.getGlobalHandler?.();

  globalErrorUtils?.setGlobalHandler?.((error: unknown, fatal?: boolean) => {
    void recordCrash(error, fatal);
    previousHandler?.(error, fatal);
  });

  const previousRejectionHandler = globalThis.onunhandledrejection;
  globalThis.onunhandledrejection = (event: PromiseRejectionEvent) => {
    void recordCrash(event.reason, false);
    if (typeof previousRejectionHandler === 'function') {
      (previousRejectionHandler as any)(event);
    }
  };
}

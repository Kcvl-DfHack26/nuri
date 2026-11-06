import type { Preferences } from '@starter/shared';
import type { ReactNode } from 'react';

import { preferencesSchema } from '@starter/shared';
import Storage from 'expo-sqlite/kv-store';
import { createContext, use, useEffect, useState } from 'react';
import { Uniwind } from 'uniwind';

function readPreferences(): Preferences {
  try {
    const raw = Storage.getItemSync('nuri.preferences');
    return preferencesSchema.parse(raw ? JSON.parse(raw) : {});
  } catch {
    return preferencesSchema.parse({});
  }
}

type PreferencesContext = {
  preferences: Preferences;
  update: (patch: Partial<Preferences>) => void;
  storageError: string | null;
};

const Context = createContext<PreferencesContext | null>(null);

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [storageError, setStorageError] = useState<string | null>(null);
  useEffect(() => {
    Uniwind.setTheme(preferences.appearance);
  }, [preferences.appearance]);

  function update(patch: Partial<Preferences>) {
    const next = preferencesSchema.parse({ ...preferences, ...patch });
    try {
      Storage.setItemSync('nuri.preferences', JSON.stringify(next));
      setPreferences(next);
      setStorageError(null);
    } catch {
      setStorageError('設定を保存できませんでした。もう一度お試しください。');
    }
  }

  return <Context value={{ preferences, update, storageError }}>{children}</Context>;
}

export function usePreferences() {
  const value = use(Context);
  if (!value) {
    throw new Error('PreferencesProvider is missing');
  }
  return value;
}

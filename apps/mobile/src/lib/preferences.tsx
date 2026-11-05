import type { Preferences } from '@starter/shared';
import type { ReactNode } from 'react';

import { preferencesSchema } from '@starter/shared';
import * as Haptics from 'expo-haptics';
import Storage from 'expo-sqlite/kv-store';
import { createContext, use, useEffect, useState } from 'react';
import { Appearance } from 'react-native';

function readPreferences(): Preferences {
  try {
    const raw = Storage.getItemSync('expo-hono-opentofu-starter.preferences');
    return preferencesSchema.parse(raw ? JSON.parse(raw) : {});
  } catch {
    return preferencesSchema.parse({});
  }
}

type PreferencesContext = {
  preferences: Preferences;
  update: (patch: Partial<Preferences>) => void;
  toggleFavorite: (id: string) => void;
  complete: (id: string) => void;
  storageError: string | null;
};

const Context = createContext<PreferencesContext | null>(null);

export function todayKey(date = new Date()): string {
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function PreferencesProvider({ children }: { children: ReactNode }) {
  const [preferences, setPreferences] = useState(readPreferences);
  const [storageError, setStorageError] = useState<string | null>(null);
  useEffect(() => {
    Appearance.setColorScheme(
      preferences.appearance === 'system' ? 'unspecified' : preferences.appearance,
    );
  }, [preferences.appearance]);

  function update(patch: Partial<Preferences>) {
    const next = preferencesSchema.parse({ ...preferences, ...patch });
    try {
      Storage.setItemSync('expo-hono-opentofu-starter.preferences', JSON.stringify(next));
      setPreferences(next);
      setStorageError(null);
    } catch {
      setStorageError('Your changes could not be saved. Please try again.');
    }
  }

  function feedback() {
    if (preferences.haptics) {
      void Haptics.selectionAsync().catch(() => {
        /* Haptics are optional on unsupported devices. */
      });
    }
  }

  function toggleFavorite(id: string) {
    update({
      favorites: preferences.favorites.includes(id)
        ? preferences.favorites.filter((value) => value !== id)
        : [...preferences.favorites, id],
    });
    feedback();
  }

  function complete(id: string) {
    const day = todayKey();
    const completed = preferences.completed[day] ?? [];
    update({ completed: { ...preferences.completed, [day]: [...new Set([...completed, id])] } });
    feedback();
  }

  return (
    <Context value={{ preferences, update, toggleFavorite, complete, storageError }}>
      {children}
    </Context>
  );
}

export function usePreferences() {
  const value = use(Context);
  if (!value) {
    throw new Error('PreferencesProvider is missing');
  }
  return value;
}

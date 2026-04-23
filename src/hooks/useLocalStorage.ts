import { useState, useEffect, useCallback } from 'react';

export function useLocalStorage<T>(key: string, initializer: T | (() => T)): [T, (v: T | ((prev: T) => T)) => void] {
  const [value, setValue] = useState<T>(() => {
    try {
      const stored = localStorage.getItem(key);
      if (stored !== null) return JSON.parse(stored);
    } catch(e) {}
    const init = typeof initializer === 'function' ? (initializer as () => T)() : initializer;
    localStorage.setItem(key, JSON.stringify(init));
    return init;
  });

  useEffect(() => {
    const read = () => {
      try {
        const stored = localStorage.getItem(key);
        if (stored !== null) setValue(JSON.parse(stored));
      } catch(e) {}
    };

    const onStorage = (e: StorageEvent) => {
      if (!e) return;
      if (e.key === key) read();
    };

    const onCustom = (e: any) => {
      if (e && e.detail && e.detail.key === key) read();
    };

    window.addEventListener('storage', onStorage);
    window.addEventListener('va:ls', onCustom);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('va:ls', onCustom);
    };
  }, [key]);

  const set = useCallback((v: T | ((prev: T) => T)) => {
    setValue(prev => {
      const next = typeof v === 'function' ? (v as (prev: T) => T)(prev) : v;
      localStorage.setItem(key, JSON.stringify(next));
      try { window.dispatchEvent(new CustomEvent('va:ls', { detail: { key } })); } catch(e) {}
      return next;
    });
  }, [key]);

  return [value, set];
}

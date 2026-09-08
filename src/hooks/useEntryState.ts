import { useCallback, useRef, useState, type Dispatch, type SetStateAction } from 'react';
import { readEntryValue, readHistoryEnvelope, writeEntryValue } from '../lib/navigationState';

/** Reviewable UI state belongs to a browser history entry, never to another visit/account. */
export function useEntryState<T>(
  name: string,
  initial: T | (() => T),
  persist?: (value: T) => T,
): [T, Dispatch<SetStateAction<T>>] {
  const entry = useRef(readHistoryEnvelope()?.entryKey);
  const owner = useRef(readHistoryEnvelope()?.owner);
  const [value, setValue] = useState<T>(() => {
    const saved = readEntryValue<T>(name, entry.current);
    return saved !== undefined
      ? saved
      : typeof initial === 'function'
        ? (initial as () => T)()
        : initial;
  });
  const current = useRef(value);
  const persistRef = useRef(persist);
  persistRef.current = persist;
  const update = useCallback<Dispatch<SetStateAction<T>>>(
    (next) => {
      if (readHistoryEnvelope()?.owner !== owner.current) return;
      const resolved =
        typeof next === 'function' ? (next as (previous: T) => T)(current.current) : next;
      current.current = resolved;
      writeEntryValue(
        name,
        persistRef.current ? persistRef.current(resolved) : resolved,
        entry.current,
      );
      setValue(resolved);
    },
    [name],
  );
  return [value, update];
}

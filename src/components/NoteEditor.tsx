import { useEffect, useRef } from 'react';

/**
 * Plain in-place note editor. Mount-time only: focus, caret at end, autosize.
 * After that the browser owns the caret — selection, copy and paste behave
 * natively; re-renders never touch the cursor.
 */
export function NoteEditor({
  initial,
  placeholder,
  ariaLabel,
  onChangeText,
  onDone,
}: {
  initial: string;
  placeholder: string;
  ariaLabel: string;
  onChangeText: (text: string) => void;
  onDone: () => void;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  return (
    <textarea
      ref={ref}
      rows={2}
      defaultValue={initial}
      placeholder={placeholder}
      aria-label={ariaLabel}
      style={{
        width: '100%',
        fontFamily: 'inherit',
        fontSize: 14,
        background: 'var(--surface2)',
        border: '1px solid var(--accent-text)',
        borderRadius: 'var(--r-control)',
        padding: 10,
        color: 'var(--ink)',
        resize: 'none',
        overflow: 'hidden',
      }}
      onInput={(e) => {
        const el = e.currentTarget;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
        onChangeText(el.value);
      }}
      onBlur={onDone}
    />
  );
}

import { useEffect, useRef } from 'react';

/**
 * Plain in-place note editor. Mount-time only: focus, caret at end, autosize.
 * After that the browser owns the caret — selection, copy and paste behave
 * natively; re-renders never touch the cursor.
 */
export function NoteEditor({
  initial,
  placeholder,
  labelledBy,
  doneLabel,
  onChangeText,
  onDone,
}: {
  initial: string;
  placeholder: string;
  labelledBy: string;
  doneLabel: string;
  onChangeText: (text: string) => void;
  onDone: (text: string) => void | Promise<void>;
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
    <div className="note-editor">
      <textarea
        ref={ref}
        className="note-editor__field"
        rows={2}
        defaultValue={initial}
        placeholder={placeholder}
        aria-labelledby={labelledBy}
        onInput={(e) => {
          const el = e.currentTarget;
          el.style.height = 'auto';
          el.style.height = `${el.scrollHeight}px`;
          onChangeText(el.value);
        }}
      />
      <button
        type="button"
        className="btn btn-ghost note-editor__done"
        onClick={() => onDone(ref.current?.value ?? initial)}
      >
        {doneLabel}
      </button>
    </div>
  );
}

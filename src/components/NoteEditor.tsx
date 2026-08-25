import { useEffect, useRef, useState } from 'react';

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
  disabled = false,
  onChangeText,
  onDone,
}: {
  initial: string;
  placeholder: string;
  labelledBy: string;
  doneLabel: string;
  disabled?: boolean;
  onChangeText: (text: string) => void;
  onDone: (text: string) => void | Promise<void>;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  const submitting = useRef(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    el.focus();
    el.setSelectionRange(el.value.length, el.value.length);
    el.style.height = 'auto';
    el.style.height = `${el.scrollHeight}px`;
  }, []);

  async function done(): Promise<void> {
    if (disabled || submitting.current) return;
    submitting.current = true;
    setIsSubmitting(true);
    try {
      await onDone(ref.current?.value ?? initial);
    } finally {
      submitting.current = false;
      setIsSubmitting(false);
    }
  }

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
        disabled={disabled || isSubmitting}
        onClick={() => void done()}
      >
        {doneLabel}
      </button>
    </div>
  );
}

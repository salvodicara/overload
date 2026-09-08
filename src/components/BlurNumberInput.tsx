import { useEntryState } from '../hooks/useEntryState';
import { useEffect, useRef, useState, type InputHTMLAttributes } from 'react';
import { useTranslation } from 'react-i18next';

type Props = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  'value' | 'defaultValue' | 'onChange' | 'onBlur'
> & {
  value: number | null | undefined;
  draftKey?: string;
  validate(value: number | null): boolean;
  onSave(value: number | null): Promise<unknown>;
  invalidMessage: string;
  saveMessage: string;
};
/** A store acknowledgement must never replace text entered after that request began. */
export function BlurNumberInput({
  value,
  draftKey,
  validate,
  onSave,
  invalidMessage,
  saveMessage,
  ...props
}: Props) {
  const { t } = useTranslation();
  const [saved, setSaved] = useEntryState(
    'number:' + (draftKey ?? props.name ?? props['aria-label']),
    { text: value == null ? '' : String(value), dirty: false },
  );
  const [draft, setDraft] = useState(saved.text);
  const draftRef = useRef(draft);
  const dirty = useRef(saved.dirty);
  const mounted = useRef(true);
  const version = useRef(0);
  const pendingText = useRef<string | null>(null);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<'invalid' | 'save' | null>(null);
  const input = useRef<HTMLInputElement>(null);
  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);
  useEffect(() => {
    if (!dirty.current) {
      const next = value == null ? '' : String(value);
      draftRef.current = next;
      setDraft(next);
    }
  }, [value]);
  async function save() {
    if (!dirty.current) return;
    const submitted = draftRef.current;
    if (pendingText.current === submitted) return;
    const amount = submitted === '' ? null : Number(submitted);
    if (!input.current?.validity.valid || !validate(amount)) {
      setError('invalid');
      return;
    }
    pendingText.current = submitted;
    const request = ++version.current;
    setPending(true);
    setError(null);
    try {
      await onSave(amount);
      if (mounted.current && request === version.current && draftRef.current === submitted) {
        dirty.current = false;
        setSaved({ text: submitted, dirty: false });
      }
    } catch {
      if (mounted.current && request === version.current) setError('save');
    } finally {
      if (mounted.current && request === version.current) {
        pendingText.current = null;
        setPending(false);
      }
    }
  }
  return (
    <>
      <input
        {...props}
        ref={input}
        value={draft}
        onChange={(event) => {
          dirty.current = true;
          draftRef.current = event.target.value;
          setDraft(event.target.value);
          setSaved({ text: event.target.value, dirty: true });
          setError(null);
        }}
        onBlur={() => void save()}
      />
      {pending ? (
        <span className="small muted" role="status">
          {t('diet.saving')}
        </span>
      ) : dirty.current && !error ? (
        <span className="small muted" role="status">
          {t('diet.unsaved')}
        </span>
      ) : null}
      {error && (
        <span className="form-feedback form-feedback--error" role="alert">
          {error === 'invalid' ? invalidMessage : saveMessage}
        </span>
      )}
      {error === 'save' && (
        <button type="button" className="btn btn-ghost" onClick={() => void save()}>
          {t('library.retry')}
        </button>
      )}
    </>
  );
}

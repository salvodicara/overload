import {
  useId,
  useLayoutEffect,
  useRef,
  type KeyboardEvent,
  type MouseEvent,
  type ReactNode,
  type RefObject,
} from 'react';

const FOCUSABLE = [
  'a[href]',
  'area[href]',
  'button:not([disabled])',
  'input:not([disabled]):not([type="hidden"])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  '[contenteditable="true"]',
  '[tabindex]:not([tabindex="-1"])',
].join(',');

type BottomSheetProps = {
  open: boolean;
  title: ReactNode;
  onClose(): void;
  children: ReactNode;
  initialFocusRef?: RefObject<HTMLElement | null>;
  closeOnScrim?: boolean;
};

type SavedStyle = {
  property: string;
  priority: string;
  value: string;
};

type ScrollLock = {
  body: HTMLElement;
  savedStyles: SavedStyle[];
  scrollX: number;
  scrollY: number;
  trigger: HTMLElement | null;
};

function visibleFocusable(dialog: HTMLDialogElement): HTMLElement[] {
  return [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((element) => {
    const style = getComputedStyle(element);
    return (
      element.getClientRects().length > 0 &&
      style.display !== 'none' &&
      style.visibility !== 'hidden' &&
      !element.closest('[aria-hidden="true"]')
    );
  });
}

function saveBodyStyle(body: HTMLElement, property: string): SavedStyle {
  return {
    property,
    priority: body.style.getPropertyPriority(property),
    value: body.style.getPropertyValue(property),
  };
}

function restoreBodyStyles(body: HTMLElement, saved: SavedStyle[]): void {
  for (const { property, priority, value } of saved) {
    if (value) body.style.setProperty(property, value, priority);
    else body.style.removeProperty(property);
  }
}

export function BottomSheet({
  open,
  title,
  onClose,
  children,
  initialFocusRef,
  closeOnScrim = false,
}: BottomSheetProps) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const scrollLockRef = useRef<ScrollLock | null>(null);
  const restoreFrameRef = useRef<number | null>(null);
  const onCloseRef = useRef(onClose);
  const titleId = useId();
  onCloseRef.current = onClose;

  useLayoutEffect(() => {
    const dialog = dialogRef.current;
    if (!dialog || !open) {
      if (dialog?.open) dialog.close();
      return;
    }

    if (restoreFrameRef.current !== null) {
      cancelAnimationFrame(restoreFrameRef.current);
      restoreFrameRef.current = null;
    }
    if (!scrollLockRef.current) {
      const active = document.activeElement;
      const body = document.body;
      scrollLockRef.current = {
        body,
        savedStyles: ['overflow', 'position', 'top', 'left', 'right', 'width', 'padding-right'].map(
          (property) => saveBodyStyle(body, property),
        ),
        scrollX: window.scrollX,
        scrollY: window.scrollY,
        trigger: active instanceof HTMLElement && active !== body ? active : null,
      };
    }
    const lock = scrollLockRef.current;
    const { body, savedStyles, scrollX, scrollY, trigger } = lock;
    const scrollbarWidth = Math.max(0, window.innerWidth - document.documentElement.clientWidth);

    body.style.overflow = 'hidden';
    body.style.position = 'fixed';
    body.style.top = `${-scrollY}px`;
    body.style.left = `${-scrollX}px`;
    body.style.right = '0';
    body.style.width = '100%';
    if (scrollbarWidth > 0) body.style.paddingRight = `${scrollbarWidth}px`;

    dialog.showModal();
    const requested = initialFocusRef?.current;
    const focusable = visibleFocusable(dialog);
    const target =
      requested && focusable.includes(requested) ? requested : (focusable[0] ?? dialog);
    target.focus({ preventScroll: true });

    return () => {
      if (dialog.open) dialog.close();
      restoreBodyStyles(body, savedStyles);
      if (!trigger?.isConnected) {
        scrollLockRef.current = null;
        return;
      }
      restoreFrameRef.current = requestAnimationFrame(() => {
        restoreFrameRef.current = null;
        if (!trigger.isConnected) {
          scrollLockRef.current = null;
          return;
        }
        if (document.querySelector('dialog[open][aria-modal="true"]')) {
          scrollLockRef.current = null;
          return;
        }
        window.scrollTo(scrollX, scrollY);
        trigger.focus({ preventScroll: true });
        scrollLockRef.current = null;
      });
    };
  }, [initialFocusRef, open]);

  function requestClose(): void {
    onCloseRef.current();
  }

  function trapFocus(event: KeyboardEvent<HTMLDialogElement>): void {
    if (event.key !== 'Tab') return;
    const dialog = dialogRef.current;
    if (!dialog) return;
    const focusable = visibleFocusable(dialog);
    if (focusable.length === 0) {
      event.preventDefault();
      dialog.focus({ preventScroll: true });
      return;
    }
    const first = focusable[0];
    const last = focusable.at(-1) ?? first;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus({ preventScroll: true });
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus({ preventScroll: true });
    } else if (!dialog.contains(document.activeElement)) {
      event.preventDefault();
      (event.shiftKey ? last : first).focus({ preventScroll: true });
    }
  }

  function handleScrim(event: MouseEvent<HTMLDialogElement>): void {
    if (closeOnScrim && event.target === event.currentTarget) requestClose();
  }

  return (
    <dialog
      ref={dialogRef}
      className="sheet-scrim"
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      tabIndex={-1}
      onCancel={(event) => {
        event.preventDefault();
        requestClose();
      }}
      onClick={handleScrim}
      onKeyDown={trapFocus}
    >
      <div className="sheet card card-pad">
        <h2 id={titleId} className="sheet__title">
          {title}
        </h2>
        <div className="sheet__body stack">{children}</div>
      </div>
    </dialog>
  );
}

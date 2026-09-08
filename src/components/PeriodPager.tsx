import { useLayoutEffect, useRef, type ReactNode } from 'react';
import '../theme/period-pager.css';

/** Native scroll snapping: the browser owns dragging, momentum and vertical pan. */
export function PeriodPager({
  value,
  label,
  onMove,
  canNext = true,
  children,
}: {
  value: string;
  label: string;
  onMove(direction: -1 | 1): void;
  canNext?: boolean;
  children(offset: -1 | 0 | 1): ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const move = useRef(onMove);
  move.current = onMove;
  const touching = useRef(false);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const locked = useRef(false);
  const settle = () => {
    const node = ref.current;
    if (!node || touching.current || locked.current || !node.clientWidth) return;
    const page = Math.round(node.scrollLeft / node.clientWidth);
    if (page === 1) return;
    locked.current = true;
    move.current(page < 1 ? -1 : 1);
  };
  const schedule = () => {
    clearTimeout(timer.current);
    timer.current = setTimeout(settle, 140);
  };
  useLayoutEffect(() => {
    const node = ref.current!;
    clearTimeout(timer.current);
    node.scrollLeft = node.clientWidth;
    locked.current = false;
  }, [value]);
  useLayoutEffect(() => {
    const node = ref.current!;
    const resize = new ResizeObserver(() => {
      node.scrollLeft = node.clientWidth;
    });
    resize.observe(node);
    return () => {
      resize.disconnect();
      clearTimeout(timer.current);
    };
  }, []);
  return (
    <div
      ref={ref}
      className="period-pager"
      role="group"
      aria-label={label}
      onScroll={schedule}
      onTouchStart={() => {
        touching.current = true;
      }}
      onTouchEnd={() => {
        touching.current = false;
        schedule();
      }}
      onTouchCancel={() => {
        touching.current = false;
        schedule();
      }}
    >
      {([-1, 0, 1] as const)
        .filter((offset) => offset !== 1 || canNext)
        .map((offset) => (
          <div
            className="period-pager__page"
            key={offset}
            inert={offset !== 0}
            aria-hidden={offset !== 0 ? true : undefined}
          >
            {children(offset)}
          </div>
        ))}
    </div>
  );
}

import { useEffect, useRef, useState } from 'react';
import { secondsUntil } from './time';

/** Tickt sekündlich bis `to`; ruft `onDone` einmalig auf. */
export function useCountdown(to: string | null | undefined, onDone?: () => void) {
  const [left, setLeft] = useState(() => secondsUntil(to));
  const done = useRef(false);
  const cb = useRef(onDone);
  cb.current = onDone;

  useEffect(() => {
    done.current = false;
    setLeft(secondsUntil(to));
    if (!to) return;
    const id = window.setInterval(() => {
      const l = secondsUntil(to);
      setLeft(l);
      if (l <= 0 && !done.current) {
        done.current = true;
        cb.current?.();
      }
    }, 1000);
    return () => window.clearInterval(id);
  }, [to]);

  return left;
}

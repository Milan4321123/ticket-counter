'use client';

// Marks its element with data-in once it scrolls into view (and keeps it while
// it is on screen), so CSS can play an entrance and run looping animations
// only while somebody can see them.
import { useEffect, useRef, type ReactNode } from 'react';

export default function InView({ as: Tag = 'div', className, children }: { as?: 'div' | 'section' | 'article'; className?: string; children: ReactNode }) {
  const ref = useRef<HTMLElement | null>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (typeof IntersectionObserver === 'undefined') {
      el.setAttribute('data-in', '');
      return;
    }
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          el.setAttribute('data-in', '');
          el.setAttribute('data-seen', '');
        } else {
          el.removeAttribute('data-in');
        }
      },
      { threshold: 0.25 }
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);
  return (
    <Tag ref={ref as never} className={className}>
      {children}
    </Tag>
  );
}

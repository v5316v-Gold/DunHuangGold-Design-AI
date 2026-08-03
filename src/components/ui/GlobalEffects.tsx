'use client';

import { useEffect, useState } from 'react';

export function GlobalEffects() {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  return (
    <>
      {/* CSS 自定义光标 */}
      <style jsx global>{`
        body {
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='20' height='20' viewBox='0 0 24 24' fill='none' stroke='%23D4AF37' stroke-width='1.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M4 4l7.07 17 2.51-7.39L21 11.07 4 4z'/%3E%3Cpath d='M13.5 13.5L19 19'/%3E%3C/svg%3E") 0 0, auto !important;
        }
        button, a, [role="button"], .clickable {
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='%23D4AF37' stroke='%23D4AF37' stroke-width='1'%3E%3Cpath d='M4 4l7.07 17 2.51-7.39L21 11.07 4 4z'/%3E%3C/svg%3E") 0 0, pointer !important;
        }
        input, textarea, [contenteditable="true"] {
          cursor: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='20' viewBox='0 0 20 24'%3E%3Crect x='8' y='2' width='2' height='18' fill='%23D4AF37'/%3E%3Crect x='5' y='4' width='8' height='2' fill='%23D4AF37'/%3E%3Crect x='5' y='8' width='8' height='2' fill='%23D4AF37'/%3E%3Crect x='5' y='12' width='8' height='2' fill='%23D4AF37'/%3E%3Crect x='5' y='16' width='8' height='2' fill='%23D4AF37'/%3E%3C/svg%3E") 8 12, text !important;
        }
      `}</style>
    </>
  );
}

export default GlobalEffects;

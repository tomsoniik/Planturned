import type { ReactNode } from 'react';

/**
 * Wejście sekcji przy przewijaniu, w czystym CSS (animation-timeline: view()).
 * Bez wsparcia przeglądarki albo przy "ogranicz ruch" treść jest po prostu widoczna.
 */
export default function Reveal({ children, className }: { children: ReactNode; className?: string }) {
  return <div className={`reveal${className ? ` ${className}` : ''}`}>{children}</div>;
}

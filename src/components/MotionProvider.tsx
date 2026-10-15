"use client";

import { MotionConfig } from 'framer-motion';
import type { ReactNode } from 'react';

/** Przy "ogranicz ruch" w systemie animacje przesunięć są wyłączane, zostaje samo przenikanie. */
export default function MotionProvider({ children }: { children: ReactNode }) {
  return <MotionConfig reducedMotion="user">{children}</MotionConfig>;
}

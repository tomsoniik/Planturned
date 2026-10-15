"use client";

import dynamic from 'next/dynamic';
import { SAMPLE_BASE } from '@/lib/sampleBase';
import styles from '@/app/page.module.css';

const BasePreview3D = dynamic(() => import('./BasePreview3D'), {
  ssr: false,
  loading: () => <div className={styles.previewSkeleton} />,
});

export default function HeroPreview() {
  return <BasePreview3D items={SAMPLE_BASE} />;
}

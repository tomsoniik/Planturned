"use client";

import { useRouter } from 'next/navigation';
import { Plus } from '@phosphor-icons/react';
import { createProject } from '@/lib/projects';

export default function NewProjectButton({ size }: { size?: 'lg' }) {
  const router = useRouter();
  return (
    <button
      className={`btn btn-primary${size === 'lg' ? ' btn-lg' : ''}`}
      onClick={() => router.push(`/builder/${createProject().id}`)}
    >
      <Plus size={16} weight="bold" />
      Nowy projekt
    </button>
  );
}

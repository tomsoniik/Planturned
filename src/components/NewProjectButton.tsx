"use client";

import { useRouter } from 'next/navigation';
import { Plus } from '@phosphor-icons/react';
import { createProject, listProjects } from '@/lib/projects';
import { useT } from './I18nProvider';

export default function NewProjectButton({ size }: { size?: 'lg' }) {
  const router = useRouter();
  const t = useT();
  return (
    <button
      className={`btn btn-primary${size === 'lg' ? ' btn-lg' : ''}`}
      onClick={() => router.push(`/builder/${createProject({ name: t.common.projectName(listProjects().length + 1) }).id}`)}
    >
      <Plus size={16} weight="bold" />
      {t.common.newProject}
    </button>
  );
}

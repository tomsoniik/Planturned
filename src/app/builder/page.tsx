"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DownloadSimple, Trash, UploadSimple } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import SiteNav from '@/components/SiteNav';
import NewProjectButton from '@/components/NewProjectButton';
import PlanThumbnail from '@/components/PlanThumbnail';
import { useAppStore } from '@/store/useAppStore';
import { useI18n } from '@/components/I18nProvider';
import type { Lang } from '@/lib/i18n';
import { deleteProject, exportProject, importProjectFile, listProjects, type Project } from '@/lib/projects';
import styles from './projects.module.css';

function timeAgo(iso: string, lang: Lang) {
  const rtf = new Intl.RelativeTimeFormat(lang, { numeric: 'auto' });
  const diff = (new Date(iso).getTime() - Date.now()) / 1000;
  const steps: [number, Intl.RelativeTimeFormatUnit][] = [
    [60, 'second'],
    [60, 'minute'],
    [24, 'hour'],
    [30, 'day'],
    [12, 'month'],
  ];
  let value = diff;
  for (const [size, unit] of steps) {
    if (Math.abs(value) < size) return rtf.format(Math.round(value), unit);
    value /= size;
  }
  return rtf.format(Math.round(value), 'year');
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addNotification } = useAppStore();
  const { t, lang } = useI18n();

  useEffect(() => {
    // localStorage jest dostępny dopiero po montażu (strona jest też renderowana na serwerze)
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setProjects(listProjects());
  }, []);

  const handleImport = async (file?: File) => {
    if (!file) return;
    try {
      const p = await importProjectFile(file);
      setProjects(listProjects());
      addNotification(t.projects.loaded(p.name), 'success');
    } catch {
      addNotification(t.projects.badFile, 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = (p: Project) => {
    if (!window.confirm(t.projects.confirmDelete(p.name))) return;
    deleteProject(p.id);
    setProjects(listProjects());
  };

  const importButton = (
    <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
      <UploadSimple size={16} weight="bold" />
      {t.projects.loadFile}
    </button>
  );

  return (
    <>
      <SiteNav />
      <main className={`wrap ${styles.page}`}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>{t.common.myProjects}</h1>
            <p className={styles.note}>{t.projects.note}</p>
          </div>
          <div className={styles.actions}>
            {importButton}
            <NewProjectButton />
          </div>
          <input
            ref={fileRef}
            type="file"
            accept=".json,application/json"
            className="sr-only"
            onChange={(e) => handleImport(e.target.files?.[0])}
          />
        </header>

        {projects === null ? (
          <div className={styles.grid} aria-busy>
            {[0, 1, 2].map((i) => (
              <div key={i} className={`${styles.card} ${styles.skeleton}`} />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <div className={styles.empty}>
            <h2>{t.projects.emptyTitle}</h2>
            <p>{t.projects.emptyText}</p>
            <div className={styles.actions}>
              {importButton}
              <NewProjectButton />
            </div>
          </div>
        ) : (
          <ul className={styles.grid}>
            {projects.map((p, i) => (
              <motion.li
                key={p.id}
                className={styles.card}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              >
                <Link href={`/builder/${p.id}`} className={styles.cardLink}>
                  <div className={styles.thumb}>
                    {p.items.length > 0 ? (
                      <PlanThumbnail items={p.items} className={styles.thumbSvg} />
                    ) : (
                      <span className={styles.thumbEmpty}>{t.projects.emptyPlan}</span>
                    )}
                  </div>
                  <div className={styles.meta}>
                    <h2 className={styles.name}>{p.name}</h2>
                    <p className={styles.details}>
                      {t.projects.elements(p.items.length)} · {timeAgo(p.updatedAt, lang)}
                    </p>
                  </div>
                </Link>
                <div className={styles.cardActions}>
                  <button className="icon-btn" title={t.projects.exportTitle} onClick={() => exportProject(p)}>
                    <DownloadSimple size={16} weight="bold" />
                  </button>
                  <button className="icon-btn danger" title={t.projects.deleteTitle} onClick={() => handleDelete(p)}>
                    <Trash size={16} weight="bold" />
                  </button>
                </div>
              </motion.li>
            ))}
          </ul>
        )}
      </main>
    </>
  );
}

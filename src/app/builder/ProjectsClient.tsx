"use client";

import { useEffect, useRef, useState, type DragEvent } from 'react';
import Link from 'next/link';
import { DownloadSimple, Plus, Trash, UploadSimple } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import SiteNav from '@/components/SiteNav';
import HeroVideo from '@/components/HeroVideo';
import { useCreateProject } from '@/components/NewProjectButton';
import type { Media } from '@/lib/cms/schema';
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

export default function ProjectsClient({ media }: { media: Media }) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [dragging, setDragging] = useState(false);
  const dragDepth = useRef(0);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addNotification } = useAppStore();
  const { t, lang } = useI18n();
  const create = useCreateProject();

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

  // Plik można upuścić w dowolnym miejscu strony; licznik, bo dragleave przychodzi też z elementów w środku
  const hasFiles = (e: DragEvent) => e.dataTransfer.types.includes('Files');
  const dropHandlers = {
    onDragEnter: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current += 1;
      setDragging(true);
    },
    onDragOver: (e: DragEvent) => {
      if (hasFiles(e)) e.preventDefault();
    },
    onDragLeave: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      dragDepth.current = Math.max(0, dragDepth.current - 1);
      if (dragDepth.current === 0) setDragging(false);
    },
    onDrop: (e: DragEvent) => {
      if (!hasFiles(e)) return;
      e.preventDefault();
      dragDepth.current = 0;
      setDragging(false);
      handleImport(e.dataTransfer.files[0]);
    },
  };

  const enter = (i: number) => ({
    initial: { opacity: 0, y: 12 },
    animate: { opacity: 1, y: 0 },
    transition: { duration: 0.5, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] as const },
  });

  const empty = projects?.length === 0;

  return (
    <>
      <SiteNav overlay />
      <div className={styles.shell} {...dropHandlers}>
        <HeroVideo media={media} still />
        <main className={`wrap ${styles.page}`}>
          <header className={styles.header}>
            <div>
              <h1 className={styles.title}>
                {t.common.myProjects}
                {projects && projects.length > 0 && <span className={styles.count}>{projects.length}</span>}
              </h1>
              <p className={styles.note}>{t.projects.note}</p>
            </div>
            {projects && !empty && (
              <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
                <UploadSimple size={16} weight="bold" />
                {t.projects.loadFile}
              </button>
            )}
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
          ) : (
            <ul className={`${styles.grid}${empty ? ` ${styles.gridEmpty}` : ''}`}>
              <motion.li {...enter(0)}>
                <button className={`${styles.tile} ${styles.tileNew}`} onClick={create}>
                  <span className={styles.tileIcon}>
                    <Plus size={20} weight="bold" />
                  </span>
                  <strong>{t.common.newProject}</strong>
                  <span className={styles.tileText}>{t.projects.newText}</span>
                </button>
              </motion.li>

              {empty && (
                <motion.li {...enter(1)}>
                  <button className={`${styles.tile} ${styles.tileDrop}`} onClick={() => fileRef.current?.click()}>
                    <span className={styles.tileIcon}>
                      <UploadSimple size={20} weight="bold" />
                    </span>
                    <strong>{t.projects.dropTitle}</strong>
                    <span className={styles.tileText}>{t.projects.dropText}</span>
                  </button>
                </motion.li>
              )}

              {projects.map((p, i) => (
                <motion.li key={p.id} className={styles.card} {...enter(i + 1)}>
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

        {dragging && (
          <div className={styles.dropOverlay} aria-hidden>
            <UploadSimple size={28} weight="bold" />
            {t.projects.dropHere}
          </div>
        )}
      </div>
    </>
  );
}

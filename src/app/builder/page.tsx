"use client";

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { DownloadSimple, Trash, UploadSimple } from '@phosphor-icons/react';
import { motion } from 'framer-motion';
import SiteNav from '@/components/SiteNav';
import NewProjectButton from '@/components/NewProjectButton';
import PlanThumbnail from '@/components/PlanThumbnail';
import { useAppStore } from '@/store/useAppStore';
import { deleteProject, exportProject, importProjectFile, listProjects, type Project } from '@/lib/projects';
import styles from './projects.module.css';

const rtf = new Intl.RelativeTimeFormat('pl', { numeric: 'auto' });

function timeAgo(iso: string) {
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

function elementsLabel(n: number) {
  if (n === 1) return '1 element';
  const lastDigit = n % 10, lastTwo = n % 100;
  if (lastDigit >= 2 && lastDigit <= 4 && (lastTwo < 12 || lastTwo > 14)) return `${n} elementy`;
  return `${n} elementów`;
}

export default function ProjectsPage() {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const { addNotification } = useAppStore();

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
      addNotification(`Wczytano "${p.name}"`, 'success');
    } catch {
      addNotification('Ten plik nie wygląda na projekt bazy', 'error');
    } finally {
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleDelete = (p: Project) => {
    if (!window.confirm(`Usunąć "${p.name}"? Tego nie da się cofnąć.`)) return;
    deleteProject(p.id);
    setProjects(listProjects());
  };

  const importButton = (
    <button className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
      <UploadSimple size={16} weight="bold" />
      Wczytaj plik
    </button>
  );

  return (
    <>
      <SiteNav />
      <main className={`wrap ${styles.page}`}>
        <header className={styles.header}>
          <div>
            <h1 className={styles.title}>Moje projekty</h1>
            <p className={styles.note}>Zapisane w tej przeglądarce. Eksportuj plik, jeśli chcesz mieć kopię.</p>
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
            <h2>Nie masz jeszcze projektów</h2>
            <p>Utwórz pierwszy albo wczytaj plik .baseplan.json od kogoś z ekipy.</p>
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
                      <span className={styles.thumbEmpty}>Pusty plan</span>
                    )}
                  </div>
                  <div className={styles.meta}>
                    <h2 className={styles.name}>{p.name}</h2>
                    <p className={styles.details}>
                      {elementsLabel(p.items.length)} · {timeAgo(p.updatedAt)}
                    </p>
                  </div>
                </Link>
                <div className={styles.cardActions}>
                  <button className="icon-btn" title="Eksportuj do pliku" onClick={() => exportProject(p)}>
                    <DownloadSimple size={16} weight="bold" />
                  </button>
                  <button className="icon-btn danger" title="Usuń projekt" onClick={() => handleDelete(p)}>
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

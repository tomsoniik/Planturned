"use client";

/*
  Wybór mapy z gry: przy nowym projekcie i z górnego paska edytora. Start zawsze na spawnie z gry.
*/
import { useEffect, useState } from 'react';
import { X } from '@phosphor-icons/react';
import { loadMap, loadMapIndex, mapOverviewUrl, type MapInfo, type Site } from '@/lib/terrain';
import { siteAtSpawn } from './MapPicker';
import { useT } from './I18nProvider';
import styles from './MapChooser.module.css';

export default function MapChooser({
  current,
  onPick,
  onClose,
}: {
  current?: string;
  /** Wybrana mapa (punkt startu na pierwszym spawnie) albo undefined: bez mapy. */
  onPick: (site: Site | undefined) => void;
  onClose?: () => void;
}) {
  const t = useT();
  const [maps, setMaps] = useState<MapInfo[] | null>(null);
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    loadMapIndex().then(setMaps);
  }, []);

  const pick = (id: string) => {
    if (id === current) return onClose?.();
    setBusy(id);
    loadMap(id)
      .then((d) => onPick(siteAtSpawn(d, 0)))
      .finally(() => setBusy(null));
  };

  return (
    <div className={styles.backdrop} onMouseDown={(e) => e.target === e.currentTarget && onClose?.()}>
      <section className={styles.dialog} role="dialog" aria-label={t.mapChooser.title}>
        <header className={styles.head}>
          <div>
            <h2>{t.mapChooser.title}</h2>
            <p>{t.mapChooser.sub}</p>
          </div>
          {onClose && (
            <button className="icon-btn" onClick={onClose} aria-label={t.hud.resume}>
              <X size={16} weight="bold" />
            </button>
          )}
        </header>
        {maps === null ? (
          <p className={styles.muted}>{t.map.loadingList}</p>
        ) : maps.length === 0 ? (
          <div className={styles.muted}>
            <p>{t.map.noMaps}</p>
            <code>npm run export:game</code>
          </div>
        ) : (
          <div className={styles.grid}>
            {maps.map((m) => (
              <button key={m.id} className={styles.map} data-on={current === m.id || undefined} disabled={!!busy} onClick={() => pick(m.id)}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={mapOverviewUrl(m.id)} alt="" loading="lazy" />
                <span>
                  <strong>{m.name}</strong>
                  <em>{busy === m.id ? t.map.loadingList : `${(m.size / 1024).toFixed(m.size < 1024 ? 1 : 0)} km`}</em>
                </span>
              </button>
            ))}
          </div>
        )}
        <footer className={styles.foot}>
          <button className="btn btn-ghost" onClick={() => onPick(undefined)}>
            {t.mapChooser.noMap}
          </button>
        </footer>
      </section>
    </div>
  );
}

"use client";

/*
  Ikona przedmiotu z gry (public/unturned/items/<id>.png), wspólna dla planu 2D, ekwipunku 3D, pasków slotów
  i okna Materiały. Stały rozmiar (siatka nie skacze przy ładowaniu), leniwe ładowanie, a przy błędzie sieci
  szary kwadrat z nazwą zamiast dziury. To tylko zabezpieczenie: każdy przedmiot ma mieć ikonę z gry.
*/
import { useState } from 'react';
import styles from './ItemIcon.module.css';

export default function ItemIcon({ src, name, size, eager = false }: { src: string; name: string; size: number; eager?: boolean }) {
  const [broken, setBroken] = useState<string | null>(null);
  if (broken === src) {
    return (
      <span className={styles.fallback} style={{ width: size, height: size }} title={name} role="img" aria-label={name}>
        {name}
      </span>
    );
  }
  return (
    // eslint-disable-next-line @next/next/no-img-element
    <img
      className={styles.icon}
      src={src}
      alt=""
      width={size}
      height={size}
      loading={eager ? 'eager' : 'lazy'}
      decoding="async"
      draggable={false}
      onError={() => setBroken(src)}
    />
  );
}

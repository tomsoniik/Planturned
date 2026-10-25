"use client";

import { useEffect, useRef, useState } from 'react';
import { useReducedMotion } from 'framer-motion';
import type { Media } from '@/lib/cms/schema';
import styles from './HeroVideo.module.css';

/*
  Tło stron: film z YouTube (ustawiany w panelu /admin, domyślnie oficjalny zwiastun Unturned).
  Film zostaje na YouTube, u nas jest tylko embed. Pętla po fragmencie start-end.
*/
interface YTPlayer {
  seekTo(seconds: number, allowSeekAhead: boolean): void;
  playVideo(): void;
  destroy(): void;
}

interface YTNamespace {
  Player: new (el: HTMLElement, opts: object) => YTPlayer;
}

declare global {
  interface Window {
    YT?: YTNamespace;
    onYouTubeIframeAPIReady?: () => void;
  }
}

let apiPromise: Promise<YTNamespace> | null = null;

function loadApi(): Promise<YTNamespace> {
  if (window.YT?.Player) return Promise.resolve(window.YT);
  apiPromise ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve(window.YT!);
    const script = document.createElement('script');
    script.src = 'https://www.youtube.com/iframe_api';
    document.head.appendChild(script);
  });
  return apiPromise;
}

/** still: tylko kadr, bez odtwarzacza (podstrony: lista projektów, changelog). */
export default function HeroVideo({ media, still }: { media: Media; still?: boolean }) {
  const { videoId, start, end, poster } = media;
  const reduce = useReducedMotion();
  const host = useRef<HTMLDivElement>(null);
  const [playing, setPlaying] = useState(false);

  useEffect(() => {
    // Sama klatka przy ograniczonych animacjach, oszczędzaniu danych i na telefonie (dane, bateria)
    const saveData = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData;
    const phone = window.matchMedia('(max-width: 767px)').matches;
    if (still || reduce || saveData || phone || !host.current) return;

    let player: YTPlayer | null = null;
    let cancelled = false;
    const el = document.createElement('div');
    host.current.appendChild(el);

    loadApi().then((YT) => {
      if (cancelled) return;
      player = new YT.Player(el, {
        host: 'https://www.youtube-nocookie.com',
        videoId,
        playerVars: {
          autoplay: 1, mute: 1, controls: 0, disablekb: 1, playsinline: 1,
          rel: 0, iv_load_policy: 3, fs: 0, start, ...(end > 0 && { end }),
        },
        events: {
          onReady: (e: { target: YTPlayer }) => e.target.playVideo(),
          onStateChange: (e: { data: number; target: YTPlayer }) => {
            // 1 = gra, 0 = koniec fragmentu (end albo koniec filmu)
            if (e.data === 1) setPlaying(true);
            if (e.data === 0) {
              e.target.seekTo(start, true);
              e.target.playVideo();
            }
          },
        },
      });
    });

    return () => {
      cancelled = true;
      player?.destroy();
      el.remove();
    };
  }, [still, reduce, videoId, start, end]);

  return (
    <div className={styles.video} aria-hidden>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={poster || `https://i.ytimg.com/vi/${videoId}/maxresdefault.jpg`} alt="" className={styles.videoPoster} />
      <div ref={host} className={styles.videoFrame} data-playing={playing || undefined} />
    </div>
  );
}

"use client";

/*
  Menu Esc > Ustawienia: czułość myszy, pole widzenia, odwrócenie osi Y, głośność i wyciszenie.
  Zapis lokalnie u użytkownika (lib/settings3d), zmiana działa od razu.
*/
import { FOV_RANGE, SENSITIVITY_RANGE, useSettings3D } from '@/lib/settings3d';
import { useT } from './I18nProvider';
import hud from './Hud3D.module.css';
import styles from './Settings3DPanel.module.css';

export default function Settings3DPanel() {
  const t = useT();
  const s = useSettings3D();
  return (
    <>
      <label className={hud.setting}>
        <span>{t.settings3d.sensitivity}</span>
        <span className={styles.slider}>
          <input
            type="range"
            min={SENSITIVITY_RANGE[0]}
            max={SENSITIVITY_RANGE[1]}
            step={0.05}
            value={s.sensitivity}
            onChange={(e) => s.set({ sensitivity: Number(e.target.value) })}
          />
          <output>{s.sensitivity.toFixed(2)}x</output>
        </span>
      </label>
      <label className={hud.setting}>
        <span>{t.settings3d.fov}</span>
        <span className={styles.slider}>
          <input type="range" min={FOV_RANGE[0]} max={FOV_RANGE[1]} step={1} value={s.fov} onChange={(e) => s.set({ fov: Number(e.target.value) })} />
          <output>{s.fov}°</output>
        </span>
      </label>
      <label className={hud.setting}>
        <span>{t.settings3d.invertY}</span>
        <input type="checkbox" role="switch" className={hud.switch} checked={s.invertY} onChange={(e) => s.set({ invertY: e.target.checked })} />
      </label>
      <label className={hud.setting}>
        <span>{t.settings3d.volume}</span>
        <span className={styles.slider}>
          <input
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={s.volume}
            disabled={s.muted}
            onChange={(e) => s.set({ volume: Number(e.target.value) })}
          />
          <output>{Math.round(s.volume * 100)}%</output>
        </span>
      </label>
      <label className={hud.setting}>
        <span>{t.settings3d.mute}</span>
        <input type="checkbox" role="switch" className={hud.switch} checked={s.muted} onChange={(e) => s.set({ muted: e.target.checked })} />
      </label>
      <button className={styles.reset} onClick={s.reset}>
        {t.settings3d.reset}
      </button>
    </>
  );
}

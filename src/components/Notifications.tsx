"use client";

import React from 'react';
import { CheckCircle, Info, WarningCircle } from '@phosphor-icons/react';
import { useAppStore } from '@/store/useAppStore';
import styles from './Notifications.module.css';

const ICONS = {
  success: CheckCircle,
  error: WarningCircle,
  info: Info,
};

export default function Notifications() {
  const { notifications, removeNotification } = useAppStore();

  return (
    <div className={styles.stack} aria-live="polite">
      {notifications.map((notif) => {
        const Icon = ICONS[notif.type];
        return (
          <button
            key={notif.id}
            className={styles.toast}
            data-type={notif.type}
            onClick={() => removeNotification(notif.id)}
          >
            <Icon size={16} weight="bold" />
            {notif.message}
          </button>
        );
      })}
    </div>
  );
}

import { normalizeItemId, type PlacedItem } from './builder';
import type { Site } from './terrain';
import type { SceneSettings } from './scene';

export interface Project {
  id: string;
  name: string;
  description: string;
  items: PlacedItem[];
  /** Miejsce bazy na mapie z gry (opcjonalne). */
  site?: Site;
  /** Pora dnia i tryb bazy (ziemia / skybase) w 3D. */
  scene?: SceneSettings;
  /** Pasek 9 slotów (id elementów, null = pusty). Brak: domyślny pasek. */
  hotbar?: (string | null)[];
  createdAt: string;
  updatedAt: string;
}

const STORAGE_KEY = 'baseplanner:projects';
const LEGACY_KEY = 'builder_local_projects';

function readAll(): Project[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      // Stare identyfikatory klocków (f_square, c_wall...) mapujemy na struktury z gry.
      return (JSON.parse(raw) as Project[]).map((p) => ({
        ...p,
        items: p.items.map((i) => ({ ...i, itemId: normalizeItemId(i.itemId) })),
      }));
    }

    // Jednorazowa migracja projektów ze starej wersji (dane jako string JSON).
    const legacy = localStorage.getItem(LEGACY_KEY);
    if (!legacy) return [];
    type LegacyProject = { id: string; name?: string; description?: string; data?: string | PlacedItem[]; updatedAt?: string };
    const migrated: Project[] = (JSON.parse(legacy) as LegacyProject[]).map((p) => ({
      id: p.id,
      name: p.name || 'Projekt',
      description: p.description || '',
      items: typeof p.data === 'string' ? JSON.parse(p.data) : p.data || [],
      createdAt: p.updatedAt || new Date().toISOString(),
      updatedAt: p.updatedAt || new Date().toISOString(),
    }));
    writeAll(migrated);
    return migrated;
  } catch {
    return [];
  }
}

function writeAll(list: Project[]) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch {
    // brak miejsca / tryb prywatny: projekt zostaje tylko w pamięci karty
  }
}

export function listProjects(): Project[] {
  return readAll().sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export function getProject(id: string): Project | undefined {
  return readAll().find((p) => p.id === id);
}

export function createProject(partial: Partial<Project> = {}): Project {
  const list = readAll();
  const now = new Date().toISOString();
  const project: Project = {
    id: `p-${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`,
    name: partial.name || `Baza ${list.length + 1}`,
    description: partial.description || '',
    items: partial.items || [],
    site: partial.site,
    scene: partial.scene,
    hotbar: partial.hotbar,
    createdAt: now,
    updatedAt: now,
  };
  writeAll([project, ...list]);
  return project;
}

export function updateProject(id: string, updates: Partial<Omit<Project, 'id'>>) {
  const list = readAll();
  const idx = list.findIndex((p) => p.id === id);
  if (idx === -1) return;
  list[idx] = { ...list[idx], ...updates, updatedAt: new Date().toISOString() };
  writeAll(list);
}

export function deleteProject(id: string) {
  writeAll(readAll().filter((p) => p.id !== id));
}

const FILE_VERSION = 1;

export function exportProject(project: Project) {
  const payload = {
    format: 'baseplanner',
    version: FILE_VERSION,
    name: project.name,
    description: project.description,
    items: project.items,
    site: project.site,
    scene: project.scene,
    hotbar: project.hotbar,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `${project.name.replace(/[^\p{L}\p{N}_-]+/gu, '_') || 'baza'}.baseplan.json`;
  a.click();
  URL.revokeObjectURL(url);
}

export async function importProjectFile(file: File): Promise<Project> {
  const data = JSON.parse(await file.text());
  // Akceptujemy nasz format oraz goły array PlacedItem.
  const items: unknown = Array.isArray(data) ? data : data?.items;
  if (!Array.isArray(items) || items.some((i) => typeof i?.itemId !== 'string')) {
    throw new Error('Nieprawidłowy plik projektu');
  }
  return createProject({
    name: data?.name ? `${data.name} (import)` : file.name.replace(/\..*$/, ''),
    description: data?.description || '',
    items: items as PlacedItem[],
    site: data?.site,
    scene: data?.scene,
    hotbar: Array.isArray(data?.hotbar) ? data.hotbar : undefined,
  });
}

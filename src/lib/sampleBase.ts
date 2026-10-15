import type { PlacedItem } from './builder';

/**
 * Przykładowa baza 4x3 (strona główna): klonowe podłogi i ściany, drzwi, okna,
 * metalowe filary i dach nad połową, łóżko w środku.
 */
function buildSample(): PlacedItem[] {
  const items: PlacedItem[] = [];
  let n = 0;
  const add = (itemId: string, x: number, y: number, rotation = 0) =>
    items.push({ id: `s${n++}`, itemId, x, y, rotation, floor: 0 });

  const cols = [-90, -30, 30, 90];
  const rows = [-60, 0, 60];

  cols.forEach((x) => rows.forEach((y) => add('maple_floor', x, y)));

  cols.forEach((x) => {
    add(x === 30 ? 'maple_window' : 'maple_wall', x, -90);
    add(x === -30 ? 'maple_doorway' : 'maple_wall', x, 90);
  });
  rows.forEach((y) => {
    add(y === 0 ? 'maple_window' : 'maple_wall', -120, y, 90);
    add('maple_wall', 120, y, 90);
  });

  [-120, -60, 0, 60, 120].forEach((x) => {
    add('metal_pillar', x, -90);
    add('metal_pillar', x, 90);
  });
  [-30, 30].forEach((y) => {
    add('metal_pillar', -120, y);
    add('metal_pillar', 120, y);
  });

  [30, 90].forEach((x) => rows.forEach((y) => add(x === 90 && y === 0 ? 'metal_hole' : 'metal_roof', x, y)));

  add('bed', -60, 0);
  return items;
}

export const SAMPLE_BASE = buildSample();

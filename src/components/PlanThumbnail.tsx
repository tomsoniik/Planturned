import { BED_CLAIM_RADIUS, findDef, getPolygonVertices, isRoofLayer, type BuildItem, type PlacedItem } from '@/lib/builder';

interface Props {
  items: PlacedItem[];
  showClaim?: boolean;
  className?: string;
  /** Margines wokół bazy w jednostkach planu. */
  padding?: number;
}

const layer = (def: BuildItem) =>
  isRoofLayer(def) ? 4 : def.shape === 'hatch' ? 5 : def.shape === 'pillar' ? 3 : def.shape === 'wall' ? 2 : def.shape === 'bed' ? 1 : 0;

/** Statyczny rzut 2D projektu jako SVG (miniatury, podglądy). */
export default function PlanThumbnail({ items, showClaim = false, className, padding = 24 }: Props) {
  if (items.length === 0) {
    return <svg className={className} viewBox="0 0 100 60" aria-hidden />;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  items.forEach((i) => {
    const isBed = findDef(i.itemId)?.shape === 'bed';
    const r = isBed && showClaim ? BED_CLAIM_RADIUS : 35;
    minX = Math.min(minX, i.x - r);
    minY = Math.min(minY, i.y - r);
    maxX = Math.max(maxX, i.x + r);
    maxY = Math.max(maxY, i.y + r);
  });
  const vb = [minX - padding, minY - padding, maxX - minX + padding * 2, maxY - minY + padding * 2];

  const maxFloor = Math.max(...items.map((i) => i.floor || 0));
  const drawable = items
    .map((item) => ({ item, def: findDef(item.itemId) }))
    .filter((d): d is { item: PlacedItem; def: BuildItem } => !!d.def)
    .sort((a, b) => (a.item.floor || 0) - (b.item.floor || 0) || layer(a.def) - layer(b.def));

  return (
    <svg className={className} viewBox={vb.join(' ')} role="img" aria-label="Rzut bazy">
      {showClaim &&
        drawable
          .filter(({ def }) => def.shape === 'bed')
          .map(({ item }) => (
            <circle
              key={`claim-${item.id}`}
              cx={item.x}
              cy={item.y}
              r={BED_CLAIM_RADIUS}
              fill="var(--accent-soft)"
              stroke="var(--accent)"
              strokeWidth={2}
              strokeDasharray="8 8"
            />
          ))}
      {drawable.map(({ item, def }) => {
        const fill = item.customColor || def.color;
        const dim = (item.floor || 0) < maxFloor ? 0.55 : 1;
        const rot = `rotate(${item.rotation} ${item.x} ${item.y})`;

        switch (def.shape) {
          case 'bed':
            return <rect key={item.id} x={item.x - 10} y={item.y - 20} width={20} height={40} rx={4} fill={fill} transform={rot} />;
          case 'pillar': {
            const r = def.part === 'post' ? 3.5 : 5;
            return <rect key={item.id} x={item.x - r} y={item.y - r} width={r * 2} height={r * 2} fill={fill} stroke="var(--bg)" strokeWidth={1.5} />;
          }
          case 'hatch':
            return <rect key={item.id} x={item.x - 11} y={item.y - 11} width={22} height={22} fill={fill} stroke="var(--bg)" strokeWidth={1.5} transform={rot} />;
          case 'wall': {
            const h = def.part === 'rampart' ? 3 : 5;
            if (def.part === 'doorway' || def.part === 'garage') {
              const w = def.part === 'doorway' ? 21.6 : 7.8;
              return (
                <g key={item.id} transform={rot} fill={fill} stroke="var(--bg)" strokeWidth={1}>
                  <rect x={item.x - 30} y={item.y - h / 2} width={w} height={h} />
                  <rect x={item.x + 30 - w} y={item.y - h / 2} width={w} height={h} />
                </g>
              );
            }
            return (
              <rect
                key={item.id}
                x={item.x - 30}
                y={item.y - h / 2}
                width={60}
                height={h}
                fill={fill}
                fillOpacity={def.part === 'ramp_wall' ? 0.6 : 1}
                stroke="var(--bg)"
                strokeWidth={1}
                transform={rot}
              />
            );
          }
          default: {
            const pts = getPolygonVertices(def.shape, item.x, item.y, item.rotation);
            const roof = isRoofLayer(def);
            return (
              <g key={item.id}>
                <polygon
                  points={pts.map((p) => `${p.x},${p.y}`).join(' ')}
                  fill={fill}
                  fillOpacity={dim * (roof ? 0.7 : 1)}
                  stroke="var(--bg)"
                  strokeWidth={1.5}
                />
                {def.part === 'tri_hole' && (
                  <rect x={item.x - 7} y={item.y - 7} width={14} height={14} fill="var(--bg)" transform={rot} />
                )}
                {def.part === 'hole' && (
                  <rect x={item.x - 12} y={item.y - 12} width={24} height={24} fill="var(--bg)" transform={rot} />
                )}
              </g>
            );
          }
        }
      })}
    </svg>
  );
}

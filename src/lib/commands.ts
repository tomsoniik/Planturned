/*
  Komendy czatu w 3D (jak w Unturned i Minecrafcie): składnia, podpowiedzi i parsowanie.
  Wykonanie siedzi w edytorze, bo zmienia stan projektu (pora dnia, skybase, pasek, elementy).
*/
import { SKY_HEIGHTS } from './scene';

export const COMMAND_IDS = ['help', 'time', 'skybase', 'sky', 'ground', 'spawn', 'fly', 'walk', 'orbit', 'tp', 'pos', 'beds', 'give', 'screenshot', '2d', 'undo', 'redo', 'clear'] as const;
export type CommandId = (typeof COMMAND_IDS)[number];

export const COMMAND_USAGE: Record<CommandId, string> = {
  help: '/help',
  time: '/time day|dusk|night',
  skybase: '/skybase',
  sky: '/sky <m>',
  ground: '/ground',
  spawn: '/spawn [n]',
  fly: '/fly',
  walk: '/walk',
  orbit: '/orbit',
  tp: '/tp <x> <z>',
  pos: '/pos',
  beds: '/beds [on|off]',
  give: '/give <element> [slot]',
  screenshot: '/screenshot',
  '2d': '/2d',
  undo: '/undo',
  redo: '/redo',
  clear: '/clear',
};

const TAKES_ARGS = new Set<CommandId>(['time', 'sky', 'tp', 'beds', 'give']);

export const isCommandId = (v: string): v is CommandId => (COMMAND_IDS as readonly string[]).includes(v);

/** "/give metal wall 3" -> { name: 'give', args: ['metal', 'wall', '3'] }; null, gdy tekst nie jest komendą. */
export function parseCommand(text: string): { name: string; args: string[] } | null {
  const s = text.trim();
  if (!s.startsWith('/')) return null;
  const [name = '', ...args] = s.slice(1).split(/\s+/);
  return { name: name.toLowerCase(), args };
}

export interface Suggestion {
  /** Co pokazać na liście. */
  label: string;
  /** Tekst pola po wybraniu (Tab). */
  complete: string;
}

/** Podpowiedzi dla wpisanego tekstu: nazwy komend, a dalej wartości argumentów. */
export function suggest(input: string, itemIds: string[]): Suggestion[] {
  if (!input.startsWith('/')) return [];
  const parts = input.slice(1).split(' ');
  if (parts.length === 1) {
    const q = parts[0].toLowerCase();
    return COMMAND_IDS.filter((id) => id.startsWith(q)).map((id) => ({
      label: COMMAND_USAGE[id],
      complete: `/${id}${TAKES_ARGS.has(id) ? ' ' : ''}`,
    }));
  }
  const cmd = parts[0].toLowerCase();
  const argIndex = parts.length - 2;
  const q = parts[parts.length - 1].toLowerCase();
  const head = `/${parts.slice(0, -1).join(' ')} `;
  let options: string[] = [];
  if (cmd === 'time' && argIndex === 0) options = ['day', 'dusk', 'night'];
  if (cmd === 'beds' && argIndex === 0) options = ['on', 'off'];
  if (cmd === 'sky' && argIndex === 0) options = SKY_HEIGHTS.map(String);
  if (cmd === 'give' && argIndex === 0) options = itemIds;
  if (cmd === 'give' && argIndex === 1) options = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];
  return options
    .filter((o) => o.toLowerCase().includes(q) && o.toLowerCase() !== q)
    .sort((a, b) => Number(!a.startsWith(q)) - Number(!b.startsWith(q)))
    .slice(0, 6)
    .map((o) => ({ label: o, complete: `${head}${o} ` }));
}

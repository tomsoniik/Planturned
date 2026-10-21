'use server';

import { revalidatePath } from 'next/cache';
import { requireAdmin } from '@/lib/cms/auth';
import { resetContent, setContent } from '@/lib/cms/store';
import { CmsError, type CmsKey } from '@/lib/cms/schema';

export interface SaveResult {
  ok: boolean;
  message: string;
}

const KEYS: CmsKey[] = ['changelog', 'media', 'links', 'seo'];

/**
 * Jeden zapis dla każdej sekcji panelu: formularz wysyła klucz i JSON w polu "data".
 * Sesja sprawdzana tutaj, bo server action da się wywołać zwykłym POST-em.
 */
export async function saveContent(_prev: SaveResult | null, form: FormData): Promise<SaveResult> {
  await requireAdmin();
  const key = form.get('key') as CmsKey;
  if (!KEYS.includes(key)) return { ok: false, message: 'Nieznana sekcja' };

  try {
    if (form.get('mode') === 'reset') {
      await resetContent(key);
    } else {
      await setContent(key, JSON.parse(String(form.get('data') ?? 'null')));
    }
  } catch (e) {
    if (e instanceof CmsError) return { ok: false, message: e.message };
    if (e instanceof SyntaxError) return { ok: false, message: 'Uszkodzone dane formularza' };
    console.error('[cms] zapis nie powiódł się', e);
    return { ok: false, message: 'Zapis nie powiódł się. Spróbuj ponownie.' };
  }

  // Wszystkie strony czytają CMS przy renderze; odświeżamy cały layout
  revalidatePath('/', 'layout');
  return { ok: true, message: form.get('mode') === 'reset' ? 'Przywrócono domyślne' : 'Zapisano' };
}

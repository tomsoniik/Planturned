import type { Metadata } from 'next';
import { getContent } from '@/lib/cms/store';
import { getDict } from '@/lib/i18n-server';
import SiteFooter from '@/components/SiteFooter';
import ProjectsClient from './ProjectsClient';

export async function generateMetadata(): Promise<Metadata> {
  const t = await getDict();
  return { title: `${t.common.myProjects} - Untmatica`, alternates: { canonical: '/builder' } };
}

/** Lista projektów działa w przeglądarce (localStorage); serwer dokłada tylko tło z CMS. */
export default async function ProjectsPage() {
  return (
    <>
      <ProjectsClient media={await getContent('media')} />
      <SiteFooter />
    </>
  );
}

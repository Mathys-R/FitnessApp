// src/app/(protected)/catalogs/page.tsx
import { PageHeader } from '@/components/layout/PageHeader';

export default function CatalogsPage() {
  return (
    <div className="flex flex-col">
      <PageHeader title="Catalogues" subtitle="Aliments & Exercices" />
      <div className="p-4">
        <div className="ios-card space-y-2 p-6 text-center">
          <p className="text-sm font-medium text-white">Module Catalogues</p>
          <p className="text-xs text-[#8E8E93]">
            Base de données d&apos;exercices et d&apos;aliments partagés entre partenaires.
          </p>
        </div>
      </div>
    </div>
  );
}


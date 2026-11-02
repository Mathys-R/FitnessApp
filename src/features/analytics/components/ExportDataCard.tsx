// src/features/analytics/components/ExportDataCard.tsx
'use client';

import { useRef, useState } from 'react';
import { toast } from 'sonner';
import { Download, FileJson, FileSpreadsheet, Loader2 } from 'lucide-react';
import { exportUserDataCsvBundle, exportUserDataJson, type CsvExportBundle } from '@/features/analytics/services/export.service';
import { buildCsvBlobContent, saveTextFile, type SaveFileMimeType } from '@/features/analytics/utils/file-save.utils';
import { getLocalTodayIso } from '@/lib/date.utils';

export interface ExportDataCardProps {
  className?: string;
}

interface PreparedExports {
  csv: CsvExportBundle;
  json: string;
}

interface ExportFileButton {
  key: string;
  label: string;
  filename: string;
  mimeType: SaveFileMimeType;
  getContent: (data: PreparedExports) => string;
}

const CSV_MIME: SaveFileMimeType = 'text/csv;charset=utf-8';
function buildFileButtons(todayIso: string): ExportFileButton[] {
  return [
    { key: 'daily', label: 'Poids & objectifs', filename: 'daily_logs.csv', mimeType: CSV_MIME, getContent: (d) => buildCsvBlobContent(d.csv.dailyLogsCsv) },
    { key: 'nutrition', label: 'Nutrition', filename: 'nutrition_history.csv', mimeType: CSV_MIME, getContent: (d) => buildCsvBlobContent(d.csv.nutritionHistoryCsv) },
    { key: 'workout', label: 'Musculation', filename: 'workout_history.csv', mimeType: CSV_MIME, getContent: (d) => buildCsvBlobContent(d.csv.workoutHistoryCsv) },
    { key: 'json', label: 'Sauvegarde complète', filename: `fitness_backup_${todayIso}.json`, mimeType: 'application/json', getContent: (d) => d.json },
  ];
}

export function ExportDataCard({ className }: ExportDataCardProps) {
  const [prepared, setPrepared] = useState<PreparedExports | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const loadingRef = useRef(false);
  const savingRef = useRef(false);

  const handlePrepare = async () => {
    if (loadingRef.current) return; // anti double-tap
    loadingRef.current = true;
    setIsLoading(true);
    try {
      const [csv, json] = await Promise.all([exportUserDataCsvBundle(), exportUserDataJson()]);
      setPrepared({ csv, json });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de la préparation des exports');
      setPrepared(null);
    } finally {
      loadingRef.current = false;
      setIsLoading(false);
    }
  };

  // Données déjà en mémoire → saveTextFile appelé de façon synchrone dans le geste (activation iOS préservée)
  const handleSave = (btn: ExportFileButton) => {
    if (!prepared || savingRef.current) return;
    savingRef.current = true;
    setSavingKey(btn.key);
    saveTextFile({ filename: btn.filename, content: btn.getContent(prepared), mimeType: btn.mimeType })
      .then((outcome) => {
        if (outcome !== 'cancelled') toast.success(`${btn.filename} exporté`);
      })
      .catch(() => toast.error(`Échec de l'export ${btn.filename}`))
      .finally(() => {
        savingRef.current = false;
        setSavingKey(null);
      });
  };

  return (
    <section className={`ios-card p-4 space-y-3 ${className ?? ''}`}>
      <div>
        <h2 className="text-base font-semibold text-white">Exporter mes données</h2>
        <p className="text-xs text-[#8E8E93] mt-0.5">3 fichiers CSV (Excel / Numbers) + sauvegarde complète JSON</p>
      </div>

      {!prepared ? (
        <button
          type="button"
          onClick={handlePrepare}
          disabled={isLoading}
          aria-busy={isLoading}
          className="w-full min-h-[44px] rounded-xl bg-[#0A84FF] text-white font-semibold flex items-center justify-center gap-2 active:scale-[0.98] transition-transform disabled:opacity-60"
        >
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" aria-hidden /> : <Download className="h-5 w-5" aria-hidden />}
          {isLoading ? 'Préparation…' : 'Préparer mes exports'}
        </button>
      ) : (
        <div className="space-y-2">
          {buildFileButtons(getLocalTodayIso()).map((btn) => (
            <button
              key={btn.key}
              type="button"
              onClick={() => handleSave(btn)}
              disabled={savingKey !== null}
              className="w-full min-h-[44px] rounded-xl bg-[#2C2C2E] border border-[#38383A] px-3 text-left text-white flex items-center gap-3 active:scale-[0.99] transition-transform disabled:opacity-60"
            >
              {btn.mimeType === 'application/json'
                ? <FileJson className="h-5 w-5 shrink-0 text-[#0A84FF]" aria-hidden />
                : <FileSpreadsheet className="h-5 w-5 shrink-0 text-[#30D158]" aria-hidden />}
              <span className="flex-1 text-sm font-medium">
                {btn.label} <span className="text-[#8E8E93]">({btn.filename})</span>
              </span>
              {savingKey === btn.key && <Loader2 className="h-4 w-4 animate-spin text-[#8E8E93]" aria-hidden />}
            </button>
          ))}
          <p className="text-xs text-[#8E8E93] pt-1">Sur iPhone : Partager → Enregistrer dans Fichiers</p>
        </div>
      )}
    </section>
  );
}

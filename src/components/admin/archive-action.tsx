'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Button, Modal } from '@/components/ui';
import { archiveOldRides } from '@/lib/actions/rides-v2';

// =============================================================================
// TYPES
// =============================================================================

interface ArchiveActionProps {
  /** Number of archivable rides (displayed for informational purposes) */
  archivableCount: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ArchiveAction({ archivableCount }: ArchiveActionProps) {
  const router = useRouter();
  const [months, setMonths] = useState(12);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ archivedCount: number; deletedLogCount: number } | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleArchive = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const archiveResult = await archiveOldRides(months);
      setResult(archiveResult);
      setShowConfirm(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler bei der Archivierung');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* Info about archivable data */}
      {archivableCount > 0 && (
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Aktuell {archivableCount} Fahrt{archivableCount !== 1 ? 'en' : ''} aelter als 6 Monate vorhanden.
        </p>
      )}

      {/* Month Selection */}
      <div className="flex items-end gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            Archiviere Fahrten aelter als
          </label>
          <select
            value={months}
            onChange={(e) => setMonths(parseInt(e.target.value))}
            className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                     bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
          >
            <option value={6}>6 Monate</option>
            <option value={12}>12 Monate</option>
            <option value={24}>24 Monate</option>
            <option value={36}>36 Monate</option>
          </select>
        </div>

        <Button
          onClick={() => setShowConfirm(true)}
          variant="danger"
          disabled={loading}
        >
          Archivierung starten
        </Button>
      </div>

      {/* Success Result */}
      {result && (
        <div className="p-4 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <p className="text-sm font-medium text-green-700 dark:text-green-400">
            Archivierung erfolgreich abgeschlossen
          </p>
          <ul className="mt-2 text-sm text-green-600 dark:text-green-300 space-y-1">
            <li>{result.archivedCount} Fahrt(en) archiviert/storniert</li>
            <li>{result.deletedLogCount} Log-Eintraege geloescht</li>
          </ul>
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {/* Confirmation Modal */}
      <Modal
        isOpen={showConfirm}
        onClose={() => setShowConfirm(false)}
        title="Archivierung bestaetigen"
      >
        <div className="space-y-4">
          <p className="text-sm text-gray-600 dark:text-gray-400">
            Sind Sie sicher, dass Sie alle Fahrten aelter als <strong>{months} Monate</strong> archivieren moechten?
          </p>

          <div className="p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-xl">
            <p className="text-sm text-yellow-700 dark:text-yellow-400">
              <strong>Achtung:</strong> Geplante und bestaetigte Fahrten werden storniert.
              Abgeschlossene Fahrten bleiben erhalten. System-Logs aelter als 30 Tage werden geloescht.
              Dieser Vorgang kann nicht rueckgaengig gemacht werden.
            </p>
          </div>

          <div className="flex gap-3">
            <Button
              onClick={handleArchive}
              variant="danger"
              disabled={loading}
            >
              {loading ? 'Archivierung laeuft...' : 'Archivierung durchfuehren'}
            </Button>
            <Button
              onClick={() => setShowConfirm(false)}
              variant="ghost"
              disabled={loading}
            >
              Abbrechen
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}

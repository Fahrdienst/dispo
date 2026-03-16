'use client';

import { useState } from 'react';
import { Modal, Button } from '@/components/ui';
import type { RecurrenceEditScope } from '@/lib/actions/rides-v2';

// =============================================================================
// TYPES
// =============================================================================

interface RecurrenceEditModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (scope: RecurrenceEditScope) => void;
  mode: 'edit' | 'cancel';
  loading?: boolean;
  /** Number of future rides in the series (for informational display) */
  futureCount?: number;
  /** Total rides in the series */
  totalCount?: number;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function RecurrenceEditModal({
  isOpen,
  onClose,
  onConfirm,
  mode,
  loading = false,
  futureCount,
  totalCount,
}: RecurrenceEditModalProps) {
  const [selectedScope, setSelectedScope] = useState<RecurrenceEditScope>('single');

  const title = mode === 'edit'
    ? 'Wiederkehrende Fahrt bearbeiten'
    : 'Wiederkehrende Fahrt stornieren';

  const description = mode === 'edit'
    ? 'Wie sollen die Aenderungen angewendet werden?'
    : 'Welche Fahrten sollen storniert werden?';

  const confirmLabel = mode === 'edit' ? 'Aendern' : 'Stornieren';
  const confirmVariant = mode === 'cancel' ? 'danger' : 'primary';

  const scopeOptions: { value: RecurrenceEditScope; label: string; description: string }[] = [
    {
      value: 'single',
      label: 'Nur diese Fahrt',
      description: 'Nur die ausgewaehlte Fahrt wird geaendert.',
    },
    {
      value: 'this_and_future',
      label: 'Diese und alle zukuenftigen',
      description: futureCount !== undefined
        ? `${futureCount} zukuenftige Fahrt${futureCount !== 1 ? 'en' : ''} werden betroffen.`
        : 'Alle zukuenftigen Fahrten dieser Serie werden geaendert.',
    },
    {
      value: 'all',
      label: 'Alle Fahrten der Serie',
      description: totalCount !== undefined
        ? `${totalCount} Fahrt${totalCount !== 1 ? 'en' : ''} in der Serie (abgeschlossene Fahrten bleiben unberuehrt).`
        : 'Alle Fahrten der Serie werden geaendert (abgeschlossene bleiben unberuehrt).',
    },
  ];

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className="space-y-4">
        <p className="text-sm text-gray-600 dark:text-gray-400">{description}</p>

        <div className="space-y-2">
          {scopeOptions.map((option) => (
            <label
              key={option.value}
              className={`flex items-start gap-3 p-3 rounded-xl border cursor-pointer transition-colors ${
                selectedScope === option.value
                  ? 'border-blue-500 bg-blue-50 dark:bg-blue-900/20'
                  : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
              }`}
            >
              <input
                type="radio"
                name="recurrenceScope"
                value={option.value}
                checked={selectedScope === option.value}
                onChange={() => setSelectedScope(option.value)}
                className="mt-0.5 text-blue-600 focus:ring-blue-500"
              />
              <div>
                <span className="text-sm font-medium text-gray-900 dark:text-white">
                  {option.label}
                </span>
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                  {option.description}
                </p>
              </div>
            </label>
          ))}
        </div>

        {mode === 'cancel' && selectedScope !== 'single' && (
          <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
            <p className="text-sm text-red-700 dark:text-red-400">
              Bereits abgeschlossene Fahrten werden nicht storniert.
            </p>
          </div>
        )}

        <div className="flex gap-3 pt-2">
          <Button
            onClick={() => onConfirm(selectedScope)}
            disabled={loading}
            variant={confirmVariant as 'primary' | 'danger'}
          >
            {loading ? 'Wird ausgefuehrt...' : confirmLabel}
          </Button>
          <Button
            onClick={onClose}
            variant="ghost"
            disabled={loading}
          >
            Abbrechen
          </Button>
        </div>
      </div>
    </Modal>
  );
}

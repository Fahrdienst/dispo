'use client';

import { useState, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { Button } from '@/components/ui';
import { RecurrenceEditModal } from './recurrence-edit-modal';
import {
  cancelRecurringRides,
  countRecurrenceGroupRides,
  type RecurrenceEditScope,
} from '@/lib/actions/rides-v2';

// =============================================================================
// TYPES
// =============================================================================

interface RecurrenceActionsProps {
  rideId: string;
  recurrenceGroup: string;
  rideStatus: string;
}

// =============================================================================
// COMPONENT
// =============================================================================

/**
 * Client component that adds recurrence-aware edit/cancel actions
 * to the ride detail page. Shows recurrence info badge and provides
 * modals for scope selection.
 */
export function RecurrenceActions({ rideId, recurrenceGroup, rideStatus }: RecurrenceActionsProps) {
  const router = useRouter();
  const [showCancelModal, setShowCancelModal] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [futureCount, setFutureCount] = useState<number | undefined>(undefined);
  const [totalCount, setTotalCount] = useState<number | undefined>(undefined);

  const canCancel = rideStatus !== 'completed' && rideStatus !== 'cancelled';

  // Load series counts
  const loadCounts = useCallback(async () => {
    try {
      const [future, total] = await Promise.all([
        countRecurrenceGroupRides(recurrenceGroup, 'future'),
        countRecurrenceGroupRides(recurrenceGroup, 'all'),
      ]);
      setFutureCount(future);
      setTotalCount(total);
    } catch {
      // Silently fail - counts are informational only
    }
  }, [recurrenceGroup]);

  useEffect(() => {
    loadCounts();
  }, [loadCounts]);

  const handleCancel = async (scope: RecurrenceEditScope) => {
    setLoading(true);
    setError(null);

    try {
      const result = await cancelRecurringRides(rideId, scope);
      setSuccess(`${result.cancelledCount} Fahrt${result.cancelledCount !== 1 ? 'en' : ''} storniert`);
      setShowCancelModal(false);

      setTimeout(() => {
        router.refresh();
      }, 500);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Fehler beim Stornieren');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-3">
      {/* Series Info Badge */}
      <div className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
        </svg>
        <span>
          Teil einer Serie
          {totalCount !== undefined && ` (${totalCount} Fahrten)`}
        </span>
      </div>

      {/* Messages */}
      {error && (
        <div className="p-3 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-xl">
          <p className="text-sm text-red-700 dark:text-red-400">{error}</p>
        </div>
      )}

      {success && (
        <div className="p-3 bg-green-50 dark:bg-green-900/20 border border-green-200 dark:border-green-800 rounded-xl">
          <p className="text-sm text-green-700 dark:text-green-400">{success}</p>
        </div>
      )}

      {/* Cancel Series Button */}
      {canCancel && (
        <Button
          onClick={() => setShowCancelModal(true)}
          variant="danger"
          size="sm"
        >
          Serie stornieren
        </Button>
      )}

      {/* Cancel Modal */}
      <RecurrenceEditModal
        isOpen={showCancelModal}
        onClose={() => setShowCancelModal(false)}
        onConfirm={handleCancel}
        mode="cancel"
        loading={loading}
        futureCount={futureCount}
        totalCount={totalCount}
      />
    </div>
  );
}

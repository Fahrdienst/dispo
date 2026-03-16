import Link from 'next/link';
import {
  Card,
  Badge,
  Button,
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from '@/components/ui';
import type { RideWithRelations, RideStatus } from '@/lib/actions/rides-v2';

// =============================================================================
// TYPES
// =============================================================================

interface ReportTableProps {
  rides: RideWithRelations[];
}

// =============================================================================
// HELPERS
// =============================================================================

function StatusBadge({ status }: { status: RideStatus }) {
  const config: Record<RideStatus, { variant: 'default' | 'info' | 'warning' | 'success' | 'danger'; label: string }> = {
    planned: { variant: 'default', label: 'Geplant' },
    confirmed: { variant: 'info', label: 'Bestaetigt' },
    in_progress: { variant: 'warning', label: 'Unterwegs' },
    completed: { variant: 'success', label: 'Abgeschlossen' },
    cancelled: { variant: 'danger', label: 'Storniert' },
  };

  const { variant, label } = config[status];
  return <Badge variant={variant}>{label}</Badge>;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('de-CH', {
    weekday: 'short',
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
  });
}

function formatTime(isoString: string): string {
  return new Date(isoString).toLocaleTimeString('de-CH', {
    hour: '2-digit',
    minute: '2-digit',
  });
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ReportTable({ rides }: ReportTableProps) {
  if (rides.length === 0) {
    return (
      <Card className="p-12 text-center">
        <p className="text-lg text-gray-500 dark:text-gray-400">
          Keine Fahrten im ausgewaehlten Zeitraum gefunden.
        </p>
      </Card>
    );
  }

  return (
    <Card padding="none">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Datum</TableHead>
            <TableHead>Abholung</TableHead>
            <TableHead>Patient</TableHead>
            <TableHead>Ziel</TableHead>
            <TableHead>Fahrer</TableHead>
            <TableHead>Distanz</TableHead>
            <TableHead>Dauer</TableHead>
            <TableHead>Status</TableHead>
            <TableHead></TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {rides.map((ride) => (
            <TableRow key={ride.id} className="hover:bg-gray-50 dark:hover:bg-gray-800">
              <TableCell>
                <span className="text-sm font-medium">
                  {formatDate(ride.pickupTime)}
                </span>
              </TableCell>
              <TableCell>
                <span className="font-medium">{formatTime(ride.pickupTime)}</span>
              </TableCell>
              <TableCell>
                <span className="font-medium">
                  {ride.patient.firstName} {ride.patient.lastName}
                </span>
                <span className="block text-sm text-gray-500">{ride.patient.city}</span>
              </TableCell>
              <TableCell>
                <span className="font-medium">{ride.destination.name}</span>
                <span className="block text-sm text-gray-500">{ride.destination.city}</span>
              </TableCell>
              <TableCell>
                {ride.driver ? (
                  <span>{ride.driver.firstName} {ride.driver.lastName}</span>
                ) : (
                  <span className="text-gray-400">-</span>
                )}
              </TableCell>
              <TableCell>
                {ride.estimatedDistance
                  ? `${ride.estimatedDistance} km`
                  : '-'}
              </TableCell>
              <TableCell>
                {ride.estimatedDuration
                  ? `${ride.estimatedDuration} Min.`
                  : '-'}
              </TableCell>
              <TableCell>
                <StatusBadge status={ride.status} />
              </TableCell>
              <TableCell>
                <Link href={`/rides/${ride.id}`}>
                  <Button variant="ghost" size="sm">Details</Button>
                </Link>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}

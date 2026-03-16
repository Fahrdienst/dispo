'use client';

import { Button } from '@/components/ui';
import type { RideWithRelations } from '@/lib/actions/rides-v2';

// =============================================================================
// TYPES
// =============================================================================

interface ReportExportProps {
  rides: RideWithRelations[];
  fromDate: string;
  toDate: string;
}

// =============================================================================
// HELPERS
// =============================================================================

const STATUS_LABELS: Record<string, string> = {
  planned: 'Geplant',
  confirmed: 'Bestaetigt',
  in_progress: 'Unterwegs',
  completed: 'Abgeschlossen',
  cancelled: 'Storniert',
};

function escapeCSV(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return '';
  const str = String(value);
  // Escape quotes and wrap in quotes if contains comma, newline, or quote
  if (str.includes(',') || str.includes('\n') || str.includes('"') || str.includes(';')) {
    return `"${str.replace(/"/g, '""')}"`;
  }
  return str;
}

// =============================================================================
// COMPONENT
// =============================================================================

export function ReportExport({ rides, fromDate, toDate }: ReportExportProps) {
  const handleCSVExport = () => {
    // Use semicolon as separator for German Excel compatibility
    const separator = ';';
    const headers = [
      'Datum',
      'Abholzeit',
      'Ankunftszeit',
      'Patient',
      'Patient Adresse',
      'Ziel',
      'Ziel Adresse',
      'Fahrer',
      'Distanz (km)',
      'Dauer (Min.)',
      'Status',
      'Notizen',
    ];

    const rows = rides.map((ride) => [
      escapeCSV(new Date(ride.pickupTime).toLocaleDateString('de-CH')),
      escapeCSV(new Date(ride.pickupTime).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })),
      escapeCSV(new Date(ride.arrivalTime).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })),
      escapeCSV(`${ride.patient.firstName} ${ride.patient.lastName}`),
      escapeCSV(`${ride.patient.street}, ${ride.patient.postalCode} ${ride.patient.city}`),
      escapeCSV(ride.destination.name),
      escapeCSV(`${ride.destination.street}, ${ride.destination.postalCode} ${ride.destination.city}`),
      escapeCSV(ride.driver ? `${ride.driver.firstName} ${ride.driver.lastName}` : ''),
      escapeCSV(ride.estimatedDistance),
      escapeCSV(ride.estimatedDuration),
      escapeCSV(STATUS_LABELS[ride.status] || ride.status),
      escapeCSV(ride.notes),
    ]);

    // Add BOM for proper UTF-8 encoding in Excel
    const bom = '\uFEFF';
    const csv = bom + [headers.join(separator), ...rows.map((row) => row.join(separator))].join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `fahrtenbericht_${fromDate}_${toDate}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handlePDFExport = () => {
    // Open a new window with print-optimized layout
    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      alert('Bitte erlauben Sie Pop-ups fuer den PDF-Export.');
      return;
    }

    const totalRides = rides.length;
    const completedRides = rides.filter((r) => r.status === 'completed').length;
    const totalKm = rides.reduce((sum, r) => sum + (r.estimatedDistance || 0), 0);

    const html = `
      <!DOCTYPE html>
      <html lang="de">
      <head>
        <meta charset="utf-8">
        <title>Fahrtenbericht ${fromDate} - ${toDate}</title>
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif; font-size: 11px; color: #111; padding: 20px; }
          h1 { font-size: 18px; margin-bottom: 4px; }
          .subtitle { color: #666; margin-bottom: 16px; font-size: 12px; }
          .summary { display: flex; gap: 24px; margin-bottom: 16px; padding: 8px 0; border-bottom: 1px solid #ddd; }
          .summary-item { }
          .summary-label { font-size: 10px; color: #666; text-transform: uppercase; }
          .summary-value { font-size: 16px; font-weight: bold; }
          table { width: 100%; border-collapse: collapse; margin-top: 8px; }
          th { text-align: left; padding: 6px 8px; border-bottom: 2px solid #333; font-size: 10px; text-transform: uppercase; color: #555; }
          td { padding: 5px 8px; border-bottom: 1px solid #eee; font-size: 10px; }
          tr:nth-child(even) { background: #f9f9f9; }
          .status-completed { color: #059669; }
          .status-cancelled { color: #dc2626; }
          .status-planned { color: #6b7280; }
          .status-confirmed { color: #2563eb; }
          .status-in_progress { color: #d97706; }
          .footer { margin-top: 16px; padding-top: 8px; border-top: 1px solid #ddd; font-size: 9px; color: #999; }
          @media print {
            body { padding: 0; }
            @page { margin: 15mm; size: landscape; }
          }
        </style>
      </head>
      <body>
        <h1>Fahrtenbericht</h1>
        <p class="subtitle">
          Zeitraum: ${new Date(fromDate).toLocaleDateString('de-CH')} bis ${new Date(toDate).toLocaleDateString('de-CH')}
        </p>
        <div class="summary">
          <div class="summary-item">
            <div class="summary-label">Fahrten</div>
            <div class="summary-value">${totalRides}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Abgeschlossen</div>
            <div class="summary-value">${completedRides}</div>
          </div>
          <div class="summary-item">
            <div class="summary-label">Gesamtstrecke</div>
            <div class="summary-value">${Math.round(totalKm * 10) / 10} km</div>
          </div>
        </div>
        <table>
          <thead>
            <tr>
              <th>Datum</th>
              <th>Zeit</th>
              <th>Patient</th>
              <th>Ziel</th>
              <th>Fahrer</th>
              <th>km</th>
              <th>Min.</th>
              <th>Status</th>
            </tr>
          </thead>
          <tbody>
            ${rides.map((ride) => `
              <tr>
                <td>${new Date(ride.pickupTime).toLocaleDateString('de-CH')}</td>
                <td>${new Date(ride.pickupTime).toLocaleTimeString('de-CH', { hour: '2-digit', minute: '2-digit' })}</td>
                <td>${ride.patient.firstName} ${ride.patient.lastName}</td>
                <td>${ride.destination.name}</td>
                <td>${ride.driver ? `${ride.driver.firstName} ${ride.driver.lastName}` : '-'}</td>
                <td>${ride.estimatedDistance || '-'}</td>
                <td>${ride.estimatedDuration || '-'}</td>
                <td class="status-${ride.status}">${STATUS_LABELS[ride.status] || ride.status}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
        <div class="footer">
          Erstellt am ${new Date().toLocaleString('de-CH')} | Fahrdienst
        </div>
        <script>window.onload = function() { window.print(); }</script>
      </body>
      </html>
    `;

    printWindow.document.write(html);
    printWindow.document.close();
  };

  return (
    <div className="flex gap-2">
      <Button onClick={handleCSVExport} variant="secondary" size="sm" disabled={rides.length === 0}>
        CSV Export
      </Button>
      <Button onClick={handlePDFExport} variant="secondary" size="sm" disabled={rides.length === 0}>
        PDF / Drucken
      </Button>
    </div>
  );
}

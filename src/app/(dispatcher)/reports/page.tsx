import { Card, Button } from '@/components/ui';
import { getDrivers } from '@/lib/actions/drivers-v2';
import { getRidesForReport, type RideStatus } from '@/lib/actions/rides-v2';
import { ReportTable } from '@/components/reports/report-table';
import { ReportExport } from '@/components/reports/report-export';

// =============================================================================
// TYPES
// =============================================================================

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
    driver?: string;
    status?: RideStatus;
  }>;
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default async function ReportsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Default date range: current month
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultTo = now.toISOString().split('T')[0];

  const fromDate = params.from || defaultFrom;
  const toDate = params.to || defaultTo;
  const selectedDriver = params.driver;
  const selectedStatus = params.status;

  // Fetch data
  const [drivers, rides] = await Promise.all([
    getDrivers(),
    getRidesForReport({
      fromDate,
      toDate,
      driverId: selectedDriver || undefined,
      status: selectedStatus || undefined,
    }),
  ]);

  // Calculate summary stats
  const totalRides = rides.length;
  const completedRides = rides.filter((r) => r.status === 'completed').length;
  const cancelledRides = rides.filter((r) => r.status === 'cancelled').length;
  const totalDistanceKm = rides.reduce((sum, r) => sum + (r.estimatedDistance || 0), 0);
  const totalDurationMin = rides.reduce((sum, r) => sum + (r.estimatedDuration || 0), 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fahrtenbericht</h1>
        <div className="flex gap-2">
          <a href="/reports/statistics">
            <Button variant="secondary">Fahrerstatistik</Button>
          </a>
          <ReportExport rides={rides} fromDate={fromDate} toDate={toDate} />
        </div>
      </div>

      {/* Filters */}
      <Card className="p-4">
        <form className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Von
            </label>
            <input
              type="date"
              name="from"
              defaultValue={fromDate}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Bis
            </label>
            <input
              type="date"
              name="to"
              defaultValue={toDate}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Fahrer
            </label>
            <select
              name="driver"
              defaultValue={selectedDriver || ''}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Alle Fahrer</option>
              {drivers.map((driver) => (
                <option key={driver.id} value={driver.id}>
                  {driver.firstName} {driver.lastName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
              Status
            </label>
            <select
              name="status"
              defaultValue={selectedStatus || ''}
              className="px-4 py-2 rounded-lg border border-gray-300 dark:border-gray-600
                       bg-white dark:bg-gray-700 text-gray-900 dark:text-white"
            >
              <option value="">Alle Status</option>
              <option value="planned">Geplant</option>
              <option value="confirmed">Bestaetigt</option>
              <option value="in_progress">Unterwegs</option>
              <option value="completed">Abgeschlossen</option>
              <option value="cancelled">Storniert</option>
            </select>
          </div>
          <Button type="submit" variant="secondary">
            Filtern
          </Button>
          <a href="/reports">
            <Button type="button" variant="ghost">
              Zuruecksetzen
            </Button>
          </a>
        </form>
      </Card>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Fahrten gesamt</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalRides}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Abgeschlossen</p>
          <p className="text-2xl font-bold text-green-600">{completedRides}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Storniert</p>
          <p className="text-2xl font-bold text-red-600">{cancelledRides}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Gesamtstrecke</p>
          <p className="text-2xl font-bold text-blue-600">{Math.round(totalDistanceKm * 10) / 10} km</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Gesamtdauer</p>
          <p className="text-2xl font-bold text-purple-600">
            {totalDurationMin >= 60
              ? `${Math.floor(totalDurationMin / 60)}h ${totalDurationMin % 60}m`
              : `${totalDurationMin} Min.`}
          </p>
        </Card>
      </div>

      {/* Report period info */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Zeitraum: {new Date(fromDate).toLocaleDateString('de-CH')} bis {new Date(toDate).toLocaleDateString('de-CH')}
        {selectedDriver && drivers.find((d) => d.id === selectedDriver) && (
          <span> | Fahrer: {drivers.find((d) => d.id === selectedDriver)?.firstName} {drivers.find((d) => d.id === selectedDriver)?.lastName}</span>
        )}
      </div>

      {/* Rides Table */}
      <ReportTable rides={rides} />
    </div>
  );
}

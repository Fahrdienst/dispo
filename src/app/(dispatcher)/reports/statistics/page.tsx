import Link from 'next/link';
import { Card, Button } from '@/components/ui';
import { getDriverStatistics, type DriverStatistics } from '@/lib/actions/rides-v2';

// =============================================================================
// TYPES
// =============================================================================

interface PageProps {
  searchParams: Promise<{
    from?: string;
    to?: string;
  }>;
}

// =============================================================================
// STAT CARD COMPONENT
// =============================================================================

function DriverStatCard({ stats }: { stats: DriverStatistics }) {
  return (
    <Card className="p-6">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          {stats.driverName}
        </h3>
        <Link href={`/drivers/${stats.driverId}`}>
          <Button variant="ghost" size="sm">Profil</Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Fahrten gesamt</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalRides}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Abgeschlossen</p>
          <p className="text-2xl font-bold text-green-600">{stats.completedRides}</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Kilometer</p>
          <p className="text-2xl font-bold text-blue-600">{stats.totalDistanceKm} km</p>
        </div>
        <div>
          <p className="text-sm text-gray-500 dark:text-gray-400">Durchschn. Dauer</p>
          <p className="text-2xl font-bold text-purple-600">
            {stats.averageDurationMinutes > 0 ? `${stats.averageDurationMinutes} Min.` : '-'}
          </p>
        </div>
      </div>

      {/* Progress bar: completed vs total */}
      {stats.totalRides > 0 && (
        <div className="mt-4">
          <div className="flex justify-between text-xs text-gray-500 dark:text-gray-400 mb-1">
            <span>Abschlussrate</span>
            <span>{Math.round((stats.completedRides / stats.totalRides) * 100)}%</span>
          </div>
          <div className="h-2 bg-gray-200 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full bg-green-500 rounded-full transition-all"
              style={{ width: `${(stats.completedRides / stats.totalRides) * 100}%` }}
            />
          </div>
          {stats.cancelledRides > 0 && (
            <p className="text-xs text-gray-400 mt-1">
              {stats.cancelledRides} storniert
            </p>
          )}
        </div>
      )}

      {/* Total duration */}
      {stats.totalDurationMinutes > 0 && (
        <div className="mt-3 pt-3 border-t border-gray-200 dark:border-gray-700">
          <p className="text-sm text-gray-500 dark:text-gray-400">
            Gesamtfahrzeit:{' '}
            <span className="font-medium text-gray-900 dark:text-white">
              {stats.totalDurationMinutes >= 60
                ? `${Math.floor(stats.totalDurationMinutes / 60)}h ${stats.totalDurationMinutes % 60}m`
                : `${stats.totalDurationMinutes} Min.`}
            </span>
          </p>
        </div>
      )}
    </Card>
  );
}

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default async function DriverStatisticsPage({ searchParams }: PageProps) {
  const params = await searchParams;

  // Default date range: current month
  const now = new Date();
  const defaultFrom = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  const defaultTo = now.toISOString().split('T')[0];

  const fromDate = params.from || defaultFrom;
  const toDate = params.to || defaultTo;

  const stats = await getDriverStatistics(fromDate, toDate);

  // Overall summary
  const totalRides = stats.reduce((sum, s) => sum + s.totalRides, 0);
  const totalKm = stats.reduce((sum, s) => sum + s.totalDistanceKm, 0);
  const totalMinutes = stats.reduce((sum, s) => sum + s.totalDurationMinutes, 0);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Fahrerstatistik</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Leistungsuebersicht aller Fahrer
          </p>
        </div>
        <Link href="/reports">
          <Button variant="ghost">Zurueck zu Berichte</Button>
        </Link>
      </div>

      {/* Period Filter */}
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
          <Button type="submit" variant="secondary">
            Aktualisieren
          </Button>
        </form>
      </Card>

      {/* Overall Summary */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Aktive Fahrer</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.length}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Fahrten gesamt</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{totalRides}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Gesamtstrecke</p>
          <p className="text-2xl font-bold text-blue-600">{Math.round(totalKm * 10) / 10} km</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Gesamtfahrzeit</p>
          <p className="text-2xl font-bold text-purple-600">
            {totalMinutes >= 60
              ? `${Math.floor(totalMinutes / 60)}h ${totalMinutes % 60}m`
              : `${totalMinutes} Min.`}
          </p>
        </Card>
      </div>

      {/* Period info */}
      <div className="text-sm text-gray-500 dark:text-gray-400">
        Zeitraum: {new Date(fromDate).toLocaleDateString('de-CH')} bis {new Date(toDate).toLocaleDateString('de-CH')}
      </div>

      {/* Driver Stats Grid */}
      {stats.length === 0 ? (
        <Card className="p-12 text-center">
          <p className="text-lg text-gray-500 dark:text-gray-400">
            Keine Fahrerstatistiken im ausgewaehlten Zeitraum verfuegbar.
          </p>
          <p className="text-sm text-gray-400 mt-2">
            Es wurden keine Fahrten mit zugewiesenen Fahrern gefunden.
          </p>
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {stats.map((driverStats) => (
            <DriverStatCard key={driverStats.driverId} stats={driverStats} />
          ))}
        </div>
      )}
    </div>
  );
}

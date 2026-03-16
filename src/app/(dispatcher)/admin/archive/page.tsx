import { Card } from '@/components/ui';
import { getArchiveStats } from '@/lib/actions/rides-v2';
import { ArchiveAction } from '@/components/admin/archive-action';

// =============================================================================
// PAGE COMPONENT
// =============================================================================

export default async function ArchivePage() {
  const stats = await getArchiveStats();

  const archivableCount = stats.oldPlannedRides + stats.oldCompletedRides + stats.oldCancelledRides;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900 dark:text-white">Datenarchivierung</h1>
        <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
          Verwaltung alter Fahrtendaten gemaess DSGVO-Aufbewahrungsfristen
        </p>
      </div>

      {/* GDPR Info */}
      <Card className="p-6 border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-900/10">
        <h2 className="text-lg font-semibold text-blue-700 dark:text-blue-400 mb-3">
          DSGVO-Aufbewahrungsfristen
        </h2>
        <div className="space-y-2 text-sm text-blue-600 dark:text-blue-300">
          <p>
            <strong>Patientenfahrten (Krankenakten):</strong> 10 Jahre Aufbewahrungspflicht
            gemaess Schweizer Patientenakten-Verordnung (Art. 26 KVG).
          </p>
          <p>
            <strong>Abrechnungsdaten:</strong> 10 Jahre Aufbewahrungspflicht gemaess OR Art. 958f.
          </p>
          <p>
            <strong>Personenbezogene Daten:</strong> Loeschung nach Wegfall des Verarbeitungszwecks,
            spaetestens nach Ablauf der gesetzlichen Aufbewahrungsfrist.
          </p>
          <p className="font-medium mt-2">
            Empfehlung: Daten fruehestens nach 12 Monaten archivieren, nach 10 Jahren endgueltig loeschen.
          </p>
        </div>
      </Card>

      {/* Current Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Fahrten gesamt</p>
          <p className="text-2xl font-bold text-gray-900 dark:text-white">{stats.totalRides}</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Alte geplante Fahrten</p>
          <p className="text-2xl font-bold text-orange-600">{stats.oldPlannedRides}</p>
          <p className="text-xs text-gray-400 mt-1">Aelter als 6 Monate</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Alte abgeschlossene</p>
          <p className="text-2xl font-bold text-green-600">{stats.oldCompletedRides}</p>
          <p className="text-xs text-gray-400 mt-1">Aelter als 6 Monate</p>
        </Card>
        <Card className="p-4">
          <p className="text-sm text-gray-500 dark:text-gray-400">Alte stornierte</p>
          <p className="text-2xl font-bold text-red-600">{stats.oldCancelledRides}</p>
          <p className="text-xs text-gray-400 mt-1">Aelter als 6 Monate</p>
        </Card>
      </div>

      {stats.oldestRideDate && (
        <div className="text-sm text-gray-500 dark:text-gray-400">
          Aelteste Fahrt: {new Date(stats.oldestRideDate).toLocaleDateString('de-CH', {
            day: '2-digit',
            month: 'long',
            year: 'numeric',
          })}
        </div>
      )}

      {/* Archive Action */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Archivierung ausfuehren
        </h2>
        <p className="text-sm text-gray-600 dark:text-gray-400 mb-4">
          Archiviert alte Fahrten und bereinigt System-Logs. Geplante Fahrten, die aelter als der
          gewaehlte Zeitraum sind, werden automatisch storniert. Bereits abgeschlossene Fahrten
          bleiben erhalten (Aufbewahrungspflicht).
        </p>

        <ArchiveAction archivableCount={archivableCount} />
      </Card>

      {/* What Happens */}
      <Card className="p-6">
        <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
          Was passiert bei der Archivierung?
        </h2>
        <div className="space-y-3 text-sm text-gray-600 dark:text-gray-400">
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-orange-100 dark:bg-orange-900/30 text-orange-600 flex items-center justify-center text-xs font-bold flex-shrink-0">1</span>
            <p>
              <strong>Geplante/bestaetigte Fahrten</strong> aelter als X Monate werden automatisch
              storniert (Status &quot;Storniert&quot; mit Archivierungsvermerk).
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-green-100 dark:bg-green-900/30 text-green-600 flex items-center justify-center text-xs font-bold flex-shrink-0">2</span>
            <p>
              <strong>Abgeschlossene Fahrten</strong> bleiben unveraendert (10 Jahre Aufbewahrungspflicht).
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-blue-100 dark:bg-blue-900/30 text-blue-600 flex items-center justify-center text-xs font-bold flex-shrink-0">3</span>
            <p>
              <strong>System-Logs</strong> aelter als 30 Tage werden geloescht.
            </p>
          </div>
          <div className="flex items-start gap-3">
            <span className="w-6 h-6 rounded-full bg-gray-100 dark:bg-gray-700 text-gray-600 flex items-center justify-center text-xs font-bold flex-shrink-0">4</span>
            <p>
              <strong>Stammdaten</strong> (Patienten, Fahrer, Ziele) werden <strong>nicht</strong> geloescht.
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}

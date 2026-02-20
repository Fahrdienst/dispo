# ADR-009: E-Mail-Benachrichtigung bei Fahrerzuweisung

## Status
Accepted

## Kontext

Wenn ein Disponent einen Fahrer einer Fahrt zuweist (Status: unplanned -> planned), soll der Fahrer per E-Mail benachrichtigt werden. Der Fahrer soll direkt aus der E-Mail heraus die Fahrt annehmen (planned -> confirmed) oder ablehnen (planned -> rejected) koennen, ohne sich einloggen zu muessen.

## Entscheidungen

### E-Mail-Versand: Nodemailer + Gmail SMTP

- **Nodemailer** mit Gmail SMTP und App Password.
- Kostenlos fuer das erwartete Dispo-Volumen (< 500 Mails/Tag).
- Kein externer E-Mail-Anbieter (SendGrid, SES) noetig.
- Fire-and-forget: Versand blockiert das Assignment nicht.

### Token-Modell

- Pro Zuweisung wird ein kryptographischer Token erstellt (256-bit, `crypto.randomBytes(32)`).
- Die Action (confirm/reject) ist Query-Parameter, nicht Teil des Tokens.
- Token-Ablauf: 48 Stunden, Einmalverwendung (`used_at` wird gesetzt).
- Bei Neuzuweisung eines Fahrers werden alle alten Tokens fuer die Fahrt invalidiert.

### Datenmodell

Zwei neue Tabellen:

- **`assignment_tokens`**: Token-Speicher mit `ride_id`, `driver_id`, `token`, `expires_at`, `used_at`.
- **`mail_log`**: Audit-Log fuer alle E-Mail-Versandversuche mit Status und Fehlermeldung.

Beide Tabellen nutzen RLS (Defense-in-depth): nur Staff darf SELECT (Audit). INSERT/UPDATE erfolgt ausschliesslich via Service-Role-Client.

### Oeffentliche Route

- `/api/rides/respond?token=xxx&action=confirm` — ohne Auth, Token-basiert.
- 5-Schicht-Validierung: Input -> Token gueltig -> Fahrt existiert -> Fahrer zugewiesen -> Status-Transition erlaubt.
- GET-basierte Statusaenderung ist akzeptabel, da der Token einmalig und kryptographisch sicher ist.

### Ergebnisseiten

- Eigenes `(public)` Layout ohne Dashboard-Navigation.
- Erfolgsseite mit Aktions-Bestaetigung.
- Fehlerseite mit spezifischen Fehlermeldungen (abgelaufen, ungueltig, geaendert).

## Konsequenzen

- Fahrer benoetigen keinen Login fuer die Reaktion auf Zuweisungen.
- Gmail App Password muss als Environment Variable konfiguriert werden.
- Token-basierte Links sind zeitlich begrenzt und einmalig verwendbar.
- Mail-Log ermoeglicht Audit und Fehleranalyse.

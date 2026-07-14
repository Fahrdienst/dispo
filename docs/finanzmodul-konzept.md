# Konzept: Finanzmodul (M14) — Quittungen, Fahrer-Reporting, Statistik

**Status:** Konsolidiert (Architektur-Review Martin, vor Implementierung)
**Datum:** 2026-07-15
**Autor:** Konzept-Session mit Christian (Kickoff-Fragen beantwortet), Architektur-Review Martin
**Referenz:** ADR-015 (`docs/adrs/015-finance-module.md`)

> **Hinweis Milestone-Nummer:** Das Konzept startete unter dem Arbeitstitel «M13». Zum Zeitpunkt des
> Architektur-Reviews (2026-07-15) ist «M13» im Repository jedoch bereits durch den Milestone
> «M13 – Fahrt-Erfassung (One-Page Dispo)» (Issues #124–#140) belegt. Um eine Nummern-Kollision
> zu vermeiden, läuft das Finanzmodul als **Milestone «M14 – Finanzmodul»**. Die Phasen sind
> entsprechend als 14.1–14.4 nummeriert.

---

## 1. Ziel & Scope

Ein neuer Hauptbereich **«Finanzen»** im Dispatcher-UI, der drei Fähigkeiten bündelt:

1. **Quittungen**: Zahlungsbestätigungen für Patienten (Einzelfahrt oder Zeitraum: Tag / Woche / Monat / frei), als formale, revisionsfähige Belege — z.B. zur Einreichung bei der Krankenkasse.
2. **Fahrer-Reporting**: Leistung (Fahrten/km/Zeit), Kasseninkasso, Umsatz und Entschädigung pro Fahrer.
3. **Statistik & Dashboard**: Finanzielle Gesamtübersicht (Umsatz, Volumen, Top-Listen) und ein Statistikmodul über Fahrten, Routen und Distanzen («Wie viele km sind wir insgesamt gefahren?»).

Dazu gehört ein **einmaliger Distanz-Backfill** für abgeschlossene Fahrten ohne Distanzdaten.

### Getroffene Grundsatzentscheidungen (Kickoff 2026-07-14)

| Frage | Entscheidung |
|---|---|
| Belegart | **Zahlungsbestätigung** (kein Rechnungsmodul). Patienten zahlen bar/Twint beim Fahrer. |
| Zahlungsstatus je Fahrt | **Nicht nötig** — abgeschlossene Fahrten gelten als bezahlt. |
| Beleg-Formalität | **Formal**: fortlaufende Nummern, unveränderlicher Snapshot, Storno per Vermerk. |
| MwSt | **Kein Ausweis** (nicht MwSt-pflichtig / ausgenommen). Nur Bruttobeträge. |
| Zustellung | PDF-Download, E-Mail an Patient, Sammel-PDF pro Periode. |
| Fahrer-Entschädigung | **Kombination**: Pauschale pro Fahrt + km-Satz, beides konfigurierbar. |
| Distanz-Altdaten | **Backfill via Google Directions API** (einmaliger Batch). |
| Navigation | «Verrechnung» geht im neuen Bereich «Finanzen» auf (Sub-Navigation). |
| Zugriff | **Admin + Operator** (wie heutige Verrechnung). |

---

## 2. Navigation & Informationsarchitektur

Der Menüpunkt **«Verrechnung» (`/billing`) wird ersetzt** durch **«Finanzen» (`/finance`)** mit Sub-Navigation (Muster analog `settings-nav.tsx`):

```
Finanzen (Icon: CreditCard, roles: admin+operator)
├── /finance                Dashboard (Finanzübersicht)
├── /finance/receipts       Quittungen (Liste, Erstellen, Sammellauf)
├── /finance/drivers        Fahrer (Leistung, Inkasso, Entschädigung)
├── /finance/statistics     Statistik (Fahrten, km, Routen)
└── /finance/export         Export (heutige /billing-Funktionalität zieht um)
```

- `/billing` erhält einen **Redirect** auf `/finance/export`, damit Bookmarks weiter funktionieren.
- Zusätzlicher Einstiegspunkt: **Patientendetail** bekommt einen Tab/Abschnitt **«Fahrten & Quittungen»** — alle Fahrten des Patienten mit Zeitraumfilter und Button «Quittung erstellen» (vorbefüllt mit Patient + Zeitraum).

---

## 3. Datenmodell

### 3.1 Quittungen (neu)

```sql
CREATE TABLE public.receipts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_number    text NOT NULL UNIQUE,          -- 'Q-2026-00042'
  patient_id        uuid REFERENCES patients(id) ON DELETE SET NULL,
  -- Snapshot des Empfängers zum Ausstellungszeitpunkt (überlebt Anonymisierung/Änderung):
  recipient_name    text NOT NULL,
  recipient_address text NOT NULL,
  period_from       date NOT NULL,
  period_to         date NOT NULL,
  total_amount      numeric(10,2) NOT NULL,
  currency          text NOT NULL DEFAULT 'CHF',
  status            receipt_status NOT NULL DEFAULT 'issued',  -- issued | cancelled
  cancelled_reason  text,
  cancelled_at      timestamptz,
  pdf_path          text,                          -- Supabase Storage: receipts/<year>/<number>.pdf
  issued_by         uuid NOT NULL REFERENCES profiles(id),
  issued_at         timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cancelled_needs_reason
    CHECK (status <> 'cancelled' OR cancelled_reason IS NOT NULL)
);

CREATE TABLE public.receipt_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  receipt_id    uuid NOT NULL REFERENCES receipts(id) ON DELETE CASCADE,
  ride_id       uuid REFERENCES rides(id) ON DELETE SET NULL,
  -- Denormalisiertes Storno-Flag, gespiegelt vom Eltern-Beleg (siehe Regel «Eine Fahrt …»):
  is_cancelled  boolean NOT NULL DEFAULT false,
  -- Snapshot der Fahrtdaten (eingefroren bei Ausstellung):
  ride_date     date NOT NULL,
  description   text NOT NULL,        -- z.B. 'Dübendorf → USZ Zürich (Hinfahrt)'
  distance_km   numeric(7,1),
  amount        numeric(8,2) NOT NULL
);

-- Eine Fahrt darf in höchstens EINER nicht-stornierten Quittung stehen.
-- WICHTIG: Ein Partial-Index-Prädikat darf nur Spalten der EIGENEN Tabelle referenzieren
-- (nicht receipts.status). Daher spiegelt is_cancelled den Beleg-Status (Trigger-gepflegt).
CREATE UNIQUE INDEX uq_receipt_items_active_ride
  ON public.receipt_items (ride_id)
  WHERE is_cancelled = false AND ride_id IS NOT NULL;
```

**Regeln:**

- **Nummernkreis**: `Q-<Jahr>-<5-stellig fortlaufend>`, vergeben über eine Counter-Tabelle
  `receipt_counters(year int PRIMARY KEY, last_number int NOT NULL)`. Vergabe über eine
  `SECURITY DEFINER`-RPC mit **atomarem Upsert** statt manuellem `SELECT … FOR UPDATE`:

  ```sql
  INSERT INTO receipt_counters (year, last_number) VALUES (p_year, 1)
  ON CONFLICT (year) DO UPDATE SET last_number = receipt_counters.last_number + 1
  RETURNING last_number;
  ```

  Das `ON CONFLICT DO UPDATE` nimmt implizit den Row-Lock; parallele Transaktionen serialisieren,
  ohne dass explizit `FOR UPDATE` nötig ist. Rollt die umgebende Transaktion zurück, rollt auch der
  Zähler zurück → **keine Lücken, keine Duplikate**. Sequenz pro Jahr.
- **Transaktions-Grenze**: Nummernvergabe + `receipts`/`receipt_items`-INSERT laufen in **einer** DB-Transaktion.
  Die PDF-Generierung + Storage-Upload passieren **danach** (nicht in der Transaktion — externes I/O soll
  keine DB-Locks halten). Scheitert die PDF-Erzeugung, existiert der Beleg mit `pdf_path IS NULL` und die UI
  bietet «PDF neu erzeugen» (idempotent, da Snapshot unveränderlich).
- **Unveränderlichkeit**: Nach Ausstellung sind `receipts`/`receipt_items` fachlich unveränderlich. Ein
  `BEFORE UPDATE`-Trigger auf `receipts` lässt nur Änderungen an `{status, cancelled_reason, cancelled_at, pdf_path}`
  zu; ein Trigger auf `receipt_items` lässt nur den Übergang `is_cancelled false→true` zu und blockiert alles
  Übrige (inkl. DELETE ausser CASCADE). Korrektur = Storno + Neuausstellung.
- **Eine Fahrt gehört zu max. einer aktiven Quittung**: Durchgesetzt über den Partial-Unique-Index oben.
  Beim Storno setzt ein `AFTER UPDATE`-Trigger auf `receipts` (bei `status → 'cancelled'`) alle zugehörigen
  `receipt_items.is_cancelled = true` → die Fahrten werden dadurch wieder quittierbar.
- **Quittierbar** sind nur Fahrten mit `status = 'completed'`. `cancelled`/`no_show` erscheinen nie auf Quittungen.
- Preisquelle je Item: `COALESCE(price_override, calculated_price)`. Fahrten ohne Preis blockieren die Quittungserstellung nicht, werden aber im Erstell-Dialog als «ohne Preis» markiert und müssen vorher gepflegt werden.

### 3.2 Patient: Zustell-Felder (neu)

`patients` hat heute **keine E-Mail**. Neu (alle optional):

- `email text` — für Quittungsversand per Mail (Zod-validiert)
- `billing_recipient_name text` — abweichender Rechnungsempfänger (z.B. Angehörige, Beistand)
- `billing_recipient_address text` — Adresse des abweichenden Empfängers (mehrzeilig)

Ein einzelnes `billing_recipient`-Feld genügt nicht, weil auf der Quittung Name **und** Adresse
snapshotet werden müssen. Logik bei Ausstellung: Ist `billing_recipient_name` gesetzt, wird der Snapshot
`recipient_name/recipient_address` daraus gebildet (Adresse fällt auf die Patientenadresse zurück, wenn
`billing_recipient_address` leer ist); sonst aus den Patientenfeldern.

### 3.3 Fahrer-Entschädigung: Konfiguration

Zwei neue **Spalten** auf der Singleton-Tabelle `organization_settings` (typisiert, kein Key-Value-Store):

- `driver_comp_per_ride_chf numeric(8,2)` (z.B. `5.00`)
- `driver_comp_per_km_chf numeric(8,2)` (z.B. `0.70`)

Beide über die Admin-`/settings/organization`-Maske editierbar (Admin-RLS besteht bereits).

Die Entschädigung wird **nicht persistiert**, sondern im Report live berechnet:
`Entschädigung = Anzahl abgeschlossene Fahrten × Pauschale + Σ km × km-Satz`.
Ändern sich die Sätze, ändern sich rückwirkend die Reports — falls das später ein Problem wird (verbindliche Fahrer-Abrechnungen), ist der Ausbau zu versionierten Sätzen (analog `fare_versions`) vorgezeichnet. **Bewusst einfach gestartet.**

### 3.4 Distanz-Backfill

- Neues Feld `rides.distance_source text` mit `CHECK (distance_source IN ('planned','backfill','estimate'))`, `DEFAULT 'planned'`, damit Statistiken kennzeichnen können, woher km stammen.
- Migration setzt für Bestandsfahrten mit `distance_meters IS NOT NULL` retroaktiv `distance_source = 'planned'` (aus M8-Planung); neue Fahrten erhalten `'planned'` per Default. Der Backfill-Job setzt `'backfill'`, manuelle Eingaben `'estimate'`.
- Einmaliges Admin-Skript/Server-Action: alle Fahrten mit `status = 'completed'` und `distance_meters IS NULL`, deren Patient **und** Ziel geocodiert sind → Directions API, Ergebnis in `distance_meters`/`duration_seconds` (Kosten: ~$5 pro 1000 Fahrten; Bestand seit Go-Live Feb 2026 ist überschaubar).
- Fahrten ohne Geodaten werden übersprungen und in einem Abschlussreport gelistet (manuelle Nachpflege oder Akzeptanz der Lücke).
- Rate-Limiting: Batch mit Pausen, unter dem bestehenden Tages-Budget-Schutz (ADR-010).

---

## 4. Quittungs-Workflows

### 4.1 Einzelquittung

1. Einstieg: `/finance/receipts` → «Neue Quittung» **oder** Patientendetail → «Quittung erstellen».
2. Patient wählen, Zeitraum wählen — Schnellwahl **Tag / Woche / Monat** plus freier Von–Bis-Bereich.
3. Vorschau: alle abgeschlossenen, noch nicht quittierten Fahrten im Zeitraum mit Datum, Route, km, Betrag; einzelne Fahrten abwählbar. Summe live.
4. «Ausstellen»: Nummer ziehen, Snapshot schreiben, PDF generieren, in Storage ablegen.
5. Aktionen danach: **PDF herunterladen**, **per E-Mail senden** (an `patients.email`, via bestehender Mail-Infrastruktur aus ADR-013), erneut herunterladen (immer dasselbe gespeicherte PDF).

### 4.2 Sammellauf (Monats-/Periodenlauf)

1. `/finance/receipts` → «Sammellauf»: Zeitraum wählen.
2. System zeigt alle Patienten mit quittierbaren Fahrten im Zeitraum + Summen.
3. Bestätigen → pro Patient eine Quittung (je eigene Nummer) + **ein zusammengefügtes Sammel-PDF** zum Ausdrucken; Patienten mit E-Mail optional direkt per Mail.

### 4.3 Storno

- Storno-Button an der Quittung, **Begründung Pflicht**. Status → `cancelled`, PDF bleibt archiviert (mit Storno-Kennzeichnung in der Liste), Fahrten werden wieder quittierbar.
- Kein Storno-Gegenbeleg nötig (keine MwSt, reine Zahlungsbestätigung) — der Storno-Vermerk mit Audit-Trail genügt.

### 4.4 PDF-Layout

Briefkopf der Organisation (Name/Adresse/Logo aus `organization_settings`), Empfängerblock, Titel «Quittung Q-2026-00042», Zeitraum, Tabelle (Datum | Fahrt | km | Betrag CHF), Totalzeile, Vermerk **«Betrag dankend erhalten (Barzahlung/Twint)»**, Ausstellungsdatum + ausstellende Person. Kein MwSt-Block.

**Generierung**: server-seitig mit **`@react-pdf/renderer`** (Entscheid ADR-015, siehe unten). Node-Runtime
(nicht Edge). Das Sammel-PDF wird als **ein** mehrseitiges Dokument aus den (unveränderlichen) Snapshots
neu gerendert — kein separates PDF-Merge nötig, damit auch keine `pdf-lib`-Abhängigkeit. Standard-Fonts
(Helvetica, deckt Latin-1/Umlaute) → keine externen Font-Fetches zur Laufzeit. Das Logo wird server-seitig
aus dem öffentlichen `organization`-Storage-Bucket geladen und eingebettet.

---

## 5. Fahrer-Reporting (`/finance/drivers`)

Zeitraumwahl (Monat als Default, Navigation wie `/billing` heute). Tabelle pro Fahrer:

| Spalte | Quelle |
|---|---|
| Fahrten | Count `completed` im Zeitraum |
| km | Σ `distance_meters` |
| Einsatzzeit | Σ `duration_seconds` (reine Fahrzeit Patient→Ziel; Anfahrt nicht erfasst — als Fussnote ausgewiesen) |
| Umsatz / Inkasso | Σ Fahrpreise (da Barzahlung beim Fahrer ist Umsatz = Inkasso → **eine Spalte «Einnahmen»**, dient dem Kassenabgleich) |
| Entschädigung | Fahrten × Pauschale + km × km-Satz |

- Drill-down: Klick auf Fahrer → Einzelfahrtenliste des Zeitraums.
- **CSV-Export** der Tabelle (für Vereinsbuchhaltung/Auszahlung).
- Hinweisbanner, wenn Fahrten im Zeitraum ohne km/Preis existieren (Datenqualität).

---

## 6. Dashboard (`/finance`)

**KPI-Kacheln** (aktueller Monat, mit Vergleich Vormonat/Vorjahresmonat):

- Umsatz (CHF) · Fahrten (Anzahl) · Gefahrene km · Ø Preis pro Fahrt

**Charts:**

- Umsatzverlauf 12 Monate (Balken, Vorjahr als Vergleichslinie)
- km- und Fahrtenverlauf 12 Monate
- **Top-Listen**: häufigste Ziele/Routen, Patienten nach Fahrtenzahl, aktivste Fahrer

**Quittungs-Widget:** zuletzt ausgestellte Quittungen + Anzahl quittierbarer (abgeschlossener, noch nicht quittierter) Fahrten im laufenden Monat als Arbeitsvorrat.

---

## 7. Statistik (`/finance/statistics`)

Flexible Auswertung mit Dimension × Kennzahl × Zeitraum:

- **Dimensionen:** Zeit (Monat/Quartal/Jahr), Fahrer, Ziel, Zone (aus Tarifmodell), Patient, Richtung (Hin/Rück)
- **Kennzahlen:** Fahrten, km, Fahrzeit, Umsatz
- **Jahresansicht** beantwortet direkt: «Wie viele km gesamt letztes Jahr?» — inkl. Kennzeichnung des Anteils `backfill`/geschätzter Distanzen.
- CSV-Export jeder Auswertung.

**Technik:** Bei ~2'200 Fahrten/Monat (→ ~26k/Jahr) genügen direkte SQL-Aggregationen (Server Components,
optional eine schlanke DB-View `ride_stats` als reine Lesehilfe); **kein** Materialized-View/DWH nötig. Selbst
eine volle Jahresaggregation über wenige zehntausend Zeilen ist im einstelligen Millisekundenbereich.
Empfohlene Indexe (ergänzend zu den bestehenden): `rides(date, status)`, `rides(driver_id, date, status)` und
`rides(destination_id, date, status)` — decken die Dimensionen Zeit/Fahrer/Ziel ab. Re-Evaluation auf
Materialized Views erst, wenn Auswertungen spürbar >200 ms brauchen (dokumentierte Umkehrbarkeit).

---

## 8. Sicherheit & DSGVO

- **RLS**: `receipts`/`receipt_items` lesen/schreiben nur `admin` + `operator` (`get_user_role() IN ('admin','operator')`). Fahrer haben keinen Zugriff. `receipt_counters`: RLS aktiv, **keine** Policies (Deny-all für alle Rollen) — Zugriff ausschliesslich über die `SECURITY DEFINER`-RPC zur Nummernvergabe. Storage-Bucket `receipts` **privat** (`public = false`), Zugriff nur via signierte URLs aus Server Actions.
- **Unveränderlichkeit als Sicherheitskontrolle**: Die Immutability-Trigger (Abschnitt 3.1) verhindern nachträgliche Manipulation ausgestellter Belege auch bei kompromittiertem Operator-Account — nur Storno (mit Pflicht-Begründung + Audit-Eintrag) ist möglich.
- **Audit-Trail** (bestehende Infrastruktur aus Migration 2026-03-20): Ausstellung und Storno werden protokolliert.
- **Spannungsfeld Anonymisierung ⚠**: Der bestehende GDPR-Anonymisierungsjob (Migration 2026-03-21) darf Quittungs-Snapshots **nicht** leeren — Belege unterliegen der kaufmännischen Aufbewahrung (OR: 10 Jahre). Entscheid: Anonymisierung kappt nur die Referenz (`patient_id → NULL` via `ON DELETE SET NULL` bzw. explizit), der Snapshot (`recipient_name` etc.) bleibt. **Muss von Ioannis (CISO-Review) bestätigt werden**, inkl. Ergänzung der Datenschutzerklärung/Verzeichnis der Verarbeitungstätigkeiten.
- Preis-/Umsatzdaten gelten intern nicht als besonders schützenswert, Gesundheitskontext der Fahrten schon → keine Diagnose-/Beeinträchtigungsdaten auf Quittungen oder in Exporten.

---

## 9. Phasenplan

| Phase | Inhalt | Abhängigkeiten |
|---|---|---|
| **14.1** | Migration (receipts, receipt_items, receipt_counters + RPC/Trigger, Patient-E-Mail/Empfänger, `distance_source`, org-settings Entschädigungs-Spalten), RLS + Storage-Bucket, Distanz-Backfill-Job, Nav-Umbau `/billing` → `/finance` (Export zieht um) | Keine |
| **14.2** | Quittungen: Erstell-Flow, PDF-Generierung, Storno, Patientendetail-Tab «Fahrten & Quittungen», E-Mail-Versand | 14.1 |
| **14.3** | Sammellauf + Fahrer-Report inkl. Entschädigungs-Konfiguration + CSV | 14.2 (Nummernkreis/PDF), 14.1 (km) |
| **14.4** | Dashboard + Statistikmodul | 14.1 (Backfill für sinnvolle Zahlen) |

Vor 14.1: **ADR-015 «Finanzmodul»** (Martin, erledigt) + Security-Review des Quittungs-/Anonymisierungs-Konzepts (Ioannis, parallel).

---

## 10. Offene Punkte

1. **Anfahrts-km der Fahrer**: Entschädigung basiert vorerst nur auf Patient→Ziel-Distanz. Falls Anfahrt vergütet werden soll, bräuchten wir Fahrer-Standort → bewusst ausgeklammert (Phase 2+). *(offen, bewusst deferred)*
2. **Twint vs. bar unterscheiden?** Aktuell nicht (kein Zahlungsstatus). Auf der Quittung steht neutral «Barzahlung/Twint». *(entschieden: nein)*
3. **PDF-Bibliothek**: **Entschieden — `@react-pdf/renderer`** (ADR-015). Begründung: deklaratives Layout passend zum React/TS-Stack, Vercel/Node-tauglich, Tabellen/Textumbruch out-of-the-box. Der Sammel-PDF-Fall wird durch Re-Rendering aller Belege eines Laufs in ein einziges mehrseitiges Dokument gelöst (Snapshots sind unveränderlich → deterministisch), daher **kein** binäres PDF-Merge und **kein** `pdf-lib`. `pdf-lib` bleibt dokumentierter Fallback, falls je heterogene Fremd-PDFs zusammengeführt werden müssen.
4. **Aufbewahrungsdauer PDFs** im Storage: Vorschlag **10 Jahre** (OR-Aufbewahrung), Löschjob **deferred** (kein automatischer Löschlauf im MVP) — Detail-Abstimmung mit Ioannis (Security-Review).
5. **Logo/Briefkopf**: **Bereits vorhanden** — `organization_settings` enthält `logo_url`, `org_name`, `org_street`, `org_postal_code`, `org_city`, `org_phone`, `org_email` sowie den öffentlichen `organization`-Storage-Bucket. **Keine Schema-Änderung nötig**; das PDF lädt das Logo server-seitig aus dem Bucket und bettet es ein.

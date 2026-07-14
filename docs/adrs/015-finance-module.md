# ADR-015: Finanzmodul — Quittungen, Fahrer-Reporting, Statistik (M14)

## Status

Accepted

## Date

2026-07-15

## Kontext

Das Dispo-System berechnet seit M8 (ADR-010) Fahrpreise über ein PLZ-basiertes Zonenmodell und
speichert einen Preis-Snapshot pro Fahrt. Die Verrechnung beschränkt sich heute auf eine Export-Ansicht
(`/billing`, CSV). Es fehlen:

1. **Quittungen** als formale Zahlungsbestätigungen für Patienten (Krankenkassen-Einreichung).
2. **Fahrer-Reporting** (Leistung, Kasseninkasso, Entschädigung).
3. **Finanz-/Fahrten-Statistik** (Umsatz, Volumen, gefahrene km).

Die fachlichen Grundsatzentscheide sind mit dem Product Owner (Christian) getroffen (Kickoff 2026-07-14,
dokumentiert in `docs/finanzmodul-konzept.md`, Abschnitt 1) und werden hier **nicht** neu verhandelt:
Quittung = Zahlungsbestätigung (kein Rechnungsmodul), formale Nummernkreise + unveränderlicher Snapshot,
kein MwSt-Ausweis, Fahrer-Entschädigung = Pauschale + km-Satz (unversioniert), Zugriff admin+operator,
`/billing` geht in `/finance` auf.

Dieses ADR entscheidet die **technischen** Punkte: Datenmodell, Nebenläufigkeit der Nummernvergabe,
Durchsetzung der Unveränderlichkeit, PDF-Technologie, Statistik-Ansatz, Backfill und Navigation.

### Milestone-Nummer

Das Konzept startete unter dem Arbeitstitel «M13». «M13» ist im Repository jedoch bereits durch den
Milestone **«M13 – Fahrt-Erfassung (One-Page Dispo)»** (Issues #124–#140) belegt. Um eine Kollision
zu vermeiden, läuft das Finanzmodul als **Milestone «M14 – Finanzmodul»**. Dies ist eine reversible
Namensentscheidung; sollte der PO die alte Nummer bevorzugen, ist der Milestone trivial umbenennbar.

### Bestehendes Datenmodell (relevant)

- `rides`: `patient_id`, `destination_id`, `driver_id`, `date`, `direction`, `status`,
  `distance_meters`, `duration_seconds`, `calculated_price`, `price_override` (ADR-010).
- `patients`: Name/Adresse/PLZ, seit #125 `cost_bearer`. **Keine E-Mail.**
- `organization_settings`: Singleton mit `logo_url`, `org_name/street/postal_code/city/phone/email`,
  öffentlicher `organization`-Storage-Bucket, Admin-RLS (Migration 20260316).
- `audit_log`: unveränderliches Audit-Trail, Admin-lesbar, Service-Role-Insert (Migration 20260320).
- GDPR-Anonymisierung: `anonymize_patient()` überschreibt PII, behält Stadt/Region für Statistik
  (Migration 20260321).

---

## Optionen & Entscheidungen

### E1: Datenmodell — dedizierte Beleg-Tabellen mit Snapshot

**Entscheidung:** Drei neue Tabellen `receipts`, `receipt_items`, `receipt_counters`.

- Der **Snapshot** friert Empfänger (`recipient_name`, `recipient_address`) und pro Position die
  Fahrtdaten (`ride_date`, `description`, `distance_km`, `amount`) zum Ausstellungszeitpunkt ein.
- Referenzen (`patient_id`, `ride_id`) sind `ON DELETE SET NULL` — der Beleg überlebt Anonymisierung/Löschung
  der Quell-Entitäten. Damit ist die kaufmännische Aufbewahrung (OR, 10 Jahre) unabhängig vom
  DSGVO-Anonymisierungsjob gewährleistet: Die Anonymisierung kappt nur die Referenz, nie den Snapshot.

**Verworfen:** Belege «on the fly» aus `rides` rendern (kein Snapshot). Grund: Preis-/Adressänderungen oder
Anonymisierung würden ausgestellte Belege nachträglich verändern — inakzeptabel für revisionsfähige Dokumente.

### E2: Nummernkreis — atomarer Upsert statt `SELECT … FOR UPDATE`

**Entscheidung:** Nummernvergabe über eine `SECURITY DEFINER`-RPC mit atomarem Upsert:

```sql
INSERT INTO receipt_counters (year, last_number) VALUES (p_year, 1)
ON CONFLICT (year) DO UPDATE SET last_number = receipt_counters.last_number + 1
RETURNING last_number;
```

`ON CONFLICT DO UPDATE` nimmt implizit den Row-Lock; parallele Transaktionen serialisieren. Rollt die
umgebende Transaktion zurück, rollt der Zähler mit → **keine Lücken, keine Duplikate**. Format
`Q-<Jahr>-<5-stellig>`, Sequenz pro Jahr.

**Verworfen:** Manuelles `SELECT last_number FROM receipt_counters WHERE year = ? FOR UPDATE` +
`UPDATE`. Funktioniert, ist aber zwei Statements (mehr Round-Trips) und fehleranfälliger bei fehlender
Zeile (erste Quittung des Jahres). Der Upsert deckt den «erste Nummer»-Fall in einem Statement ab.

**Verworfen:** Postgres-`SEQUENCE`. Sequenzen sind nicht transaktions-rückrollbar (Lücken bei Rollback)
und nicht sauber pro Jahr partitionierbar — für formale, lückenlose Nummernkreise ungeeignet.

### E3: Unveränderlichkeit — Trigger-basiert

**Entscheidung:** Zwei Trigger sichern die fachliche Immutabilität ab:

- `receipts` `BEFORE UPDATE`: lehnt Änderungen an allen Spalten **ausser**
  `{status, cancelled_reason, cancelled_at, pdf_path}` ab.
- `receipt_items` `BEFORE UPDATE`: erlaubt nur den Übergang `is_cancelled false→true`, blockiert alles
  Übrige; `BEFORE DELETE`: blockiert (Ausnahme: CASCADE aus einem — im Normalbetrieb nie ausgeführten —
  `receipts`-DELETE).

Das ist zugleich eine **Sicherheitskontrolle**: Auch ein kompromittierter Operator-Account kann
ausgestellte Belege nicht manipulieren, nur stornieren (mit Pflicht-Begründung + Audit-Eintrag).

### E4: «Eine Fahrt → max. eine aktive Quittung» — Partial-Unique-Index mit gespiegeltem Flag

**Problem:** Ein Partial-Index-Prädikat darf **nur Spalten der eigenen Tabelle** referenzieren. Die
naheliegende Formulierung «unique auf `receipt_items.ride_id`, solange die Eltern-`receipts.status`
nicht `cancelled` ist» ist so **nicht umsetzbar**, weil das Prädikat `receipts.status` bräuchte.

**Entscheidung:** Denormalisiertes `receipt_items.is_cancelled boolean NOT NULL DEFAULT false`, gepflegt
von einem `AFTER UPDATE`-Trigger auf `receipts` (bei `status → 'cancelled'` werden alle zugehörigen
Items auf `is_cancelled = true` gesetzt). Der Constraint:

```sql
CREATE UNIQUE INDEX uq_receipt_items_active_ride
  ON public.receipt_items (ride_id)
  WHERE is_cancelled = false AND ride_id IS NOT NULL;
```

Damit wird garantiert, dass jede Fahrt in höchstens einer nicht-stornierten Quittung steht; bei Storno
wird die Fahrt wieder quittierbar.

**Verworfen:** Exclusion-Constraint oder Applikations-seitige Prüfung. Der Partial-Unique-Index ist die
DB-native, race-freie Durchsetzung; eine reine App-Prüfung wäre bei parallelen Ausstellungen unsicher.

### E5: Transaktions-Grenze — DB-Schreibung getrennt von PDF/Storage

**Entscheidung:** Nummernvergabe + `receipts`/`receipt_items`-INSERT in **einer** DB-Transaktion.
PDF-Rendering + Storage-Upload **danach**, ausserhalb der Transaktion. Scheitert die PDF-Erzeugung,
existiert der Beleg mit `pdf_path IS NULL`; die UI bietet «PDF neu erzeugen» (idempotent, da Snapshot
unveränderlich).

**Begründung:** Externes I/O (Render, Storage-Upload) darf keine DB-Row-Locks halten. Entkopplung hält
Transaktionen kurz und macht die PDF-Erzeugung wiederholbar.

### E6: PDF-Technologie — `@react-pdf/renderer`

**Kriterium (vom PO gesetzt):** server-seitiger Sammel-PDF-Merge in Next.js/Vercel.

| Option | Layout | Sammel-PDF | Vercel/Node | DX im React/TS-Stack |
|--------|--------|------------|-------------|----------------------|
| **`@react-pdf/renderer`** | deklarativ (Flexbox, Text-Umbruch, Tabellen) | 1 Dokument mit N Seiten aus Snapshots | Node-Runtime, pure JS | hoch (JSX-Komponenten) |
| `pdf-lib` | manuell (Koordinaten, kein Text-Umbruch) | echtes binäres Merge (`copyPages`) | Node, pure JS | niedrig für Tabellenlayout |
| Puppeteer/Headless-Chrome (HTML→PDF) | HTML/CSS | via mehrfaches HTML | schwer (Chromium-Binary, Function-Size-Limit) | mittel |

**Entscheidung: `@react-pdf/renderer`.**

- Der Sammel-PDF-Fall wird **nicht** durch binäres Merge gelöst, sondern durch **Re-Rendering** aller
  Belege eines Laufs in ein einziges mehrseitiges Dokument. Da die Beleg-Daten unveränderliche Snapshots
  sind, ist das Ergebnis deterministisch und visuell identisch zu den einzeln archivierten PDFs. Damit
  entfällt die Notwendigkeit für `pdf-lib` — **eine Bibliothek weniger**.
- Node-Runtime (nicht Edge). Standard-Font **Helvetica** (deckt Latin-1 inkl. Umlaute) → keine externen
  Font-Fetches zur Laufzeit. Das Logo wird server-seitig aus dem `organization`-Bucket geladen und eingebettet.
- `pdf-lib` bleibt **dokumentierter Fallback**, falls je heterogene Fremd-PDFs zusammengeführt werden müssen.

**Verworfen:** Puppeteer/Headless-Chrome. Auf Vercel-Serverless heikel (Chromium-Binary, Function-Size-,
Cold-Start-Kosten). Kein Mehrwert gegenüber deklarativem PDF für ein tabellarisches Beleglayout.

### E7: Statistik — direkte SQL-Aggregation, keine Materialized Views

**Entscheidung:** Bei ~2'200 Fahrten/Monat (~26k/Jahr) genügen direkte SQL-Aggregationen in Server
Components, optional gekapselt in einer schlanken Lese-View `ride_stats`. Ergänzende Indexe:
`rides(date, status)`, `rides(driver_id, date, status)`, `rides(destination_id, date, status)`.

**Verworfen (vorerst):** Materialized Views / DWH. Bei diesem Volumen liegen selbst Jahresaggregationen
im einstelligen Millisekundenbereich. Re-Evaluation erst, wenn Auswertungen spürbar >200 ms brauchen
(dokumentierte Umkehrbarkeit — additive Einführung ohne Schema-Rewrite).

### E8: Distanz-Backfill — `distance_source` + einmaliger Batch

**Entscheidung:** Neues Feld `rides.distance_source` (`CHECK IN ('planned','backfill','estimate')`,
`DEFAULT 'planned'`). Migration setzt für Bestandsfahrten mit vorhandenem `distance_meters` retroaktiv
`'planned'`. Ein einmaliger Admin-Batch geocodet fehlende Distanzen abgeschlossener Fahrten via Directions
API (`'backfill'`), unter dem bestehenden Budget-Schutz (ADR-010), mit Rate-Limiting/Pausen. Fahrten ohne
Geodaten werden übersprungen und in einem Abschlussreport gelistet.

**Begründung:** Der Batch übernimmt die bereits in «Karten fixen» (ADR-014) etablierte idempotente,
gechunkte Batch-Mechanik (`processGeocodingBatch`-Muster) statt einer synchronen Server-Action-Schleife
(Serverless-Timeout-Risiko).

### E9: Navigation — `/finance` Sub-Nav, Redirect von `/billing`

**Entscheidung:** Neuer Hauptbereich `/finance` mit Sub-Navigation (Muster analog
`src/components/settings/settings-nav.tsx`): `/finance` (Dashboard), `/finance/receipts`,
`/finance/drivers`, `/finance/statistics`, `/finance/export`. Die heutige `/billing`-Funktionalität
(`getBillingData`, `BillingTable`, `ExportButton`) zieht nach `/finance/export` um. `/billing` erhält
einen Redirect (via `next.config` `redirects()` oder `redirect()` in der Page), damit Bookmarks
funktionieren. Zusätzlicher Einstieg: Patientendetail-Tab «Fahrten & Quittungen».

---

## RLS & Storage

| Objekt | Policy |
|--------|--------|
| `receipts`, `receipt_items` | SELECT + ALL nur `get_user_role() IN ('admin','operator')`; Fahrer kein Zugriff |
| `receipt_counters` | RLS aktiv, **keine** Policy (Deny-all); Zugriff nur via `SECURITY DEFINER`-RPC |
| Storage-Bucket `receipts` | privat (`public = false`); Zugriff via signierte URLs aus Server Actions (admin/operator) |
| `organization_settings` neue Spalten | bestehende Admin-Update-Policy deckt die Entschädigungs-Spalten ab |

Audit: Ausstellung und Storno werden über die bestehende `audit_log`-Infrastruktur protokolliert
(`entity_type = 'receipt'`, `action ∈ {'create','cancel'}`).

**Hinweis:** Das vertiefte Security-/DSGVO-Review (Anonymisierung vs. Belegaufbewahrung, RLS-Details,
Storage-Retention) erfolgt parallel durch den CISO (Ioannis). Dessen Findings werden über ein separates
Issue in M14 eingearbeitet.

---

## Konsequenzen

### Positiv

- Revisionsfähige, unveränderliche Belege mit lückenlosem Nummernkreis; Manipulationsschutz auf DB-Ebene.
- Belegaufbewahrung (OR 10 Jahre) und DSGVO-Anonymisierung koexistieren konfliktfrei (Snapshot + `SET NULL`).
- Nur **eine** PDF-Bibliothek (`@react-pdf/renderer`), kein Chromium, keine externen Laufzeit-Fetches.
- Statistik ohne DWH-Komplexität — «simple first, scalable later» mit klar dokumentiertem Upgrade-Pfad.
- Navigation additiv; `/billing` bleibt via Redirect erreichbar.

### Negativ

- Denormalisiertes `receipt_items.is_cancelled` erfordert Trigger-Pflege (Preis der Partial-Index-Lösung).
- Sammel-PDF re-rendert statt gespeicherte PDFs zu mergen — geringfügig mehr Rechenzeit pro Lauf
  (bei Monatsvolumen vernachlässigbar).
- Unversionierte Entschädigungssätze: Satzänderungen wirken rückwirkend auf Reports (bewusst einfach;
  Upgrade auf versionierte Sätze analog `fare_versions` ist vorgezeichnet).

### Risiken

| Risiko | Wahrscheinlichkeit | Impact | Mitigation |
|--------|--------------------|--------|------------|
| Anonymisierungsjob leert versehentlich Snapshot-Felder | Gering | Hoch (Beleg unbrauchbar) | Snapshot in separaten Tabellen; Anonymisierung fasst `receipts` nicht an; Ioannis-Review + Test |
| PDF-Erzeugung schlägt fehl (Storage/Render) | Mittel | Gering | Beleg-Insert entkoppelt; `pdf_path NULL` + idempotenter «neu erzeugen»-Pfad |
| Nummernlücke durch Rollback | Gering | Mittel (formaler Kreis) | Zähler-Increment in derselben Transaktion → Rollback gibt Nummer frei |
| Backfill-Kosten/Timeout | Gering | Gering | Budget-Schutz (ADR-010), gechunkter idempotenter Batch (ADR-014-Muster) |
| Statistik-Queries werden langsam bei Wachstum | Gering | Gering | Indexe gesetzt; MV-Upgrade als dokumentierte Umkehrbarkeit |

---

## Betroffene Bereiche (Grobschnitt, Details in den Issues)

- **Migration (14.1):** `receipts`, `receipt_items`, `receipt_counters` (+ RPC + Trigger), Partial-Unique-Index,
  `patients.email/billing_recipient_name/billing_recipient_address`, `rides.distance_source`,
  `organization_settings.driver_comp_per_ride_chf/driver_comp_per_km_chf`, RLS, Storage-Bucket `receipts`.
- **Backfill-Job (14.1):** Directions-Batch für `completed`-Fahrten ohne `distance_meters`.
- **Nav-Umbau (14.1):** `/finance`-Shell + Sub-Nav, `/billing` → `/finance/export` (Umzug + Redirect).
- **Quittungen (14.2):** Erstell-Flow (Einzel), PDF-Generierung, Storno, Patientendetail-Tab, E-Mail (ADR-013-Infra).
- **Sammellauf + Fahrer-Report (14.3):** Periodenlauf mit Sammel-PDF, Entschädigungs-Konfiguration, CSV.
- **Dashboard + Statistik (14.4):** KPI-Kacheln, Charts, flexible Auswertung, CSV.
- **Tests + Doku (14.x):** Nummernkreis-Concurrency, Immutability-Trigger, Partial-Index, RLS, PDF-Snapshot.

Vollständiges Konzept: `docs/finanzmodul-konzept.md`.

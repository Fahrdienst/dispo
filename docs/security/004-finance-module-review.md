# Security-/Compliance-Review — Finanzmodul (M14)

**Reviewer:** Ioannis (CISO)
**Datum:** 2026-07-15
**Review-Gegenstand:** `docs/finanzmodul-konzept.md` (Konzept-Entwurf, Stand 2026-07-15)
**Phase:** Vor Implementierung / vor ADR-015 (Martin, parallel)
**Klassifizierung:** INTERNAL — VERTRAULICH

> Dieses Review bewertet das Konzept **vor** der Umsetzung. Es ändert das Konzept-Dokument
> nicht (ADR-015 in Arbeit), sondern formuliert Anforderungen und offene Entscheide.
> Referenzen: ADR-013 (`docs/adrs/013-order-sheet-email.md`), Schema-Review
> (`docs/security/002-schema-security-review.md`), RLS-Resolution
> (`docs/security/003-rls-review-resolution.md`), Migrationen `20260320` (Audit),
> `20260321` (GDPR-Anonymisierung), `20260319`/`20260323` (Storage).

---

## 1. Zusammenfassung & Verdikt

**Verdikt: CONDITIONAL GO.** Das Konzept ist aus Security-Sicht grundsätzlich solide
(private Buckets nach `feedback`-Muster, RLS-Beschränkung admin+operator, Snapshot-Design,
Storno-statt-Löschen). Der Anonymisierungs-Ansatz aus Abschnitt 8 (`patient_id → NULL`,
Snapshot bleibt) ist **DSGVO-konform vertretbar** — mit Auflagen. Vor Migration (Phase 13.1)
müssen die beiden CRITICAL-Findings umgesetzt sein; die HIGH-Findings vor Feature-Freigabe
(Phase 13.2/13.3).

### Findings nach Severity

| ID | Severity | Titel |
|----|----------|-------|
| SEC-M14-001 | **CRITICAL** | Unveränderlichkeit ist per RLS allein nicht durchsetzbar — Trigger + kein direktes UPDATE/DELETE nötig |
| SEC-M14-002 | **CRITICAL** | Nummernkreis muss atomar via SECURITY DEFINER vergeben werden; Counter darf nicht client-beschreibbar sein |
| SEC-M14-003 | **HIGH** | Anonymisierungsjob muss `receipts.patient_id` explizit kappen und den Snapshot garantiert nie anfassen (Regressionsschutz) |
| SEC-M14-004 | **HIGH** | Quittungs-Mail: Inhaltsminimierung, PDF als Anhang statt Link, Gmail als Sub-Prozessor (AVV) |
| SEC-M14-005 | **HIGH** | Signierte Storage-URLs kurzlebig (≤ 5 min) — **nicht** das 1-Jahres-Muster aus `feedback` übernehmen |
| SEC-M14-006 | **HIGH** | Audit-Abdeckung für Ausstellung/Storno/**Export** inkl. Erweiterung der TS-Enums im Logger |
| SEC-M14-007 | **MEDIUM** | Statistik-View/Exporte serverseitig rollen-gaten; Bucket-Default-Deny bestätigen |
| SEC-M14-008 | **MEDIUM** | `billing_recipient`: Offenlegung an Dritte (Angehörige/Beistand) braucht Rechtsgrundlage |
| SEC-M14-009 | **MEDIUM** | CSV-/Statistik-Export: Gesundheitsinferenz über Dimension «Ziel» begrenzen |
| SEC-M14-010 | **MEDIUM** | Patienten-E-Mail vor Versand verifizieren (Fehlversand = Gesundheitsdaten an Dritte) |
| SEC-M14-011 | **MEDIUM** | 10-Jahres-Löschjob für PDF + Snapshot fehlt (Speicherbegrenzung Art. 5 Abs. 1 lit. e) |
| SEC-M14-012 | **LOW** | Pfadstruktur/Nummer im Storage — keine PII in Pfad |
| SEC-M14-013 | **LOW** | Distanz-Backfill-Lauf auditieren |

**3 wichtigste Muss-Anforderungen:** SEC-M14-001 (Immutability-Trigger), SEC-M14-002
(atomarer Nummernkreis), SEC-M14-003 (Anonymisierung kappt Referenz, schützt Snapshot).

---

## 2. Schwerpunkt Anonymisierung vs. Belegaufbewahrung (Konzept Abschnitt 8) ⚠

### 2.1 Ist-Analyse des bestehenden Jobs

`supabase/migrations/20260321_000001_gdpr_anonymization.sql` **löscht Patienten nie** — die
Funktion `anonymize_patient()` führt ein `UPDATE patients SET first_name='ANONYMISIERT' …`
durch (Soft-Anonymisierung). Konsequenz für das Konzept:

- Der im Konzept genannte Mechanismus **`patient_id → NULL via ON DELETE SET NULL` greift nie**,
  weil keine `DELETE`-Operation stattfindet. `ON DELETE SET NULL` ist ein sinnvoller struktureller
  Schutz für den Fall einer echten Zeilenlöschung, aber im heutigen Anonymisierungspfad **inaktiv**.
- Das ist genau der Grund, warum das Snapshot-Design richtig ist: `receipts.recipient_name`,
  `recipient_address` und die `receipt_items`-Beschreibungen werden bei Ausstellung **kopiert**
  und sind vom Patienten-Datensatz entkoppelt. Eine Anonymisierung des Patienten leert den
  Beleg nicht — das ist gewollt und aufbewahrungsrechtlich notwendig.

### 2.2 DSGVO-Bewertung — ist der Ansatz vertretbir?

**Ja, mit Auflagen.** Eine Zahlungsbestätigung ist ein Buchungsbeleg im Sinne von
**OR Art. 958f** (Aufbewahrungspflicht 10 Jahre, unveränderbar). Damit greift **DSGVO
Art. 17 Abs. 3 lit. b** (Verarbeitung zur Erfüllung einer rechtlichen Verpflichtung) — das
Recht auf Löschung ist für den ausgestellten Beleg **überlagert**. Der Beleg darf und muss
im ursprünglichen Zustand aufbewahrt werden, inklusive Empfängername (der Name ist
konstituierender Bestandteil des Belegs; ohne ihn verliert er seine Beweisfunktion).

**Aber:** Aufbewahrungspflicht rechtfertigt nur den **Beleg selbst**, nicht die fortbestehende
**Verknüpfbarkeit** mit dem betroffenen Patienten über andere Datenbestände. Nach einem
Erasure-Request (Art. 17) muss die Re-Assoziation unterbunden werden:

→ **SEC-M14-003 (HIGH):** `anonymize_patient()` muss `UPDATE receipts SET patient_id = NULL
WHERE patient_id = p_patient_id` ausführen. Snapshot-Spalten (`recipient_name`,
`recipient_address`, alle `receipt_items`) bleiben **unangetastet**. So bleibt der Beleg
aufbewahrungsfähig, aber die Fremdschlüssel-Brücke zum (anonymisierten) Patienten ist gekappt.
Analog muss geprüft werden, dass die bestehende `communication_log`-Anonymisierung
(Zeile 59–62 der Migration) nicht versehentlich Belegdaten mitanonymisiert (tut sie nicht —
sie fasst nur `communication_log` an; bestätigt).

### 2.3 Muss der Anonymisierungsjob receipts ausklammern?

**Teils schützen, teils gezielt anfassen:**
- **Snapshot-Spalten:** explizit **ausklammern** (nie leeren). Da die Funktion tabellenweise
  arbeitet und `receipts` heute nicht kennt, ist der Default-Zustand korrekt. Das reicht aber
  nicht — es braucht einen **aktiven Regressionsschutz**, damit ein späterer Entwickler nicht
  „der Vollständigkeit halber" `receipts` mit anonymisiert und damit die Aufbewahrungspflicht
  verletzt:
  - Kommentar-Block in der Migration, der die OR-Aufbewahrung und das Verbot erklärt.
  - Ein Unit-/Integrationstest, der nach `anonymize_patient()` prüft: `receipts.recipient_name`
    bleibt gesetzt **und** `receipts.patient_id IS NULL`.
- **Fremdschlüssel `patient_id`:** **gezielt** auf NULL setzen (siehe 2.2).

### 2.4 Gesundheitsinferenz im Snapshot (Art. 9)

Die `receipt_items.description` (z.B. „Dübendorf → USZ Zürich") enthält Zielnamen, die einen
medizinischen Kontext offenlegen (USZ = Universitätsspital). Nach Anonymisierung des Patienten
verbleibt auf dem Beleg `recipient_name` + medizinisches Ziel für 10 Jahre — faktisch eine
gesundheitsbezogene Personenaussage (Art. 9). Das ist **inhärent zum Belegzweck** (der Patient
reicht die Quittung selbst bei der Krankenkasse ein) und aufbewahrungsrechtlich gedeckt.
Auflage: strenge Zugriffskontrolle (nur admin+operator, siehe Abschnitt 5) und Aufnahme in
das VVT als Art.-9-relevante Verarbeitung (siehe Abschnitt 7).

### 2.5 Eintrag ins Verzeichnis der Verarbeitungstätigkeiten (VVT)

Neue Verarbeitungstätigkeit **„Ausstellung und Aufbewahrung von Zahlungsbestätigungen"**:

| Feld | Inhalt |
|---|---|
| Zweck | Zahlungsnachweis, Einreichung bei Krankenkasse, kaufmännische Aufbewahrung |
| Datenkategorien | Name/Adresse (bzw. `billing_recipient`), Fahrtdaten (Datum, Route/Ziel, km, Betrag), Belegnummer, ausstellende Person |
| Besondere Kategorien (Art. 9) | Ja — Zielorte lassen medizinischen Kontext erkennen; inhärent zum Belegzweck |
| Rechtsgrundlage Ausstellung | Art. 6 Abs. 1 lit. b (Leistungserbringung / Wunsch des Patienten) |
| Rechtsgrundlage Aufbewahrung | Art. 6 Abs. 1 lit. c i.V.m. Art. 17 Abs. 3 lit. b, OR Art. 958f (10 Jahre) |
| Empfänger | Patient (+ optional billing_recipient), Google/Gmail (E-Mail-Zustellung, Sub-Prozessor), Supabase (Speicherung), Hosting |
| Löschfrist | 10 Jahre nach Ausstellung, danach Löschung PDF + Anonymisierung Snapshot (SEC-M14-011) |
| Betroffenenrechte | Löschung durch gesetzliche Aufbewahrung überlagert; `patient_id`-Verknüpfung wird bei Anonymisierung gekappt |

Zusätzlich: Stammdaten-Verarbeitung um Feld `patients.email` (Zweck Quittungsversand) ergänzen.

---

## 3. Findings im Detail

### SEC-M14-001 (CRITICAL) — Unveränderlichkeit per Trigger erzwingen

**Bedrohung:** Böswilliger oder kompromittierter Operator ändert `total_amount`,
`recipient_name` oder Item-Beträge eines bereits ausgestellten Belegs (Beleg-Manipulation,
Verletzung der Revisionsfähigkeit / OR-Unveränderbarkeit).

**Angriffsvektor:** RLS-Policies allein genügen nicht. Wenn `receipts` eine
UPDATE-Policy für operator/admin erhält (wie alle anderen Tabellen im Schema, siehe
`get_user_role() IN ('admin','operator')`-Muster), kann jeder Operator **jede** Spalte ändern.
Der öffentliche Supabase-anon-Key erlaubt direkte Queries (vgl. akzeptiertes Risiko SEC-004).

**Maßnahme (Muss):**
1. **Kein direktes UPDATE/DELETE** auf `receipts`/`receipt_items` für authenticated — keine
   permissive UPDATE/DELETE-Policy anlegen (Default-Deny greift dann). Analog zum `audit_log`
   (Migration `20260320`, „No UPDATE/DELETE — immutable").
2. **BEFORE UPDATE/DELETE-Trigger** als Defense-in-Depth: UPDATE nur zulässig, wenn
   ausschließlich `status` (`issued`→`cancelled`), `cancelled_reason`, `cancelled_at`
   geändert werden; jede Änderung an eingefrorenen Spalten und jedes DELETE wird mit
   `RAISE EXCEPTION` abgelehnt. `receipt_items`: UPDATE/DELETE komplett blockiert
   (außer CASCADE beim — hier nie eintretenden — Storno-Delete; Storno löscht **nicht**).
3. Schreibpfad (Ausstellung, Storno) ausschließlich über **serverseitige Server Actions**
   (`requireAuth(["admin","operator"])`) bzw. eine SECURITY-DEFINER-Funktion.

Trigger-Funktionen: `LANGUAGE plpgsql SECURITY DEFINER SET search_path = public` (Pflicht,
vgl. SEC-002 aus Review 002).

### SEC-M14-002 (CRITICAL) — Atomarer Nummernkreis, Counter nicht client-beschreibbar

**Bedrohung:** Nummernlücken/-duplikate bei parallelen Ausstellungen; Manipulation des
Counters durch einen Operator (rückdatierte oder gefälschte Belegnummern).

**Maßnahme (Muss):**
1. Nummernvergabe in einer **SECURITY-DEFINER-Funktion** `next_receipt_number(p_year int)`
   mit `SELECT … FOR UPDATE` auf `receipt_counters`, `SET search_path = public`. Aufruf
   **innerhalb derselben Transaktion** wie das `INSERT INTO receipts`, damit ein
   Rollback die Nummer freigibt (keine unnötigen Lücken).
2. `receipt_counters`: **keine** INSERT/UPDATE/DELETE-Policy für authenticated. Nur die
   SECURITY-DEFINER-Funktion (bzw. service_role) schreibt. SELECT höchstens admin.
3. **Nummern nie wiederverwenden** — auch nicht nach Storno. Der Beleg behält seine Nummer,
   Status wird `cancelled`. Eine Lücke ist ein Compliance-*Feature* (signalisiert fehlenden
   Beleg) und muss untersuchbar sein, kein Bug. Im Runbook dokumentieren.

### SEC-M14-003 (HIGH) — Anonymisierung: Referenz kappen, Snapshot schützen

Siehe Abschnitt 2.2–2.3. Konkret: `anonymize_patient()` um
`UPDATE receipts SET patient_id = NULL WHERE patient_id = p_patient_id` ergänzen; Snapshot
unangetastet; Regressionstest + Migrationskommentar (OR-Aufbewahrung). Kein Anfassen von
`receipt_items`.

### SEC-M14-004 (HIGH) — Quittungs-Mail: Minimierung, Anhang statt Link, Sub-Prozessor

**Bestehende Infra (Wiederverwendbarkeit):** `src/lib/mail/transport.ts` nutzt **nodemailer
mit Gmail-Service** (`GMAIL_USER`/`GMAIL_APP_PASSWORD`). `sendMail()` unterstützt `attachments`.
Templates sind modular (ADR-013) mit `escapeHtml()` — XSS-Schutz vorhanden und wiederverwendbar.

**Bewertung:** Wiederverwendbar, aber die neue Zielgruppe ändert die Risikolage grundlegend:
Empfänger ist jetzt der **Patient** (bzw. Angehörige), nicht mehr der interne Fahrer, und der
Inhalt ist **gesundheitskontextuell** (medizinische Zielorte).

**Maßnahme (Muss):**
1. **Inhaltsminimierung der Mail-Body:** Der E-Mail-Text enthält **keine** Zielnamen/Routen/
   Diagnosen — nur neutralen Hinweis: „Ihre Quittung Nr. Q-2026-00042 liegt bei." Betreff
   ebenfalls neutral, ohne Ziel/Gesundheitsbezug. Die medizinisch inferierbaren Details
   stehen ausschließlich im PDF.
2. **PDF als Anhang, nicht als Link.** Ein signierter Storage-Link in einer Mail ist ein
   Bearer-Token im Postfach (Weiterleitung/Leak → Gesundheitsdaten-Exposure) und erzwänge
   eine lange TTL (Konflikt mit SEC-M14-005). Anhang vermeidet den persistenten Link.
3. **Google Workspace/Gmail als Sub-Prozessor** im VVT führen; AVV/DPA mit Google
   sicherstellen (ergänzend zu den bereits offenen Supabase-/Vercel-AVVs). Transport erfolgt
   TLS-gesichert; Inhalt liegt bei Google unverschlüsselt vor → Minimierung (Punkt 1) ist die
   maßgebliche Kompensation.
4. `mail_log` (Migration `20260227`) darf **keine** PDF-Inhalte/Gesundheitsdaten speichern —
   nur Metadaten (recipient, status, template, Zeit). Bestehendes Muster beibehalten.

### SEC-M14-005 (HIGH) — Signierte URLs kurzlebig

Der `feedback`-Bucket (`src/actions/feedback.ts`) verwendet bewusst **1-Jahres-Signed-URLs**,
weil die URL dauerhaft in einem GitHub-Issue eingebettet ist. **Dieses Muster darf für
`receipts` NICHT übernommen werden.** Quittungs-PDFs werden on-demand in einer authentifizierten
Session heruntergeladen.

**Maßnahme:** Signierte URL mit **TTL ≤ 300 s (5 min)**, pro Download-Aktion frisch erzeugt,
ausschließlich in einer Server Action nach `requireAuth(["admin","operator"])`. Beim
Mail-Versand keine URL verwenden (Anhang, siehe SEC-M14-004).

### SEC-M14-006 (HIGH) — Audit-Abdeckung inkl. Export

**Ist:** `src/lib/audit/logger.ts` deckt `entity_type` als TS-Union ab **ohne** `receipt`;
`action` ohne `issue`/`cancel`/`export`. DB-Spalte ist `TEXT` (keine Enum-Migration nötig),
aber die TS-Unions müssen erweitert werden, sonst wird falsch/gar nicht geloggt.

**Maßnahme (Muss protokollieren):**
- **Ausstellung:** `entity_type='receipt'`, `action='create'`, `entity_id=receipt.id`,
  metadata: `receipt_number`, `patient_id`, `total_amount`, `item_count`, `period`.
- **Storno:** `action='cancel'`, metadata: `cancelled_reason`, `receipt_number`.
- **Export (CSV/Statistik/Fahrer-Report):** `action='export'`, `entity_type='receipt'` bzw.
  neu `'report'`, metadata: Report-Typ, Zeitraum, Zeilenzahl, `requested_by`. **Exporte von
  finanziellen/gesundheitsadjazenten Daten müssen protokolliert werden** (Accountability
  Art. 5 Abs. 2; wer hat wann welche Daten exportiert).
- TS-Unions `AuditAction` / `AuditEntityType` in `logger.ts` entsprechend erweitern
  (`'cancel'`, `'export'`; `'receipt'`, ggf. `'report'`).

### SEC-M14-007 (MEDIUM) — RLS/Bucket bestätigen, Statistik serverseitig gaten

- **Bucket `receipts`:** exakt nach `feedback`-Muster (Migration `20260323`): `public=false`,
  **keine** Policy, die den Bucket referenziert → Default-Deny für anon/authenticated,
  Zugriff nur via service_role. Keine breite `FOR ALL`-Policy (würde alle Buckets öffnen).
- **RLS receipts/receipt_items/receipt_counters:** SELECT/INSERT nur
  `get_user_role() IN ('admin','operator')`; kein Fahrer-Zugriff; kein UPDATE/DELETE (SEC-M14-001).
- **Statistik/`ride_stats`-View:** Fahrer haben SELECT auf ihre **eigenen** Fahrten
  (`rides_select_driver`). Eine ungeschützte Aggregat-View könnte über den anon-Key
  Gesamtumsätze/-mengen offenlegen. Daher: Statistik- und Report-Daten **serverseitig** via
  Server Action mit `requireAuth(["admin","operator"])` bereitstellen; falls eine DB-View
  genutzt wird, `security_invoker = on` setzen, damit die zugrunde liegende RLS greift, und die
  View nicht breiter granten als nötig.

### SEC-M14-008 (MEDIUM) — `billing_recipient`: Offenlegung an Dritte

Ein abweichender Rechnungsempfänger (Angehörige/Beistand) bedeutet, dass eine gesundheits-
adjazente Quittung an eine **dritte Person** geht.
- **Beistand (gesetzliche Vertretung):** Rechtsgrundlage über Vertretungsbefugnis gegeben.
- **Angehörige ohne Vertretungsbefugnis:** benötigen eine **Einwilligung des Patienten**.

**Maßnahme:** Beim Setzen von `billing_recipient` + Mailversand an Dritte muss der Prozess eine
dokumentierte Berechtigung/Einwilligung voraussetzen. Kein automatischer Versand an
`billing_recipient` ohne diesen Nachweis. PO-Entscheid zur Prozessausgestaltung nötig
(Offener Punkt 5).

### SEC-M14-009 (MEDIUM) — Export-Gesundheitsinferenz begrenzen

- **Fahrer-Report-CSV:** enthält nur Aggregate (Fahrten, km, Zeit, Einnahmen, Entschädigung) —
  **keine** Patientennamen, **keine** Zielnamen. Spalten-Allowlist erzwingen (kein `SELECT *`).
  Konsistent mit der etablierten Konvention (Memory: Fahrer-Projektionen enumerieren Spalten).
- **Statistik-Export mit Dimension „Ziel":** Zielnamen können Spitäler/Kliniken sein →
  Gesundheitsinferenz. Solche Exporte sind intern (admin/operator), gelten aber als
  **VERTRAULICH** und dürfen die Organisation nicht verlassen. UI-Hinweis + Audit (SEC-M14-006).
  Keine Patienten-Klarnamen in aggregierten Exporten (Dimension „Patient" nur mit ID/Pseudonym
  oder ausschließlich in der Detail-Drilldown-Ansicht, nicht im CSV).

### SEC-M14-010 (MEDIUM) — Patienten-E-Mail vor Versand verifizieren

Ein Tippfehler in `patients.email` sendet eine gesundheitsadjazente Quittung an eine fremde
Person = meldepflichtige Datenschutzverletzung (Art. 33/34).

**Maßnahme:** Vor dem ersten Versand die Adresse im UI explizit bestätigen lassen
(Anzeige der Zieladresse im Sende-Dialog). Optional: Double-Opt-in/Verifikation der
Patienten-E-Mail. Mindestens: Bestätigungsschritt „Senden an `max@…`?" mit sichtbarer Adresse.

### SEC-M14-011 (MEDIUM) — 10-Jahres-Löschjob fehlt (Speicherbegrenzung)

Art. 5 Abs. 1 lit. e verlangt Löschung nach Wegfall des Zwecks. Nach Ablauf der 10-jährigen
OR-Frist müssen PDF (Storage) **und** Snapshot-PII (`recipient_name`, `recipient_address`,
`receipt_items.description`) gelöscht/anonymisiert werden. Heute existiert kein solcher Job.

**Maßnahme:** Aufbewahrungs-/Löschkonzept ins VVT (Abschnitt 2.5); Implementierung eines
periodischen Löschjobs kann bis nahe Fristende zurückgestellt werden, **muss aber jetzt als
geplante Maßnahme dokumentiert** und der Zeitpunkt (Go-Live Feb 2026 + 10 J) festgehalten werden.
Offener Punkt 4 des Konzepts damit beantwortet: 10 Jahre, danach Löschjob — bestätigt.

### SEC-M14-012 (LOW) — Storage-Pfad

`receipts/<year>/<number>.pdf` enthält **keine** PII (Belegnummer ist kein Personenbezug) —
gut. Vorhersagbarkeit des Pfads ist unkritisch, da der Bucket privat ist und ohne service_role +
kurzlebige Signatur kein Zugriff besteht. Keine Patientennamen in Datei-/Pfadnamen aufnehmen.

### SEC-M14-013 (LOW) — Distanz-Backfill auditieren

Der einmalige Directions-API-Backfill sendet nur **bereits vorhandene** Geokoordinaten an
Google (kein neuer PII-Abfluss über ADR-010 hinaus). Den Lauf als Admin-Aktion auditieren
(`action='update'`, metadata: betroffene Fahrten, übersprungene Fahrten, Zeitpunkt) und den
Abschlussreport (übersprungene Fahrten) nicht mit Patientenklarnamen exportieren.

---

## 4. Threat Model (STRIDE, Kurzfassung)

| Kategorie | Bedrohung | Kontrolle |
|---|---|---|
| **Tampering** | Operator ändert ausgestellten Beleg | SEC-M14-001 (Trigger, kein UPDATE/DELETE) |
| **Tampering** | Manipulation Nummernkreis | SEC-M14-002 (SECURITY DEFINER, Counter nicht schreibbar) |
| **Information Disclosure** | Gesundheitsdaten an Dritte via Mail/Link | SEC-M14-004/005/010 (Minimierung, Anhang, Verifikation) |
| **Information Disclosure** | Fahrer/anon-Key liest Belege/Statistik | SEC-M14-007 (RLS Default-Deny, serverseitiges Gating) |
| **Repudiation** | „Ich habe den Beleg nicht ausgestellt/exportiert" | SEC-M14-006 (Audit inkl. Export) |
| **Elevation of Privilege** | Fahrer sieht fremde Umsätze | SEC-M14-007 (keine Fahrer-Policy, View security_invoker) |
| **Info Disclosure (Recht)** | Erasure-Umgehung durch fortbestehende Verknüpfung | SEC-M14-003 (patient_id kappen) |

---

## 5. Offene Entscheide für den Product Owner

1. **PDF-Zustellung Mail:** Anhang (empfohlen, SEC-M14-004) vs. Link — bitte Anhang bestätigen.
2. **`billing_recipient`-Versand an Dritte:** Prozess für Einwilligung/Vertretungsnachweis
   festlegen (SEC-M14-008).
3. **Google Workspace AVV:** Bestätigen, dass ein DPA/AVV mit Google für die Gmail-Zustellung
   besteht (SEC-M14-004). Falls nicht: alternativer Mailversand-Provider prüfen.
4. **10-Jahres-Löschung (SEC-M14-011):** Konzept bestätigen (Vorschlag: automatischer Löschjob
   PDF + Snapshot nach 10 J). Offener Punkt 4 des Konzepts.
5. **Patienten-E-Mail-Verifikation (SEC-M14-010):** Minimal Bestätigungsschritt oder Double-Opt-in?
6. **DSFA/DPIA:** Angesichts systematischer Verarbeitung gesundheitsadjazenter Daten (Art. 9)
   im neuen Umfang empfiehlt sich eine kurze Aktualisierung der bestehenden DSFA-Bewertung
   (bereits als offen im Memory geführt).

---

## 6. Abnahmekriterien vor Phase-Freigabe

**Vor 13.1 (Migration):** SEC-M14-001, SEC-M14-002, SEC-M14-003 umgesetzt und getestet;
Bucket nach `feedback`-Muster; VVT-Eintrag erstellt.
**Vor 13.2 (Quittungen/Mail):** SEC-M14-004, SEC-M14-005, SEC-M14-006, SEC-M14-010.
**Vor 13.3 (Report/CSV):** SEC-M14-007, SEC-M14-009 (Export-Allowlist + Audit).
**Vor Produktivbetrieb:** SEC-M14-011 dokumentiert, SEC-M14-008 Prozess definiert.

---

*Reviewed by Ioannis (CISO), 2026-07-15*
*Klassifizierung: INTERNAL — VERTRAULICH*
*Bezug: `docs/finanzmodul-konzept.md`, ADR-015 (in Arbeit, Martin)*

---

## 7. Verifikations-Nachtrag (Code-Review gegen `main`)

**Datum:** 2026-07-16
**Reviewer:** Ioannis (CISO)
**Geprüfter Stand:** `main` @ `82d5216` (Merge M12 als Basis; M14 alle 4 Phasen gemerged).
**Gegenstand:** Verifikation der Findings SEC-M14-001..013 **gegen den implementierten Code**
(nicht gegen Behauptungen). Geprüfte Artefakte: Migrationen `20260718`–`20260723`,
`src/actions/receipt-*`, `src/actions/driver-report.ts`, `src/actions/statistics.ts`,
`src/actions/distance-backfill.ts`, `src/lib/receipts/*`, `src/lib/mail/receipt-mail.ts`,
`src/lib/finance/*`, `src/lib/audit/logger.ts`, `src/app/(dashboard)/finance/**`.

### 7.1 Gesamtverdikt

**GO mit einer offenen Lücke (MEDIUM) + PO-Entscheiden.** Die beiden CRITICALs und die
HIGH/MEDIUM/LOW-Findings sind ganz überwiegend sauber und teils vorbildlich umgesetzt
(Immutability-Trigger, atomarer Nummernkreis, Snapshot-Schutz, Mail-Minimierung, TTL 300 s,
Pseudonymisierung, Export-Audit). **Eine echte Lücke** wurde gefunden: der on-demand
**Sammel-PDF-Download** (`.../receipts/batch/download/route.ts`) exportiert Beleg-Inhalte
(Namen + medizinisch inferierbare Zielorte, bis zu 500 Belege) **ohne Audit-Eintrag** —
Teilverstoß gegen SEC-M14-006 (Accountability Art. 5 Abs. 2). Kein Fix im Rahmen dieses
Reviews (paralleler Agent), präzise dokumentiert unten.

### 7.2 Ergebnis je Finding

| ID | Severity | Verdikt | Nachweis (Datei) |
|----|----------|---------|------------------|
| SEC-M14-001 | CRITICAL | **UMGESETZT** | `20260718` §5/§7: BEFORE-UPDATE/DELETE-Trigger auf `receipts`+`receipt_items` (`SECURITY DEFINER SET search_path=public`), Default-Deny (kein UPDATE/DELETE-Policy), Storno-Propagation via AFTER-Trigger. |
| SEC-M14-002 | CRITICAL | **UMGESETZT** | `20260718` §4: `next_receipt_number()` SECURITY DEFINER, atomarer `ON CONFLICT DO UPDATE`, Rollen-Gate (`service_role`/admin/operator), `receipt_counters` RLS deny-all. Aufruf in `issue_receipt` (`20260720`) in derselben Transaktion. |
| SEC-M14-003 | HIGH | **UMGESETZT** | `20260718` §9: `anonymize_patient()` ergänzt um `UPDATE receipts SET patient_id=NULL`; Snapshot (`recipient_name/-address`, `receipt_items`) unangetastet; Trigger lässt `patient_id` nur → NULL kappen. Migrationskommentar (OR 958f) vorhanden. |
| SEC-M14-004 | HIGH | **UMGESETZT** | `src/lib/mail/receipt-mail.ts`: Body trägt nur Anrede/Nr./Zeitraum/Org (schmales `ReceiptMailData`-Interface); PDF als **Anhang** (`attachments`), kein Link; `mail_log` metadaten-only; `escapeHtml` (XSS). |
| SEC-M14-005 | HIGH | **UMGESETZT** | `src/lib/receipts/constants.ts` `RECEIPT_SIGNED_URL_TTL_SECONDS = 300`; einzige Signatur-Stelle für Belege in `receipt-download.ts`. Grep bestätigt: nur `feedback.ts` (1 J, gewollt) + `receipt-download.ts` (300 s) rufen `createSignedUrl`. Mail-Pfad nutzt gar keine URL. |
| SEC-M14-006 | HIGH | **TEILWEISE** | Ausstellung (`20260720` RPC → `audit_log`), Storno (`receipt-cancel.ts` `action='cancel'`), CSV-Exporte (`driver-report.ts`/`statistics.ts` `action='export'/entity='report'`), Mailversand (`receipt-email.ts`) und Batch-Lauf (`receipt-batch.ts`) alle geloggt; `AuditAction`/`AuditEntityType` um `cancel`/`export`/`receipt`/`report` erweitert. **LÜCKE:** Sammel-PDF-Download nicht auditiert (7.3). |
| SEC-M14-007 | MEDIUM | **UMGESETZT** | `20260723`: alle 5 Dashboard-RPCs `SECURITY INVOKER` **+** explizites Rollen-Gate (`get_user_role() IN ('admin','operator')`) + `REVOKE ALL FROM PUBLIC`. `statistics-data.ts`/`driver-report-data.ts` fetchen über user-scoped Client (RLS greift), Aggregation serverseitig. Bucket `receipts` `public=false`, kein Policy → Default-Deny. `/finance/layout.tsx` gated admin+operator. |
| SEC-M14-008 | MEDIUM | **OFFEN (PO/Prozess)** | `billing_recipient_*` implementiert (`20260719`, `issue_receipt`), Kommentar verweist auf SEC-M14-008; **kein** Einwilligungs-/Vertretungsnachweis erzwungen. Erwartungsgemäß Prozess-/PO-Entscheid, kein Code-Fehler. |
| SEC-M14-009 | MEDIUM | **UMGESETZT** | `statistics.ts`: Patient-Dimension → `exportLabel = patientPseudonym()` (P-<8hex>) im CSV, Klarname nur am Schirm; explizite Spalten-Allowlist (`STAT_CSV_COLUMNS`), kein `SELECT *` (`RIDE_SELECT` enumeriert). Fahrer-Report aggregat-only (keine Patienten/Ziele). `SENSITIVE_DIMENSIONS` markiert Ziel+Patient. |
| SEC-M14-010 | MEDIUM | **UMGESETZT (Minimum)** | `receipt-mail.ts`: Empfänger ausschließlich aus `patients.email`, nie geraten, kein Send ohne Adresse. `receipt-list-email-dialog.tsx`: Bestätigungsdialog zeigt Zieladresse explizit vor Versand. Double-Opt-in/Verifikation bleibt PO-Option. |
| SEC-M14-011 | MEDIUM | **OFFEN (geplant/PO)** | Kein 10-Jahres-Löschjob im Code (erwartungsgemäß zurückgestellt). Muss als geplante Maßnahme im VVT dokumentiert werden. |
| SEC-M14-012 | LOW | **UMGESETZT** | `pdf-service.ts`: Pfad `<year>/<receipt_number>.pdf` (`receiptYear()`), keine PII; privater Bucket. |
| SEC-M14-013 | LOW | **UMGESETZT** | `distance-backfill.ts`: admin-only, `logAudit(action='update', metadata.job='distance_backfill', processed/…)`; `getDistanceBackfillSkipped()` liefert nur `id`+`date` (keine Patientennamen). |

### 7.3 Gefundene Lücke (präzise Dokumentation, NICHT gefixt)

🟡 **SEC-M14-006-GAP (MEDIUM) — Sammel-PDF-Download ohne Audit-Eintrag**

- **Datei:** `src/app/(dashboard)/finance/receipts/batch/download/route.ts`, `POST`-Handler,
  nach erfolgreichem `renderBatchReceiptPdf(parsed.data.ids)` (Zeile ~49–59).
- **Was fehlt:** Kein `logAudit(...)`. Die Route streamt ein Sammel-PDF mit bis zu 500
  Beleg-Inhalten (Empfängername + medizinisch inferierbare Zielorte) an den Browser, ohne
  festzuhalten, **wer wann welche Belege** exportiert hat. Auch die aufgerufene Lib-Funktion
  `src/lib/receipts/batch-pdf-service.ts` (`renderBatchReceiptPdf`) protokolliert nicht.
- **Warum relevant:** SEC-M14-006 verlangt, dass **Exporte** finanzieller/gesundheits-
  adjazenter Daten attribuierbar sind (Art. 5 Abs. 2 DSGVO, Accountability). CSV-Exporte und
  der Mailversand erfüllen das; dieser Bulk-PDF-Export ist die **einzige** Export-Oberfläche
  ohne Audit — inkonsistent und die risikoreichste (höchstes Datenvolumen je Aktion).
- **Positiv (bereits vorhanden):** `requireAuth(["admin","operator"])`, IDs im Body (nicht in
  Access-Logs), `Cache-Control: no-store`, nicht persistiert.
- **Empfohlene Maßnahme:** Nach erfolgreichem Render ein `logAudit({ action:'export',
  entityType:'report', metadata:{ report_type:'receipt_batch_pdf', receipt_count:ids.length,
  … } })` ergänzen (analog `statistics.ts`/`driver-report.ts`). Aufwand: gering.

### 7.4 Positiv hervorzuheben

- Immutability-Design ist mustergültig: Default-Deny **plus** Trigger als Defense-in-Depth,
  `patient_id`/`ride_id` nur → NULL kappbar, DELETE stets blockiert — auch gegen den
  service_role-Client, der RLS umgeht, aber die Trigger passiert.
- Nummernkreis: Rollback gibt die Nummer frei (keine Lücken), Lücke bleibt bewusst ein
  Compliance-Signal.
- Neue SECURITY-INVOKER-RPCs (`20260723`) haben **zusätzlich** zum INVOKER-Modell ein
  explizites Rollen-Gate — sauberer Gürtel-und-Hosenträger-Ansatz, keine Fahrer-Leaks über
  Aggregat-Views.

*Verifiziert von Ioannis (CISO), 2026-07-16 — Klassifizierung: INTERNAL — VERTRAULICH*

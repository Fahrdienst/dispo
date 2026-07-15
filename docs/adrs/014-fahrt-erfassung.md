# ADR-014: Fahrt-Erfassung (One-Page-Dispo, M13)

## Status
Accepted

## Kontext

Die bestehende Fahrt-Erfassung lief ueber `ride-form.tsx` — ein generisches
Formular, das sowohl fuer das Anlegen als auch fuer das Bearbeiten einer Fahrt
verwendet wurde. Fuer den taeglichen Dispo-Betrieb ist dieses Formular zu
technisch: Der Disponent denkt in "Wer faehrt wohin und wann?", nicht in
Datenbankfeldern wie `pickup_time`, `appointment_time` oder `duration_category`.

Das alte Access-System hatte eine Ein-Seiten-Maske, in der die Disponentin die
Fahrt links erfasste und rechts sofort Karte, berechnete Zeiten und Preis sah.
M13 baut dieses Erlebnis als moderne "One-Page-Dispo" nach: eine dedizierte
Route `/rides/erfassen` mit Zwei-Spalten-Layout, Live-Berechnung und einem
"nie-blockieren"-Speicherfluss.

Wesentliche fachliche Anforderungen:

- Die Abholzeit soll aus dem **Termin** rueckgerechnet werden (der Disponent
  kennt den Termin, nicht die Abholzeit).
- Hin- und Rueckfahrt sollen in einem Schritt erfassbar sein.
- Fehlende Geodaten, Preis oder Terminzeit duerfen das Speichern **nie**
  verhindern — der Disponent soll "jetzt speichern, spaeter ergaenzen" koennen.
- Kostentraeger und Transportbedarf sollen erfassbar sein.
- Die Fahrerzuweisung ist bewusst **nicht** Teil dieses Flows.

## Optionen

### Route / Formular

1. **Neue Route `/rides/erfassen` mit eigener `RideCaptureForm`** (gewaehlt) —
   Klare Trennung von Erfassung (One-Page-Dispo) und Bearbeitung
   (`ride-form.tsx`). Kein Risiko fuer den Edit-Flow.
2. **`ride-form.tsx` ueberladen** — Ein Formular fuer alles. Wuerde das bereits
   komplexe Formular mit Zwei-Spalten-Layout, Live-Karte und Terminlogik
   ueberfrachten und den getesteten Edit-Pfad gefaehrden.
3. **Modal/Dialog** — Zu wenig Platz fuer das Zwei-Spalten-Erlebnis mit Karte
   und Preis-Breakdown. Der Quick-Capture-Dialog (G1/G2) deckt den schnellen
   Fall bereits ab; `/rides/erfassen` ist die vollstaendige Variante.

### Zeitberechnung

1. **Client-orchestriert, Server-Actions fuer I/O** (gewaehlt) — Die reine
   Zeitmathematik (`calculateRideTimes`) laeuft im Client fuer sofortiges
   Feedback; Route/Preis kommen ueber Server-Actions (`calculateRouteForRide`,
   Preis in `createRide`). Der Server bleibt autoritativ beim Speichern.
2. **Alles serverseitig** — Kein Live-Feedback ohne Roundtrip. Schlechtere UX.
3. **Alles clientseitig** — Maps-/Preis-Logik und -Keys gehoeren nicht in den
   Client (Kosten, Secrets).

### Hin + Rueck

1. **Zwei verknuepfte `rides` ueber `parent_ride_id`** (gewaehlt) — Nutzt das
   bestehende Feld aus ADR-008. Rueckfahrt ist eine eigenstaendige, unabhaengig
   disponierbare Fahrt mit `direction=return` und Verweis auf die Hinfahrt.
2. **Ein `rides`-Datensatz mit `direction=both`** — Vermischt zwei
   Transportvorgaenge in einem Datensatz; erschwert getrennte Fahrerzuweisung,
   Status und Abrechnung.

## Entscheidung

### E1: Neue Route `/rides/erfassen` + `RideCaptureForm`

- Server-Component-Seite `src/app/(dashboard)/rides/erfassen/page.tsx` laedt
  aktive Patienten, aktive Ziele und die Org-Zeitpuffer
  (`loadRideTimeBuffers`) und reicht sie an die Client-Komponente
  `RideCaptureForm` (`src/components/rides/ride-capture-form.tsx`).
- `ride-form.tsx` (Bearbeiten) bleibt **unveraendert**. Erfassung und
  Bearbeitung sind bewusst zwei getrennte Oberflaechen.
- Deep-Link-Parameter (`?date=`, `?patient_id=`, `?destination_id=`)
  vorbelegen Felder, damit aus Dashboard/Dispo direkt erfasst werden kann.

### E2: Slot-Architektur

`RideCaptureForm` ist der State-Kern; die Bausteine sind entkoppelte Slot-
Komponenten unter `src/components/rides/capture/`:

```
ride-capture-form.tsx        -- State-Kern (Formular, alle useState/useMemo)
capture/
  types.ts                   -- geteilte Contracts (RouteInfo, CapturePatient, ...)
  capture-patient-field.tsx  -- Patient waehlen/inline anlegen (#136/#137)
  capture-destination-field.tsx
  cost-bearer-display.tsx    -- Kostentraeger des Patienten (read-only, #125)
  requirement-chips.tsx      -- Bedarf als Chip-Set (#135)
  series-toggle.tsx          -- Serie (delegiert an bestehende Logik)
  ride-map-panel.tsx         -- Live-Karte (#132)
  ride-price-panel.tsx       -- Live-Preis-Breakdown (#133)
  capture-save-actions.tsx   -- zwei Submit-Buttons (save_intent, #139)
  save-result-panel.tsx      -- Post-Save-Panel mit Warnungen (#139)
```

Der Kern besitzt den gesamten State; Slots erhalten nur ihren Slice plus Setter
ueber eigene `*Props`. Die geteilten Shapes liegen in `capture/types.ts`, um
einen Zirkelimport zwischen Kern und Slots zu vermeiden.

### E3: Zwei-Spalten-UX

Layout `lg:grid-cols-[1fr_minmax(360px,440px)]`:

- **Links (Erfassung):** Wer -> Wohin & Wann -> Bedarf/Serie. Fuehrt den
  Disponenten in Lesereihenfolge durch den Vorgang.
- **Rechts (Ergebnis, live):** Karte, berechnete Abholzeit(en), Preis-Breakdown.
  Aktualisiert sich bei jeder Aenderung ohne Speichern.

### E4: Rechenmodell

Reine Funktion `calculateRideTimes` (`src/lib/rides/time-calc.ts`, #129):

```
Hinfahrt-Abholzeit  = Terminbeginn - Fahrzeit - Vorlauf(pickupBuffer) - Boarding
Rueckfahrt-Abholzeit = Terminende + Rueck-Puffer(returnBuffer)
Terminende          = Terminbeginn + Termindauer   (im Client abgeleitet)
```

- Die drei Puffer (`pickupBuffer`, `boarding`, `returnBuffer`) sind
  **org-weite Defaults** aus `organization_settings` (#128), geladen ueber
  `loadRideTimeBuffers` und nur zum Vorbelegen. Der Disponent kann die
  vorgeschlagene Zeit jederzeit manuell ueberschreiben (`pickupManual`).
- `duration_category` (`under_2h` / `over_2h`) wird aus der Termindauer
  abgeleitet: `>= 120 min -> over_2h`. Sie speist den Duebendorf-Tarif
  (ADR-010).
- Ergibt eine Rechnung eine Zeit ausserhalb `00:00`-`23:59`, liefert die
  Funktion `null` (kein Vorschlag) statt eines ungueltigen Werts.

### E5: Hin + Rueck = zwei verknuepfte `rides`

- Bei "Hin & Rueck" (`round_trip`, Default) legt `createRide` nach der Hinfahrt
  eine zweite Fahrt mit `direction=return`, `status=unplanned` und
  `parent_ride_id = <Hinfahrt>` an (Feld aus ADR-008).
- Die Rueckfahrt-Abholzeit ist `return_pickup_time` oder, falls leer,
  `Terminende + returnBuffer`.
- Scheitert die Rueckfahrt, bleibt die Hinfahrt bestehen (geloggt, nicht
  blockierend) — konsistent mit dem "nie-blockieren"-Prinzip.

### E6: Kostentraeger am Patienten

Der Kostentraeger (`cost_bearer`, #125) haengt ausschliesslich am **Patienten**,
nie an der Fahrt. Im Erfassungsflow wird er nur read-only angezeigt
(`cost-bearer-display.tsx`); Pflege erfolgt ueber die Patientenformulare
(`patientSchema` / `patientInlineSchema`). Enum:
`health_insurance | self_payer | municipality | other`, optional (NULL erlaubt).

### E7: Bedarf als `ride_requirement`-Set

Der Transportbedarf (#126) ist ein Set auf **Fahrtebene** (`rides.requirements`,
`ride_requirement[]`, NOT NULL DEFAULT `{}`): `wheelchair | rollator |
companion | oxygen | carry_chair | stretcher`. Ein neues Enum (nicht
`impairment_type`), bewusst als Superset plus `oxygen`/`carry_chair`.

- `requirementsToVehicleType` (`src/lib/rides/requirements.ts`) mappt nur
  `wheelchair -> wheelchair`, alles andere -> `standard`. `vehicle_type` wird in
  M13 **nicht** erweitert; `oxygen`/`carry_chair`/`stretcher` bleiben rein
  informative Flags.
- `companion` impliziert immer einen Begleitschutz (`has_escort=true`), da beide
  denselben realen Sachverhalt abbilden (`resolveHasEscort`).

### E8: "Nie-blockieren"-Prinzip

Fehlende Geodaten, nicht berechenbarer Preis oder fehlende Terminzeit erzeugen
**strukturierte, nicht-blockierende Warnungen** statt harter Feldfehler
(`collectRideWarnings`, `src/lib/rides/warnings.ts`, #130):

- `createRide` speichert die Fahrt immer (sofern die Pflichtfelder valide sind)
  und gibt bei Warnungen `success: true` mit `warnings[]` zurueck, **ohne**
  weiterzuleiten. Das Post-Save-Panel (#139) zeigt die Warnungen; der Disponent
  bleibt auf der Seite.
- Preis-/Routenberechnung ist "best effort" in einem `try/catch` — eine
  Ausnahme bricht das Speichern nie ab.
- `save_intent` steuert die Navigation: `list` leitet nach dem sauberen
  Speichern zur Tagesansicht (`/rides?date=`); `order_sheet` unterdrueckt die
  Weiterleitung, damit das M11-Auftragsblatt geoeffnet werden kann.

### E9: Fahrerzuweisung out-of-scope

Die Erfassung legt Fahrten mit `status=unplanned` (kein Fahrer) an. Die
Fahrerzuweisung passiert bewusst spaeter im Dispo-Board — das trennt "Auftrag
erfassen" sauber von "Auftrag disponieren" und haelt die One-Page-Maske schlank.

## Konsequenzen

### Positiv
- Disponentengerechte Maske: Termin rein, Abholzeit + Preis + Karte raus.
- Kein Risiko fuer den bestehenden Edit-Flow (`ride-form.tsx` unangetastet).
- Reine, testbare Kernlogik (`calculateRideTimes`, `requirementsToVehicleType`,
  `collectRideWarnings`) ohne DB-/React-Abhaengigkeiten.
- "Nie-blockieren" verhindert Dateneingabe-Sackgassen im Tagesbetrieb.
- Hin/Rueck als getrennte Fahrten bleiben unabhaengig disponier- und abrechenbar.

### Negativ
- Zwei Erfassungs-Einstiege (Quick-Capture-Dialog + `/rides/erfassen`), die
  parallel gepflegt werden muessen.
- Zwei Zeit-Puffer-Quellen (Org-Default vs. manuelle Ueberschreibung) erfordern
  klare UI-Signale, welcher Wert gerade greift.

### Risiken
- Die Ableitungen `appointment_end_time` und `duration_category` liegen inline
  in der Client-Komponente. Der zugrunde liegende Baustein (`addMinutesToTime`)
  ist reine, getestete Logik; die Verdrahtung der `>= 120 min`-Schwelle wird
  ueber die Tarif-Vorschau im Browser manuell verifiziert (siehe Tests unten).
- Der Preis-Trigger haengt an vollstaendigen Geodaten. Nicht geocodierte
  Adressen liefern bewusst nur eine Warnung, keinen Preis.

## Tests

Reine Logik ist per Vitest abgedeckt (echter Test):

- `calculateRideTimes` / `detectTimeConflicts` — `src/lib/rides/__tests__/time-calc.test.ts`
- `requirementsToVehicleType` — `src/lib/rides/__tests__/requirements.test.ts`
- `collectRideWarnings` — `src/lib/rides/__tests__/warnings.test.ts`
- `loadRideTimeBuffers` (Stub-Client) — `src/lib/rides/__tests__/time-buffers.test.ts`
- Org-Zeitpuffer-Zod (#128) — `src/lib/validations/__tests__/organization.test.ts`
- Kostentraeger-Zod (#125) — `src/lib/validations/__tests__/patients-cost-bearer.test.ts`
- Bedarf-Zod (#126) — `src/lib/validations/__tests__/ride-requirements-schema.test.ts`
- `appointment_end_time`-Arithmetik — `src/lib/rides/__tests__/appointment-end-derivation.test.ts`
- `createRide` "nie-blockieren" + `save_intent` (gemockt) —
  `src/actions/__tests__/create-ride.test.ts`

Manuell / DB-seitig verifiziert (kein automatisierter Test):

- End-to-End-Erfassungsfluss inkl. Live-Karte im Browser.
- `>= 120 min -> over_2h`-Schwelle als Inline-Ternary in der Komponente
  (Downstream-Tarif ist getestet).
- Return-Ride-Erzeugung, Serien-Delegation und Fahrer-Verfuegbarkeits-Guard in
  `createRide` (RLS-/DB-abhaengig).

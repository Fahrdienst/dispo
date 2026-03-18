# Maps & Verrechnung — Betriebsrunbook

## Google Maps API Kostenmanagement

### Wirtschaftlichkeit (Cost Governance)
- **Erwartete Kosten:** ~$25/Monat bei Normalbetrieb (ca. 50-100 Fahrten/Tag).
- **Free Tier:** Vollständig durch das Google Maps $200 Monthly Credit abgedeckt.
- **Budget-Sperre:** Ein Hard-Limit von **$20/Tag** ist in der Google Cloud Console hinterlegt.
- **Monitoring:** Das **Maps Health Dashboard** unter `/settings/geocoding` zeigt den Live-Status der Daten-Integrität.

### Technische Kostenkontrolle (Engineering Controls)
Um das Budget zu schonen, nutzt die App folgende Mechanismen:

1.  **Places Session Tokens (Prio: Hoch):**
    *   **Mechanismus:** Bei der Adresssuche (Autocomplete) wird eine Session-ID generiert. Alle Tipp-Ereignisse bis zur Auswahl der Adresse werden als eine einzige "Session" abgerechnet ($17/1000 Sessions statt pro Tastendruck).
    *   **Wartung:** Sicherstellen, dass die `PlacesAutocomplete`-Komponente das Token bei jeder neuen Suche zurücksetzt.

2.  **Polyline Caching & Persistenz:**
    *   **Mechanismus:** Berechnete Routen (Polylines) werden in der Spalte `rides.polyline` gespeichert.
    *   **Vorteil:** Verhindert redundante `Directions API` Aufrufe ($5/1000) beim erneuten Laden von Ride-Details oder Dashboard-Karten.
    *   **Aktion:** Bei manuellen Adressänderungen muss die Polyline neu berechnet werden (Trigger: `calculateRouteForRide`).

3.  **Static Maps Layering:**
    *   **Mechanismus:** Wir bevorzugen `Maps Static API` ($2/1000) gegenüber der `Maps JavaScript API` ($7/1000) für rein informative Anzeigen.
    *   **Caching:** Static Maps URLs sind deterministisch. Der Browser-Cache sollte auf 24h+ eingestellt sein.

### Sicherheit & API-Key Schutz
1.  **Zwei-Key-Strategie:**
    *   `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`: Client-seitig, eingeschränkt auf **HTTP-Referrer** (deine-domain.ch). Erlaubt nur Static Maps und Places.
    *   `GOOGLE_MAPS_API_KEY`: Server-seitig (Server Actions), eingeschränkt auf **IP-Adresse** des Webservers. Erlaubt Geocoding und Directions.
2.  **Signed URLs:** Für Karten in E-Mails/PDFs (Order Sheets) werden **Digital Signatures (URL Signing)** verwendet, um Missbrauch des API-Keys durch Dritte zu verhindern.

## Ausfälle und Fehlerbehandlung

### Google Maps API nicht erreichbar
- **Symptom:** `geocode_status = 'failed'`, Fehlermeldungen im Dashboard.
- **Impact:** Neue Adressen werden nicht verortet; Routenberechnung (Preis) schlägt fehl.
- **Maßnahme:** Prüfe [Google Maps Platform Status](https://status.cloud.google.com/).
- **Health Check:** Prüfe Ampel-System unter `/settings/geocoding`.

### Quota überschritten (OVER_QUERY_LIMIT)
- **Symptom:** Karte lädt nicht oder "Quota Exceeded" Fehlermeldung.
- **Maßnahme:** Prüfe Cloud Console auf ungewöhnliche Spikes (Loop-Gefahr bei Batch-Retries).
- **Prävention:** Hard-Limit von 100 Geocoding Calls/Tag pro API in der Google Console setzen.

## Verrechnung & Tarife

### Manuelle Korrektur
- Falls Geocoding fehlschlägt, kann der Disponent unter `/billing` Preise manuell überschreiben.
- Markiere Adressen als `geocode_status = 'manual'`, um automatische Überschreibungen zu verhindern.

### Datensparsamkeit (GDPR)
- An Google werden **keine Patientennamen** gesendet.
- Übertragen werden ausschließlich: Adressen, Koordinaten und Trip-Dauern.

*Stand: März 2026 — Senior Maps Engineering Team*

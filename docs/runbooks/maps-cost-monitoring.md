# Maps & Verrechnung — Betriebsrunbook

## Google Maps API Kosten

### Erwartete Kosten
- ~$29/Monat bei 100 Fahrten/Tag
- Vollstaendig durch $200 Free Tier abgedeckt

### Kostenschutz
1. Budget-Limit: $20/Tag im Google Cloud Project
2. Alert bei 80% Tages-Budget
3. Einrichtung: Google Cloud Console → Billing → Budgets & Alerts

### Setup-Anleitung
1. Google Cloud Project erstellen
2. APIs aktivieren: Geocoding, Directions, Places (New)
3. Server-Key erstellen (IP-Restricted): fuer `GOOGLE_MAPS_API_KEY`
4. Client-Key erstellen (HTTP-Referrer-Restricted): fuer `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`
5. Budget erstellen: $20/Tag, Alert bei $16/Tag (80%)
6. DPA akzeptieren: Admin Console → Security → Data Processing

## Ausfaelle und Fehlerbehandlung

### Google Maps API nicht erreichbar
- **Symptom**: Geocoding schlaegt fehl, geocode_status = 'failed'
- **Impact**: Neue Adressen werden nicht geocodet. Bestehende Koordinaten bleiben.
- **Massnahme**: Pruefe https://status.cloud.google.com/. Retry erfolgt automatisch (2x).
- **Workaround**: Manuelles Geocoding oder Koordinaten-Eingabe.

### Quota ueberschritten
- **Symptom**: OVER_QUERY_LIMIT Fehler in Logs
- **Impact**: Geocoding und Routenberechnung blockiert.
- **Massnahme**: Budget erhoehen oder Volumen reduzieren.
- **Praevention**: Budget-Alert, Rate < 50 QPS (weit unter unserem Volumen).

### Falsche Geocoding-Ergebnisse
- **Symptom**: formatted_address weicht stark von Eingabe ab
- **Massnahme**: geocode_status auf 'manual' setzen, Koordinaten manuell korrigieren.
- **Tool**: Google Maps Search → Rechtsklick → Koordinaten kopieren.

## Verrechnung

### Fahrt ohne Preis
- **Ursache**: PLZ nicht in Zonenmatrix ODER Geocoding fehlgeschlagen
- **Pruefen**: /billing → Fahrten ohne Preis (rot markiert)
- **Loesung**: Zone/PLZ anlegen unter /settings/zones ODER Preis manuell ueberschreiben

### Tarifaenderung
1. Neue Tarifversion erstellen unter /settings/fares
2. valid_from = Datum ab dem neuer Tarif gilt
3. Bestehende Version: valid_to setzen
4. Bereits geplante Fahrten behalten ihren Preis-Snapshot

## Datenschutz

### Was wird an Google gesendet?
- Adressen (Strasse, PLZ, Ort) — KEINE Patientennamen
- Koordinaten fuer Routenberechnung
- Patientenadressen nur server-seitig (nie im Browser)
- Zieladressen auch client-seitig (Places Autocomplete)

### Logging
- Maps-API-Aufrufe loggen: Status, Latenz, Fehlercode
- NICHT geloggt: vollstaendige Adressen, Patientennamen
- geocode_status und formatted_address werden in DB gespeichert (nicht in Logfiles)

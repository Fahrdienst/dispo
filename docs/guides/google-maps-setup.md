# Google Maps API Setup — Schritt-fuer-Schritt-Anleitung

Diese Anleitung erklaert wie du die zwei Google Maps API-Keys fuer das Dispo-Projekt einrichtest. Am Ende hast du:

- **Server-Key** (`GOOGLE_MAPS_API_KEY`) — fuer Geocoding + Routenberechnung
- **Client-Key** (`NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`) — fuer Places Autocomplete im Browser

Geschaetzte Zeit: 15–20 Minuten.

---

## 1. Google Cloud Konto und Projekt erstellen

### 1.1 Google Cloud Console oeffnen

1. Gehe zu **https://console.cloud.google.com/**
2. Melde dich mit deinem Google-Konto an (oder erstelle eines)
3. Akzeptiere die Nutzungsbedingungen

### 1.2 Neues Projekt erstellen

1. Klicke oben links auf das **Projekt-Dropdown** (neben "Google Cloud")
2. Klicke auf **"Neues Projekt"**
3. Projektname: `dispo-fahrdienst` (oder aehnlich)
4. Organisation: leer lassen (oder deine Organisation waehlen)
5. Klicke **"Erstellen"**
6. Warte bis das Projekt erstellt ist und stelle sicher, dass es oben ausgewaehlt ist

### 1.3 Billing aktivieren

Google Maps APIs benoetigen ein Billing-Konto, auch wenn die Nutzung im Free Tier bleibt ($200/Monat Guthaben).

1. Gehe zu **Abrechnung** (Billing): https://console.cloud.google.com/billing
2. Klicke auf **"Rechnungskonto verknuepfen"** oder **"Rechnungskonto erstellen"**
3. Gib eine Kreditkarte oder ein anderes Zahlungsmittel ein
4. Verknuepfe das Billing-Konto mit dem Projekt `dispo-fahrdienst`

> **Keine Sorge**: Bei unserem Volumen (~100 Fahrten/Tag) fallen ca. $29/Monat an — vollstaendig durch das $200 Free Tier abgedeckt. Du zahlst nichts.

---

## 2. Google Maps APIs aktivieren

Du musst genau **3 APIs** aktivieren.

### 2.1 APIs aktivieren

1. Gehe zu **APIs & Dienste > Bibliothek**: https://console.cloud.google.com/apis/library
2. Suche und aktiviere nacheinander:

| API | Suche nach | Schaltflaeche |
|-----|-----------|---------------|
| **Geocoding API** | "Geocoding" | "Aktivieren" klicken |
| **Directions API** | "Directions" | "Aktivieren" klicken |
| **Places API (New)** | "Places API" | Waehle die **"Places API (New)"** aus (NICHT die alte "Places API") und klicke "Aktivieren" |

> **Wichtig**: Es gibt zwei Places APIs. Du brauchst die **"Places API (New)"** — sie hat ein modernes REST-Interface und bessere Preise.

### 2.2 Pruefen ob alles aktiviert ist

1. Gehe zu **APIs & Dienste > Dashboard**: https://console.cloud.google.com/apis/dashboard
2. Du solltest sehen:
   - Geocoding API ✓
   - Directions API ✓
   - Places API (New) ✓

---

## 3. API-Keys erstellen

Du brauchst **zwei separate Keys** mit unterschiedlichen Einschraenkungen.

### 3.1 Server-Key erstellen (fuer Geocoding + Directions)

1. Gehe zu **APIs & Dienste > Anmeldedaten**: https://console.cloud.google.com/apis/credentials
2. Klicke oben auf **"+ Anmeldedaten erstellen" > "API-Schluessel"**
3. Ein neuer Key wird generiert — klicke auf **"Schluessel einschraenken"**
4. Konfiguriere:
   - **Name**: `dispo-server-key`
   - **Anwendungseinschraenkungen**: Waehle **"Keine"** (oder "IP-Adressen" wenn du die Vercel-IPs kennst)
   - **API-Einschraenkungen**: Waehle **"Schluessel einschraenken"** und waehle:
     - ✅ Geocoding API
     - ✅ Directions API
     - ❌ Places API (New) — NICHT auswaehlen
5. Klicke **"Speichern"**
6. **Kopiere den Key** — das ist dein `GOOGLE_MAPS_API_KEY`

### 3.2 Client-Key erstellen (fuer Places Autocomplete)

1. Klicke erneut auf **"+ Anmeldedaten erstellen" > "API-Schluessel"**
2. Klicke auf **"Schluessel einschraenken"**
3. Konfiguriere:
   - **Name**: `dispo-client-key`
   - **Anwendungseinschraenkungen**: Waehle **"HTTP-Verweis-URLs (Websites)"**
   - Fuege folgende URLs hinzu:
     - `http://localhost:3000/*` (Entwicklung)
     - `https://dein-projekt.vercel.app/*` (Produktion — spaeter anpassen)
     - `https://deine-domain.ch/*` (Custom Domain — spaeter anpassen)
   - **API-Einschraenkungen**: Waehle **"Schluessel einschraenken"** und waehle:
     - ✅ Places API (New)
     - ❌ Geocoding API — NICHT auswaehlen
     - ❌ Directions API — NICHT auswaehlen
4. Klicke **"Speichern"**
5. **Kopiere den Key** — das ist dein `NEXT_PUBLIC_GOOGLE_MAPS_API_KEY`

### 3.3 Warum zwei Keys?

| Key | Wo genutzt | Sicherheit |
|-----|-----------|------------|
| Server-Key | Nur auf dem Server (Node.js) | Nie im Browser sichtbar, kein `NEXT_PUBLIC_` Prefix |
| Client-Key | Im Browser (Places Autocomplete) | Durch HTTP-Referrer eingeschraenkt — nur deine Domain kann ihn nutzen |

---

## 4. Keys in das Projekt eintragen

### 4.1 .env.local bearbeiten

Oeffne die Datei `.env.local` im Projektroot und fuege die Keys hinzu:

```
# Bestehende Supabase-Eintraege bleiben unveraendert
NEXT_PUBLIC_SUPABASE_URL=https://...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
NEXT_PUBLIC_APP_URL=http://localhost:3000

# NEU: Google Maps Keys
GOOGLE_MAPS_API_KEY=AIzaSy...dein-server-key...
NEXT_PUBLIC_GOOGLE_MAPS_API_KEY=AIzaSy...dein-client-key...
```

### 4.2 Pruefen ob es funktioniert

Starte den Dev-Server und teste:

```bash
npm run dev
```

1. **Geocoding testen**: Erstelle oder bearbeite einen Patienten mit einer Schweizer Adresse. Nach dem Speichern sollte in der Datenbank `geocode_status = 'success'` stehen.

2. **Places Autocomplete testen**: Gehe zu Ziele > Neues Ziel erstellen. Im Suchfeld "Google Maps Suche" sollten Vorschlaege erscheinen wenn du z.B. "Universitaetsspital Zuerich" eingibst.

3. **Routenberechnung testen**: Erstelle eine Fahrt mit einem Patienten und einem Ziel, die beide erfolgreich geocodet wurden. Im Formular sollte "~X.X km, ~Y Min. Fahrzeit" erscheinen.

---

## 5. Budget und Kostenschutz einrichten

### 5.1 Tages-Budget setzen

1. Gehe zu **Abrechnung > Budgets und Benachrichtigungen**: https://console.cloud.google.com/billing/budgets
2. Klicke **"Budget erstellen"**
3. Konfiguriere:
   - **Name**: `Maps Daily Budget`
   - **Projekte**: `dispo-fahrdienst`
   - **Produkte**: Alle (oder nur Maps-APIs)
   - **Betrag**: `$20` pro Monat (= ca. $0.65/Tag)
   - **Schwellenwerte**: 50%, 80%, 100%
   - **Benachrichtigungen**: Aktiviere E-Mail-Benachrichtigungen an dein Admin-Konto
4. Klicke **"Fertig"**

### 5.2 API-Quota pruefen

1. Gehe zu **APIs & Dienste > Dashboard**: https://console.cloud.google.com/apis/dashboard
2. Klicke auf eine API (z.B. "Geocoding API")
3. Tab **"Kontingente"** zeigt die Limits:
   - Geocoding: 50 Anfragen/Sekunde (wir nutzen < 1/Sekunde)
   - Directions: 50 Anfragen/Sekunde
   - Places: 600 Anfragen/Minute

---

## 6. Datenschutz (DPA / Auftragsverarbeitung)

Falls du mit echten Patientendaten arbeitest, muss der Google Cloud Auftragsverarbeitungsvertrag (DPA) akzeptiert werden.

### 6.1 DPA akzeptieren

1. Gehe zu **Google Cloud Admin Console**: https://admin.google.com/ (nur bei Google Workspace) ODER direkt in der Cloud Console
2. Gehe zu **Konto > Kontoinstellungen > Data Processing Terms**
3. Oder: Gehe zu https://console.cloud.google.com/terms und akzeptiere die "Data Processing and Security Terms"
4. Pruefe ob der Vertrag den EU/CH Standard Contractual Clauses (SCC) entspricht

> **Hinweis**: Fuer individuelle Google-Konten (nicht Workspace) gilt der Google Cloud Platform TOS, der bereits einen Auftragsverarbeitungsvertrag einschliesst. Pruefe die Details unter: https://cloud.google.com/terms/data-processing-addendum

### 6.2 Was wird an Google gesendet?

| Daten | Wann | Wie |
|-------|------|-----|
| Patientenadresse (Strasse, PLZ, Ort) | Bei Geocoding (Patient erstellen/bearbeiten) | Server-seitig — nie im Browser |
| Zieladresse (Spital, Praxis) | Bei Places Autocomplete + Geocoding | Client-seitig (Autocomplete) + Server-seitig (Geocoding) |
| Koordinaten (lat/lng) | Bei Routenberechnung | Server-seitig |

**NICHT gesendet**: Patientennamen, Geburtsdaten, Diagnosen, Telefonnummern.

---

## 7. Troubleshooting

### "REQUEST_DENIED" Fehler

- **Ursache**: API nicht aktiviert oder Key nicht korrekt eingeschraenkt
- **Loesung**: Pruefe in der Google Cloud Console ob alle 3 APIs aktiviert sind
- **Pruefe**: Ist der richtige Key fuer den richtigen Zweck konfiguriert?

### Places Autocomplete zeigt keine Vorschlaege

- **Pruefe Browser-Konsole** (F12 > Console) auf Fehler
- **Haeufigste Ursache**: HTTP-Referrer-Einschraenkung blockiert `localhost`
  - Loesung: `http://localhost:3000/*` zum Client-Key hinzufuegen
- **Zweithaeufigste Ursache**: Places API (New) nicht aktiviert
  - Loesung: In der API-Bibliothek "Places API (New)" aktivieren

### Geocoding gibt keine Ergebnisse

- **Pruefe die Adresse**: Ist sie korrekt und vollstaendig? (Strasse, Hausnummer, PLZ, Ort)
- **Pruefe geocode_status** in der Datenbank (Supabase > Table Editor > patients/destinations)
- **"failed"**: Google konnte die Adresse nicht finden — Adresse korrigieren
- **"pending"**: Geocoding wurde noch nicht ausgefuehrt — Patient/Ziel erneut speichern

### Routenberechnung zeigt "nicht moeglich"

- **Pruefe**: Haben Patient UND Ziel `geocode_status = 'success'`?
- Wenn nicht: Adressen korrigieren und erneut speichern
- **Pruefe**: Ist die Directions API aktiviert?

### API-Kosten ueberpruefen

1. Gehe zu **Abrechnung > Berichte**: https://console.cloud.google.com/billing/reports
2. Filtere nach Projekt `dispo-fahrdienst`
3. Gruppiere nach "SKU" um die einzelnen API-Kosten zu sehen

---

## Zusammenfassung

| Schritt | Was | Wo |
|---------|-----|-----|
| 1 | Google Cloud Projekt erstellen | https://console.cloud.google.com/ |
| 2 | Billing aktivieren | https://console.cloud.google.com/billing |
| 3 | 3 APIs aktivieren | APIs & Dienste > Bibliothek |
| 4 | Server-Key erstellen | Anmeldedaten > API-Schluessel |
| 5 | Client-Key erstellen | Anmeldedaten > API-Schluessel |
| 6 | Keys in `.env.local` eintragen | Lokale Datei im Projekt |
| 7 | Budget einrichten | Abrechnung > Budgets |
| 8 | DPA akzeptieren | Cloud Console > Terms |
| 9 | Testen | `npm run dev` + Patient/Ziel erstellen |

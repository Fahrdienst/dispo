# Gmail E-Mail-Versand Setup — Schritt-fuer-Schritt-Anleitung

Diese Anleitung erklaert wie du den automatischen E-Mail-Versand fuer Fahrer-Benachrichtigungen einrichtest. Am Ende hast du:

- **Gmail-Konto** mit App Password fuer SMTP-Versand
- **Vercel** Environment Variables konfiguriert
- **Supabase** Migration ausgefuehrt (Tabellen `assignment_tokens` + `mail_log`)

Geschaetzte Zeit: 15–20 Minuten.

---

## 1. Gmail-Konto einrichten

Du kannst ein bestehendes Gmail-Konto verwenden oder ein neues erstellen. Empfehlung: Ein eigenes Konto wie `dispo-noreply@gmail.com` verwenden, damit die Absenderadresse professionell wirkt.

### 1.1 Neues Gmail-Konto erstellen (optional)

1. Gehe zu **https://accounts.google.com/signup**
2. Erstelle ein Konto mit einer passenden Adresse, z.B. `dispo-noreply@gmail.com`
3. Schliesse die Registrierung ab

### 1.2 Zwei-Faktor-Authentifizierung aktivieren

App Passwords funktionieren nur mit aktivierter 2FA.

1. Gehe zu **https://myaccount.google.com/security**
2. Scrolle zu **"Wie Sie sich bei Google anmelden"**
3. Klicke auf **"Bestätigung in zwei Schritten"**
4. Folge dem Einrichtungsassistenten:
   - Telefonnummer eingeben
   - Bestaetigungscode per SMS erhalten
   - Bestaetigen und aktivieren

### 1.3 App Password erstellen

1. Gehe zu **https://myaccount.google.com/apppasswords**
   - Falls der Link nicht funktioniert: Google-Konto → Sicherheit → Bestätigung in zwei Schritten → App-Passwörter (ganz unten)
2. Bei **"App auswählen"** gib einen Namen ein, z.B. `Dispo Krankentransport`
3. Klicke auf **"Erstellen"**
4. Google zeigt ein **16-stelliges Passwort** an (Format: `xxxx xxxx xxxx xxxx`)
5. **Kopiere dieses Passwort sofort** — es wird nur einmal angezeigt!
6. Entferne die Leerzeichen fuer die spaetere Verwendung: `xxxxxxxxxxxxxxxx`

> **Wichtig:** Dieses Passwort ist dein `GMAIL_APP_PASSWORD`. Bewahre es sicher auf.

---

## 2. Vercel Environment Variables setzen

### 2.1 Vercel Dashboard oeffnen

1. Gehe zu **https://vercel.com/dashboard**
2. Klicke auf dein **Dispo-Projekt**
3. Gehe zu **Settings** → **Environment Variables**

### 2.2 Drei Variables hinzufuegen

Fuege folgende Variables hinzu. Setze bei jeder den Scope auf **Production**, **Preview** und **Development**:

| Name | Wert | Beispiel |
|------|------|----------|
| `GMAIL_USER` | Deine Gmail-Adresse | `dispo-noreply@gmail.com` |
| `GMAIL_APP_PASSWORD` | Das App Password aus Schritt 1.3 | `abcdefghijklmnop` |
| `MAIL_FROM` | Absender-Anzeigename mit E-Mail | `Dispo Krankentransport <dispo-noreply@gmail.com>` |

So geht's fuer jede Variable:

1. **Key**: Name eingeben (z.B. `GMAIL_USER`)
2. **Value**: Wert eingeben (z.B. `dispo-noreply@gmail.com`)
3. **Environment**: Alle drei Checkboxen aktivieren (Production, Preview, Development)
4. Klicke auf **"Save"**

### 2.3 NEXT_PUBLIC_APP_URL pruefen

Stelle sicher, dass `NEXT_PUBLIC_APP_URL` auf deine Produktions-URL zeigt (z.B. `https://dispo.vercel.app`). Diese Variable wird benoetigt um die Annahme-/Ablehnungs-Links in der E-Mail zu generieren.

1. Suche in den Environment Variables nach `NEXT_PUBLIC_APP_URL`
2. Falls nicht vorhanden, erstelle sie:
   - **Key**: `NEXT_PUBLIC_APP_URL`
   - **Value**: `https://deine-domain.vercel.app` (deine tatsaechliche Produktions-URL)
   - **Environment**: Production

> **Wichtig:** Ohne diese Variable werden keine E-Mails versendet.

### 2.4 Redeploy ausloesen

Damit die neuen Variables wirksam werden:

1. Gehe zu **Deployments**
2. Klicke beim letzten Deployment auf die drei Punkte (**...**)
3. Waehle **"Redeploy"**

---

## 3. Lokale Entwicklung (.env.local)

Fuer lokale Entwicklung die gleichen Werte in `.env.local` eintragen:

```bash
# Gmail SMTP for driver notifications
GMAIL_USER=dispo-noreply@gmail.com
GMAIL_APP_PASSWORD=abcdefghijklmnop
MAIL_FROM="Dispo Krankentransport <dispo-noreply@gmail.com>"
```

> **Hinweis:** `.env.local` ist in `.gitignore` und wird nie committed.

---

## 4. Supabase Migration

Die Migration erstellt zwei Tabellen:

- **`assignment_tokens`** — Speichert Einmal-Tokens fuer Annahme/Ablehnungs-Links
- **`mail_log`** — Audit-Log aller E-Mail-Versandversuche

### 4.1 Migration ausfuehren

Falls noch nicht geschehen:

```bash
npx supabase db push
```

### 4.2 Tabellen pruefen

1. Gehe zum **Supabase Dashboard** → **Table Editor**
2. Pruefe, dass die Tabellen `assignment_tokens` und `mail_log` vorhanden sind
3. Beide Tabellen sollten leer sein (werden erst befuellt wenn Fahrer zugewiesen werden)

---

## 5. Funktionstest

### 5.1 E-Mail-Versand testen

1. Oeffne die Dispo-App
2. Erstelle eine **neue Fahrt** (oder oeffne eine bestehende mit Status "Ungeplant")
3. **Weise einen Fahrer zu** (der Fahrer muss ein Profil mit E-Mail-Adresse haben)
4. Die Fahrt wechselt auf Status **"Geplant"** und eine E-Mail wird automatisch versendet

### 5.2 E-Mail pruefen

1. Oeffne das E-Mail-Postfach des zugewiesenen Fahrers
2. Du solltest eine E-Mail sehen mit:
   - Fahrtdetails (Ziel, Datum, Abholzeit, Richtung)
   - Gruener Button **"Fahrt annehmen"**
   - Roter Button **"Fahrt ablehnen"**

### 5.3 Links testen

1. Klicke auf **"Fahrt annehmen"** → Erfolgsseite "Fahrt angenommen", Fahrt-Status wechselt zu "Bestaetigt"
2. Oder klicke auf **"Fahrt ablehnen"** → Erfolgsseite "Fahrt abgelehnt", Fahrt-Status wechselt zu "Abgelehnt"
3. Klicke den Link nochmal → Fehlerseite "Link abgelaufen oder bereits verwendet"

### 5.4 Mail-Log pruefen

1. Gehe zum **Supabase Dashboard** → **Table Editor** → **mail_log**
2. Du solltest einen Eintrag sehen mit `status = 'sent'` und der Empfaenger-E-Mail

---

## Fehlerbehebung

| Problem | Loesung |
|---------|---------|
| Keine E-Mail kommt an | Pruefe `mail_log` in Supabase auf `status = 'failed'` und lies die `error`-Spalte |
| "Missing GMAIL_USER" in Logs | Environment Variables in Vercel nicht gesetzt oder Redeploy vergessen |
| "No profile/email found for driver" | Der Fahrer hat kein verknuepftes Profil mit E-Mail-Adresse |
| "NEXT_PUBLIC_APP_URL is not configured" | `NEXT_PUBLIC_APP_URL` fehlt in den Environment Variables |
| Gmail blockiert Anmeldung | 2FA nicht aktiviert oder App Password falsch |
| Link zeigt "Ungültiger Link" | Token-Format ungueltig — Link wurde nicht korrekt kopiert |
| Link zeigt "Fahrt geaendert" | Die Fahrt wurde zwischenzeitlich einem anderen Fahrer zugewiesen |

---

## Gmail-Limits

- **Tageslimit**: 500 E-Mails/Tag (kostenloser Gmail-Account)
- **Google Workspace**: 2.000 E-Mails/Tag
- Fuer das erwartete Dispo-Volumen ist der kostenlose Account ausreichend

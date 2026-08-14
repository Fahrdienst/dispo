# Mail-Sandbox: sicheres End-zu-End-Testen

Beim Testen dürfen **keine** E-Mails an echte (aus dem Altsystem importierte)
Fahrer oder Patienten gehen. Dafür gibt es einen zentralen **Mail-Sandbox-Guard**:
jeder Versand läuft über `sendGuardedMail` (`src/lib/mail/send.ts`), das anhand
der Umgebungsvariable `MAIL_MODE` entscheidet, ob und an wen zugestellt wird.

> Der rohe Gmail-Transport (`src/lib/mail/transport.ts`) ist `server-only` und
> wird ausschließlich intern von `send.ts` verwendet. Neue Sender **müssen**
> `sendGuardedMail` benutzen — direkt am Guard vorbei zu senden ist nicht möglich.

## Die drei Modi

| `MAIL_MODE` | Verhalten |
|-------------|-----------|
| `live`      | Normalversand an die echten Empfänger. |
| `redirect`  | Mail wird vollständig normal aufgebaut und via Gmail versendet, aber **alle** Empfänger (to/cc/bcc) werden durch `MAIL_REDIRECT_TO` ersetzt. Der Betreff bekommt das Präfix `[TEST → original@x]`. cc/bcc werden ins `to` gefaltet, damit nie versehentlich eine echte Person in Kopie steht. |
| `log`       | **Kein** Versand. Es wird nur ein `mail_log`-Eintrag geschrieben und eine server-seitige Konsolenzeile ausgegeben (nur Empfänger/Template/Betreff — **kein** Mail-Body mit PII). |

### Fail-safe-Default (wichtig)

Der Guard sendet **niemals** versehentlich an echte Empfänger:

- `MAIL_MODE=live` → nur bei **explizit** gesetztem `live`.
- `MAIL_MODE` nicht gesetzt **oder** ungültig →
  - `redirect`, falls `MAIL_REDIRECT_TO` gesetzt ist,
  - sonst `log`.
- `MAIL_MODE=redirect` **ohne** `MAIL_REDIRECT_TO` → degradiert zu `log`.

Kurz: Ohne bewusste Konfiguration geht **nichts** an echte Adressen raus.

## Allowlist (Pilot-Fahrer)

`MAIL_ALLOWLIST` ist optional und enthält kommaseparierte Einträge, die auch im
`redirect`-Modus **normal** beliefert werden (z. B. später einzelne Pilot-Fahrer).
Zwei Formen, case-insensitive:

- **Ganze Adresse**: `pilot@example.ch`
- **Ganze Domain**: `@pilot-fahrer.ch` (matcht jede Adresse dieser Domain)

Beispiel:

```
MAIL_MODE=redirect
MAIL_REDIRECT_TO=christian.stebler+fahrdienst@gmail.com
MAIL_ALLOWLIST=pilot@example.ch,@pilot-fahrer.ch
```

Bei gemischten Empfängern gehen die allowlisteten Adressen echt raus, alle
übrigen an `MAIL_REDIRECT_TO`.

## Test-Fahrer-Trick (Gmail Plus-Alias)

Gmail liefert alle Adressen der Form `name+beliebig@gmail.com` in dieselbe
Inbox. So kann man je Test-Fahrer eine eigene, unterscheidbare Adresse
hinterlegen, ohne echte Postfächer:

- `christian.stebler+fahrer1@gmail.com`
- `christian.stebler+fahrer2@gmail.com`

Alle landen bei `christian.stebler@gmail.com`. Ideal, um den kompletten
Zuweisungs-/Bestätigungs-Flow durchzuspielen.

## `mail_log`

Im `redirect`/`log`-Modus hält der Log-Eintrag den **Original-Empfänger** und
den **effektiven Modus** fest (ohne Schema-Migration, als Vermerk im bestehenden
`recipient`-Feld):

| Modus     | `mail_log.recipient`                         | `mail_log.status` |
|-----------|----------------------------------------------|-------------------|
| live      | `driver@old.ch`                              | `sent`            |
| redirect  | `driver@old.ch → test@inbox.ch [redirect]`   | `sent`            |
| redirect + allowlist | `pilot@example.ch [allowlist]`    | `sent`            |
| log       | `driver@old.ch [log]`                        | `logged`          |

Das Feld führt immer mit dem ursprünglich beabsichtigten Empfänger, gefolgt vom
Modus-Tag in eckigen Klammern.

## Empfehlung für Vercel

| Environment          | Empfehlung |
|----------------------|-----------|
| **Production**       | `MAIL_MODE` **erst** auf `live` setzen, wenn wirklich live gegangen wird. Vorher `redirect` (mit `MAIL_REDIRECT_TO`) oder gar nichts. |
| **Preview / Dev**    | **Nichts** setzen. Der Fail-safe-Default (`log`, bzw. `redirect` falls jemand `MAIL_REDIRECT_TO` gesetzt hat) verhindert jeden echten Versand. |
| **Lokal (`.env`)**   | Für E2E-Tests `MAIL_MODE=redirect` + `MAIL_REDIRECT_TO=deine+alias@gmail.com`. |

> Merksatz: Solange in Production `MAIL_MODE` nicht explizit auf `live` steht,
> erreicht **keine** Mail einen echten Fahrer.

## Was passiert, wenn Christian nichts setzt?

- **Production ohne `MAIL_MODE`**: Fail-safe → `log` (kein Versand), bzw.
  `redirect`, falls `MAIL_REDIRECT_TO` gesetzt wurde. Nie `live`.
- **Preview/Dev ohne alles**: `log` — sichtbar in `mail_log` und Server-Logs,
  aber niemand bekommt Mail.

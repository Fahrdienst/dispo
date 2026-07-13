import type { HelpArticle } from "@/lib/help/types"

/**
 * Article "Benutzer verwalten" for admins — real content.
 * Audience: admin.
 */
export const adminBenutzer: HelpArticle = {
  slug: "admin-benutzer",
  title: "Benutzer verwalten",
  category: "administration",
  audience: ["admin"],
  keywords: [
    "benutzer",
    "konto",
    "anlegen",
    "rolle",
    "passwort",
    "verwalten",
    "administration",
  ],
  summary:
    "So legen Sie Konten an, vergeben Rollen und setzen Passwörter zurück.",
  sections: [
    {
      id: "einleitung",
      heading: "Wer darf was?",
      blocks: [
        {
          type: "paragraph",
          text: "Jede Person, die mit der App arbeitet, braucht ein eigenes Konto. Die Rolle bestimmt, was jemand sehen und tun darf. Es gibt drei Rollen:",
        },
        {
          type: "list",
          items: [
            "Administrator: darf alles, auch Benutzer und Einstellungen verwalten.",
            "Disponent: erfasst Fahrten und teilt Fahrer ein.",
            "Fahrer: sieht die eigenen Fahrten und trägt die Verfügbarkeit ein.",
          ],
        },
        {
          type: "paragraph",
          text: "Die Benutzerverwaltung öffnen Sie über den Menüpunkt „Benutzer“. Dieser Bereich ist nur für Administratoren sichtbar.",
        },
      ],
    },
    {
      id: "anlegen",
      heading: "Ein neues Konto anlegen",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Bereich „Benutzer“ öffnen",
              text: "Klicken Sie im Menü auf „Benutzer“ und dann oben rechts auf „Neuer Benutzer“.",
            },
            {
              title: "Angaben eintragen",
              text: "Tragen Sie „E-Mail“, ein „Passwort“ und den „Anzeigename“ ein und wählen Sie unter „Rolle“ Administrator, Disponent oder Fahrer.",
            },
            {
              title: "Bei Fahrern: Fahrer verknüpfen",
              text: "Wählen Sie als Rolle „Fahrer“, erscheint das Feld „Fahrer“. Wählen Sie darin den passenden, bereits angelegten Fahrer-Datensatz aus. So werden Konto und Fahrer miteinander verbunden.",
            },
            {
              title: "Speichern",
              text: "Klicken Sie auf „Speichern“. Das neue Konto erscheint danach in der Liste.",
            },
          ],
        },
        // TODO(content): Screenshot des Benutzer-Formulars mit Rolle-Auswahl.
        {
          type: "callout",
          variant: "warning",
          title: "Sicheres Passwort",
          text: "Ein Passwort muss mindestens 12 Zeichen lang sein und einen Grossbuchstaben, einen Kleinbuchstaben und eine Zahl enthalten. Teilen Sie das erste Passwort der Person sicher mit – sie kann es später selbst ändern.",
        },
        {
          type: "callout",
          variant: "info",
          text: "Der Fahrer-Datensatz selbst (mit Fahrzeug und Adresse) wird nicht hier, sondern im Bereich „Fahrer“ angelegt. Beim Anlegen des Kontos verknüpfen Sie nur einen bestehenden Fahrer.",
        },
      ],
    },
    {
      id: "aendern",
      heading: "Konto ändern, Rolle wechseln, Passwort zurücksetzen",
      blocks: [
        {
          type: "paragraph",
          text: "In der Benutzerliste öffnen Sie am Ende jeder Zeile das Menü mit den drei Punkten und wählen „Bearbeiten“.",
        },
        {
          type: "list",
          items: [
            "Rolle wechseln: Wählen Sie im Feld „Rolle“ eine andere Rolle und klicken Sie auf „Speichern“.",
            "Passwort zurücksetzen: Auf der Bearbeiten-Seite gibt es unten den Bereich „Passwort ändern“. Tragen Sie ein neues Passwort ein und klicken Sie auf „Passwort aktualisieren“.",
            "Konto sperren: Wählen Sie im Drei-Punkte-Menü „Deaktivieren“. Die Person kann sich dann nicht mehr anmelden. Mit „Aktivieren“ heben Sie das wieder auf.",
          ],
        },
        {
          type: "callout",
          variant: "info",
          text: "Die E-Mail-Adresse eines bestehenden Kontos lässt sich nicht nachträglich ändern. Legen Sie in diesem Fall ein neues Konto an.",
        },
        {
          type: "callout",
          variant: "warning",
          title: "Zwei Schutzregeln",
          text: "Sie können Ihre eigene Rolle nicht ändern und Ihr eigenes Konto nicht deaktivieren. Ausserdem lässt sich der letzte verbleibende Administrator nicht herabstufen oder sperren – so bleibt immer mindestens ein Administrator handlungsfähig.",
        },
      ],
    },
  ],
}

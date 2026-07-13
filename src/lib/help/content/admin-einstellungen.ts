import type { HelpArticle } from "@/lib/help/types"

/**
 * Article "Einstellungen und Zonen" for admins — real content.
 * Audience: admin.
 */
export const adminEinstellungen: HelpArticle = {
  slug: "admin-einstellungen",
  title: "Einstellungen und Zonen",
  category: "administration",
  audience: ["admin"],
  keywords: [
    "einstellungen",
    "zonen",
    "konfiguration",
    "administration",
    "system",
    "organisation",
  ],
  summary:
    "Ein Überblick über die Einstellungen der App – von den Organisationsdaten bis zu den Zonen.",
  sections: [
    {
      id: "einleitung",
      heading: "Wo Sie die Einstellungen finden",
      blocks: [
        {
          type: "paragraph",
          text: "Die Einstellungen öffnen Sie über den Menüpunkt „Einstellungen“. Oben finden Sie eine Reihe von Reitern, mit denen Sie zwischen den Bereichen wechseln: „Zonen“, „Zonenkarte“, „Tarife“, „Geocoding“, „Organisation“, „System“ und „Sicherheit“.",
        },
        {
          type: "callout",
          variant: "info",
          text: "Die Einstellungen sind hauptsächlich Administratoren vorbehalten. Den Reiter „Sicherheit“ – zum Ändern des eigenen Passworts – erreicht dagegen jede angemeldete Person.",
        },
      ],
    },
    {
      id: "organisation",
      heading: "Organisation: Ihre eigenen Daten",
      blocks: [
        {
          type: "paragraph",
          text: "Unter „Organisation“ hinterlegen Sie die Angaben zu Ihrem Fahrdienst. Diese Daten erscheinen später auf Quittungen und Belegen.",
        },
        {
          type: "list",
          items: [
            "Name, Strasse, PLZ, Ort sowie Telefon, E-Mail und Website Ihrer Organisation,",
            "ein Logo und zwei Farben (Primär- und Sekundärfarbe) für Belege,",
            "Schalter für E-Mail- und SMS-Benachrichtigungen sowie den Absender-Namen.",
          ],
        },
        {
          type: "steps",
          steps: [
            {
              title: "Angaben eintragen",
              text: "Füllen Sie die Felder aus. Pflicht ist nur der „Organisationsname“.",
            },
            {
              title: "Speichern",
              text: "Klicken Sie unten auf „Einstellungen speichern“. Bei Erfolg erscheint der Hinweis „Einstellungen gespeichert“.",
            },
          ],
        },
        // TODO(content): Screenshot der Organisations-Einstellungen mit den Reitern oben.
        {
          type: "callout",
          variant: "tip",
          text: "Mit „Test-E-Mail senden“ prüfen Sie, ob der E-Mail-Versand funktioniert, bevor Fahrer echte Benachrichtigungen erhalten.",
        },
      ],
    },
    {
      id: "zonen",
      heading: "Zonen: Gebiete für die Preisberechnung",
      blocks: [
        {
          type: "paragraph",
          text: "Zonen fassen Postleitzahlen zu Gebieten zusammen. Aus der Zone eines Ziels ergibt sich später der Preis einer Fahrt.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Reiter „Zonen“ öffnen",
              text: "Wechseln Sie oben auf den Reiter „Zonen“. Sie sehen die bereits vorhandenen Zonen.",
            },
            {
              title: "Neue Zone anlegen",
              text: "Klicken Sie auf „Neue Zone“, tragen Sie einen „Name“ ein und klicken Sie auf „Speichern“.",
            },
            {
              title: "Postleitzahlen zuordnen",
              text: "Öffnen Sie die Zone erneut zum Bearbeiten. Im Bereich „Postleitzahlen“ tragen Sie eine oder mehrere PLZ ein (mehrere mit Komma oder Leerzeichen trennen) und klicken auf „Hinzufügen“.",
            },
          ],
        },
        {
          type: "callout",
          variant: "tip",
          title: "Zonenkarte",
          text: "Der Reiter „Zonenkarte“ zeigt alle Zonen farbig auf einer Landkarte und darunter eine Tabelle mit den Preisen je Zone. So sehen Sie auf einen Blick, welche PLZ zu welcher Zone gehört.",
        },
      ],
    },
    {
      id: "system-sicherheit",
      heading: "System und Sicherheit",
      blocks: [
        {
          type: "list",
          items: [
            "„System“: zeigt zur Information den Zustand der App und der angebundenen Dienste. Hier lässt sich nichts einstellen – die Seite dient nur dem Nachschauen.",
            "„Geocoding“: hier können Adressen, die noch keine Position auf der Karte haben, erneut ermittelt werden.",
            "„Sicherheit“: hier ändern Sie Ihr eigenes Passwort und richten bei Bedarf eine Zwei-Faktor-Anmeldung ein.",
          ],
        },
        {
          type: "callout",
          variant: "info",
          text: "Die Tarife selbst pflegen Sie im Reiter „Tarife“. Dazu gibt es eine eigene Anleitung „Tarife pflegen“.",
        },
      ],
    },
  ],
}

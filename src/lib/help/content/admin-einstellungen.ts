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
      id: "geocoding",
      heading: "Geocoding: Adressen auf der Karte verorten",
      blocks: [
        {
          type: "paragraph",
          text: "Damit Fahrten auf der Karte erscheinen und Routen berechnet werden können, braucht jede Patienten- und Zieladresse eine Position (Koordinaten). Das geschieht normalerweise automatisch, sobald Sie eine Adresse anlegen oder ändern. Der Reiter „Geocoding“ zeigt den Stand und lässt fehlende Positionen nachtragen.",
        },
        {
          type: "paragraph",
          text: "Oben sehen Sie je eine Übersicht für Patienten und für Ziele: wie viele Adressen bereits verortet sind und wie viele noch offen oder fehlgeschlagen sind.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Backfill starten",
              text: "Klicken Sie auf „Backfill starten“. Die App arbeitet die offenen Adressen in Blöcken ab. Ein Fortschrittsbalken zeigt, wie viele verarbeitet sind, samt Anzahl erfolgreich, fehlgeschlagen und verbleibend.",
            },
            {
              title: "Laufen lassen oder abbrechen",
              text: "Der Lauf kann einige Minuten dauern. Mit „Abbrechen“ stoppen Sie nach dem aktuellen Block; bereits verortete Adressen bleiben gespeichert. Sie können jederzeit erneut starten – fertige Adressen werden übersprungen.",
            },
          ],
        },
        {
          type: "callout",
          variant: "info",
          text: "Adressen, die Google nicht findet – etwa wegen Tippfehlern oder unvollständiger Angaben –, erscheinen am Ende in der Liste „Nicht geocodierbar“. Korrigieren Sie diese Adressen im jeweiligen Patienten- oder Ziel-Stammdatensatz; beim Speichern wird die Position automatisch neu ermittelt.",
        },
        {
          type: "callout",
          variant: "tip",
          text: "Von Hand müssen Sie das selten anstossen: Neue oder geänderte Adressen werden sofort verortet, und ein täglicher Hintergrundlauf holt zuvor fehlgeschlagene Adressen von selbst nach.",
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
            "„Geocoding“: hier tragen Sie fehlende Positionen von Adressen auf der Karte nach (siehe Abschnitt „Geocoding“ oben).",
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

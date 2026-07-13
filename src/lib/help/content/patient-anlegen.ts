import type { HelpArticle } from "@/lib/help/types"

/**
 * Tutorial "Eine Patientin oder einen Patienten anlegen" — real content.
 * Audience: operator and admin.
 */
export const patientAnlegen: HelpArticle = {
  slug: "patient-anlegen",
  title: "Anleitung: Eine Patientin oder einen Patienten anlegen",
  category: "stammdaten",
  audience: ["operator", "admin"],
  keywords: [
    "patient",
    "anlegen",
    "stammdaten",
    "adresse",
    "person",
    "neu",
  ],
  summary:
    "So speichern Sie eine Person mit Adresse, damit Sie sie bei Fahrten schnell auswählen können.",
  sections: [
    {
      id: "einleitung",
      heading: "Bevor Sie beginnen",
      blocks: [
        {
          type: "paragraph",
          text: "Damit Sie eine Person bei einer Fahrt auswählen können, muss sie einmal gespeichert werden. Nötig sind dafür der Name und die Adresse. Alles Weitere – etwa eine Beeinträchtigung oder eine Telefonnummer – können Sie ergänzen.",
        },
      ],
    },
    {
      id: "formular-oeffnen",
      heading: "Das Formular öffnen",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Bereich „Patienten“ öffnen",
              text: "Klicken Sie oben im Menü auf „Patienten“.",
            },
            {
              title: "Neue Person starten",
              text: "Klicken Sie oben rechts auf „Neuer Patient“. Es öffnet sich ein Formular.",
            },
          ],
        },
      ],
    },
    {
      id: "ausfuellen",
      heading: "Die Angaben eintragen",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Name eintragen",
              text: "Tragen Sie „Vorname“ und „Nachname“ ein. Diese beiden Felder sind Pflicht.",
            },
            {
              title: "Adresse eingeben",
              text: "Am einfachsten nutzen Sie das Feld „Adresssuche (Google Maps)“: Tippen Sie die Adresse ein und wählen Sie den passenden Vorschlag. Strasse, Hausnummer, PLZ und Ort werden dann automatisch ausgefüllt. Sie können die vier Felder auch von Hand eintragen. Alle vier sind Pflicht.",
            },
            {
              title: "Telefon ergänzen (freiwillig)",
              text: "Im Feld „Telefon“ können Sie die Telefonnummer der Person hinterlegen.",
            },
            {
              title: "Notfallkontakt ergänzen (freiwillig)",
              text: "Unter „Notfallkontakt“ können Sie Name und Telefon einer Kontaktperson eintragen.",
            },
          ],
        },
        // TODO(content): Screenshot des Patienten-Formulars mit Name, Adresssuche und Adressfeldern.
        {
          type: "callout",
          variant: "tip",
          title: "Pflichtfelder erkennen",
          text: "Pflichtfelder sind mit einem roten Sternchen markiert. Fehlt eine Angabe, erscheint nach dem Speichern ein roter Hinweis direkt unter dem Feld. Die PLZ muss vierstellig sein (Schweiz).",
        },
      ],
    },
    {
      id: "beeintraechtigungen",
      heading: "Beeinträchtigungen erfassen",
      blocks: [
        {
          type: "paragraph",
          text: "Im Bereich „Beeinträchtigungen“ setzen Sie Häkchen bei allem, was für die Fahrt wichtig ist. Sie können mehrere Angaben gleichzeitig auswählen:",
        },
        {
          type: "list",
          items: [
            "Rollator",
            "Rollstuhl",
            "Liegendtransport",
            "Begleitperson",
          ],
        },
        {
          type: "callout",
          variant: "info",
          text: "Diese Angaben helfen später bei der Einteilung – zum Beispiel, damit für einen Rollstuhl das passende Fahrzeug gewählt wird. In den Feldern „Kommentar“ und „Interne Notizen“ können Sie zusätzliche Hinweise festhalten.",
        },
      ],
    },
    {
      id: "speichern",
      heading: "Speichern",
      blocks: [
        {
          type: "paragraph",
          text: "Klicken Sie unten auf „Speichern“. Danach kehren Sie zur Patientenliste zurück – die neue Person ist dort sofort sichtbar und kann bei Fahrten ausgewählt werden.",
        },
        {
          type: "callout",
          variant: "info",
          title: "Was passiert mit der Adresse?",
          text: "Nach dem Speichern ermittelt die App im Hintergrund die genaue Lage der Adresse auf der Karte. Das geschieht automatisch, Sie müssen nichts tun.",
        },
        {
          type: "callout",
          variant: "tip",
          title: "Ändern und ausblenden",
          text: "Um eine Person später zu ändern, klicken Sie in der Liste auf ihre Karte und dann auf „Bearbeiten“. Personen, die Sie nicht mehr brauchen, können Sie über „Deaktivieren“ ausblenden – gelöscht wird nichts. Mit dem Häkchen „Inaktive anzeigen“ machen Sie sie bei Bedarf wieder sichtbar.",
        },
      ],
    },
  ],
}

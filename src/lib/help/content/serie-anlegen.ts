import type { HelpArticle } from "@/lib/help/types"

/**
 * Tutorial "Eine Fahrtserie anlegen" — real content.
 * Audience: operator and admin.
 */
export const serieAnlegen: HelpArticle = {
  slug: "serie-anlegen",
  title: "Anleitung: Eine Fahrtserie anlegen",
  category: "fahrten",
  audience: ["operator", "admin"],
  keywords: [
    "serie",
    "fahrtserie",
    "wiederholung",
    "regelmässig",
    "wöchentlich",
    "termin",
  ],
  summary:
    "So legen Sie wiederkehrende Fahrten an – etwa jeden Dienstag zur Therapie – und erzeugen daraus die einzelnen Termine.",
  sections: [
    {
      id: "einleitung",
      heading: "Wann sich eine Fahrtserie lohnt",
      blocks: [
        {
          type: "paragraph",
          text: "Fährt eine Person regelmässig zum gleichen Ziel – zum Beispiel jeden Montag und Donnerstag zur Therapie – müssen Sie nicht jede Fahrt einzeln erfassen. Sie legen einmal eine „Fahrtserie“ an und erzeugen daraus mit einem Klick alle einzelnen Fahrten.",
        },
        {
          type: "callout",
          variant: "info",
          text: "Eine Fahrtserie ist zunächst nur eine Vorlage. Die einzelnen Fahrten entstehen erst, wenn Sie im zweiten Schritt „Fahrten generieren“. Das erklären wir weiter unten.",
        },
      ],
    },
    {
      id: "serie-erfassen",
      heading: "Die Serie erfassen",
      blocks: [
        {
          type: "steps",
          steps: [
            {
              title: "Bereich „Fahrtserien“ öffnen",
              text: "Klicken Sie links im Menü auf „Fahrtserien“.",
            },
            {
              title: "Neue Serie starten",
              text: "Klicken Sie oben rechts auf „Neue Fahrtserie“. Es öffnet sich ein Formular.",
            },
            {
              title: "Person und Ziel wählen",
              text: "Wählen Sie im Feld „Patient“ die Person aus und im Feld „Ziel“ den Ort, zu dem gefahren wird.",
            },
            {
              title: "Abholzeit und Richtung eintragen",
              text: "Tragen Sie bei „Abholzeit“ die Uhrzeit ein. Bei „Richtung“ wählen Sie „Hinfahrt“, „Rückfahrt“ oder „Hin & Rück“.",
            },
            {
              title: "Wiederholung festlegen",
              text: "Wählen Sie bei „Wiederholungstyp“, wie oft die Fahrt stattfindet: „Täglich“, „Wöchentlich“, „Zweiwöchentlich“ oder „Monatlich“.",
            },
            {
              title: "Wochentage ankreuzen",
              text: "Bei „Wöchentlich“ oder „Zweiwöchentlich“ erscheinen die Wochentage Mo bis So zum Ankreuzen. Setzen Sie ein Häkchen bei den Tagen, an denen gefahren wird.",
            },
            {
              title: "Zeitraum festlegen",
              text: "Tragen Sie bei „Startdatum“ ein, ab wann die Serie gilt. Das Feld „Enddatum“ ist freiwillig – lassen Sie es leer, läuft die Serie unbefristet weiter.",
            },
            {
              title: "Speichern",
              text: "Klicken Sie unten auf „Speichern“. Die Serie erscheint danach in der Übersicht.",
            },
          ],
        },
        // TODO(content): Screenshot des Fahrtserien-Formulars mit Patient, Ziel, Wiederholungstyp und Wochentagen.
        {
          type: "callout",
          variant: "tip",
          title: "Termin und Rückfahrt",
          text: "Im grauen Kasten „Termin (optional)“ können Sie zusätzlich Terminbeginn, Terminende und die Abholzeit für die Rückfahrt hinterlegen. Diese Angaben sind freiwillig.",
        },
      ],
    },
    {
      id: "fahrten-generieren",
      heading: "Fahrten aus der Serie erzeugen",
      blocks: [
        {
          type: "paragraph",
          text: "Nach dem Speichern besteht die Serie – die einzelnen Fahrten müssen Sie aber noch erzeugen. Das machen Sie in der Übersicht „Fahrtserien“.",
        },
        {
          type: "steps",
          steps: [
            {
              title: "Menü der Serie öffnen",
              text: "Klicken Sie in der Zeile der Serie rechts auf das Menü mit den drei Punkten.",
            },
            {
              title: "„Fahrten generieren“ wählen",
              text: "Wählen Sie den Eintrag „Fahrten generieren“. Es öffnet sich ein kleines Fenster.",
            },
            {
              title: "Zeitraum wählen",
              text: "Legen Sie bei „Von“ und „Bis“ fest, für welchen Zeitraum die Fahrten entstehen sollen. Vorgeschlagen sind die nächsten zwei Wochen.",
            },
            {
              title: "„Generieren“ klicken",
              text: "Klicken Sie auf „Generieren“. Die App legt für jeden passenden Tag eine Fahrt an und meldet Ihnen, wie viele Fahrten erzeugt wurden.",
            },
          ],
        },
        {
          type: "callout",
          variant: "info",
          title: "Was passiert danach?",
          text: "Die erzeugten Fahrten erscheinen in der normalen Fahrtenübersicht – zunächst noch ohne Fahrer. Teilen Sie ihnen anschliessend im Bereich „Disposition“ eine Fahrerin oder einen Fahrer zu.",
        },
        {
          type: "callout",
          variant: "tip",
          text: "Sie können „Fahrten generieren“ gefahrlos wiederholen, etwa jede Woche neu. Bereits vorhandene Fahrten werden dabei übersprungen und nicht doppelt angelegt.",
        },
      ],
    },
    {
      id: "aendern-beenden",
      heading: "Serie ändern oder beenden",
      blocks: [
        {
          type: "paragraph",
          text: "Über das Drei-Punkte-Menü in der Übersicht können Sie eine bestehende Serie anpassen.",
        },
        {
          type: "list",
          items: [
            "„Bearbeiten“: Öffnet die Serie erneut. Hier ändern Sie zum Beispiel Uhrzeit, Wochentage oder das Enddatum.",
            "Serie beenden: Tragen Sie beim Bearbeiten ein „Enddatum“ ein. Danach entstehen keine neuen Fahrten mehr über dieses Datum hinaus.",
            "„Deaktivieren“: Setzt die Serie stumm. Sie erzeugt keine Fahrten mehr, bleibt aber zur Ansicht erhalten und kann später wieder aktiviert werden.",
          ],
        },
        {
          type: "callout",
          variant: "warning",
          text: "Wenn Sie eine Serie ändern, ändern sich bereits erzeugte Fahrten nicht rückwirkend. Passen Sie einzelne bestehende Fahrten bei Bedarf direkt in der Fahrtenübersicht an.",
        },
      ],
    },
  ],
}

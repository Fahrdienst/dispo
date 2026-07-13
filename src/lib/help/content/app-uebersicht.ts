import type { HelpArticle } from "@/lib/help/types"

/**
 * Overview article — real content. Visible to everyone.
 * Written in simple, formal German ("Sie") for users aged 60+.
 */
export const appUebersicht: HelpArticle = {
  slug: "app-uebersicht",
  title: "Was ist die Fahrdienst-App?",
  category: "grundlagen",
  audience: ["public", "driver", "operator", "admin"],
  keywords: [
    "übersicht",
    "einführung",
    "was ist",
    "programm",
    "software",
    "start",
    "grundlagen",
  ],
  summary:
    "Eine einfache Einführung: Wofür die Fahrdienst-App da ist und wie sie Ihnen bei der täglichen Arbeit hilft.",
  sections: [
    {
      id: "wozu",
      heading: "Wozu dient die App?",
      blocks: [
        {
          type: "paragraph",
          text: "Mit der Fahrdienst-App planen und verwalten Sie Krankentransporte. Sie erfassen Fahrten, teilen Fahrerinnen und Fahrer ein und behalten den Überblick über den ganzen Tag – alles an einem Ort.",
        },
        {
          type: "paragraph",
          text: "Sie müssen nichts installieren. Die App läuft im Internet-Browser, so wie eine normale Webseite. Sie melden sich mit Ihrer E-Mail-Adresse und Ihrem Passwort an.",
        },
        {
          type: "callout",
          variant: "tip",
          title: "Gut zu wissen",
          text: "Sie können nichts kaputt machen. Probieren Sie ruhig aus. Wenn Sie einmal nicht weiterkommen, hilft Ihnen diese Hilfe-Seite Schritt für Schritt.",
        },
      ],
    },
    {
      id: "bereiche",
      heading: "Die wichtigsten Bereiche",
      blocks: [
        {
          type: "paragraph",
          text: "Links am Bildschirmrand finden Sie das Menü. Über dieses Menü erreichen Sie alle Bereiche der App. Welche Bereiche Sie sehen, hängt von Ihrer Rolle ab.",
        },
        {
          type: "list",
          items: [
            "Dashboard: Ihre Startseite mit den wichtigsten Zahlen und der Tageskarte.",
            "Fahrten: Hier erfassen und bearbeiten Sie einzelne Fahrten.",
            "Disposition: Hier teilen Sie den Fahrten die passenden Fahrerinnen und Fahrer zu.",
            "Patienten und Ziele: Ihre gespeicherten Adressen für wiederkehrende Fahrten.",
            "Meine Fahrten: Fahrerinnen und Fahrer sehen hier ihre eigenen Einsätze.",
          ],
        },
        {
          type: "screenshot",
          src: "/help/screenshots/app-uebersicht-menue.png",
          alt: "Das Hauptmenü der Fahrdienst-App am linken Bildschirmrand mit den Einträgen Dashboard, Fahrten und Disposition.",
          caption: "Das Menü am linken Rand führt Sie zu allen Bereichen.",
          markers: [
            { number: 1, x: 12, y: 18, label: "Menü öffnen und schließen" },
            { number: 2, x: 12, y: 45, label: "Bereich auswählen" },
          ],
        },
      ],
    },
    {
      id: "rollen",
      heading: "Wer sieht was?",
      blocks: [
        {
          type: "paragraph",
          text: "Jede Person hat eine Rolle. Die Rolle bestimmt, welche Bereiche und welche Hilfe-Themen für sie sichtbar sind.",
        },
        {
          type: "list",
          items: [
            "Fahrerin/Fahrer: sieht die eigenen Fahrten und die eigene Verfügbarkeit.",
            "Disponentin/Disponent (Operator): plant Fahrten und teilt Fahrer ein.",
            "Administration: verwaltet zusätzlich Benutzer, Tarife und Einstellungen.",
          ],
        },
      ],
    },
  ],
}

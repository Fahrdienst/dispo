/**
 * Type definitions for the help / documentation content store.
 *
 * A single content store powers two surfaces:
 *  - the public help pages (`/help`) — everything flagged with audience "public"
 *  - the protected, role-specific help area (`/hilfe`) — public content plus
 *    the content matching the signed-in user's role.
 *
 * The only thing that distinguishes public from protected content is the
 * `audience` flag on each article. No copy/paste, one source of truth.
 */

import type { Enums } from "@/lib/types/database"

/** Application roles, re-exported for convenience in the help module. */
export type UserRole = Enums<"user_role">

/**
 * Who is allowed to see an article. "public" is visible to everyone
 * (including signed-out visitors); the role values gate protected content.
 */
export type HelpAudience = "public" | "driver" | "operator" | "admin"

/**
 * Top-level grouping used to organise articles into sections on the
 * overview pages. Kept as a small closed union so grouping and ordering
 * are fully type-checked.
 */
export type HelpCategory =
  | "grundlagen"
  | "fahrten"
  | "disposition"
  | "stammdaten"
  | "abrechnung"
  | "fahrer"
  | "administration"
  | "hilfe"

/** Human-readable labels for each category (German, formal "Sie"). */
export const CATEGORY_LABELS: Record<HelpCategory, string> = {
  grundlagen: "Grundlagen",
  fahrten: "Fahrten erfassen und planen",
  disposition: "Disposition",
  stammdaten: "Stammdaten pflegen",
  abrechnung: "Abrechnung",
  fahrer: "Für Fahrerinnen und Fahrer",
  administration: "Administration",
  hilfe: "Hilfe und Kontakt",
}

/** Display order of categories on the overview pages. */
export const CATEGORY_ORDER: readonly HelpCategory[] = [
  "grundlagen",
  "fahrten",
  "disposition",
  "stammdaten",
  "abrechnung",
  "fahrer",
  "administration",
  "hilfe",
]

/**
 * A single positioned marker drawn on top of a screenshot. Coordinates are
 * percentages (0–100) relative to the image box, so they stay correct at
 * any rendered size.
 */
export interface ScreenshotMarker {
  /** Sequential number shown inside the marker badge. */
  number: number
  /** Horizontal position in percent (0 = left edge, 100 = right edge). */
  x: number
  /** Vertical position in percent (0 = top edge, 100 = bottom edge). */
  y: number
  /** Optional short caption describing what the marker points at. */
  label?: string
}

/** A normal text paragraph. */
export interface ParagraphBlock {
  type: "paragraph"
  text: string
}

/** A bulleted (default) or numbered list of short items. */
export interface ListBlock {
  type: "list"
  ordered?: boolean
  items: string[]
}

/** An annotated screenshot referencing an image under `/help/screenshots/`. */
export interface ScreenshotBlock {
  type: "screenshot"
  /** Public path, e.g. "/help/screenshots/fahrt-erfassen-formular.png". */
  src: string
  /** Descriptive alt text (required for accessibility). */
  alt: string
  /** Optional caption rendered below the image. */
  caption?: string
  /** Optional numbered marker overlays. */
  markers?: ScreenshotMarker[]
}

/** A highlighted note: informational, a warning, or a tip. */
export interface CalloutBlock {
  type: "callout"
  variant: "info" | "warning" | "tip"
  /** Optional bold heading for the callout. */
  title?: string
  text: string
}

/** A single step within a `StepsBlock`. */
export interface Step {
  title: string
  text: string
}

/** An ordered, numbered walkthrough (used for tutorials). */
export interface StepsBlock {
  type: "steps"
  steps: Step[]
}

/**
 * Discriminated union of every content block an article section can contain.
 * Rendering switches exhaustively over `block.type`.
 */
export type HelpBlock =
  | ParagraphBlock
  | ListBlock
  | ScreenshotBlock
  | CalloutBlock
  | StepsBlock

/** A titled section of an article. `id` is used as the anchor / TOC target. */
export interface HelpSection {
  /** URL-fragment-safe anchor id, unique within the article. */
  id: string
  heading: string
  blocks: HelpBlock[]
}

/** A complete help article. */
export interface HelpArticle {
  /** URL slug, unique across the whole registry. */
  slug: string
  title: string
  category: HelpCategory
  /** One or more audiences that may see this article. */
  audience: HelpAudience[]
  /** Search keywords (umlaut-tolerant matching is applied at query time). */
  keywords: string[]
  /** Short one- or two-sentence summary shown on cards and search results. */
  summary: string
  sections: HelpSection[]
}

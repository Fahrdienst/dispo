/**
 * TTL for receipt-PDF signed URLs.
 *
 * SEC-M14-005 (HIGH): receipt PDFs are downloaded on-demand inside an
 * authenticated session, so the URL must be short-lived. This deliberately does
 * NOT reuse the 1-year `feedback` pattern (that URL is embedded in a GitHub
 * issue). Hard ceiling: 5 minutes.
 *
 * Lives outside the "use server" action file because Next.js only allows async
 * function exports there.
 */
export const RECEIPT_SIGNED_URL_TTL_SECONDS = 300

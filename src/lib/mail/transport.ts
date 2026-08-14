// server-only: the Gmail transport must never be pulled into a client bundle.
// It is reached exclusively through `./send.ts` (sendGuardedMail); senders no
// longer import this module directly, so the sandbox guard cannot be bypassed.
import "server-only"
import nodemailer from "nodemailer"

/**
 * Low-level Gmail transport. INTERNAL — do not import outside `./send.ts`.
 * All application mail goes through `sendGuardedMail` so the MAIL_MODE sandbox
 * guard is always applied.
 */
export const mailTransport = nodemailer.createTransport({
  service: "gmail",
  auth: {
    user: process.env.GMAIL_USER,
    pass: process.env.GMAIL_APP_PASSWORD,
  },
})

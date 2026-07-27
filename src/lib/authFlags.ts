// Auth capability flags (code constants, same pattern as src/lib/phase.ts).
//
// PHONE_AUTH_ENABLED — mobile (SMS OTP) sign-in/up. OFF until:
//   1. an SMS provider (MSG91 / Twilio / …) is wired to Supabase, AND
//   2. India TRAI **DLT** sender-ID + template registration is approved (business KYC; weeks of lead time).
// Until both are done, Supabase rejects phone auth ("Phone logins are disabled"), so we hide the Mobile
// option rather than advertise a door that's locked. Flip to `true` only once phone OTP genuinely works
// end-to-end in production. When false, the login/signup identifier is email-only.
export const PHONE_AUTH_ENABLED = false

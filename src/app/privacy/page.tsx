import Link from 'next/link'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'
import { siteConfig } from '@/lib/site-config'
import { tokens as T } from '@/lib/tokens'

// Today's data handling, as the code does it. Change this page in the same commit as any change to
// what is stored, where, or who receives it.
const CONTACT = siteConfig.email
  ? `email ${siteConfig.email}`
  : 'contact us (we have not published a privacy contact address yet)'

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: T.paper, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      <SiteHeader />

      {/* Content */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>

        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Privacy Policy</h1>
          <div style={{ fontSize: 13, color: T.muted }}>Last updated: October 2026 · Effective immediately</div>
        </div>

        {/* Summary box */}
        <div style={{ background: T.tint, border: `1px solid ${T.slip.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 36 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.teal, marginBottom: 10 }}>Summary in plain English</div>
          {[
            'Your slip file is read by AI and is not kept after it has been read.',
            'What the AI reads from it is kept. It is saved in your browser and, if you are signed in, in our database.',
            'Those saved figures can include your full PAN. They are not encrypted by us.',
            'Your slips are sent to Anthropic (USA), an AI provider, to be read.',
            'There is no self-service way to delete your data from our servers yet.',
            'We do not sell your data.',
          ].map(point => (
            <div key={point} style={{ fontSize: 13, color: T.ink, marginBottom: 6, lineHeight: 1.6 }}>{point}</div>
          ))}
        </div>

        {[
          {
            title: '1. Who we are',
            content: 'ArthVo is an AI-powered financial tool designed for India\'s working class. We provide salary-slip analysis and tax-regime comparison.',
          },
          {
            title: '2. What we collect',
            content: null,
            list: [
              'Documents you upload — salary slips, offer letters, AIS / Form 26AS and filed returns, sent to us to be read.',
              'What is read from them — pay figures, employer and pay period, and, where the document shows them, your name, full PAN and the last 4 digits of your Aadhaar.',
              'Passwords for protected files — sent to our server only to open that file. We do not save them.',
              'Numbers you type in — such as rent, deductions and other income. These stay in your browser unless cloud backup is on.',
              'Account details — your email address, and a password that Supabase stores in hashed form.',
              'Reminder sign-ups — if you ask for a reminder, your email, the saving figure shown to you, the financial year and when you agreed.',
              'Chat messages — your questions, plus a note of which steps you have completed (no amounts). These are sent to Anthropic to generate a reply. We save only a count of messages, not their text.',
              'Usage data — pages visited, through Vercel Analytics, and our own counts of events such as a slip being read. Those counts hold no personal information.',
            ],
          },
          {
            title: '3. How your salary slip is processed',
            content: 'When you upload a salary slip: (1) The file goes from your browser to our server over an encrypted HTTPS connection. (2) Our server sends its contents to Anthropic\'s Claude AI API, which reads it and extracts the details. (3) The extracted details come back to your browser and are saved there. (4) If you are signed in, our server also saves them to our database. (5) We do not save the file itself: it is held in memory while it is read, then discarded. Reading is automatic and no step in the product has a person review your slip, but people with administrative access to our database could view the saved details.',
          },
          {
            title: '4. Third parties who process your data',
            content: null,
            list: [
              'Anthropic (USA) — receives the full contents of documents you upload and your chat messages. Its own terms decide how long it keeps them and how it may use them. See anthropic.com/privacy.',
              'Supabase — hosts our database and handles sign-in, so it holds everything listed under "On our servers" below.',
              'Vercel (USA) — hosts ArthVo, provides usage analytics, and holds our server logs. See vercel.com/legal/privacy-policy.',
              'We do not sell your data or share it with advertisers or data brokers.',
            ],
          },
          {
            title: '5. Where your data is stored',
            content: 'In your browser:',
            list: [
              'Your salary details, tax inputs, AIS data and the identity details used to check that new slips are yours, including your full PAN. This is not encrypted. It stays there after you sign out, so anyone using the same browser could see it. To remove it, clear this site\'s data in your browser settings.',
              'Backup files you download contain the same data and are not encrypted.',
            ],
          },
          {
            title: 'On our servers',
            content: null,
            list: [
              'Parsed slips — if you upload while signed in, we save everything read from the slip, including employer, pay period, net pay and, where shown, your name, full PAN and last 4 digits of Aadhaar. We do not encrypt these records ourselves.',
              'Activity records — linked to your account: for example, that a slip was read, how many, and its net pay. We do not encrypt these ourselves.',
              'Account and reminder details — as listed in section 2.',
              'Server logs — our logs record the gross pay, net pay and month read from each slip page, without your name. Error logs can include error details.',
              'Cloud backup — not switched on today. When it is on, a copy of your browser data, including your full PAN, is saved to your account, encrypted. We hold the key, so we are able to decrypt it.',
              'Bank statements — this feature is off today. Statements read while it was on may still be stored, including their transaction data.',
              'We do not delete any of this automatically. It stays until it is removed by hand.',
            ],
          },
          {
            title: '6. Deleting or changing your data',
            content: `There is no "Delete my data" option in ArthVo yet. Signing out does not delete anything from our servers, and clears only some of what is in your browser. To ask us to access, correct or delete what we hold about you, ${CONTACT}. We handle these requests by hand.`,
          },
          {
            title: '7. Your rights under the DPDP Act 2023',
            content: `India's Digital Personal Data Protection Act 2023 gives you the rights below. Parts of the Act are coming into force in phases, so some may not be enforceable yet. This list describes the law. It does not mean ArthVo already meets every requirement of the Act. To use any of these rights, ${CONTACT}.`,
            list: [
              'Access — to ask for a summary of the personal data we process about you, what we do with it, and who we have shared it with.',
              'Correction — to ask us to correct, complete or update your personal data.',
              'Erasure — to ask us to erase your personal data, unless we need to keep it for the purpose you gave it for or to comply with the law.',
              'Grievance — to raise a complaint with us about how we handle your personal data or respond to these requests.',
              'Complaint to the Data Protection Board of India — to take your complaint to the Board. The Act requires you to raise it with us first.',
            ],
          },
          {
            title: '8. Cookies and browser storage',
            content: 'We use cookies to keep you signed in, and browser storage (localStorage) to remember your salary data on this device. We do not use advertising cookies. Vercel Analytics measures page visits.',
          },
          {
            title: '9. Children\'s data',
            content: 'ArthVo is not intended for use by anyone under the age of 18. We do not knowingly collect data from minors.',
          },
          {
            title: '10. Changes to this policy',
            content: 'We update this policy as the product changes. The date at the top of this page shows the latest version.',
          },
          {
            title: '11. Contact us',
            content: `For privacy questions or data requests, ${CONTACT}.`,
          },
        ].map(section => (
          <div key={section.title} style={{ marginBottom: 32 }}>
            <h2 style={{ fontSize: 17, fontWeight: 700, color: T.ink, marginBottom: 10, paddingBottom: 8, borderBottom: `1px solid ${T.hairline}` }}>
              {section.title}
            </h2>
            {section.content && (
              <p style={{ fontSize: 14, color: T.ink, lineHeight: 1.8, marginBottom: section.list ? 12 : 0 }}>
                {section.content}
              </p>
            )}
            {section.list && (
              <ul style={{ paddingLeft: 0, listStyle: 'none' }}>
                {section.list.map((item, i) => (
                  <li key={i} style={{ fontSize: 14, color: T.ink, lineHeight: 1.8, marginBottom: 8, paddingLeft: 20, position: 'relative' }}>
                    <span style={{ position: 'absolute', left: 0, color: T.teal, fontWeight: 700 }}>•</span>
                    {item}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}

        {/* Footer note */}
        <div style={{ background: T.caution.fill, border: `1px solid ${T.caution.border}`, borderRadius: 12, padding: '16px 20px', fontSize: 13, color: T.caution.text, lineHeight: 1.7 }}>
          <strong>Disclaimer:</strong> ArthVo is an informational tool, not a registered investment adviser. Tax calculations are illustrative — consult a CA for ITR filing.
        </div>

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Link href="/dashboard" style={{ display: 'inline-block', padding: '12px 28px', background: T.teal, color: T.ivory, borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            ← Back to Salary Upload
          </Link>
        </div>
      </div>
      <SiteFooter />
    </div>
  )
}

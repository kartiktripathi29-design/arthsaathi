import Link from 'next/link'
import { tokens as T } from '@/lib/tokens'

export default function PrivacyPage() {
  return (
    <div style={{ minHeight: '100vh', background: T.paper, fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}>

      {/* Nav */}
      <nav style={{ background: T.teal, padding: '16px 48px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <Link href="/" style={{ textDecoration: 'none', display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 32, height: 32, background: T.taupe, borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 800, fontSize: 16, color: T.teal }}>₹</div>
          <span style={{ fontWeight: 700, fontSize: 16, color: T.ivory }}>ArthVo</span>
        </Link>
        <Link href="/dashboard" style={{ fontSize: 13, color: 'rgba(244,238,224,0.6)', textDecoration: 'none' }}>
          ← Back to Dashboard
        </Link>
      </nav>

      {/* Content */}
      <div style={{ maxWidth: 760, margin: '0 auto', padding: '48px 24px' }}>

        <div style={{ marginBottom: 40 }}>
          <h1 style={{ fontSize: 32, fontWeight: 800, color: T.ink, marginBottom: 8 }}>Privacy Policy</h1>
          <div style={{ fontSize: 13, color: T.muted }}>Last updated: April 2025 · Effective immediately</div>
        </div>

        {/* Summary box */}
        <div style={{ background: T.tint, border: `1px solid ${T.slip.border}`, borderRadius: 14, padding: '20px 24px', marginBottom: 36 }}>
          <div style={{ fontSize: 15, fontWeight: 700, color: T.teal, marginBottom: 10 }}>📋 Summary in plain English</div>
          {[
            '✓ Your salary slip is processed by AI to extract numbers — it is NOT saved anywhere',
            '✓ We do not sell your data to anyone, ever',
            '✓ No salary document is stored on our servers',
            '✓ Parsed salary numbers are saved only in your own browser (localStorage)',
            '✓ You can delete all your data at any time using the Reset button in the sidebar',
            '✓ The AI processing happens on Anthropic\'s servers (USA) under their privacy policy',
          ].map(point => (
            <div key={point} style={{ fontSize: 13, color: T.ink, marginBottom: 6, lineHeight: 1.6 }}>{point}</div>
          ))}
        </div>

        {[
          {
            title: '1. Who we are',
            content: 'ArthVo is an AI-powered financial guidance platform designed for India\'s working class. We provide salary analysis, tax optimisation, and investment guidance. We are in the process of obtaining SEBI Investment Adviser (RIA) registration. Registered in India.',
          },
          {
            title: '2. What data we collect',
            content: null,
            list: [
              'Salary slip documents — uploaded voluntarily by you for AI parsing. These are sent to Anthropic\'s Claude API for processing and are immediately discarded after the parsed data is returned. We do not store the raw document.',
              'Parsed salary data — the structured numbers extracted from your salary slip (Basic, HRA, PF, Net Pay etc.). These are stored only in your browser\'s localStorage on your own device. They are never sent to our database.',
              'Chat messages — questions you ask the AI advisor. These are sent to Anthropic\'s Claude API to generate a response and are not stored in our database.',
              'Usage analytics — anonymous data about which pages you visit, via Vercel Analytics. No personal information is collected.',
            ],
          },
          {
            title: '3. How your salary slip is processed',
            content: 'When you upload a salary slip, the following happens: (1) The file is sent from your browser to our server over an encrypted HTTPS connection. (2) Our server forwards it to Anthropic\'s Claude AI API for reading and extracting salary components. (3) The extracted data (just numbers and labels — no image) is returned to your browser. (4) The original file is discarded from server memory immediately. At no point is your salary slip saved to a database or storage system.',
          },
          {
            title: '4. Third parties who process your data',
            content: null,
            list: [
              'Anthropic (USA) — processes salary slip documents and chat messages via their Claude AI API. Anthropic does not train its models on API customer data by default. See anthropic.com/privacy.',
              'Vercel (USA) — hosts the ArthVo application. Vercel may log anonymous request metadata. See vercel.com/legal/privacy-policy.',
              'We do not share your data with any other third party, advertiser, or data broker.',
            ],
          },
          {
            title: '5. Data storage and location',
            content: 'Parsed salary numbers and tax calculations are stored only in your browser\'s localStorage — on your own device. This data never leaves your device unless you explicitly use a feature that sends it to the AI (such as the chat). We do not operate a user account database at this time. There is no server-side storage of personal financial data.',
          },
          {
            title: '6. Your rights under DPDP Act 2023',
            content: 'Under India\'s Digital Personal Data Protection Act 2023, you have the right to:',
            list: [
              'Access — know what data we hold about you',
              'Correction — request correction of inaccurate data',
              'Erasure — delete all your data (use the Reset button in the dashboard sidebar at any time)',
              'Grievance redressal — raise a complaint with us or the Data Protection Board of India',
            ],
          },
          {
            title: '7. Cookies',
            content: 'ArthVo does not use tracking cookies. We use browser localStorage (not cookies) to remember your salary data between sessions on the same device. You can clear this at any time using the Reset button in the sidebar, or by clearing your browser\'s local storage.',
          },
          {
            title: '8. Children\'s data',
            content: 'ArthVo is not intended for use by anyone under the age of 18. We do not knowingly collect data from minors.',
          },
          {
            title: '9. Changes to this policy',
            content: 'We may update this privacy policy as the product evolves. The date at the top of this page will always reflect the latest version. Continued use of ArthVo after changes constitutes acceptance of the updated policy.',
          },
          {
            title: '10. Contact us',
            content: 'For any privacy concerns, data deletion requests, or questions about this policy, please contact us. We aim to respond within 72 hours.',
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
          ⚠️ <strong>Investment Disclaimer:</strong> ArthVo provides general financial guidance for educational purposes. All investment advice is indicative. Tax calculations are illustrative — consult a CA for ITR filing. We are in the process of obtaining SEBI RIA registration. Past performance of investments is not indicative of future returns.
        </div>

        <div style={{ marginTop: 32, textAlign: 'center' }}>
          <Link href="/dashboard" style={{ display: 'inline-block', padding: '12px 28px', background: T.teal, color: T.ivory, borderRadius: 10, textDecoration: 'none', fontWeight: 600, fontSize: 14 }}>
            ← Back to Salary Upload
          </Link>
        </div>
      </div>
    </div>
  )
}

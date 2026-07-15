// Landing page — the self-contained v7 intro experience (public/intro-v7.html), full-viewport.
//
// This embeds the designed HTML/CSS/JS exactly, so the ~45s cinematic + hero/steps render
// pixel-perfect with no risk of mistranscribing the animation engine. Internal links inside the
// embed use `<base target="_top">` so "See your verdict" / "Decode an offer letter" / "Log in"
// navigate the top window (/try, /offer, /login). The root layout adds no chrome, so a fixed
// full-viewport frame is a clean full-screen takeover.
//
// NOTE: content lives inside the frame, so it isn't in the top document's server HTML — fine for the
// brand landing, but a native React port would be the move if deep-content SEO becomes a priority.
export default function LandingPage() {
  return (
    <iframe
      src="/intro-v7.html"
      title="ArthVo — your tax, finally clear"
      style={{ position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0, display: 'block' }}
    />
  )
}

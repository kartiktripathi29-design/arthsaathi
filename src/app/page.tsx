'use client'
// Landing page — the self-contained v7 intro experience (public/intro-v7.html), full-viewport.
//
// This embeds the designed HTML/CSS/JS exactly, so the ~45s cinematic + hero/steps render
// pixel-perfect with no risk of mistranscribing the animation engine. Internal links inside the
// embed use `<base target="_top">` so "See your verdict" / "Decode an offer letter" navigate the top
// window (/try, /offer). The frame is a full-screen takeover during the intro. When the intro ends it
// reports its content height, and the frame joins the page flow between the shared header and footer.
//
// NOTE: content lives inside the frame, so it isn't in the top document's server HTML — fine for the
// brand landing, but a native React port would be the move if deep-content SEO becomes a priority.
import { useEffect, useRef, useState } from 'react'
import SiteHeader from '@/components/SiteHeader'
import SiteFooter from '@/components/SiteFooter'

export default function LandingPage() {
  const [height, setHeight] = useState<number | null>(null)
  const frame = useRef<HTMLIFrameElement>(null)

  useEffect(() => {
    const onMessage = (e: MessageEvent) => {
      if (e.origin === window.location.origin && e.source === frame.current?.contentWindow && e.data?.type === 'arthvo:landing') setHeight(e.data.height)
    }
    window.addEventListener('message', onMessage)
    // The intro may have ended before this listener existed (reduced motion skips it), so ask.
    frame.current?.contentWindow?.postMessage('arthvo:ping', window.location.origin)
    return () => window.removeEventListener('message', onMessage)
  }, [])

  const landed = height !== null
  return (
    <>
      {landed && <SiteHeader />}
      <iframe
        ref={frame}
        src="/intro-v7.html"
        title="ArthVo — your tax, finally clear"
        style={landed
          ? { width: '100%', height, border: 0, display: 'block' }
          : { position: 'fixed', inset: 0, width: '100%', height: '100%', border: 0, display: 'block' }}
      />
      {landed && <SiteFooter />}
    </>
  )
}

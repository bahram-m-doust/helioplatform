/**
 * Tiny placeholder for ``/`` after Phase 5.8. The customer-facing site
 * is on Framer; this app is reduced to the onboarding questionnaire.
 *
 * Renders a self-contained "this is the API host" message — no
 * SiteHeader / SiteFooter dependency on the deleted marketing assets.
 */
export default function RootRedirect() {
  return (
    <main
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: '100vh',
        padding: '2rem',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, sans-serif',
        background: '#0b0d10',
        color: '#e6e8eb',
      }}
    >
      <h1 style={{ fontSize: '1.5rem', marginBottom: '1rem' }}>Helio API</h1>
      <p style={{ maxWidth: 480, textAlign: 'center', color: '#8b94a3' }}>
        This is the Helio API host. The customer-facing site lives at{' '}
        <a href="https://platform.helio.ae" style={{ color: '#ffd24a' }}>
          platform.helio.ae
        </a>
        ; admin tools live at{' '}
        <a href="https://admin.helio.ae" style={{ color: '#ffd24a' }}>
          admin.helio.ae
        </a>
        .
      </p>
    </main>
  );
}

export default {
  logo: (
    <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 700, letterSpacing: '-0.01em' }}>
      <img src="/favicon.svg" width="22" height="22" alt="" />
      Veralith <span style={{ opacity: 0.5, fontWeight: 500 }}>Docs</span>
    </span>
  ),
  project: {
    link: 'https://github.com/SrijanShekhar21/VeralithAI',
  },
  docsRepositoryBase: 'https://github.com/kaustavd7/VeralithAI_frontend/tree/main/apps/docs',
  primaryHue: 155,
  primarySaturation: 60,
  sidebar: {
    defaultMenuCollapseLevel: 1,
    toggleButton: true,
  },
  footer: {
    text: `© ${new Date().getFullYear()} Veralith`,
  },
  useNextSeoProps() {
    return { titleTemplate: '%s – Veralith Docs' }
  },
  head: (
    <>
      <link rel="icon" type="image/svg+xml" href="/favicon.svg" />
      <meta name="viewport" content="width=device-width, initial-scale=1.0" />
      <meta
        name="description"
        content="Veralith documentation — evaluate, diagnose, and self-heal RAG hallucinations."
      />
      <link rel="preconnect" href="https://fonts.googleapis.com" />
      <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      <link href="https://fonts.googleapis.com/css2?family=Raleway:wght@400;500;600;700&display=swap" rel="stylesheet" />
      <style
        dangerouslySetInnerHTML={{
          __html: `
        body, .nextra-content, h1, h2, h3, h4, h5, h6, p, li, a, button, table, nav, aside, .nextra-nav-container, .nextra-sidebar-container { font-family: 'Raleway', ui-sans-serif, system-ui, -apple-system, sans-serif !important; }
        code, pre, kbd, samp { font-family: ui-monospace, 'JetBrains Mono', Menlo, monospace !important; }
      `,
        }}
      />
    </>
  ),
}

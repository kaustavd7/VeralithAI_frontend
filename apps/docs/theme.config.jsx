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
    </>
  ),
}

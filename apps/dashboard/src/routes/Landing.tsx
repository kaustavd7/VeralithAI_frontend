// Landing route — the public marketing / hero page, served at `/`.
// The page is a self-contained static document (public/landing.html) with its
// own CSS/JS (including the Moss Reveal canvas). Embedding it in an isolated,
// full-screen iframe keeps those global styles from clashing with the
// dashboard's. Its CTAs use target="_top", so "Log in" / "Start free" navigate
// the top window to /login (the dashboard's auth).
export default function Landing() {
  return (
    <iframe
      src="/landing.html"
      title="Veralith — stop your RAG from hallucinating"
      style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        border: 0,
        display: 'block',
      }}
    />
  );
}

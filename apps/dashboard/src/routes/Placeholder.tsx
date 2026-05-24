type Props = {
  title: string;
  subtitle?: string;
};

export default function Placeholder({ title, subtitle }: Props) {
  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'flex-start',
        justifyContent: 'center',
        padding: '64px',
        gap: '12px',
        background: 'var(--bg)',
        color: 'var(--fg)',
      }}
    >
      <div
        style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 12,
          letterSpacing: '0.08em',
          textTransform: 'uppercase',
          color: 'var(--accent)',
        }}
      >
        veralith
      </div>
      <h1 style={{ margin: 0, fontSize: 32, fontWeight: 600 }}>{title}</h1>
      {subtitle ? (
        <p style={{ margin: 0, color: 'var(--fg-3)', maxWidth: 560 }}>{subtitle}</p>
      ) : null}
    </main>
  );
}

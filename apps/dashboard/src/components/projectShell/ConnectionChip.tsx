import { useQuery } from '@tanstack/react-query';
import { api } from '../../api/client';
import { openWorkbench } from '../../lib/workbench';

/* Persistent SDK/MCP wiring indicator in the project topbar. Two dots that go
   green once the backend has seen traces (SDK) / an authenticated agent (MCP).
   Shares the ['connection', slug] query with the onboarding Connect cards. */

function Dot({ on }: { on: boolean }) {
  return <span className={'conn-dot' + (on ? ' is-on' : '')} aria-hidden="true" />;
}

export function ConnectionChip({ slug }: { slug: string }) {
  const conn = useQuery({
    queryKey: ['connection', slug],
    queryFn: () => api.getConnectionStatus(slug),
    enabled: !!slug,
    refetchInterval: 30000,
    staleTime: 15000,
  });

  const data = conn.data;
  if (!data) return null;

  const title =
    `SDK ${data.sdk_connected ? 'connected — receiving traces' : 'not connected yet'}` +
    ` · Agent ${data.mcp_connected ? 'connected via MCP' : 'not connected yet'}` +
    ' — click for setup steps';

  return (
    <button
      type="button"
      className="conn-chip"
      title={title}
      onClick={() => openWorkbench('Integration')}
    >
      <Dot on={data.sdk_connected} />
      <span className="conn-chip-l">SDK</span>
      <span className="conn-chip-sep">·</span>
      <Dot on={data.mcp_connected} />
      <span className="conn-chip-l">MCP</span>
    </button>
  );
}

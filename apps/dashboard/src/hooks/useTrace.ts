import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useTrace(projectIdOrSlug: string, traceId: string) {
  return useQuery({
    queryKey: ['trace', projectIdOrSlug, traceId],
    queryFn: () => api.getTrace(projectIdOrSlug, traceId),
    enabled: !!projectIdOrSlug && !!traceId,
    // Evaluation is async (ingest + Re-evaluate both schedule it in the
    // background). While the trace still reads "evaluating", poll so the view
    // flips to "evaluated" on its own — otherwise a re-eval looks stuck forever
    // because nothing refetches after the initial invalidation. Stops once done.
    refetchInterval: (query) =>
      query.state.data?.trace?.status === 'evaluating' ? 4000 : false,
  });
}

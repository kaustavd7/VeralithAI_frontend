import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';

export function useTrace(projectIdOrSlug: string, traceId: string) {
  return useQuery({
    queryKey: ['trace', projectIdOrSlug, traceId],
    queryFn: () => api.getTrace(projectIdOrSlug, traceId),
    enabled: !!projectIdOrSlug && !!traceId,
  });
}

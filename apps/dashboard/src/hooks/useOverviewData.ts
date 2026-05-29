import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { TracesQuery } from '../api/types';

export function useStats(projectId: string) {
  return useQuery({
    queryKey: ['stats', projectId],
    queryFn: () => api.getStats(projectId),
    enabled: !!projectId,
  });
}

export function useTraces(projectId: string, query: TracesQuery = {}) {
  return useQuery({
    queryKey: ['traces', projectId, query],
    queryFn: () => api.listTraces(projectId, query),
    enabled: !!projectId,
  });
}

export function useCalibration(projectId: string) {
  return useQuery({
    queryKey: ['calibration', projectId],
    queryFn: () => api.getCalibration(projectId),
    enabled: !!projectId,
  });
}

export function useApiKeys(projectId: string) {
  return useQuery({
    queryKey: ['api-keys', projectId],
    queryFn: () => api.listApiKeys(projectId),
    enabled: !!projectId,
  });
}

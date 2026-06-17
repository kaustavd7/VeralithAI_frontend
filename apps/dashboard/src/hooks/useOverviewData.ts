import { useQuery } from '@tanstack/react-query';
import { api } from '../api/client';
import type { TracesQuery } from '../api/types';

export interface StatsQueryParams {
  since?: string;
  until?: string;
  bucket?: 'hour' | 'day';
}

/**
 * Per DEV2_HANDOFF.md §1, each windowed Analytics panel may resolve to a
 * different time window, so this hook key includes the params and each panel
 * keeps its own cache slot.
 */
export function useStats(projectId: string, params: StatsQueryParams = {}) {
  return useQuery({
    queryKey: ['stats', projectId, params],
    queryFn: () => api.getStats(projectId, params),
    enabled: !!projectId,
  });
}

/**
 * Failure-cell timeseries for the 2×3 grounded × completeness taxonomy.
 * Mirrors useStats. The caller MUST pass a stable, quantized `since` (floor
 * Date.now() to the minute) — otherwise the query key changes every render and
 * react-query refetches in an infinite loop. Quantization lives in the caller.
 */
export function useCellTimeseries(projectId: string, params: StatsQueryParams = {}) {
  return useQuery({
    queryKey: ['cell-timeseries', projectId, params],
    queryFn: () => api.getCellTimeseries(projectId, params),
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

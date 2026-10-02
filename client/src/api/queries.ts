import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { api } from "./client";
import type { AppConfig, Catalog, ClockifyStatus, ClockifySyncRequest, ClockifySyncResult, Entry, EntryInput } from "./types";

export const queryKeys = {
  entries: (from: string, to: string) => ["entries", from, to] as const,
  catalog: ["catalog"] as const,
  config: ["config"] as const,
  clockifyStatus: ["clockify", "status"] as const,
  clockifyPlan: (request: ClockifySyncRequest) => ["clockify", "plan", request] as const,
};

export const entriesQuery = (from: string, to: string) => ({
  queryKey: queryKeys.entries(from, to),
  queryFn: ({ signal }: { signal: AbortSignal }) => api.get<Entry[]>(`/api/entries?from=${from}&to=${to}`, signal),
});

export function useEntries(from: string, to: string) {
  return useQuery(entriesQuery(from, to));
}

export function useCatalog() {
  return useQuery({ queryKey: queryKeys.catalog, queryFn: ({ signal }) => api.get<Catalog>("/api/catalog", signal) });
}

export function useConfig() {
  return useQuery({ queryKey: queryKeys.config, queryFn: ({ signal }) => api.get<AppConfig>("/api/config", signal), staleTime: Infinity });
}

function useInvalidateEntries() {
  const client = useQueryClient();

  return () => Promise.all([client.invalidateQueries({ queryKey: ["entries"] }), client.invalidateQueries({ queryKey: queryKeys.catalog })]);
}

export function useCreateEntry() {
  const invalidate = useInvalidateEntries();

  return useMutation({ mutationFn: (input: EntryInput) => api.post<Entry>("/api/entries", input), onSuccess: invalidate });
}

export function useUpdateEntry() {
  const invalidate = useInvalidateEntries();

  return useMutation({ mutationFn: ({ id, input }: { id: number; input: EntryInput }) => api.put<Entry>(`/api/entries/${id}`, input), onSuccess: invalidate });
}

export function useDeleteEntry() {
  const invalidate = useInvalidateEntries();

  return useMutation({ mutationFn: (id: number) => api.delete(`/api/entries/${id}`), onSuccess: invalidate });
}

export function useClockifyStatus(enabled: boolean) {
  return useQuery({ queryKey: queryKeys.clockifyStatus, queryFn: ({ signal }) => api.get<ClockifyStatus>("/api/clockify", signal), enabled, staleTime: 0, gcTime: 0 });
}

export function useClockifyPlan(request: ClockifySyncRequest | null) {
  return useQuery({
    queryKey: request ? queryKeys.clockifyPlan(request) : ["clockify", "plan", "idle"],
    queryFn: ({ signal }) => api.post<ClockifySyncResult>("/api/clockify/sync", request, signal),
    enabled: request !== null,
    staleTime: 0,
    gcTime: 0,
  });
}

export function useConnectClockify() {
  const client = useQueryClient();

  return useMutation({
    gcTime: 0,
    mutationFn: (apiKey: string) => api.put<ClockifyStatus>("/api/clockify/connection", { apiKey }),
    onSuccess: async (status) => {
      await client.cancelQueries({ queryKey: queryKeys.clockifyStatus });
      client.setQueryData(queryKeys.clockifyStatus, status);
      void client.invalidateQueries({ queryKey: ["clockify", "plan"] });
      void client.invalidateQueries({ queryKey: queryKeys.config });
    },
  });
}

export function useDisconnectClockify() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: () => api.delete<ClockifyStatus>("/api/clockify/connection"),
    onSuccess: async (status) => {
      await client.cancelQueries({ queryKey: queryKeys.clockifyStatus });
      client.setQueryData(queryKeys.clockifyStatus, status);
      void client.invalidateQueries({ queryKey: ["clockify", "plan"] });
      void client.invalidateQueries({ queryKey: queryKeys.config });
    },
  });
}

export function useClockifyPush() {
  const client = useQueryClient();

  return useMutation({
    mutationFn: (request: ClockifySyncRequest) => api.post<ClockifySyncResult>("/api/clockify/sync", request),
    onSuccess: () => {
      void client.invalidateQueries({ queryKey: ["clockify", "plan"] });
    },
  });
}

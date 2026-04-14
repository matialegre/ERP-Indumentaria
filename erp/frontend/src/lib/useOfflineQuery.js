import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { isOnline } from "./offlineSync";
import { getAll } from "./offlineDB";

/**
 * useOfflineQuery — like useQuery but falls back to IndexedDB when offline.
 *
 * @param {string[]} queryKey — TanStack query key
 * @param {function} queryFn — async function to fetch from API
 * @param {string} [offlineStore] — IndexedDB store name to use as fallback
 * @param {object} [options] — extra useQuery options
 */
export function useOfflineQuery(queryKey, queryFn, offlineStore = null, options = {}) {
  return useQuery({
    queryKey,
    queryFn: async () => {
      if (!isOnline() && offlineStore) {
        const cached = await getAll(offlineStore);
        return cached;
      }
      return queryFn();
    },
    staleTime: isOnline() ? 2 * 60 * 1000 : Infinity,
    ...options,
  });
}

/**
 * useOfflineMutation — useMutation con outbox automático cuando no hay conexión.
 *
 * @param {function} mutationFn — función async que llama al API
 * @param {object} offlineOptions
 *   @param {function} offlineOptions.onOfflineQueued — callback(offline_id) cuando se encola
 *   @param {function} [offlineOptions.saveDraft] — función(variables) para guardar borrador local
 *   @param {string[]} [offlineOptions.invalidateKeys] — queryKeys a invalidar en onSuccess
 * @param {object} [mutationOptions] — opciones extra para useMutation
 */
export function useOfflineMutation(mutationFn, offlineOptions = {}, mutationOptions = {}) {
  const queryClient = useQueryClient();
  const { onOfflineQueued, saveDraft, invalidateKeys = [] } = offlineOptions;

  return useMutation({
    mutationFn,
    onSuccess: async (data) => {
      for (const key of invalidateKeys) {
        await queryClient.invalidateQueries({ queryKey: Array.isArray(key) ? key : [key] });
      }
      mutationOptions.onSuccess?.(data);
    },
    onError: async (err, variables) => {
      if (err.offline || err.status === 0) {
        // Guardar borrador en IndexedDB si hay función de guardado
        const offline_id = `offline-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
        if (saveDraft) {
          await saveDraft({ ...variables, offline_id, status: 'PENDING', createdAt: Date.now() });
        }
        onOfflineQueued?.(offline_id, variables);
        return; // no propagar el error
      }
      mutationOptions.onError?.(err, variables);
    },
    ...mutationOptions,
  });
}


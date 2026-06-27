import useSWR, { SWRConfiguration, mutate as swrMutate } from "swr";

export const API_CACHE_CONFIG: SWRConfiguration = {
  refreshInterval: 10000,
  dedupingInterval: 2000,
  revalidateOnFocus: true,
  revalidateOnReconnect: true,
  keepPreviousData: true,
  errorRetryCount: 3,
};

export async function fetcher<T>(url: string): Promise<T> {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const res = await fetch(url, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Error ${res.status}`);
  }
  return res.json();
}

export function useApi<T>(url: string | null, config?: SWRConfiguration) {
  return useSWR<T>(url, fetcher, { ...API_CACHE_CONFIG, ...config });
}

export function invalidateCache(key: string) {
  return swrMutate(key);
}

export function updateCache<T>(key: string, data: T) {
  return swrMutate(key, data, false);
}

"use client";
import { useMemo } from "react";

export function useSearch<T extends Record<string, any>>(
  data: T[],
  term: string,
  keys?: string[]
) {
  const normalized = term.trim().toLowerCase();
  return useMemo(() => {
    if (!normalized) return data;
    return data.filter((item) => {
      const values = keys && keys.length > 0
        ? keys.map((key) => item[key])
        : Object.values(item);
      return values.some((val) => {
        if (val == null) return false;
        return String(val).toLowerCase().includes(normalized);
      });
    });
  }, [data, normalized, keys]);
}

"use client";
import { useState, useMemo } from "react";

export type SortConfig = {
  key: string;
  direction: "asc" | "desc";
} | null;

export function useSort<T extends Record<string, any>>(data: T[], defaultKey?: string) {
  const [sortConfig, setSortConfig] = useState<SortConfig>(
    defaultKey ? { key: defaultKey, direction: "asc" } : null
  );

  const sortedData = useMemo(() => {
    if (!sortConfig) return data;
    const isDate = (v: any) => v instanceof Date || (typeof v === "string" && /^\d{4}-\d{2}-\d{2}/.test(v));
    const toTime = (v: any) => (v instanceof Date ? v.getTime() : new Date(v).getTime());

    const sorted = [...data].sort((a, b) => {
      const aVal = a[sortConfig.key];
      const bVal = b[sortConfig.key];
      if (aVal == null && bVal == null) return 0;
      if (aVal == null) return 1;
      if (bVal == null) return -1;

      let cmp = 0;
      if (typeof aVal === "boolean" && typeof bVal === "boolean") {
        cmp = Number(aVal) - Number(bVal);
      } else if (typeof aVal === "number" && typeof bVal === "number") {
        cmp = aVal - bVal;
      } else if (isDate(aVal) && isDate(bVal)) {
        cmp = toTime(aVal) - toTime(bVal);
      } else {
        cmp = String(aVal).localeCompare(String(bVal), "es", { numeric: true });
      }
      return sortConfig.direction === "asc" ? cmp : -cmp;
    });
    return sorted;
  }, [data, sortConfig]);

  const requestSort = (key: string) => {
    setSortConfig((prev) => {
      if (prev?.key === key) {
        if (prev.direction === "asc") return { key, direction: "desc" };
        return null;
      }
      return { key, direction: "asc" };
    });
  };

  const SortHeader = ({ label, sortKey }: { label: string; sortKey: string }) => {
    const isActive = sortConfig?.key === sortKey;
    return (
      <th className={`sortable ${isActive ? "sort-active" : ""}`} onClick={() => requestSort(sortKey)}>
        {label}
        {isActive ? (sortConfig!.direction === "asc" ? " ▲" : " ▼") : ""}
      </th>
    );
  };

  return { sortedData, sortConfig, requestSort, SortHeader };
}

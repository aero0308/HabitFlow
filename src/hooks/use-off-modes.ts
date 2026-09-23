"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/api/client";

export function useOffModes() {
  return useQuery({
    queryKey: ["off-modes"],
    queryFn: () => api.listOffModes(),
    select: (d) => d.offModes,
  });
}

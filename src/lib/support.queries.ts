import { queryOptions, useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { getSupportPreferences, getSupportRecommendations } from "./support.functions";
import type { Preferences } from "./support";

export const supportPreferencesOptions = queryOptions({
  queryKey: ["support-preferences"],
  queryFn: () => getSupportPreferences(),
});

export function useSupportRecommendations(saved: Preferences | undefined, format: "json" | "xml") {
  const fetchRecommendations = useServerFn(getSupportRecommendations);
  return useQuery({
    queryKey: ["support-recommendations", saved, format],
    queryFn: () => fetchRecommendations({ data: { format } }),
    enabled: saved !== undefined,
    retry: false,
    staleTime: 300000,
    refetchInterval: format === "json" ? 300000 : false,
  });
}

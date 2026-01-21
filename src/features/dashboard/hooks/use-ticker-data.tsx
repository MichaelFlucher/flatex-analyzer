import { useQueries, useQuery } from "@tanstack/react-query";
import { FullTickerData } from "../types/yahoo-finance-schemas";

export interface TickerDataResult {
  tickerData: FullTickerData | null;
  allSymbols: string[];
}

async function fetchTickerData(isin: string): Promise<TickerDataResult> {
  try {
    const res = await fetch(
      `/api/isin-search?isin=${encodeURIComponent(isin)}`
    );
    if (!res.ok) {
      console.error("Fetch failed", await res.text());
      return { tickerData: null, allSymbols: [] };
    }

    const data = await res.json();

    if (!data.tickerData) {
      console.error("Incomplete financial data for ISIN", isin);
      return { tickerData: null, allSymbols: [] };
    }

    return {
      tickerData: data.tickerData as FullTickerData,
      allSymbols: data.allSymbols || [],
    };
  } catch (err) {
    console.error("Fetch error", err);
    return { tickerData: null, allSymbols: [] };
  }
}

export function useTickerData(isin: string) {
  const { data, isLoading, error } = useQuery({
    queryKey: ["ticker", isin],
    queryFn: async (): Promise<TickerDataResult> => {
      return fetchTickerData(isin);
    },
    staleTime: Infinity,
  });

  return {
    data: data?.tickerData ?? null,
    allSymbols: data?.allSymbols ?? [],
    isLoading,
    error,
  };
}

export interface TickerDataWithIsin {
  isin: string;
  tickerData: FullTickerData;
  allSymbols: string[];
}

export function useTickerDatas(isins: string[]) {
  const { data, progress } = useQueries({
    queries: isins.map((isin) => ({
      queryKey: ["ticker", isin],
      queryFn: async (): Promise<TickerDataWithIsin> => {
        const result = await fetchTickerData(isin);
        return {
          isin,
          tickerData: result.tickerData,
          allSymbols: result.allSymbols,
        };
      },
      staleTime: 24 * 60 * 60 * 1000, // cache for 24h
    })),
    combine: (results) => {
      return {
        data: results
          .filter((r) => r.status === "success")
          .filter((r) => r.data.tickerData)
          .map((result) => result.data),
        progress:
          results.filter((result) => result.status === "success").length /
          results.length,
      };
    },
  });

  return {
    data,
    progress,
  };
}

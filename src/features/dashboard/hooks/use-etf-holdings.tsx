import { useQueries } from "@tanstack/react-query";
import { ETFHoldingsData } from "../types/etf-holdings";

async function fetchETFHoldings(
  symbol: string,
  allSymbols: string[],
  isin?: string
): Promise<ETFHoldingsData | null> {
  try {
    const params = new URLSearchParams({ symbol });
    if (isin) {
      params.set('isin', isin);
    }
    // Pass all symbols for fallback attempts
    if (allSymbols.length > 1) {
      params.set('symbols', allSymbols.join(','));
    }
    const res = await fetch(`/api/etf-holdings?${params.toString()}`);
    if (!res.ok) {
      console.warn(`ETF holdings not available for ${symbol}`);
      return null;
    }

    const data = await res.json();
    return data.holdings as ETFHoldingsData;
  } catch (err) {
    console.error(`Error fetching ETF holdings for ${symbol}:`, err);
    return null;
  }
}

interface ETFHoldingsQuery {
  symbol: string;
  allSymbols: string[];
  isin: string;
  isETF: boolean;
}

/**
 * Hook to fetch ETF holdings for multiple symbols
 * Only fetches for symbols where isETF is true
 * Uses allSymbols for fallback if primary symbol fails
 */
export interface ETFHoldingsError {
  symbol: string;
  isin: string;
  error: string;
}

export function useETFHoldingsBatch(queries: ETFHoldingsQuery[]) {
  const result = useQueries({
    queries: queries.map(({ symbol, allSymbols, isin, isETF }) => ({
      queryKey: ["etf-holdings", isin], // Use ISIN as key since symbol may change
      queryFn: async (): Promise<{
        symbol: string;
        holdings: ETFHoldingsData | null;
      }> => {
        if (!isETF) {
          return { symbol, holdings: null };
        }
        const holdings = await fetchETFHoldings(symbol, allSymbols, isin);
        return { symbol, holdings };
      },
      staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
      enabled: isETF, // Only fetch for ETFs
    })),
    combine: (results) => {
      const successfulResults = results.filter((r) => r.status === "success");
      const errorResults = results.filter((r) => r.status === "error");
      // Count both success AND error as "completed" for progress calculation
      const completedResults = results.filter((r) => r.status === "success" || r.status === "error");

      // Collect error details
      const errors: ETFHoldingsError[] = errorResults.map((r) => {
        const queryIndex = results.indexOf(r);
        const query = queries[queryIndex];
        return {
          symbol: query?.symbol || `Query ${queryIndex}`,
          isin: query?.isin || 'unknown',
          error: r.error instanceof Error ? r.error.message : String(r.error),
        };
      });

      return {
        data: successfulResults.map((result) => result.data),
        progress: results.length > 0 ? completedResults.length / results.length : 1,
        errors,
      };
    },
  });

  return {
    data: result.data ?? [],
    progress: result.progress ?? 1,
    errors: result.errors ?? [],
  };
}

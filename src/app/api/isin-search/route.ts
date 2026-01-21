import { NextRequest, NextResponse } from "next/server";
import PQueue from "p-queue";
import { LRUCache } from "lru-cache";
import { fetchTickerData } from "@/features/dashboard/server/fetch-ticker-symbol";
import { ISINQuerySchema } from "@/features/dashboard/types/yahoo-finance-schemas";
import { searchAllSymbols, SymbolSearchResult } from "@/features/dashboard/server/search-symbol";
import { cache } from "@/lib/cache";
import { removeKnownSymbolWrappers } from "@/features/dashboard/utils/remove-known-symbol-wrappers";

// Cache for ISIN -> all symbols mapping
const isinSymbolCache = new LRUCache<string, SymbolSearchResult>({
  max: 10000,
  ttl: 1000 * 60 * 10000,
});

const yahooQueue = new PQueue({
  concurrency: 1,
  interval: 1000,
  intervalCap: 1,
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams);

  console.log(`[ISIN-SEARCH] Incoming request for ISIN query:`, JSON.stringify(queryParams));

  const parsedQuery = ISINQuerySchema.safeParse(queryParams);
  if (!parsedQuery.success) {
    console.error(`[ISIN-SEARCH] Invalid query params:`, parsedQuery.error.format());
    return NextResponse.json(
      { error: parsedQuery.error.format() },
      { status: 400 }
    );
  }

  const { isin } = parsedQuery.data;
  console.log(`[ISIN-SEARCH] Processing ISIN: ${isin}`);

  if (cache.has(isin)) {
    const cached = cache.get(isin);
    if (cached) {
      console.log(`[ISIN-SEARCH] ✓ Cache hit for ISIN: ${isin}`);
      return NextResponse.json(cached);
    }
  }

  console.log(`[ISIN-SEARCH] Cache miss for ISIN: ${isin}. Adding to queue...`);

  try {
    const result = await yahooQueue.add(async () => {
      let symbolResult: SymbolSearchResult | undefined = undefined;

      if (isinSymbolCache.has(isin)) {
        symbolResult = isinSymbolCache.get(isin);
        console.log(`[ISIN-SEARCH] ✓ Symbol cache hit for ISIN ${isin}: ${symbolResult?.primarySymbol} (${symbolResult?.allSymbols.length} total)`);
      }

      if (!symbolResult) {
        console.log(`[ISIN-SEARCH] Searching for symbols for ISIN: ${isin}`);
        symbolResult = await searchAllSymbols(isin);

        // Clean up symbols by removing known wrappers
        symbolResult = {
          primarySymbol: removeKnownSymbolWrappers(symbolResult.primarySymbol),
          allSymbols: symbolResult.allSymbols.map(s => removeKnownSymbolWrappers(s)),
        };

        console.log(`[ISIN-SEARCH] Found symbols: ${symbolResult.allSymbols.join(', ')}`);

        if (!symbolResult.primarySymbol) {
          console.error(`[ISIN-SEARCH] ✗ No symbol found for ISIN: ${isin}`);
          return NextResponse.json(
            { error: `No symbol found for ISIN: ${isin}` },
            { status: 404 }
          );
        }

        isinSymbolCache.set(isin, symbolResult);
        console.log(`[ISIN-SEARCH] ✓ Cached ${symbolResult.allSymbols.length} symbols for ISIN ${isin}`);
      }

      const symbol = symbolResult.primarySymbol;
      console.log(`[ISIN-SEARCH] Fetching ticker data for symbol: ${symbol}`);
      const tickerData = await fetchTickerData(symbol);
      console.log(`[ISIN-SEARCH] ✓ Successfully fetched ticker data for ${symbol}`);

      // Include all symbols in the response for fallback usage
      return {
        tickerData,
        allSymbols: symbolResult.allSymbols,
      };
    });

    cache.set(isin, result);
    console.log(`[ISIN-SEARCH] ✓ Request completed successfully for ISIN: ${isin}`);
    return NextResponse.json(result);
  } catch (err: any) {
    console.error(`[ISIN-SEARCH] ✗ Error fetching ISIN data for ${isin}:`, err);
    console.error(`[ISIN-SEARCH] Error name: ${err.name}`);
    console.error(`[ISIN-SEARCH] Error message: ${err.message}`);
    console.error(`[ISIN-SEARCH] Error stack:`, err.stack);
    if (err.cause) {
      console.error(`[ISIN-SEARCH] Error cause:`, err.cause);
    }
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchETFHoldings } from "@/features/dashboard/server/fetch-etf-holdings";
import { cache } from "@/lib/cache";
import { hardCodedIsinRemap } from "@/features/dashboard/utils/remove-known-symbol-wrappers";

const QuerySchema = z.object({
  symbol: z.string().min(1).max(20),
  symbols: z.string().optional(), // Comma-separated list of fallback symbols
  isin: z.string().min(8).max(12).optional(),
});

export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const queryParams = Object.fromEntries(url.searchParams);

  console.log(`[ETF-HOLDINGS] Incoming request:`, JSON.stringify(queryParams));

  const parsedQuery = QuerySchema.safeParse(queryParams);
  if (!parsedQuery.success) {
    console.error(`[ETF-HOLDINGS] Invalid query params:`, parsedQuery.error.format());
    return NextResponse.json(
      { error: parsedQuery.error.format() },
      { status: 400 }
    );
  }

  const { symbol, symbols: symbolsParam, isin } = parsedQuery.data;

  // Build list of symbols to try
  const symbolsToTry: string[] = [];

  // If ISIN is provided and has a hardcoded remap, try that symbol first
  if (isin) {
    const remappedSymbol = hardCodedIsinRemap(isin);
    if (remappedSymbol !== isin) {
      console.log(`[ETF-HOLDINGS] ISIN ${isin} remapped to symbol: ${remappedSymbol}`);
      symbolsToTry.push(remappedSymbol);
    }
  }

  // Add the provided symbol (if not already added via remap)
  if (!symbolsToTry.includes(symbol)) {
    symbolsToTry.push(symbol);
  }

  // Add fallback symbols from 'symbols' param
  if (symbolsParam) {
    const fallbackSymbols = symbolsParam.split(',').map(s => s.trim()).filter(s => s && !symbolsToTry.includes(s));
    symbolsToTry.push(...fallbackSymbols);
  }

  // Use ISIN as cache key if available (covers all symbol variants)
  const cacheKey = isin ? `etf-holdings:${isin}` : `etf-holdings:${symbol}`;

  // Check cache first
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`[ETF-HOLDINGS] ✓ Cache hit for: ${cacheKey}`);
      return NextResponse.json(cached);
    }
  }

  console.log(`[ETF-HOLDINGS] Cache miss. Trying ${symbolsToTry.length} symbols: ${symbolsToTry.join(', ')}`);

  // Try each symbol in order until one works
  for (const trySymbol of symbolsToTry) {
    try {
      console.log(`[ETF-HOLDINGS] Trying symbol: ${trySymbol}`);
      const holdings = await fetchETFHoldings(trySymbol, isin);

      if (holdings) {
        // Cache the successful result
        cache.set(cacheKey, { holdings, resolvedSymbol: trySymbol });
        console.log(`[ETF-HOLDINGS] ✓ Successfully fetched holdings using symbol: ${trySymbol}`);

        return NextResponse.json({ holdings, resolvedSymbol: trySymbol });
      }

      console.log(`[ETF-HOLDINGS] No holdings data for symbol: ${trySymbol}, trying next...`);
    } catch (err: any) {
      console.log(`[ETF-HOLDINGS] Error with symbol ${trySymbol}: ${err.message}, trying next...`);
    }
  }

  // All symbols failed
  console.log(`[ETF-HOLDINGS] ✗ No holdings data available for any symbol`);
  return NextResponse.json(
    { error: `No holdings data available for ${symbol} (tried ${symbolsToTry.length} variants)` },
    { status: 404 }
  );
}

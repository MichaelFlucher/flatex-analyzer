import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { fetchETFHoldings } from "@/features/dashboard/server/fetch-etf-holdings";
import { cache } from "@/lib/cache";

const QuerySchema = z.object({
  symbol: z.string().min(1).max(20),
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

  const { symbol } = parsedQuery.data;
  const cacheKey = `etf-holdings:${symbol}`;

  // Check cache first
  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`[ETF-HOLDINGS] ✓ Cache hit for symbol: ${symbol}`);
      return NextResponse.json(cached);
    }
  }

  console.log(`[ETF-HOLDINGS] Cache miss for symbol: ${symbol}. Fetching...`);

  try {
    const holdings = await fetchETFHoldings(symbol);

    if (!holdings) {
      console.log(`[ETF-HOLDINGS] No holdings data for symbol: ${symbol}`);
      return NextResponse.json(
        { error: `No holdings data available for ${symbol}` },
        { status: 404 }
      );
    }

    // Cache the result
    cache.set(cacheKey, { holdings });
    console.log(`[ETF-HOLDINGS] ✓ Successfully fetched holdings for ${symbol}`);

    return NextResponse.json({ holdings });
  } catch (err: any) {
    console.error(`[ETF-HOLDINGS] ✗ Error fetching holdings for ${symbol}:`, err);
    return NextResponse.json(
      { error: err.message || "Unexpected error" },
      { status: 500 }
    );
  }
}

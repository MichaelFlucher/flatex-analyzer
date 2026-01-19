import { fetchPriceHistory } from "@/features/dashboard/server/fetch-price-history";
import { cache } from "@/lib/cache";
import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);

  const tickers = searchParams.getAll("ticker").filter((t) => t.trim() !== "");
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  const cacheKey = `price-history:${tickers.join(",")}:${start}:${end}`;

  if (cache.has(cacheKey)) {
    const cached = cache.get(cacheKey);
    if (cached) {
      console.log(`Cache hit for ISIN: ${cacheKey}`);
      return NextResponse.json(cached);
    }
  }

  if (!tickers.length || !start || !end) {
    return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
  }

  try {
    const data = await fetchPriceHistory(tickers, start, end);
    cache.set(cacheKey, data);

    return NextResponse.json(data, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch from Flask API" },
      { status: 500 }
    );
  }
}

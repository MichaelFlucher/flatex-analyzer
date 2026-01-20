import { getEnv } from "../../../lib/env";
import { ETFHoldingsData, ETFHoldingsDataSchema } from "../types/etf-holdings";

export async function fetchETFHoldings(
  symbol: string,
  isin?: string
): Promise<ETFHoldingsData | null> {
  console.log(`fetchETFHoldings called for symbol: ${symbol}${isin ? `, isin: ${isin}` : ''}`);
  const url = new URL(
    `stock/${symbol}/holdings`,
    getEnv().YAHOO_FINANCE_WRAPPER_URL
  );

  // Pass ISIN to avoid lookup in the wrapper
  if (isin) {
    url.searchParams.set('isin', isin);
  }

  try {
    const response = await fetch(url.toString());
    const text = await response.text();

    if (!response.ok) {
      console.warn(
        `ETF holdings not available for ${symbol}: ${response.status}`,
        text
      );
      return null;
    }

    const data = JSON.parse(text);
    const parsed = ETFHoldingsDataSchema.safeParse(data);

    if (!parsed.success) {
      console.error(
        `Invalid ETF holdings data for ${symbol}:`,
        parsed.error.format()
      );
      return null;
    }

    return parsed.data;
  } catch (e) {
    console.error(`Error fetching ETF holdings for ${symbol}:`, e);
    return null;
  }
}

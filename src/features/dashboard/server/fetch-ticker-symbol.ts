import { getEnv } from "../../../lib/env";
import { FullTickerData } from "../types/yahoo-finance-schemas";

export async function fetchTickerData(ticker: string): Promise<FullTickerData> {
  const url = new URL(`stock/${ticker}`, getEnv().YAHOO_FINANCE_WRAPPER_URL);

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to fetch ticker data for ${ticker}`);
  }

  const data = await response.json();

  return data;
}

import { getEnv } from "../../../lib/env";
import { FullTickerData } from "../types/yahoo-finance-schemas";

export async function fetchTickerData(ticker: string): Promise<FullTickerData> {
  const url = new URL(`stock/${ticker}`, getEnv().YAHOO_FINANCE_WRAPPER_URL);

  const response = await fetch(url.toString());
  const text = await response.text();

  if (!response.ok) {
    console.error(`Fetch failed for ${ticker}: ${response.status} ${response.statusText}`, text);
    throw new Error(`Failed to fetch ticker data for ${ticker}: ${text.substring(0, 100)}`);
  }

  try {
    const data = JSON.parse(text);
    return data;
  } catch (e) {
    console.error("JSON Parse Error. Raw response:", text);
    throw new Error(`Failed to parse ticker data for ${ticker}. Response was not JSON.`);
  }
}

import { QuoteSearchSchema } from "../types/yahoo-finance-schemas";
import { hardCodedIsinRemap } from "../utils/remove-known-symbol-wrappers";
import { getEnv } from "@/lib/env";

export async function searchSymbol(isin: string) {
  isin = hardCodedIsinRemap(isin);

  const wrapperUrl = getEnv().YAHOO_FINANCE_WRAPPER_URL;
  const searchUrl = new URL('search', wrapperUrl);
  searchUrl.searchParams.set('q', isin);
  searchUrl.searchParams.set('region', 'US');

  console.log(`[SEARCH-SYMBOL] ================================================`);
  console.log(`[SEARCH-SYMBOL] Searching for ISIN: ${isin}`);
  console.log(`[SEARCH-SYMBOL] Wrapper URL: ${searchUrl.toString()}`);
  console.log(`[SEARCH-SYMBOL] ================================================`);

  try {
    const response = await fetch(searchUrl.toString());
    const responseText = await response.text();

    console.log(`[SEARCH-SYMBOL] ================================================`);
    console.log(`[SEARCH-SYMBOL] Response Status: ${response.status} ${response.statusText}`);
    console.log(`[SEARCH-SYMBOL] Response Headers:`, JSON.stringify(Object.fromEntries(response.headers.entries()), null, 2));
    console.log(`[SEARCH-SYMBOL] Response Content-Type: ${response.headers.get('content-type')}`);
    console.log(`[SEARCH-SYMBOL] Response Body Length: ${responseText.length} bytes`);
    console.log(`[SEARCH-SYMBOL] ================================================`);
    console.log(`[SEARCH-SYMBOL] RAW RESPONSE BODY START:`);
    console.log(responseText);
    console.log(`[SEARCH-SYMBOL] RAW RESPONSE BODY END`);
    console.log(`[SEARCH-SYMBOL] ================================================`);

    if (!response.ok) {
      console.error(`[SEARCH-SYMBOL] ✗ HTTP Error: ${response.status} ${response.statusText}`);
      throw new Error(`Wrapper service returned ${response.status}: ${responseText.substring(0, 200)}`);
    }

    let searchResult;
    try {
      searchResult = JSON.parse(responseText);
      console.log(`[SEARCH-SYMBOL] ✓ Successfully parsed JSON response`);
    } catch (parseError) {
      console.error(`[SEARCH-SYMBOL] ✗ Failed to parse response as JSON`);
      console.error(`[SEARCH-SYMBOL] Parse error:`, parseError);
      throw new Error(`Wrapper returned non-JSON response: ${responseText.substring(0, 200)}`);
    }

    console.log(`[SEARCH-SYMBOL] Search result structure:`, JSON.stringify(searchResult, null, 2));

    const match = searchResult.quotes?.[0];

    if (!match) {
      console.error(`[SEARCH-SYMBOL] ✗ No quotes found in search result for ISIN: ${isin}`);
      throw new Error("No quotes found for ISIN");
    }

    console.log(`[SEARCH-SYMBOL] First quote match:`, JSON.stringify(match, null, 2));

    const parsed = QuoteSearchSchema.safeParse(match);
    if (!parsed.success) {
      console.error(`[SEARCH-SYMBOL] ✗ Failed to parse search result for ISIN ${isin}:`, parsed.error.format());
      throw new Error("No valid quote found for ISIN");
    }

    console.log(`[SEARCH-SYMBOL] ✓ Parsed symbol: ${parsed.data.symbol}`);
    return parsed.data.symbol;
  } catch (error: any) {
    console.error(`[SEARCH-SYMBOL] ✗ Error in searchSymbol for ISIN: ${isin}`);
    console.error(`[SEARCH-SYMBOL] Error name: ${error.name}`);
    console.error(`[SEARCH-SYMBOL] Error message: ${error.message}`);
    if (error.stack) {
      console.error(`[SEARCH-SYMBOL] Error stack:`, error.stack);
    }
    throw error;
  }
}

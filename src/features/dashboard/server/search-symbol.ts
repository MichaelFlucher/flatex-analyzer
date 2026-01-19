import yahooFinance from "yahoo-finance2";
import { QuoteSearchSchema } from "../types/yahoo-finance-schemas";
import { hardCodedIsinRemap } from "../utils/remove-known-symbol-wrappers";

export async function searchSymbol(isin: string) {
  isin = hardCodedIsinRemap(isin);
  const originalFetch = global.fetch;

  // Intercept fetch to log the raw response from Yahoo
  global.fetch = async (input, init) => {
    console.log(`[YAHOO-FETCH] Requesting: ${input}`);
    console.log(`[YAHOO-FETCH] Request headers:`, JSON.stringify(init?.headers || {}));
    try {
      const response = await originalFetch(input, init);
      const clone = response.clone();
      const text = await clone.text();
      console.log(`[YAHOO-FETCH] Response status: ${response.status} ${response.statusText}`);
      console.log(`[YAHOO-FETCH] Response headers:`, JSON.stringify(Object.fromEntries(response.headers.entries())));
      console.log(`[YAHOO-FETCH] Response body (full):`, text);
      return response;
    } catch (err) {
      console.error("[YAHOO-FETCH] ✗ Network error:", err);
      throw err;
    }
  };

  try {
    console.log(`[SEARCH-SYMBOL] Calling yahooFinance.search for ISIN: ${isin}`);
    const searchResult = await yahooFinance.search(isin, {
      region: "US",
    });
    console.log(`[SEARCH-SYMBOL] ✓ Search result for ISIN ${isin}:`, JSON.stringify(searchResult, null, 2));
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
    if (error instanceof SyntaxError) {
      console.error(
        "[SEARCH-SYMBOL] SyntaxError in yahooFinance.search. This usually means a non-JSON response from Yahoo."
      );
    }
    // Try to log extra properties if yahoo-finance2 attaches them
    const errorDetails = Object.getOwnPropertyNames(error).reduce((acc, key) => {
      acc[key] = (error as any)[key];
      return acc;
    }, {} as any);
    console.error(
      "[SEARCH-SYMBOL] Error details:",
      JSON.stringify(errorDetails, null, 2)
    );
    throw error;
  } finally {
    // Restore original fetch
    global.fetch = originalFetch;
  }
}

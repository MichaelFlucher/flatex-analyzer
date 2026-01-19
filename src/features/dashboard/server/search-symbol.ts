import yahooFinance from "yahoo-finance2";
import { QuoteSearchSchema } from "../types/yahoo-finance-schemas";
import { hardCodedIsinRemap } from "../utils/remove-known-symbol-wrappers";

export async function searchSymbol(isin: string) {
  isin = hardCodedIsinRemap(isin);
  const originalFetch = global.fetch;

  // Intercept fetch to log the raw response from Yahoo
  global.fetch = async (input, init) => {
    console.log(`[Debug Fetch] Requesting: ${input}`);
    try {
      const response = await originalFetch(input, init);
      const clone = response.clone();
      const text = await clone.text();
      console.log(
        `[Debug Fetch] Response status: ${response.status}. Body preview (first 500 chars): ${text.substring(0, 500)}`
      );
      return response;
    } catch (err) {
      console.error("[Debug Fetch] Network error:", err);
      throw err;
    }
  };

  try {
    const searchResult = await yahooFinance.search(isin, {
      region: "US",
    });
    console.log("Search result for ISIN:", isin, searchResult);
    const match = searchResult.quotes?.[0];

    const parsed = QuoteSearchSchema.safeParse(match);
    if (!parsed.success) {
      console.error("Failed to parse search result", parsed.error);
      throw new Error("No valid quote found for ISIN");
    }

    return parsed.data.symbol;
  } catch (error: any) {
    console.error("Error in searchSymbol for ISIN:", isin);
    if (error instanceof SyntaxError) {
      console.error(
        "SyntaxError in yahooFinance.search. This usually means a non-JSON response from Yahoo."
      );
    }
    // Try to log extra properties if yahoo-finance2 attaches them
    console.error(
      "Error details:",
      JSON.stringify(error, Object.getOwnPropertyNames(error))
    );
    throw error;
  } finally {
    // Restore original fetch
    global.fetch = originalFetch;
  }
}

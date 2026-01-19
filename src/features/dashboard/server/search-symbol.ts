import yahooFinance from "yahoo-finance2";
import { QuoteSearchSchema } from "../types/yahoo-finance-schemas";
import { hardCodedIsinRemap } from "../utils/remove-known-symbol-wrappers";

export async function searchSymbol(isin: string) {
  isin = hardCodedIsinRemap(isin);

  // Build the Yahoo Finance search URL
  const yahooSearchUrl = `https://query2.finance.yahoo.com/v1/finance/search?q=${encodeURIComponent(isin)}&quotesCount=10&newsCount=0&enableFuzzyQuery=false&quotesQueryId=tss_match_phrase_query&region=US`;

  console.log(`[SEARCH-SYMBOL] ================================================`);
  console.log(`[SEARCH-SYMBOL] Searching for ISIN: ${isin}`);
  console.log(`[SEARCH-SYMBOL] Direct URL: ${yahooSearchUrl}`);
  console.log(`[SEARCH-SYMBOL] ================================================`);

  try {
    // Make a direct fetch to capture the raw response
    const response = await fetch(yahooSearchUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36',
        'Accept': 'application/json'
      }
    });

    // Get raw response text before parsing
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

    // Check if response is OK
    if (!response.ok) {
      console.error(`[SEARCH-SYMBOL] ✗ HTTP Error: ${response.status} ${response.statusText}`);
      throw new Error(`Yahoo Finance API returned ${response.status}: ${responseText.substring(0, 200)}`);
    }

    // Try to parse as JSON
    let searchResult;
    try {
      searchResult = JSON.parse(responseText);
      console.log(`[SEARCH-SYMBOL] ✓ Successfully parsed JSON response`);
    } catch (parseError) {
      console.error(`[SEARCH-SYMBOL] ✗ Failed to parse response as JSON`);
      console.error(`[SEARCH-SYMBOL] Parse error:`, parseError);
      throw new Error(`Yahoo Finance returned non-JSON response: ${responseText.substring(0, 200)}`);
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

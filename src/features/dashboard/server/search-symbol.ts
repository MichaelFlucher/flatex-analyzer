import { QuoteSearchSchema } from "../types/yahoo-finance-schemas";
import { hardCodedIsinRemap } from "../utils/remove-known-symbol-wrappers";
import { getEnv } from "@/lib/env";
import { z } from "zod";

// Exchange priority lists based on ISIN country code
// EU ISINs should prefer European exchanges, US ISINs should prefer US exchanges
const NORDIC_EXCHANGES = [
  'CPH',  // Copenhagen (Denmark)
  'STO',  // Stockholm (Sweden)
  'OSL',  // Oslo (Norway)
  'HEL',  // Helsinki (Finland)
  'ICE',  // Iceland
];

const EU_PRIORITY_EXCHANGES = [
  'GER',  // XETRA (Germany)
  'FRA',  // Frankfurt
  'STU',  // Stuttgart
  'DUS',  // Düsseldorf
  'MUN',  // Munich
  'HAM',  // Hamburg
  'BER',  // Berlin
  'LSE',  // London
  'PAR',  // Paris (Euronext)
  'AMS',  // Amsterdam (Euronext)
  'BRU',  // Brussels (Euronext)
  'LIS',  // Lisbon (Euronext)
  'MIL',  // Milan
  'SWX',  // Swiss Exchange
  'VIE',  // Vienna
  'MCE',  // Madrid
  ...NORDIC_EXCHANGES,  // Include Nordic exchanges
];

// Nordic countries should prioritize their local exchanges first
const NORDIC_COUNTRY_CODES = ['DK', 'SE', 'NO', 'FI', 'IS'];

const US_PRIORITY_EXCHANGES = [
  'NYQ',  // NYSE
  'NMS',  // NASDAQ
  'NGM',  // NASDAQ Global Market
  'PCX',  // NYSE Arca
  'BTS',  // BATS
  'NYS',  // NYSE
  'NAS',  // NASDAQ
];

// EU country codes (first 2 chars of ISIN)
const EU_COUNTRY_CODES = [
  'IE',  // Ireland
  'DE',  // Germany
  'FR',  // France
  'NL',  // Netherlands
  'LU',  // Luxembourg
  'GB',  // United Kingdom
  'AT',  // Austria
  'BE',  // Belgium
  'ES',  // Spain
  'IT',  // Italy
  'PT',  // Portugal
  'CH',  // Switzerland
  'SE',  // Sweden
  'DK',  // Denmark
  'NO',  // Norway
  'FI',  // Finland
];

const US_COUNTRY_CODES = ['US'];

/**
 * Determines the priority exchanges based on the ISIN country code.
 * EU ISINs prefer European exchanges, US ISINs prefer US exchanges.
 * Nordic ISINs prioritize their local Nordic exchanges first.
 */
function getPriorityExchanges(isin: string): string[] {
  const countryCode = isin.substring(0, 2).toUpperCase();

  // Nordic countries should prioritize Nordic exchanges first
  if (NORDIC_COUNTRY_CODES.includes(countryCode)) {
    // Put Nordic exchanges first, then other EU exchanges
    return [...NORDIC_EXCHANGES, ...EU_PRIORITY_EXCHANGES.filter(e => !NORDIC_EXCHANGES.includes(e))];
  }

  if (EU_COUNTRY_CODES.includes(countryCode)) {
    return EU_PRIORITY_EXCHANGES;
  }
  if (US_COUNTRY_CODES.includes(countryCode)) {
    return US_PRIORITY_EXCHANGES;
  }

  // Default: try EU first (since this is a flatex analyzer, EU is more common)
  return [...EU_PRIORITY_EXCHANGES, ...US_PRIORITY_EXCHANGES];
}

/**
 * Sorts quotes by exchange priority.
 * Returns all quotes sorted with priority exchanges first, then remaining exchanges.
 */
function sortQuotesByPriority(quotes: z.infer<typeof QuoteSearchSchema>[], isin: string): z.infer<typeof QuoteSearchSchema>[] {
  if (!quotes || quotes.length === 0) {
    return [];
  }

  const priorityExchanges = getPriorityExchanges(isin);

  console.log(`[SEARCH-SYMBOL] ISIN country code: ${isin.substring(0, 2)}`);
  console.log(`[SEARCH-SYMBOL] Priority exchanges: ${priorityExchanges.slice(0, 5).join(', ')}...`);
  console.log(`[SEARCH-SYMBOL] Available quotes:`);
  quotes.forEach((q, i) => {
    console.log(`[SEARCH-SYMBOL]   ${i}: ${q.symbol} (exchange: ${q.exchange}, type: ${q.quoteType})`);
  });

  // Sort: priority exchanges first (in order), then remaining quotes
  const sortedQuotes: z.infer<typeof QuoteSearchSchema>[] = [];
  const usedSymbols = new Set<string>();

  // Helper to add unique quotes
  const addQuote = (quote: z.infer<typeof QuoteSearchSchema>, type: string) => {
    if (!usedSymbols.has(quote.symbol)) {
      sortedQuotes.push(quote);
      usedSymbols.add(quote.symbol);
      console.log(`[SEARCH-SYMBOL] ${type} ${sortedQuotes.length}: ${quote.symbol} (exchange: ${quote.exchange}, type: ${quote.quoteType})`);
    }
  };

  // 1. Priority Exchanges + ETF/EQUITY type
  for (const exchange of priorityExchanges) {
    const match = quotes.find(q => 
      q.exchange === exchange && 
      (q.quoteType === 'ETF' || q.quoteType === 'EQUITY') && 
      !usedSymbols.has(q.symbol)
    );
    if (match) addQuote(match, "Priority ETF");
  }

  // 2. Priority Exchanges + Other types (e.g. MUTUALFUND)
  for (const exchange of priorityExchanges) {
    const match = quotes.find(q => 
      q.exchange === exchange && 
      !usedSymbols.has(q.symbol)
    );
    if (match) addQuote(match, "Priority Other");
  }

  // 3. Remaining quotes
  for (const quote of quotes) {
    addQuote(quote, "Fallback");
  }

  return sortedQuotes;
}

/**
 * Selects the best quote from search results based on exchange priority.
 * Prioritizes exchanges based on ISIN origin (EU vs US).
 */
function selectBestQuote(quotes: z.infer<typeof QuoteSearchSchema>[], isin: string): z.infer<typeof QuoteSearchSchema> | null {
  const sorted = sortQuotesByPriority(quotes, isin);
  return sorted.length > 0 ? sorted[0] : null;
}

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

    const rawQuotes = searchResult.quotes || [];

    if (rawQuotes.length === 0) {
      console.error(`[SEARCH-SYMBOL] ✗ No quotes found in search result for ISIN: ${isin}`);
      throw new Error("No quotes found for ISIN");
    }

    // Parse all quotes
    const validQuotes: z.infer<typeof QuoteSearchSchema>[] = [];
    for (const rawQuote of rawQuotes) {
      const parsed = QuoteSearchSchema.safeParse(rawQuote);
      if (parsed.success) {
        validQuotes.push(parsed.data);
      }
    }

    if (validQuotes.length === 0) {
      console.error(`[SEARCH-SYMBOL] ✗ No valid quotes found in search result for ISIN: ${isin}`);
      throw new Error("No valid quotes found for ISIN");
    }

    // Select the best quote based on exchange priority
    const bestQuote = selectBestQuote(validQuotes, isin);

    if (!bestQuote) {
      console.error(`[SEARCH-SYMBOL] ✗ Failed to select a quote for ISIN ${isin}`);
      throw new Error("No valid quote found for ISIN");
    }

    console.log(`[SEARCH-SYMBOL] ✓ Selected symbol: ${bestQuote.symbol} (exchange: ${bestQuote.exchange})`);
    return bestQuote.symbol;
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

export interface SymbolSearchResult {
  primarySymbol: string;
  allSymbols: string[];
}

/**
 * Searches for all symbols matching an ISIN, sorted by exchange priority.
 * Returns the primary (best) symbol and all alternative symbols.
 */
export async function searchAllSymbols(isin: string): Promise<SymbolSearchResult> {
  isin = hardCodedIsinRemap(isin);

  const wrapperUrl = getEnv().YAHOO_FINANCE_WRAPPER_URL;
  const searchUrl = new URL('search', wrapperUrl);
  searchUrl.searchParams.set('q', isin);
  searchUrl.searchParams.set('region', 'US');

  console.log(`[SEARCH-ALL-SYMBOLS] ================================================`);
  console.log(`[SEARCH-ALL-SYMBOLS] Searching for ISIN: ${isin}`);
  console.log(`[SEARCH-ALL-SYMBOLS] ================================================`);

  try {
    const response = await fetch(searchUrl.toString());
    const responseText = await response.text();

    if (!response.ok) {
      console.error(`[SEARCH-ALL-SYMBOLS] ✗ HTTP Error: ${response.status} ${response.statusText}`);
      throw new Error(`Wrapper service returned ${response.status}: ${responseText.substring(0, 200)}`);
    }

    let searchResult;
    try {
      searchResult = JSON.parse(responseText);
    } catch (parseError) {
      throw new Error(`Wrapper returned non-JSON response: ${responseText.substring(0, 200)}`);
    }

    const rawQuotes = searchResult.quotes || [];

    if (rawQuotes.length === 0) {
      throw new Error("No quotes found for ISIN");
    }

    // Parse all quotes
    const validQuotes: z.infer<typeof QuoteSearchSchema>[] = [];
    for (const rawQuote of rawQuotes) {
      const parsed = QuoteSearchSchema.safeParse(rawQuote);
      if (parsed.success) {
        validQuotes.push(parsed.data);
      }
    }

    if (validQuotes.length === 0) {
      throw new Error("No valid quotes found for ISIN");
    }

    // Sort quotes by exchange priority
    const sortedQuotes = sortQuotesByPriority(validQuotes, isin);
    const allSymbols = sortedQuotes.map(q => q.symbol);

    console.log(`[SEARCH-ALL-SYMBOLS] ✓ Found ${allSymbols.length} symbols: ${allSymbols.join(', ')}`);

    return {
      primarySymbol: allSymbols[0],
      allSymbols,
    };
  } catch (error: any) {
    console.error(`[SEARCH-ALL-SYMBOLS] ✗ Error for ISIN: ${isin}: ${error.message}`);
    throw error;
  }
}

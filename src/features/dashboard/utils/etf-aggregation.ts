import { ETFHoldingsData } from "../types/etf-holdings";

/**
 * Normalizes sector names from Yahoo Finance to consistent format
 * Yahoo returns sector names like "realestate", "technology", etc.
 */
function normalizeSectorName(sector: string): string {
  const sectorMap: Record<string, string> = {
    realestate: "Real Estate",
    technology: "Technology",
    healthcare: "Healthcare",
    financial_services: "Financial Services",
    financialservices: "Financial Services",
    consumer_cyclical: "Consumer Cyclical",
    consumercyclical: "Consumer Cyclical",
    consumer_defensive: "Consumer Defensive",
    consumerdefensive: "Consumer Defensive",
    communication_services: "Communication Services",
    communicationservices: "Communication Services",
    industrials: "Industrials",
    energy: "Energy",
    utilities: "Utilities",
    basic_materials: "Basic Materials",
    basicmaterials: "Basic Materials",
  };

  const normalized = sector.toLowerCase().replace(/[\s-]/g, "_");
  return sectorMap[normalized] ?? sector;
}

/**
 * Calculates weighted sector breakdown for an ETF position
 * Uses pre-aggregated sectorWeights from Yahoo Finance
 *
 * @param positionValue Total position value in EUR
 * @param holdings ETF holdings data with sector weights
 * @returns Map of sector name -> weighted value in EUR
 */
export function getETFSectorBreakdown(
  positionValue: number,
  holdings: ETFHoldingsData
): Map<string, number> {
  const breakdown = new Map<string, number>();

  if (!holdings.sectorWeights || holdings.sectorWeights.length === 0) {
    // No sector data available, return as "ETF" fallback
    breakdown.set("ETF", positionValue);
    return breakdown;
  }

  let totalWeight = 0;
  for (const { sector, weight } of holdings.sectorWeights) {
    const normalizedSector = normalizeSectorName(sector);
    const value = positionValue * (weight / 100);
    breakdown.set(
      normalizedSector,
      (breakdown.get(normalizedSector) ?? 0) + value
    );
    totalWeight += weight;
  }

  // If weights don't sum to 100%, attribute remainder to "Other"
  if (totalWeight < 99) {
    const remainder = positionValue * ((100 - totalWeight) / 100);
    breakdown.set("Other", (breakdown.get("Other") ?? 0) + remainder);
  }

  return breakdown;
}

/**
 * Calculates weighted country breakdown for an ETF position
 * Uses the country field from each holding (enriched by the wrapper)
 *
 * @param positionValue Total position value in EUR
 * @param holdings ETF holdings data with country info for each holding
 * @returns Map of country name -> weighted value in EUR
 */
export function getETFCountryBreakdown(
  positionValue: number,
  holdings: ETFHoldingsData
): Map<string, number> {
  const breakdown = new Map<string, number>();

  if (!holdings.topHoldings || holdings.topHoldings.length === 0) {
    // No holdings data available, return as "ETF" fallback
    breakdown.set("ETF", positionValue);
    return breakdown;
  }

  // Check if any holdings have country data
  const holdingsWithCountry = holdings.topHoldings.filter(h => h.country);
  if (holdingsWithCountry.length === 0) {
    // No country data available, return as "ETF" fallback
    breakdown.set("ETF", positionValue);
    return breakdown;
  }

  // Calculate total weight of holdings with country data
  let totalWeight = 0;
  for (const holding of holdings.topHoldings) {
    if (holding.country && holding.holdingPercent > 0) {
      totalWeight += holding.holdingPercent;
    }
  }

  // Distribute position value across countries based on holding weights
  for (const holding of holdings.topHoldings) {
    if (!holding.country || holding.holdingPercent <= 0) continue;

    // Normalize weight relative to total known weights
    const normalizedWeight = holding.holdingPercent / totalWeight;
    const value = positionValue * normalizedWeight;

    const country = holding.country;
    breakdown.set(country, (breakdown.get(country) ?? 0) + value);
  }

  // If we have no breakdown data, fallback to "ETF"
  if (breakdown.size === 0) {
    breakdown.set("ETF", positionValue);
  }

  return breakdown;
}

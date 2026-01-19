import { z } from "zod";

/**
 * Schema for individual ETF holding
 * Represents a single stock/asset within an ETF
 */
export const ETFHoldingSchema = z.object({
  symbol: z.string(),
  holdingName: z.string(),
  holdingPercent: z.number(), // Weight in ETF (0-100)
});

export type ETFHolding = z.infer<typeof ETFHoldingSchema>;

/**
 * Schema for sector weight in ETF
 * Pre-aggregated sector breakdown from Yahoo Finance
 */
export const SectorWeightSchema = z.object({
  sector: z.string(),
  weight: z.number(), // Percentage (0-100)
});

export type SectorWeight = z.infer<typeof SectorWeightSchema>;

/**
 * Schema for complete ETF holdings data
 * Contains both individual holdings and sector weights
 */
export const ETFHoldingsDataSchema = z.object({
  topHoldings: z.array(ETFHoldingSchema),
  sectorWeights: z.array(SectorWeightSchema),
  fetchedAt: z.string(), // ISO date string
});

export type ETFHoldingsData = z.infer<typeof ETFHoldingsDataSchema>;

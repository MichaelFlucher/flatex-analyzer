import { DepotItemDetails } from "../hooks/use-depot-item-details";
import { FullTickerData } from "./yahoo-finance-schemas";
import { DepotItem } from "./depot-item";
import { ETFHoldingsData } from "./etf-holdings";

export interface Asset extends DepotItem {
  details: DepotItemDetails;
  tickerData: FullTickerData | null;
  currentEuroPrice: number | null;
  currentPositionValue: number | null;
  priceHistory?: { date: string; price: number }[];
  etfHoldings?: ETFHoldingsData; // ETF sector/holdings data (only for ETFs)
}
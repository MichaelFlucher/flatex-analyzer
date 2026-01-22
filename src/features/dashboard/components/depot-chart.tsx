import { Asset } from "../types/asset";
import { PieChartSwitcher } from "./pie-chart-switcher";
import {
  getETFSectorBreakdown,
  getETFCountryBreakdown,
} from "../utils/etf-aggregation";

function getAssetPieData(items: Asset[]) {
  return items
    .filter((item) => item.currentPositionValue)
    .map((item) => ({
      id: item.isin,
      label: item.name,
      value: item.currentPositionValue!,
    }))
    .sort((a, b) => b.value - a.value);
}

type Contributor = {
  name: string;
  value: number;
};

function getSectorPieData(items: Asset[]) {
  const sectorMap: Record<string, number> = {};
  const sectorContributors: Record<string, Contributor[]> = {};

  for (const item of items) {
    if (!item.currentPositionValue) continue;
    const isETF = item.tickerData?.quoteType === "ETF";
    const assetName = item.tickerData?.shortName || item.name || item.isin;

    if (isETF && item.etfHoldings) {
      // Distribute ETF value across sectors based on holdings
      const breakdown = getETFSectorBreakdown(
        item.currentPositionValue,
        item.etfHoldings
      );
      for (const [sector, value] of breakdown) {
        sectorMap[sector] = (sectorMap[sector] ?? 0) + value;
        if (!sectorContributors[sector]) sectorContributors[sector] = [];
        sectorContributors[sector].push({ name: assetName, value });
      }
    } else if (isETF) {
      // ETF without holdings data - fallback to "ETF" category
      sectorMap["ETF"] = (sectorMap["ETF"] ?? 0) + item.currentPositionValue;
      if (!sectorContributors["ETF"]) sectorContributors["ETF"] = [];
      sectorContributors["ETF"].push({ name: assetName, value: item.currentPositionValue });
    } else {
      // Regular stock - use direct sector
      const sector = item.tickerData?.sector ?? "Missing Sector Data";
      sectorMap[sector] = (sectorMap[sector] ?? 0) + item.currentPositionValue;
      if (!sectorContributors[sector]) sectorContributors[sector] = [];
      sectorContributors[sector].push({ name: assetName, value: item.currentPositionValue });
    }
  }

  return Object.entries(sectorMap)
    .map(([sector, value]) => ({
      id: sector,
      label: sector,
      value,
      contributors: sectorContributors[sector] || [],
    }))
    .sort((a, b) => b.value - a.value);
}

function getCountryPieData(items: Asset[]) {
  const countryMap: Record<string, number> = {};
  const countryContributors: Record<string, Contributor[]> = {};

  for (const item of items) {
    if (!item.currentPositionValue) continue;
    const isETF = item.tickerData?.quoteType === "ETF";
    const assetName = item.tickerData?.shortName || item.name || item.isin;

    if (isETF && item.etfHoldings) {
      // Use ETF country breakdown based on holdings
      const breakdown = getETFCountryBreakdown(
        item.currentPositionValue,
        item.etfHoldings
      );
      for (const [country, value] of breakdown) {
        countryMap[country] = (countryMap[country] ?? 0) + value;
        if (!countryContributors[country]) countryContributors[country] = [];
        countryContributors[country].push({ name: assetName, value });
      }
    } else if (isETF) {
      // ETF without holdings data - fallback to "ETF" category
      countryMap["ETF"] = (countryMap["ETF"] ?? 0) + item.currentPositionValue;
      if (!countryContributors["ETF"]) countryContributors["ETF"] = [];
      countryContributors["ETF"].push({ name: assetName, value: item.currentPositionValue });
    } else {
      // Regular stock - use direct country
      const country = item.tickerData?.country ?? "Missing Country Data";
      countryMap[country] = (countryMap[country] ?? 0) + item.currentPositionValue;
      if (!countryContributors[country]) countryContributors[country] = [];
      countryContributors[country].push({ name: assetName, value: item.currentPositionValue });
    }
  }

  return Object.entries(countryMap)
    .map(([country, value]) => ({
      id: country,
      label: country,
      value,
      contributors: countryContributors[country] || [],
    }))
    .sort((a, b) => b.value - a.value);
}

export function DepotChart({ depotItems }: { depotItems: Asset[] }) {
  return (
    <PieChartSwitcher
      dataSets={[
        {
          key: "asset",
          label: "Assets",
          data: getAssetPieData(depotItems),
        },
        {
          key: "sector",
          label: "Sectors",
          data: getSectorPieData(depotItems),
        },
        {
          key: "country",
          label: "Countries",
          data: getCountryPieData(depotItems),
        },
      ]}
    />
  );
}

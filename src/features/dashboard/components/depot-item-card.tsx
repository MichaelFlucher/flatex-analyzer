import {
  Avatar,
  Card,
  CardContent,
  Dialog,
  DialogTitle,
  Divider,
  Skeleton,
  Stack,
  Typography,
} from "@mui/material";
import { sectorIcons } from "./sector-icons";
import { useState } from "react";
import AssetHistoryItem from "./asset-history";
import ValueTypography from "./value-typography";
import { Asset } from "../types/asset";
import PriceHistoryChart from "./price-history-chart";
import { green, red, blue } from "@mui/material/colors";
import Link from "next/link";
import { PreserveSearchParamsLink } from "@/components/preserve-search-params-link";

export function LazyContent({
  checkValue,
  width = 100,
  children,
}: {
  checkValue: unknown;
  width?: number | string;
  children: React.ReactNode | null | undefined;
}) {
  if (checkValue === null || checkValue === undefined) {
    return <Skeleton animation={false} variant="text" width={width} />;
  }
  return <> {children} </>;
}

export function DepotItemCard({ item, baseUrl = "/assets" }: { item: Asset, baseUrl?: string }) {
  const currentValue = item.currentPositionValue;

  const netProfit =
    currentValue !== null
      ? item.details.dividends.totalValue +
        item.details.realized.totalValue +
        currentValue -
        item.details.investment.totalValue
      : null;

  const sectorIconKey =
    item.tickerData?.sectorKey || item.tickerData?.quoteType;
  const SectorIcon = sectorIcons[sectorIconKey];

  const sectorName = item.tickerData?.sectorDisp || item.tickerData?.quoteType;

  const investmentEvents = item.details.investment.transactions.map((t) => ({
    date: t.date,
    price: t.rate,
    type: "Buy",
  }));

  const realizedEvents = item.details.realized.transactions.map((t) => ({
    date: t.date,
    price: t.rate,
    type: "Sell",
  }));

  return (
    <PreserveSearchParamsLink href={`${baseUrl}/${item.isin}`}>
      <Card
        sx={{
          height: "100%",
          cursor: "pointer",
          transition: "0.3s",
          "&:hover": { boxShadow: 6, opacity: 1 },
          opacity: item.details.quantity <= 0 ? 0.5 : 1,
        }}
      >
        <CardContent sx={{}}>
          <Stack spacing={1}>
            <PriceHistoryChart
              priceHistory={item.priceHistory}
              keyEvents={[...investmentEvents, ...realizedEvents]}
              colors={{
                Buy: green[500],
                Sell: red[500],
                Dividend: blue[500],
              }}
              apexOptions={{
                chart: {
                  id: "performance-chart",
                  toolbar: { show: false },
                  animations: { enabled: false },
                  background: "transparent",
                  zoom: { enabled: false },
                  selection: { enabled: false },
                },
              }}
            />

            <Stack direction="column" alignItems="start">
              <Stack
                width={"100%"}
                direction="row"
                spacing={1}
                alignItems="center"
                justifyContent={"space-between"}
              >
                <Typography
                  textAlign={"right"}
                  variant="caption"
                  color="text.secondary"
                >
                  <LazyContent checkValue={sectorName}>
                    {sectorName}
                  </LazyContent>
                </Typography>
                {SectorIcon && (
                  <SectorIcon
                    fontSize="medium"
                    color={netProfit > 0 ? "info" : "error"}
                  />
                )}
                {!SectorIcon && (
                  <Skeleton
                    animation={false}
                    variant="circular"
                    width={24}
                    height={24}
                  />
                )}
              </Stack>
              <Stack
                width={"100%"}
                direction="row"
                spacing={1}
                alignItems="space-between"
                justifyContent={"space-between"}
              >
                <Typography variant="body1" component="h3" fontWeight={"bold"}>
                  {item.name}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {item.tickerData?.symbol ?? "—"} · {item.isin}
              </Typography>
            </Stack>

            <Divider sx={{ mb: 1 }} />

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Invested:
              </Typography>
              <ValueTypography variant="body2">
                {item.details.investment.totalValue.toFixed(2)} €
              </ValueTypography>
            </Stack>

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Dividend Yield:
              </Typography>
              <ValueTypography variant="body2">
                {item.details.dividends.totalValue.toFixed(2)} €
              </ValueTypography>
            </Stack>

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Realised Gains:
              </Typography>
              <ValueTypography variant="body2">
                {item.details.realized.totalValue.toFixed(2)} €
              </ValueTypography>
            </Stack>

            <Divider sx={{ my: 1 }} />

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Current Position:
              </Typography>
              <Stack direction="column" alignItems="end">
                <Typography
                  className="flex gap-2"
                  variant="body2"
                  color="text.secondary"
                >
                  <ValueTypography>
                    {item.details.quantity.toFixed(2)}
                  </ValueTypography>{" "}
                  x
                  <LazyContent width={20} checkValue={item.currentEuroPrice}>
                    {item?.currentEuroPrice?.toFixed(2)} €
                  </LazyContent>
                </Typography>
                <Typography variant="body2" color="text">
                  <LazyContent checkValue={currentValue}>
                    <ValueTypography>
                      {currentValue?.toFixed(2)} €
                    </ValueTypography>
                  </LazyContent>
                </Typography>
              </Stack>
            </Stack>

            <Divider sx={{ my: 1 }} />

            <Stack direction="row" spacing={2} justifyContent="space-between">
              <Typography variant="body2" color="text.secondary">
                Net Profit:
              </Typography>
              <Stack direction="column" alignItems="end">
                <Typography variant="body2">
                  <LazyContent checkValue={netProfit}>
                    <ValueTypography>{netProfit?.toFixed(2)} €</ValueTypography>
                  </LazyContent>
                </Typography>
                <Typography
                  color={netProfit > 0 ? "info" : "error"}
                  variant="body1"
                  fontWeight="bold"
                >
                  <LazyContent checkValue={netProfit}>
                    {(
                      (netProfit / item.details.investment.totalValue) *
                      100
                    ).toFixed(2)}
                    %
                  </LazyContent>
                </Typography>
              </Stack>
            </Stack>
          </Stack>
        </CardContent>
      </Card>
    </PreserveSearchParamsLink>
  );
}

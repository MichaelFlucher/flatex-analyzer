import { useState } from "react";
import {
  Box,
  Typography,
  ToggleButtonGroup,
  ToggleButton,
} from "@mui/material";
import { PieChart } from "@mui/x-charts";
import ValueTypography from "./value-typography";
import { useShowValues } from "../hooks/use-show-values";

type PieContributor = {
  name: string;
  value: number;
};

type PieData = {
  id: string;
  label: string;
  value: number;
  contributors?: PieContributor[];
};

type ChartDataSet = {
  key: string;
  label: string;
  data: PieData[];
};

type GenericPieChartSwitcherProps = {
  dataSets: ChartDataSet[];
};

export function PieChartSwitcher({ dataSets }: GenericPieChartSwitcherProps) {
  const { showValues } = useShowValues();
  const [selectedKey, setSelectedKey] = useState(dataSets[0]?.key || "");

  const selectedData = dataSets.find((d) => d.key === selectedKey);

  const totalValue = selectedData?.data.reduce((sum, item) => sum + item.value, 0) ?? 0;

  const handleMetricChange = (
    event: React.MouseEvent<HTMLElement>,
    newKey: string | null
  ) => {
    if (newKey) {
      setSelectedKey(newKey);
    }
  };


  return (
    <Box
      sx={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        height: "100%",
      }}
    >
      {selectedData && selectedData.data.length > 0 && (
        <Box sx={{ position: "relative", width: 200, height: 200 }}>
          <PieChart
            series={[
              {
                data: selectedData.data.sort((a, b) => b.value - a.value),
                innerRadius: 60,
                outerRadius: 100,
                paddingAngle: 2,
                cornerRadius: 2,
                highlightScope: { fade: "global", highlight: "item" },
                faded: { additionalRadius: -10, color: "gray" },
                valueFormatter: (item, context) => {
                  const pieItem = selectedData.data.find(d => d.value === item.value && d.label === context.dataIndex !== undefined ? selectedData.data[context.dataIndex]?.label : '');
                  const actualItem = context.dataIndex !== undefined ? selectedData.data.sort((a, b) => b.value - a.value)[context.dataIndex] : null;

                  const valueStr = showValues
                    ? item.value.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
                    : ((item.value / totalValue) * 100).toFixed(2) + "%";

                  // Show contributors if available
                  if (actualItem?.contributors && actualItem.contributors.length > 0) {
                    const contributorLines = actualItem.contributors
                      .sort((a, b) => b.value - a.value)
                      .slice(0, 5) // Show top 5 contributors
                      .map(c => `  ${c.name}: ${c.value.toLocaleString("de-DE", { style: "currency", currency: "EUR" })}`);

                    if (actualItem.contributors.length > 5) {
                      contributorLines.push(`  ... and ${actualItem.contributors.length - 5} more`);
                    }

                    return `${valueStr}\n${contributorLines.join('\n')}`;
                  }

                  return valueStr;
                },
              },
            ]}
            width={200}
            height={200}
            hideLegend
          />
          <ValueTypography
            variant="body1"
            align="center"
            fontWeight="bold"
            sx={{ position: "absolute", top: 90, left: 0, right: 0 }}
          >
            {totalValue.toLocaleString("de-DE", {
              style: "currency",
              currency: "EUR",
            })}
          </ValueTypography>
        </Box>
      )}

      <ToggleButtonGroup
        orientation="horizontal"
        value={selectedKey}
        exclusive
        onChange={handleMetricChange}
        aria-label="chart grouping metric"
        color="primary"
        sx={{ mt: 2, mb: 2 }}
        size="small"
      >
        {dataSets.map((set) => (
          <ToggleButton key={set.key} value={set.key} aria-label={set.label}>
            {set.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}

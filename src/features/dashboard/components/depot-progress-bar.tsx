"use client";

import { Box, LinearProgress, Typography, Alert, AlertTitle, Collapse } from "@mui/material";
import { useState } from "react";
import { ProgressState } from "../hooks/use-assets-calc";
import { useDepot } from "../hooks/use-depot";

export function DepotProgressBar() {
  const { progress, etfHoldingsErrors } = useDepot();
  const [showErrors, setShowErrors] = useState(true);

  const hasErrors = etfHoldingsErrors && etfHoldingsErrors.length > 0;

  return (
    <>
      {progress.state !== ProgressState.COMPLETED && (
        <Box
          sx={{
            width: "100%",
            display: "flex",
            flexDirection: "column",
            alignItems: "center",
          }}
        >
          <Box sx={{ width: "100%" }}>
            <LinearProgress
              variant="determinate"
              value={progress.progress * 100}
            />
          </Box>
          <Typography color="text.primary" variant="caption" gutterBottom>
            {progress.message}
          </Typography>
        </Box>
      )}
      {progress.state === ProgressState.COMPLETED && hasErrors && (
        <Collapse in={showErrors}>
          <Alert
            severity="warning"
            onClose={() => setShowErrors(false)}
            sx={{ mb: 2 }}
          >
            <AlertTitle>ETF Holdings Fetch Errors</AlertTitle>
            <Typography variant="body2" component="div">
              Failed to fetch ETF holdings for the following:
              <ul style={{ margin: "8px 0 0 0", paddingLeft: "20px" }}>
                {etfHoldingsErrors.map((err, idx) => (
                  <li key={idx}>
                    <strong>{err.symbol}</strong> (ISIN: {err.isin}): {err.error}
                  </li>
                ))}
              </ul>
            </Typography>
          </Alert>
        </Collapse>
      )}
    </>
  );
}

# ETF Sector & Country Support - Implementation Plan

## Problem Statement

Currently, the portfolio analyzer handles ETFs differently from individual stocks:
- **Stocks**: Display actual sector (e.g., "Technology", "Healthcare") and country data
- **ETFs**: Display generic "ETF" placeholder for both sector and country in pie charts

This limitation exists in `src/features/dashboard/components/depot-chart.tsx`:
```typescript
const isETF = item.tickerData?.quoteType === "ETF";
const sector = isETF ? "ETF" : item.tickerData?.sector ?? "Missing Sector Data";
const country = isETF ? "ETF" : item.tickerData?.country ?? "Missing Country Data";
```

## Goal

Show weighted sector and country breakdowns for ETFs based on their underlying holdings.

**Example**: If an MSCI World ETF (€10,000 position) contains:
- 65% Technology → €6,500 attributed to Technology sector
- 20% Healthcare → €2,000 attributed to Healthcare sector
- 15% Financials → €1,500 attributed to Financials sector

---

## Implementation Plan

### Phase 1: Data Source Research & Selection

#### 1.1 Investigate ETF Holdings Data Sources

**Option A: Yahoo Finance Holdings Endpoint**
- Yahoo Finance provides ETF holdings data via the `quoteSummary` module with `topHoldings`
- Pros: Already using Yahoo Finance for ticker data
- Cons: Limited to top 10-15 holdings, may not include full breakdown

**Option B: External ETF Data Providers**
- ETFdb.com API
- JustETF (for European ETFs)
- Morningstar API
- Pros: More comprehensive data
- Cons: May require API keys, additional costs

**Option C: Manual/Static Holdings Data**
- Store ETF composition data locally in database
- Pros: Full control, no external dependencies
- Cons: Requires manual updates, data can become stale

**Recommendation**: Start with Yahoo Finance (`topHoldings` module) as it integrates with existing infrastructure. Fall back to manual data for ETFs where Yahoo data is insufficient.

#### 1.2 Tasks
- [x] Test Yahoo Finance `quoteSummary` endpoint with `topHoldings` module
- [x] Evaluate data quality for common ETFs (MSCI World, S&P 500, etc.)
- [x] Document available fields: holding symbol, percentage weight, sector, country
- [x] Decide on fallback strategy for incomplete data

#### 1.3 Research Findings (Completed)

**yfinance Library Properties for ETF/Funds:**
- `ticker.funds_data.top_holdings` - Top holdings with symbol, name, percentage
- `ticker.funds_data.sector_weightings` - Pre-aggregated sector breakdown (dict)
- `ticker.funds_data.equity_holdings` - Equity holding statistics

**Decision:** Use `yfinance` library directly (already in use by yf-rest_wrapper).
- Primary: Use `sector_weightings` for sector breakdown (pre-aggregated by Yahoo)
- Secondary: Use `top_holdings` for individual holding details
- Fallback: Show "ETF" category if no data available

---

### Phase 2: Data Model & Type Definitions

#### 2.1 Create ETF Holdings Types

**File**: `src/features/dashboard/types/etf-holdings.ts`

```typescript
export interface ETFHolding {
  symbol: string;           // Stock ticker symbol
  holdingName: string;      // Company name
  holdingPercent: number;   // Weight in ETF (0-1 or 0-100)
  sector?: string;          // Sector of the holding
  sectorKey?: string;       // Normalized sector key
  country?: string;         // Country of the holding
}

export interface ETFHoldingsData {
  totalHoldings: number;    // Total number of holdings
  topHoldings: ETFHolding[];// Top holdings with details
  sectorWeights?: SectorWeight[];
  countryWeights?: CountryWeight[];
  lastUpdated: Date;
}

export interface SectorWeight {
  sector: string;
  sectorKey: string;
  weight: number;           // Percentage (0-100)
}

export interface CountryWeight {
  country: string;
  weight: number;           // Percentage (0-100)
}
```

#### 2.2 Extend Existing Types

**File**: `src/features/dashboard/types/asset.ts`

Add optional `etfHoldings` property to Asset interface:
```typescript
export interface Asset extends DepotItem {
  // ... existing properties
  etfHoldings?: ETFHoldingsData;  // NEW: ETF holdings data
}
```

#### 2.3 Tasks
- [x] Create `etf-holdings.ts` type definitions
- [x] Update `Asset` interface to include optional ETF holdings
- [x] Add Zod schemas for runtime validation

**Commits:**
- `570ecf1` feat(types): Add ETF holdings type definitions
- `6afaac4` feat(types): Extend Asset interface with etfHoldings

---

### Phase 3: ETF Holdings Data Fetching

#### 3.1 Extend Yahoo Finance Wrapper

**File**: `yf-rest_wrapper` (external service)

Add endpoint to fetch ETF holdings:
- `GET /holdings/:symbol` - Returns top holdings for an ETF

**Implementation Notes**:
- Use `yahoo-finance2` package's `quoteSummary` with `topHoldings` module
- Cache results (ETF holdings don't change frequently)
- Handle rate limiting

#### 3.2 Create Holdings Fetch Hook

**File**: `src/features/dashboard/hooks/use-etf-holdings.tsx`

```typescript
export function useETFHoldings(symbol: string, isETF: boolean) {
  return useQuery({
    queryKey: ['etf-holdings', symbol],
    queryFn: () => fetchETFHoldings(symbol),
    enabled: isETF,
    staleTime: 24 * 60 * 60 * 1000, // Cache for 24 hours
  });
}
```

#### 3.3 Integrate into Asset Loading

**File**: `src/features/dashboard/hooks/use-assets-calc.tsx`

Extend `useAssetsCalc` to:
1. Identify ETF assets (where `quoteType === "ETF"`)
2. Fetch holdings data for each ETF
3. Attach holdings data to Asset objects

#### 3.4 Tasks
- [x] Add `/holdings/:symbol` endpoint to yf-rest_wrapper
- [x] Create `useETFHoldings` hook
- [x] Integrate holdings fetching into asset calculation pipeline
- [x] Add caching strategy for holdings data
- [x] Handle errors gracefully (fallback to "ETF" if holdings unavailable)

**Commits (yf-rest_wrapper):**
- `2d074a0` feat(api): Add ETF holdings endpoint

**Commits (flatex-analyzer):**
- `fb71a71` feat(server): Add ETF holdings fetch function
- `ff1f29c` feat(api): Add ETF holdings API route
- `3b647c7` feat(hooks): Add useETFHoldingsBatch hook
- `fd4bd4f` feat(hooks): Integrate ETF holdings into asset calculation

---

### Phase 4: Weighted Aggregation Logic

#### 4.1 Create Holdings-Aware Aggregation Functions

**File**: `src/features/dashboard/utils/etf-aggregation.ts`

```typescript
/**
 * Calculates weighted sector breakdown for an ETF position
 * @param positionValue Total position value in EUR
 * @param holdings ETF holdings data
 * @returns Map of sector -> weighted value
 */
export function getETFSectorBreakdown(
  positionValue: number,
  holdings: ETFHoldingsData
): Map<string, number> {
  const breakdown = new Map<string, number>();

  for (const holding of holdings.topHoldings) {
    const sector = holding.sectorKey ?? 'unknown';
    const weight = holding.holdingPercent / 100;
    const value = positionValue * weight;

    breakdown.set(sector, (breakdown.get(sector) ?? 0) + value);
  }

  return breakdown;
}

/**
 * Calculates weighted country breakdown for an ETF position
 */
export function getETFCountryBreakdown(
  positionValue: number,
  holdings: ETFHoldingsData
): Map<string, number> {
  // Similar implementation
}
```

#### 4.2 Update Pie Chart Data Functions

**File**: `src/features/dashboard/components/depot-chart.tsx`

Modify `getSectorPieData` and `getCountryPieData`:

```typescript
function getSectorPieData(items: Asset[]): ChartData[] {
  const sectorValues = new Map<string, number>();

  for (const item of items) {
    const positionValue = item.currentPositionValue ?? 0;
    const isETF = item.tickerData?.quoteType === "ETF";

    if (isETF && item.etfHoldings) {
      // Distribute ETF value across sectors based on holdings
      const breakdown = getETFSectorBreakdown(positionValue, item.etfHoldings);
      for (const [sector, value] of breakdown) {
        sectorValues.set(sector, (sectorValues.get(sector) ?? 0) + value);
      }
    } else if (!isETF) {
      // Regular stock - use direct sector
      const sector = item.tickerData?.sectorKey ?? 'unknown';
      sectorValues.set(sector, (sectorValues.get(sector) ?? 0) + positionValue);
    } else {
      // ETF without holdings data - fallback to "ETF" category
      sectorValues.set('ETF', (sectorValues.get('ETF') ?? 0) + positionValue);
    }
  }

  return Array.from(sectorValues.entries()).map(([sector, value]) => ({
    name: sector,
    value,
  }));
}
```

#### 4.3 Tasks
- [x] Create `etf-aggregation.ts` utility functions
- [x] Update `getSectorPieData` to handle ETF holdings
- [x] Update `getCountryPieData` to handle ETF holdings
- [ ] Add unit tests for aggregation logic (future)
- [x] Handle edge cases (missing data, rounding errors)

**Commits:**
- `21b09b3` feat(utils): Add ETF aggregation utility functions
- `783aa01` feat(chart): Update getSectorPieData for ETF sector breakdown
- `a9bf2f6` feat(chart): Update getCountryPieData for ETF support

---

### Phase 5: UI/UX Enhancements

#### 5.1 Visual Indicators

- Add indicator showing which assets are ETFs with expanded holdings
- Show tooltip with "Including X underlying holdings" for ETF contributions

#### 5.2 ETF Details View

**File**: `src/app/(app)/(dashboard)/assets/[isin]/page.tsx`

Add section showing ETF composition:
- Top 10 holdings with weights
- Sector breakdown chart
- Country breakdown chart

#### 5.3 Toggle Option

Add user preference to:
- Show ETFs as single "ETF" category (current behavior)
- Show ETFs broken down by underlying holdings (new behavior)

#### 5.4 Tasks
- [ ] Add ETF composition section to asset detail page
- [ ] Add toggle for ETF breakdown mode in settings
- [ ] Update tooltips to show ETF contribution details
- [ ] Add loading states for ETF holdings data

---

### Phase 6: Data Caching & Performance

#### 6.1 Database Schema for Holdings Cache

**File**: `src/db/schema.ts`

```typescript
export const etfHoldingsCache = pgTable('etf_holdings_cache', {
  symbol: varchar('symbol', { length: 20 }).primaryKey(),
  holdingsData: jsonb('holdings_data').$type<ETFHoldingsData>(),
  fetchedAt: timestamp('fetched_at').notNull(),
  expiresAt: timestamp('expires_at').notNull(),
});
```

#### 6.2 Cache Strategy

- Cache ETF holdings for 24 hours (holdings change infrequently)
- Refresh cache on user request or scheduled job
- Store in PostgreSQL for persistence across sessions

#### 6.3 Tasks
- [ ] Add database table for holdings cache
- [ ] Implement cache read/write logic
- [ ] Add cache invalidation mechanism
- [ ] Consider background job for cache refresh

---

## File Changes Summary

| File | Change Type | Description |
|------|-------------|-------------|
| `src/features/dashboard/types/etf-holdings.ts` | New | ETF holdings type definitions |
| `src/features/dashboard/types/asset.ts` | Modify | Add `etfHoldings` property |
| `src/features/dashboard/hooks/use-etf-holdings.tsx` | New | Hook to fetch ETF holdings |
| `src/features/dashboard/hooks/use-assets-calc.tsx` | Modify | Integrate holdings fetching |
| `src/features/dashboard/utils/etf-aggregation.ts` | New | Weighted aggregation utilities |
| `src/features/dashboard/components/depot-chart.tsx` | Modify | Update pie chart data functions |
| `src/app/(app)/(dashboard)/assets/[isin]/page.tsx` | Modify | Add ETF details section |
| `src/db/schema.ts` | Modify | Add holdings cache table |
| `yf-rest_wrapper/` | Modify | Add holdings endpoint |

---

## Testing Strategy

1. **Unit Tests**
   - Test aggregation functions with mock holdings data
   - Test edge cases: empty holdings, missing sectors, rounding

2. **Integration Tests**
   - Test Yahoo Finance holdings endpoint
   - Test end-to-end asset loading with ETF holdings

3. **Manual Testing**
   - Test with real ETFs: MSCI World, S&P 500, regional ETFs
   - Verify pie charts show correct weighted breakdowns
   - Test fallback behavior when holdings unavailable

---

## Rollout Plan

1. **Phase 1-2**: Research & Types (Foundation)
2. **Phase 3**: Data Fetching (Backend integration)
3. **Phase 4**: Aggregation Logic (Core feature)
4. **Phase 5**: UI Enhancements (User experience)
5. **Phase 6**: Caching & Performance (Production readiness)

---

## Open Questions

1. How to handle ETFs with no available holdings data?
   - Option: Keep showing as "ETF" category
   - Option: Show "Insufficient data" warning

2. Should we support nested ETFs (ETF holding other ETFs)?
   - Recommendation: First version ignores nested ETFs

3. How often should holdings data be refreshed?
   - Recommendation: 24-hour cache, manual refresh option

4. Should users be able to override/edit ETF holdings manually?
   - Recommendation: Future enhancement, not in initial scope

---

## Implementation Status

### Completed (Core Feature)
- [x] **Phase 1**: Data source research - Using yfinance `funds_data.sector_weightings`
- [x] **Phase 2**: Type definitions - `ETFHolding`, `SectorWeight`, `ETFHoldingsData`
- [x] **Phase 3**: Data fetching pipeline - API endpoint, hook, integration
- [x] **Phase 4**: Sector aggregation - ETFs now show weighted sector breakdown

### Partially Implemented
- [ ] **Country breakdown**: Yahoo Finance doesn't provide country data for ETF holdings
  - Currently shows "ETF" for country (same as before)
  - Structure in place for future enhancement when data source available

### Future Enhancements (Phase 5-6)
- [ ] ETF details page with holdings list
- [ ] Toggle for ETF breakdown mode in settings
- [ ] Database caching for holdings (currently in-memory via React Query)
- [ ] Unit tests for aggregation functions

### Commit History (flatex-analyzer)
```
570ecf1 feat(types): Add ETF holdings type definitions
6afaac4 feat(types): Extend Asset interface with etfHoldings
fb71a71 feat(server): Add ETF holdings fetch function
ff1f29c feat(api): Add ETF holdings API route
3b647c7 feat(hooks): Add useETFHoldingsBatch hook
fd4bd4f feat(hooks): Integrate ETF holdings into asset calculation
21b09b3 feat(utils): Add ETF aggregation utility functions
783aa01 feat(chart): Update getSectorPieData for ETF sector breakdown
a9bf2f6 feat(chart): Update getCountryPieData for ETF support
```

### Commit History (yf-rest_wrapper)
```
2d074a0 feat(api): Add ETF holdings endpoint
```

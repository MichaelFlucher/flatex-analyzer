import {
  pgTable,
  serial,
  varchar,
  date,
  decimal,
  bigint,
  timestamp,
  index,
  unique,
} from "drizzle-orm/pg-core";

export const priceHistoryCache = pgTable(
  "price_history_cache",
  {
    id: serial("id").primaryKey(),
    ticker: varchar("ticker", { length: 20 }).notNull(),
    date: date("date").notNull(),
    open: decimal("open", { precision: 16, scale: 6 }),
    high: decimal("high", { precision: 16, scale: 6 }),
    low: decimal("low", { precision: 16, scale: 6 }),
    close: decimal("close", { precision: 16, scale: 6 }),
    volume: bigint("volume", { mode: "number" }),
    createdAt: timestamp("created_at").defaultNow().notNull(),
  },
  (table) => [
    index("idx_price_history_ticker").on(table.ticker),
    index("idx_price_history_date").on(table.date),
    index("idx_price_history_ticker_date").on(table.ticker, table.date),
    unique("price_history_cache_ticker_date_key").on(table.ticker, table.date),
  ]
);

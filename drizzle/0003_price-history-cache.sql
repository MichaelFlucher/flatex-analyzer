-- Price history cache table for yf-wrapper
-- Stores historical price data that never changes (immutable once published)
CREATE TABLE "price_history_cache" (
	"id" serial PRIMARY KEY NOT NULL,
	"ticker" varchar(20) NOT NULL,
	"date" date NOT NULL,
	"open" decimal(16, 6),
	"high" decimal(16, 6),
	"low" decimal(16, 6),
	"close" decimal(16, 6),
	"volume" bigint,
	"created_at" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "price_history_cache_ticker_date_unique" UNIQUE("ticker", "date")
);
--> statement-breakpoint
CREATE INDEX "idx_price_history_ticker" ON "price_history_cache" ("ticker");
--> statement-breakpoint
CREATE INDEX "idx_price_history_date" ON "price_history_cache" ("date");
--> statement-breakpoint
CREATE INDEX "idx_price_history_ticker_date" ON "price_history_cache" ("ticker", "date");

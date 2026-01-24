export function convertToEuroPrice(
  price: number,
  currencies: Record<string, number> | null,
  currency: string
): number {
  if (!currency) {
    return price;
  }

  let normalizedPrice = price;
  let normalizedCurrency = currency.toUpperCase();

  // Special case: GBp (British pence) → divide by 100 to convert to GBP
  if (currency === "GBp" || currency === "gbp") {
    normalizedPrice = price / 100;
    normalizedCurrency = "GBP";
  }

  if (normalizedCurrency === "EUR") {
    return normalizedPrice;
  }

  if (!currencies) {
    console.warn(`Conversion rates not available for ${currency}`);
    return 0;
  }

  const conversionRate = currencies[normalizedCurrency];
  if (!conversionRate) {
    console.warn(`Conversion rate for ${currency} not found`);
    return 0;
  }

  return normalizedPrice / conversionRate;
}

const KNOWN_SYMBOL_WRAPPERS = [
  "CL.SN"
];

export function removeKnownSymbolWrappers(symbol: string): string {
  for (const wrapper of KNOWN_SYMBOL_WRAPPERS) {
    const regex = new RegExp(`${wrapper}$`);
    if (regex.test(symbol)) {
      return symbol.replace(regex, '');
    }
  }
  return symbol;
}


const ISIN_REMAP: Record<string, string> = {
  "US02079K3059": "GOOGL",
  "IE00BQT3WG13": "36BZ.DE",  // iShares MSCI China A UCITS ETF - Yahoo ISIN search only returns Mexican ticker
  "IE00BJ5JNZ06": "QDVG.DE",  // iShares MSCI World Health Care Sector UCITS ETF
  "DK0062498333": "NOVO-B.CO",  // Novo Nordisk B shares on Copenhagen
}

export function hardCodedIsinRemap(symbol: string): string {
  if(ISIN_REMAP[symbol] === undefined) return symbol;
  return ISIN_REMAP[symbol] || symbol;
}
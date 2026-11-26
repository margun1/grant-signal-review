// Static demonstration figures from the product sales Markdown. Keep outside ledger queries.
export const sampleSales = [
  ["2026-06-03", "가상 가정 고객", "POWERBOARD", 8, 149000],
  ["2026-06-09", "가상 교육기관", "POWERBOARD", 4, 139000],
  ["2026-06-15", "가상 교육기관", "드론", 1, 780000],
  ["2026-06-22", "가상 공공기관", "드론", 1, 850000],
  ["2026-07-03", "가상 가정 고객", "POWERBOARD", 12, 149000],
  ["2026-07-09", "가상 교육기관", "POWERBOARD", 6, 139000],
  ["2026-07-15", "가상 교육기관", "드론", 2, 780000],
  ["2026-07-22", "가상 공공기관", "드론", 1, 850000],
  ["2026-08-03", "가상 가정 고객", "POWERBOARD", 14, 149000],
  ["2026-08-09", "가상 교육기관", "POWERBOARD", 8, 139000],
  ["2026-08-15", "가상 교육기관", "드론", 2, 780000],
  ["2026-08-22", "가상 공공기관", "드론", 2, 850000],
  ["2026-09-03", "가상 가정 고객", "POWERBOARD", 18, 149000],
  ["2026-09-09", "가상 교육기관", "POWERBOARD", 10, 139000],
  ["2026-09-15", "가상 교육기관", "드론", 3, 780000],
  ["2026-09-22", "가상 공공기관", "드론", 2, 850000],
  ["2026-10-03", "가상 가정 고객", "POWERBOARD", 20, 149000],
  ["2026-10-09", "가상 교육기관", "POWERBOARD", 12, 139000],
  ["2026-10-15", "가상 교육기관", "드론", 3, 780000],
  ["2026-10-22", "가상 공공기관", "드론", 3, 850000],
  ["2026-11-03", "가상 가정 고객", "POWERBOARD", 24, 149000],
  ["2026-11-09", "가상 교육기관", "POWERBOARD", 14, 139000],
  ["2026-11-15", "가상 교육기관", "드론", 4, 780000],
  ["2026-11-22", "가상 공공기관", "드론", 3, 850000],
] as const;

export const sampleProducts = ["POWERBOARD", "드론"] as const;
type SampleSale = (typeof sampleSales)[number];

function summarize(sales: readonly SampleSale[]) {
  return sales.reduce(
    (sum, [, , , quantity, price]) => ({
      quantity: sum.quantity + quantity,
      revenue: sum.revenue + quantity * price,
    }),
    { quantity: 0, revenue: 0 },
  );
}

export const sampleSalesTotal = summarize(sampleSales);
export const sampleSalesByProduct = sampleProducts.map((product) => {
  const rows = sampleSales.filter((row) => row[2] === product);
  return { product, transactions: rows.length, ...summarize(rows) };
});

const months = [...new Set(sampleSales.map(([date]) => date.slice(0, 7)))];
export const sampleSalesByMonth = months.map((month) => {
  const rows = sampleSales.filter(([date]) => date.startsWith(month));
  return {
    month,
    products: sampleProducts.map((product) => summarize(rows.filter((row) => row[2] === product))),
    ...summarize(rows),
  };
});

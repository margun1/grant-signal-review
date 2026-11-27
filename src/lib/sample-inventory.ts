const products = [
  { name: "POWERBOARD 계측기", kind: "완제품", min_stock: 10, target_stock: 30, quantities: [24, 16, 7] },
  { name: "POWERBOARD 전류 센서", kind: "부품·재료", min_stock: 25, target_stock: 60, quantities: [42, 31, 18] },
  { name: "POWERBOARD 통신 모듈", kind: "부품·재료", min_stock: 12, target_stock: 35, quantities: [20, 19, 28] },
  { name: "교육용 드론 키트", kind: "완제품", min_stock: 8, target_stock: 20, quantities: [14, 10, 5] },
  { name: "드론 예비 프로펠러 세트", kind: "부품·재료", min_stock: 20, target_stock: 50, quantities: [31, 27, 23] },
  { name: "드론 프로펠러 가드 세트", kind: "부품·재료", min_stock: 12, target_stock: 30, quantities: [22, 18, 15] },
];

const snapshotDates = ["2026-11-13", "2026-11-20", "2026-11-27"];

export const sampleInventoryItems = products.map(({ name, kind, min_stock, target_stock }) => ({
  name, kind, min_stock, target_stock,
}));

export const sampleInventorySnaps = snapshotDates.flatMap((as_of, index) =>
  products.map(({ name, kind, quantities }) => ({
    item: name, kind, quantity: quantities[index], as_of,
  })),
);

export const samplePurchaseOrders = [
  { id: "sample-po-01", item: products[3].name, quantity: 10, status: "발주 전", ordered_at: null, received_at: null, memo: "교육 일정 대비", created_at: "2026-11-27T11:00:00+09:00" },
  { id: "sample-po-02", item: products[0].name, quantity: 15, status: "발주 완료", ordered_at: "2026-11-26", received_at: null, memo: "실증 설치분", created_at: "2026-11-26T15:00:00+09:00" },
  { id: "sample-po-03", item: products[4].name, quantity: 12, status: "입고 완료", ordered_at: "2026-11-24", received_at: "2026-11-27", memo: "수업용 예비 부품", created_at: "2026-11-24T10:00:00+09:00" },
  { id: "sample-po-04", item: products[1].name, quantity: 20, status: "발주 완료", ordered_at: "2026-11-23", received_at: null, memo: "센서 교체용", created_at: "2026-11-23T14:00:00+09:00" },
  { id: "sample-po-05", item: products[2].name, quantity: 15, status: "입고 완료", ordered_at: "2026-11-18", received_at: "2026-11-25", memo: "통신 모듈 보충", created_at: "2026-11-18T11:00:00+09:00" },
];

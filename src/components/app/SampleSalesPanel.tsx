import { Panel } from "@/components/app/ui";
import { cnt, won } from "@/lib/biz";
import {
  sampleProducts,
  sampleSales,
  sampleSalesByMonth,
  sampleSalesByProduct,
  sampleSalesTotal,
} from "@/lib/sample-sales";

export function SampleSalesPanel({ profitability = false }: { profitability?: boolean }) {
  return (
    <Panel title="제품별 가상 매출" accent="gold">
      <div className="space-y-4">
        <div className="rounded-md border border-warning/40 bg-warning/10 p-3 text-sm">
          <strong>가상 데이터 · 실제 실적 아님</strong>
          <p className="mt-1">
            2026년 6~11월 · 부가가치세 제외 · {sampleSales.length}건 ·{" "}
            {cnt(sampleSalesTotal.quantity)} · {won(sampleSalesTotal.revenue)}
          </p>
          {profitability && (
            <p className="mt-1">
              가상 원가가 제공되지 않아 매출총이익과 이익률은 산정할 수 없습니다.
            </p>
          )}
        </div>

        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <caption className="pb-2 text-left font-semibold">제품별 합계</caption>
            <thead className="bg-secondary">
              <tr>
                <th scope="col" className="p-2 text-left">
                  제품
                </th>
                <th scope="col" className="p-2 text-right">
                  거래 건수
                </th>
                <th scope="col" className="p-2 text-right">
                  판매량
                </th>
                <th scope="col" className="p-2 text-right">
                  가상 매출
                </th>
                <th scope="col" className="p-2 text-right">
                  매출 비중
                </th>
              </tr>
            </thead>
            <tbody>
              {sampleSalesByProduct.map(({ product, transactions, quantity, revenue }) => (
                <tr key={product} className="border-t">
                  <th scope="row" className="p-2 text-left">
                    {product}
                  </th>
                  <td className="p-2 text-right">{transactions}건</td>
                  <td className="p-2 text-right">{cnt(quantity)}</td>
                  <td className="p-2 text-right">{won(revenue)}</td>
                  <td className="p-2 text-right">
                    {((100 * revenue) / sampleSalesTotal.revenue).toFixed(1)}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full whitespace-nowrap text-sm">
            <caption className="pb-2 text-left font-semibold">월별 가상 매출</caption>
            <thead className="bg-secondary">
              <tr>
                <th scope="col" className="p-2 text-left">
                  기준월
                </th>
                {sampleProducts.map((product) => (
                  <th key={product} scope="col" className="p-2 text-right">
                    {product} 수량 · 매출
                  </th>
                ))}
                <th scope="col" className="p-2 text-right">
                  월 합계
                </th>
              </tr>
            </thead>
            <tbody>
              {sampleSalesByMonth.map(({ month, products, revenue }) => (
                <tr key={month} className="border-t">
                  <th scope="row" className="p-2 text-left">
                    {month}
                  </th>
                  {products.map((product, index) => (
                    <td key={sampleProducts[index]} className="p-2 text-right">
                      {cnt(product.quantity)} · {won(product.revenue)}
                    </td>
                  ))}
                  <td className="p-2 text-right font-semibold">{won(revenue)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {!profitability && (
          <details>
            <summary className="cursor-pointer text-sm font-semibold">
              가상 거래 내역 {sampleSales.length}건
            </summary>
            <div className="mt-2 overflow-x-auto">
              <table aria-label="가상 거래 내역" className="w-full whitespace-nowrap text-sm">
                <thead className="bg-secondary">
                  <tr>
                    {["판매일", "구매자 구분", "상품명", "수량", "단가", "판매금액"].map(
                      (label, index) => (
                        <th
                          scope="col"
                          key={label}
                          className={index < 3 ? "p-2 text-left" : "p-2 text-right"}
                        >
                          {label}
                        </th>
                      ),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {sampleSales.map(([date, buyer, product, quantity, price]) => (
                    <tr key={date} className="border-t">
                      <td className="p-2">{date}</td>
                      <td className="p-2">{buyer}</td>
                      <td className="p-2">{product}</td>
                      <td className="p-2 text-right">{cnt(quantity)}</td>
                      <td className="p-2 text-right">{won(price)}</td>
                      <td className="p-2 text-right">{won(quantity * price)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </details>
        )}
      </div>
    </Panel>
  );
}

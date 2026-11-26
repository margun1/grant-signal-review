import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Panel } from "@/components/app/ui";
import { getRentalElectricityTariffs } from "@/lib/rental-electricity.functions";

const labels: Record<string, string> = {
  complexnm: "단지명",
  housenm: "단지명",
  hsmpnm: "단지명",
  adres: "주소",
  address: "주소",
  eleccgstype: "전기요금제",
  eleccgs: "전기요금제",
};

export function RentalElectricityTariffs() {
  const [page, setPage] = useState(1);
  const fetchTariffs = useServerFn(getRentalElectricityTariffs);
  const query = useQuery({
    queryKey: ["rental-electricity-tariffs", page],
    queryFn: () => fetchTariffs({ data: { page } }),
    staleTime: 15 * 60_000,
    retry: false,
  });
  const data = query.data;
  const columns = [...new Set(data?.rows.flatMap(Object.keys) ?? [])];
  const hasNext =
    !!data &&
    (data.totalCount === null
      ? data.rows.length === data.pageSize
      : page * data.pageSize < data.totalCount);

  return (
    <Panel
      title="임대주택단지 전기요금제"
      accent="gold"
      action={
        <Button
          variant="outline"
          size="sm"
          disabled={query.isFetching}
          onClick={() => void query.refetch()}
        >
          다시 조회
        </Button>
      }
    >
      {query.isPending ? (
        <p role="status" className="text-sm text-muted-foreground">
          전기요금제를 조회하는 중…
        </p>
      ) : query.isError ? (
        <p role="alert" className="text-sm text-destructive">
          {query.error.message}
        </p>
      ) : data?.rows.length && columns.length ? (
        <div className="overflow-x-auto rounded-md border" tabIndex={0}>
          <table className="w-full text-sm">
            <thead className="bg-accent">
              <tr>
                {columns.map((column) => (
                  <th key={column} scope="col" className="whitespace-nowrap px-3 py-2 text-left">
                    {labels[column.toLowerCase().replaceAll("_", "")] ?? column}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.rows.map((row, index) => (
                <tr key={index} className="border-t">
                  {columns.map((column) => (
                    <td key={column} className="whitespace-nowrap px-3 py-2">
                      {row[column] || "—"}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="text-sm text-muted-foreground">이 페이지에 표시할 자료가 없습니다.</p>
      )}
      {(page > 1 || hasNext) && (
        <nav aria-label="전기요금제 목록 페이지" className="mt-3 flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            disabled={page === 1 || query.isFetching}
            onClick={() => setPage(page - 1)}
          >
            이전
          </Button>
          <span className="text-sm">{page}페이지</span>
          <Button
            variant="outline"
            size="sm"
            disabled={!hasNext || query.isFetching}
            onClick={() => setPage(page + 1)}
          >
            다음
          </Button>
        </nav>
      )}
      <p className="mt-3 text-xs text-muted-foreground">
        출처: 공공데이터포털 · 임대주택단지 전기요금제
      </p>
    </Panel>
  );
}

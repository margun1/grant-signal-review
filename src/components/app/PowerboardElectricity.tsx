import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Panel, todayKst } from "@/components/app/ui";
import { getNamyangjuHouseAverage } from "@/lib/kepco.functions";

function previousMonth() {
  const month = new Date(`${todayKst().slice(0, 7)}-01T00:00:00Z`);
  month.setUTCMonth(month.getUTCMonth() - 1);
  return month.toISOString().slice(0, 7);
}

export function PowerboardElectricity() {
  const [month, setMonth] = useState(previousMonth);
  const [requestedMonth, setRequestedMonth] = useState(month);
  const fetchAverage = useServerFn(getNamyangjuHouseAverage);
  const result = useQuery({
    queryKey: ["kepco-house-average", requestedMonth],
    queryFn: () => fetchAverage({ data: { month: requestedMonth } }),
    staleTime: 15 * 60_000,
    retry: false,
  });

  return (
    <Panel title="한전 전력데이터 · 남양주시 가구 평균" accent="gold">
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          if (month === requestedMonth) void result.refetch();
          else setRequestedMonth(month);
        }}
      >
        <div className="space-y-2">
          <Label htmlFor="kepco-month">조회 월</Label>
          <Input
            id="kepco-month"
            type="month"
            required
            max={previousMonth()}
            value={month}
            onChange={(event) => setMonth(event.target.value)}
          />
        </div>
        <Button type="submit" variant="outline" disabled={result.isFetching}>
          조회
        </Button>
      </form>
      <div className="mt-4">
        {result.isPending ? (
          <p role="status" className="text-sm text-muted-foreground">
            한전 전력데이터를 조회하는 중…
          </p>
        ) : result.isError ? (
          <p role="alert" className="text-sm text-destructive">
            {result.error.message}
          </p>
        ) : result.data ? (
          <>
            <p className="mb-2 text-sm text-muted-foreground">{requestedMonth} 기준</p>
            <dl className="grid gap-3 sm:grid-cols-3">
              {(
                [
                  ["가구당 평균 사용량", result.data.averageKwh, "kWh"],
                  ["가구당 평균 전기요금", result.data.averageBill, "원"],
                  ["집계 가구 수", result.data.households, "가구"],
                ] as const
              ).map(([label, value, unit]) => (
                <div key={label} className="rounded-md border p-3">
                  <dt className="text-sm text-muted-foreground">{label}</dt>
                  <dd className="mt-1 font-bold">
                    {value === null ? "기록 없음" : `${value.toLocaleString("ko-KR")} ${unit}`}
                  </dd>
                </div>
              ))}
            </dl>
          </>
        ) : (
          <p className="text-sm text-muted-foreground">
            {requestedMonth}에 공개된 자료가 없습니다.
          </p>
        )}
      </div>
      <p className="mt-4 text-xs leading-relaxed text-muted-foreground">
        출처: 한국전력 전력데이터개방포털 · 가구평균 전력사용량. 지역 집계값은 POWERBOARD 가상 실증
        수치와 별도로 표시합니다.
      </p>
    </Panel>
  );
}

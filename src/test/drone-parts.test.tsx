import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Route } from "@/routes/_authenticated/drone";

it("filters the sample parts by classification and name and restores all rows when cleared", () => {
  const DronePage = Route.options.component;
  if (!DronePage) throw new Error("Missing drone route component");
  render(<DronePage />);

  const search = screen.getByRole("searchbox", { name: "부품 찾기" });
  expect(screen.getByRole("status")).toHaveTextContent("전체 40개 중 40개 표시");
  expect(screen.getByText(/535,500원/)).toBeInTheDocument();

  fireEvent.change(search, { target: { value: "추진 esc" } });
  expect(screen.getByRole("status")).toHaveTextContent("전체 40개 중 1개 표시");
  expect(screen.getByRole("rowheader", { name: "4채널 모터 제어기(ESC)" })).toBeInTheDocument();

  fireEvent.change(search, { target: { value: "없는 부품" } });
  expect(screen.getByText("검색어와 일치하는 부품이 없습니다.")).toBeInTheDocument();

  fireEvent.change(search, { target: { value: "" } });
  expect(screen.getByRole("status")).toHaveTextContent("전체 40개 중 40개 표시");
});

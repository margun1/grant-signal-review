import { fireEvent, render, screen } from "@testing-library/react";
import { expect, it } from "vitest";
import { Route } from "@/routes/_authenticated/drone_.parts";

it("filters the sample parts by classification and name and restores all rows when cleared", () => {
  const DronePage = Route.options.component;
  if (!DronePage) throw new Error("Missing drone route component");
  render(<DronePage />);

  const search = screen.getByRole("searchbox", { name: "부품 찾기" });
  expect(screen.getByRole("status")).toHaveTextContent("전체 255개 중 255개 표시");

  fireEvent.change(search, { target: { value: "기체 프레임키트" } });
  expect(screen.getByRole("status")).toHaveTextContent("전체 255개 중 5개 표시");

  fireEvent.change(search, { target: { value: "demo-001-01" } });
  fireEvent.click(screen.getByRole("button", { name: "검색" }));
  expect(screen.getByRole("status")).toHaveFocus();
  expect(screen.getByRole("status")).toHaveTextContent("전체 255개 중 1개 표시");
  expect(screen.getByRole("rowheader", { name: "프레임 키트" })).toBeInTheDocument();
  expect(screen.getByText("52,000원")).toBeInTheDocument();

  fireEvent.change(search, { target: { value: "없는 부품" } });
  expect(screen.getByText("검색어와 일치하는 부품이 없습니다.")).toBeInTheDocument();

  fireEvent.change(search, { target: { value: "" } });
  expect(screen.getByRole("status")).toHaveTextContent("전체 255개 중 255개 표시");

  fireEvent.change(search, { target: { value: "없는 부품" } });
  const category = screen.getByRole("button", { name: /^기체$/ });
  fireEvent.click(category);
  expect(category).toHaveAttribute("aria-pressed", "true");
  expect(search).toHaveValue("");
  expect(screen.queryByRole("button", { name: /^프레임 키트$/ })).toBeNull();
  expect(screen.getAllByRole("rowheader", { name: "프레임 키트" })).toHaveLength(5);
  expect(screen.queryByText("DEMO-051-05")).toBeNull();
  fireEvent.change(search, { target: { value: "프레임키트" } });
  expect(screen.getByRole("status")).toHaveTextContent("전체 255개 중 5개 표시");

  fireEvent.click(screen.getByRole("button", { name: /^전체$/ }));
  expect(screen.getByRole("status")).toHaveTextContent("전체 255개 중 255개 표시");
});

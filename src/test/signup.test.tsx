import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ReactNode } from "react";

const { signUp, navigate } = vi.hoisted(() => ({ signUp: vi.fn(), navigate: vi.fn() }));
vi.mock("@tanstack/react-router", () => ({
  createFileRoute: () => (options: unknown) => ({ options }),
  useNavigate: () => navigate,
}));
vi.mock("@tanstack/react-start", () => ({ useServerFn: () => vi.fn() }));
vi.mock("@/lib/share-invite.functions", () => ({ prepareSharedSignup: vi.fn() }));
vi.mock("@/integrations/supabase/client", () => ({ supabase: { auth: { signUp } } }));
vi.mock("@/components/app/AuthShell", () => ({
  AuthShell: ({ children }: { children: ReactNode }) => <div>{children}</div>,
  Divider: () => null,
  GoogleButton: () => null,
}));
import { Route } from "@/routes/signup";

function submitSignup() {
  const Component = Route.options.component;
  if (!Component) throw new Error("Signup component missing");
  render(<Component />);
  fireEvent.change(screen.getByLabelText("이름"), { target: { value: "신규 회원" } });
  fireEvent.change(screen.getByLabelText("이메일"), { target: { value: "new-member@example.com" } });
  fireEvent.change(screen.getByLabelText("비밀번호", { exact: true }), { target: { value: "Member-pass-2026" } });
  fireEvent.change(screen.getByLabelText("비밀번호 확인"), { target: { value: "Member-pass-2026" } });
  fireEvent.click(screen.getByRole("button", { name: "가입하기" }));
}

describe("Public signup access", () => {
  beforeEach(() => { vi.clearAllMocks(); window.location.hash = ""; });

  it("enters the company page immediately when signup returns a session, without approval", async () => {
    signUp.mockResolvedValue({ data: { session: { user: { id: "new-member" } } }, error: null });
    submitSignup();
    await waitFor(() => expect(navigate).toHaveBeenCalledWith({ to: "/company", replace: true }));
  });

  it("requires email verification when signup has no session instead of bypassing authentication", async () => {
    signUp.mockResolvedValue({ data: { session: null }, error: null });
    submitSignup();
    await waitFor(() => expect(signUp).toHaveBeenCalledOnce());
    await waitFor(() => expect(screen.queryByRole("button", { name: "가입하기" })).toBeNull());
    expect(navigate).not.toHaveBeenCalled();
  });
});
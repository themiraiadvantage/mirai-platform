import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import Auth from "./Auth";
import { ApiError } from "@/lib/api";
const mocks = vi.hoisted(() => ({ replace: vi.fn(), signIn: vi.fn(), request: vi.fn() }));
vi.mock("next/navigation", () => ({ useRouter: () => ({ replace: mocks.replace }) }));
vi.mock("@/lib/session", () => ({ useSession: () => null, signIn: mocks.signIn }));
vi.mock("@/lib/api", async (original) => ({
  ...(await original<typeof import("@/lib/api")>()),
  apiRequest: mocks.request,
}));
beforeEach(() => {
  vi.clearAllMocks();
  sessionStorage.clear();
  window.history.replaceState({}, "", "/");
});
afterEach(() => cleanup());
function fillSignIn() {
  fireEvent.change(screen.getByLabelText("Email address"), {
    target: { value: "buyer@example.com" },
  });
  fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
    target: { value: "Abcdef1!" },
  });
}
describe("connected authentication forms", () => {
  it("keeps the selected plot through signup, verification and sign-in", async () => {
    const target = "/dashboard/explore/MR-4092?plan=3mo#plans";
    const query = `?redirect=${encodeURIComponent(target)}`;
    window.history.replaceState({}, "", `/sign-up${query}`);
    mocks.request.mockResolvedValue({ message: "Accepted" });
    const signup = render(<Auth mode="sign-up" />);
    expect(screen.getByRole("link", { name: "Sign in" })).toHaveAttribute(
      "href",
      `/sign-in${query}`,
    );
    fillSignIn();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Buyer" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Abcdef1!" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith(`/verify-email${query}`));
    expect(sessionStorage.getItem("mirai-auth-redirect")).toBe(target);
    signup.unmount();
    window.history.replaceState({}, "", "/verify-email");
    const verification = render(<Auth mode="verify" />);
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "012345" } });
    fireEvent.submit(screen.getByRole("button", { name: "Verify email" }).closest("form")!);
    expect(await screen.findByRole("link", { name: "Continue to sign in" })).toHaveAttribute(
      "href",
      `/sign-in${query}`,
    );
    verification.unmount();
    window.history.replaceState({}, "", "/sign-in");
    mocks.signIn.mockResolvedValueOnce({ name: "Buyer" });
    render(<Auth mode="sign-in" />);
    fillSignIn();
    fireEvent.submit(screen.getByRole("button", { name: "Sign in" }).closest("form")!);
    await waitFor(() => expect(mocks.replace).toHaveBeenLastCalledWith(target));
  });
  it("shows real sign-in fields without demo accounts or fabricated verification", () => {
    render(<Auth mode="sign-in" />);
    expect(screen.getByRole("button", { name: "Sign in" })).toBeInTheDocument();
    expect(screen.queryByText(/demo|prepared workspace|123456/i)).not.toBeInTheDocument();
    expect(screen.getByLabelText("Password", { exact: true })).toHaveAttribute(
      "autocomplete",
      "current-password",
    );
    expect(screen.queryByLabelText("Confirm password")).not.toBeInTheDocument();
  });
  it("only redirects after successful API authentication", async () => {
    mocks.signIn.mockRejectedValueOnce(new ApiError("Invalid email or password", 401));
    render(<Auth mode="sign-in" />);
    fillSignIn();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Invalid email or password");
    expect(mocks.replace).not.toHaveBeenCalled();
    mocks.signIn.mockResolvedValueOnce({ name: "Buyer" });
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    await waitFor(() => expect(mocks.replace).toHaveBeenCalledWith("/dashboard"));
    expect(mocks.signIn).toHaveBeenCalledWith("buyer@example.com", "Abcdef1!");
  });
  it("sends signup to the backend and waits for an email link instead of creating a session", async () => {
    mocks.request.mockResolvedValueOnce({ message: "Accepted" });
    render(<Auth mode="sign-up" />);
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: " Test Buyer " } });
    fillSignIn();
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Abcdef1!" } });
    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByRole("button", { name: "Create account" }));
    expect(await screen.findByRole("heading", { name: "Check your inbox." })).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledWith(
      "/auth/signup",
      expect.objectContaining({
        body: JSON.stringify({
          name: "Test Buyer",
          email: "buyer@example.com",
          password: "Abcdef1!",
        }),
      }),
    );
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(screen.getByRole("button", { name: "Resend email in 60s" })).toBeDisabled();
  });
  it("offers a real resend when the backend requires email verification", async () => {
    mocks.signIn.mockRejectedValueOnce(
      new ApiError("Please verify your email before signing in.", 403),
    );
    mocks.request.mockResolvedValueOnce({ message: "Accepted" });
    render(<Auth mode="sign-in" />);
    fillSignIn();
    fireEvent.click(screen.getByRole("button", { name: "Sign in" }));
    fireEvent.click(await screen.findByRole("button", { name: "Resend verification email" }));
    expect(await screen.findByRole("heading", { name: "Check your inbox." })).toBeInTheDocument();
    expect(mocks.request).toHaveBeenCalledWith(
      "/auth/resend-verification",
      expect.objectContaining({ body: JSON.stringify({ email: "buyer@example.com" }) }),
    );
  });
  it("rejects passwords that do not meet the backend policy", async () => {
    render(<Auth mode="sign-up" />);
    fillSignIn();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Buyer" } });
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "onlyletterslongenough" },
    });
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Include one uppercase letter");
    expect(mocks.request).not.toHaveBeenCalled();
  });
  it("checks every password requirement as the user types", () => {
    render(<Auth mode="sign-up" />);
    const requirements = screen.getByRole("list", { name: "Password requirements" });
    expect(requirements).toHaveTextContent("Needed: At least 8 characters");
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "Abcdef1!" },
    });
    for (const label of [
      "At least 8 characters",
      "One uppercase letter",
      "One lowercase letter",
      "One number",
      "One special character",
    ]) {
      expect(requirements).toHaveTextContent(`Met: ${label}`);
    }
    fireEvent.change(screen.getByLabelText("Password", { exact: true }), {
      target: { value: "abcdef1!" },
    });
    expect(requirements).toHaveTextContent("Needed: One uppercase letter");
    expect(requirements).toHaveTextContent("Met: One lowercase letter");
  });
  it("verifies the emailed code before allowing the user to continue to sign-in", async () => {
    mocks.request
      .mockRejectedValueOnce(new ApiError("The code is incorrect or has expired.", 400))
      .mockResolvedValueOnce({ message: "Email verified" });
    render(<Auth mode="verify" />);
    fireEvent.change(screen.getByLabelText("Email address"), {
      target: { value: "buyer@example.com" },
    });
    fireEvent.change(screen.getByLabelText("Verification code"), { target: { value: "012345" } });
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    expect(await screen.findByRole("alert")).toHaveTextContent(
      "The code is incorrect or has expired.",
    );
    fireEvent.click(screen.getByRole("button", { name: "Verify email" }));
    expect(await screen.findByRole("heading", { name: "Email verified." })).toBeInTheDocument();
    expect(mocks.request).toHaveBeenLastCalledWith(
      "/auth/verify-code",
      expect.objectContaining({
        body: JSON.stringify({ email: "buyer@example.com", code: "012345" }),
      }),
    );
    expect(mocks.signIn).not.toHaveBeenCalled();
    expect(screen.getByRole("link", { name: "Continue to sign in" })).toHaveAttribute(
      "href",
      "/sign-in",
    );
  });
  it("blocks mismatched confirmation and updates the match indicator live", async () => {
    render(<Auth mode="sign-up" />);
    fillSignIn();
    fireEvent.change(screen.getByLabelText("Full name"), { target: { value: "Buyer" } });
    fireEvent.change(screen.getByLabelText("Confirm password"), {
      target: { value: "Different1!" },
    });
    expect(screen.getByText("Passwords do not match")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("aria-invalid", "true");
    fireEvent.submit(screen.getByRole("button", { name: "Create account" }).closest("form")!);
    expect(await screen.findByRole("alert")).toHaveTextContent("Your passwords do not match.");
    expect(mocks.request).not.toHaveBeenCalled();
    fireEvent.change(screen.getByLabelText("Confirm password"), { target: { value: "Abcdef1!" } });
    expect(screen.getByText("Passwords match")).toBeInTheDocument();
    expect(screen.getByLabelText("Confirm password")).toHaveAttribute("aria-invalid", "false");
  });
});

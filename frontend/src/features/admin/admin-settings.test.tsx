import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { AdminSettings } from "./AdminManagement";
import { AdminProvider, useAdmin } from "./admin-store";
const mocks = vi.hoisted(() => ({ role: "SUPER_ADMIN", request: vi.fn() }));
vi.mock("./admin-auth", () => ({
  adminRequest: mocks.request,
  useAdminAccess: () => ({ user: { staffRole: mocks.role } }),
}));
const settings = {
  company: "MIRAI Database",
  email: "support@example.com",
  phone: "",
  reservationFee: 42000,
  accessMonths: 18,
};
function Defaults() {
  const { data } = useAdmin();
  return (
    <output data-testid="defaults">
      {data.settings.reservationFee}/{data.settings.accessMonths}
    </output>
  );
}
function open() {
  render(
    <AdminProvider liveSettings>
      <AdminSettings />
      <Defaults />
    </AdminProvider>,
  );
}
beforeEach(() => {
  localStorage.clear();
  mocks.role = "SUPER_ADMIN";
  mocks.request.mockReset();
  mocks.request.mockResolvedValue(settings);
});
afterEach(cleanup);
describe("live admin settings", () => {
  it("loads database settings, removes preview sections, and saves owner defaults", async () => {
    open();
    const fee = await screen.findByLabelText("Default reservation fee (₦)");
    expect(fee).toHaveValue(42000);
    expect(screen.queryByText("Explore safely")).not.toBeInTheDocument();
    expect(screen.queryByText("Preview data")).not.toBeInTheDocument();
    fireEvent.change(fee, { target: { value: "65000" } });
    mocks.request.mockResolvedValue({ ...settings, reservationFee: 65000 });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(screen.getByTestId("defaults")).toHaveTextContent("65000/18"));
    const options = mocks.request.mock.calls.at(-1)?.[1];
    expect(JSON.parse(options.body).reservationFee).toBe(65000);
  });
  it("lets admins save the profile while keeping protected defaults read-only and out of the request", async () => {
    mocks.role = "ADMIN";
    open();
    const fee = await screen.findByLabelText("Default reservation fee (₦)");
    expect(fee).toHaveAttribute("readonly");
    expect(screen.getByLabelText("Default access (months)")).toHaveAttribute("readonly");
    fireEvent.change(screen.getByLabelText("Company name"), { target: { value: "New company" } });
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    await waitFor(() => expect(mocks.request).toHaveBeenCalledTimes(2));
    expect(JSON.parse(mocks.request.mock.calls[1][1].body)).toEqual({
      company: "New company",
      email: settings.email,
      phone: "",
    });
  });
  it("shows a save failure and keeps the last confirmed defaults", async () => {
    open();
    const fee = await screen.findByLabelText("Default reservation fee (₦)");
    fireEvent.change(fee, { target: { value: "60000" } });
    mocks.request.mockRejectedValue(new Error("Saving failed"));
    fireEvent.click(screen.getByRole("button", { name: "Save settings" }));
    expect(await screen.findByRole("alert")).toHaveTextContent("Saving failed");
    expect(screen.getByTestId("defaults")).toHaveTextContent("42000/18");
  });
  it("blocks stale browser defaults on load failure and supports retry", async () => {
    mocks.request.mockRejectedValueOnce(new Error("Cannot load settings"));
    open();
    expect(await screen.findByRole("alert")).toHaveTextContent("Cannot load settings");
    expect(screen.queryByLabelText("Company name")).not.toBeInTheDocument();
    mocks.request.mockResolvedValue(settings);
    fireEvent.click(screen.getByRole("button", { name: "Try again" }));
    expect(await screen.findByLabelText("Company name")).toHaveValue(settings.company);
  });
});

import { useState } from "react";
import { afterEach, describe, expect, it } from "vitest";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import {
  StaffAccessPicker,
  ACCESS_PRESETS,
  type StaffAccessValue,
  accessDescription,
} from "./staff-access";
afterEach(cleanup);
function Editor() {
  const [value, setValue] = useState<StaffAccessValue>({
    role: "LISTING_MANAGER",
    permissions: [...ACCESS_PRESETS.LISTING_MANAGER],
  });
  return (
    <>
      <StaffAccessPicker value={value} onChange={setValue} />
      <output data-testid="value">{JSON.stringify(value)}</output>
    </>
  );
}
const current = () => JSON.parse(screen.getByTestId("value").textContent!);
describe("flexible staff permissions", () => {
  it("lets the owner combine sections across role presets", () => {
    render(<Editor />);
    expect(screen.getByRole("checkbox", { name: "Plots" })).toBeChecked();
    fireEvent.click(screen.getByRole("checkbox", { name: "Payments" }));
    fireEvent.click(screen.getByRole("checkbox", { name: "Plots" }));
    expect(current().permissions).toContain("payments");
    expect(current().permissions).not.toContain("plots");
    expect(screen.getByRole("checkbox", { name: /Overview/ })).toBeDisabled();
  });
  it("selects all operational sections without granting staff management", () => {
    render(<Editor />);
    fireEvent.click(screen.getByRole("button", { name: "Select all sections" }));
    expect(current().permissions).toContain("settings");
    expect(current().permissions).not.toContain("verification");
    expect(current().permissions).not.toContain("staff");
    expect(accessDescription(current().role, current().permissions)).toBe(
      "All operational sections",
    );
    fireEvent.click(screen.getByRole("button", { name: "Clear selection" }));
    expect(current().permissions).toEqual(["dashboard"]);
  });
  it("applies a different preset then permits custom changes", () => {
    render(<Editor />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "PAYMENT_SUPPORT" } });
    expect(current().permissions).toContain("payments");
    expect(current().permissions).not.toContain("plots");
    fireEvent.click(screen.getByRole("checkbox", { name: "Documents" }));
    expect(current().permissions).toContain("documents");
  });
  it("makes full Super Admin authority an explicit choice", () => {
    render(<Editor />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "SUPER_ADMIN" } });
    expect(screen.getByText(/Super Admins have full platform access/)).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
    expect(current().role).toBe("SUPER_ADMIN");
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "DOCUMENT_ADMINISTRATOR" } });
    expect(current().permissions).toEqual(["dashboard", "documents"]);
  });
});

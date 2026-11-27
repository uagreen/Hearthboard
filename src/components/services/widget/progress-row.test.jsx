// @vitest-environment jsdom

import { screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

import ProgressRow from "./progress-row";

describe("components/services/widget/progress-row", () => {
  it("renders the title, the percentage and the details", () => {
    renderWithProviders(<ProgressRow title="Ubuntu ISO" percent={42} details="2 MB/s · 2m" />);

    expect(screen.getByText("Ubuntu ISO")).toBeInTheDocument();
    expect(screen.getByText("42%")).toBeInTheDocument();
    expect(screen.getByText("2 MB/s · 2m")).toBeInTheDocument();
  });

  it("exposes the progress to assistive technology and sizes the fill", () => {
    renderWithProviders(<ProgressRow title="x" percent={42} details="" />);

    const bar = screen.getByRole("progressbar");
    expect(bar).toHaveAttribute("aria-valuenow", "42");
    expect(bar).toHaveAttribute("aria-valuemin", "0");
    expect(bar).toHaveAttribute("aria-valuemax", "100");
    expect(bar.firstChild).toHaveStyle({ width: "42%" });
    expect(bar.firstChild.className).toContain("bg-emerald-500");
  });

  it("shows the error text and a red fill when failed", () => {
    renderWithProviders(<ProgressRow title="x" percent={10} details="" error errorText="Tracker gave an error" />);

    expect(screen.getByText("Tracker gave an error")).toBeInTheDocument();
    expect(screen.getByRole("progressbar").firstChild.className).toContain("bg-red-500");
  });

  it("does not crash without a title", () => {
    renderWithProviders(<ProgressRow percent={5} details="" />);

    expect(screen.getByRole("progressbar")).toHaveAttribute("aria-valuenow", "5");
  });
});

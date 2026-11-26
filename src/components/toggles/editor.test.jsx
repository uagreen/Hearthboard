// @vitest-environment jsdom

import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import EditorLink from "./editor";

describe("components/toggles/editor", () => {
  it("links to the built-in editor", () => {
    render(<EditorLink />);

    const link = screen.getByRole("link", { name: "Editor" });
    expect(link.getAttribute("href")).toBe("/editor");
    expect(link.querySelector("svg")).toBeTruthy();
  });
});

// @vitest-environment jsdom

import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI, useSWR } = vi.hoisted(() => ({ useWidgetAPI: vi.fn(), useSWR: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));
vi.mock("swr", () => ({ default: useSWR }));

import Component from "./component";

const HREF = "https://lib.example.com";
const status = {
  active: false,
  indexedAt: "2026-11-25T10:00:00Z",
  stats: { totalBooks: 412000, totalAuthors: 98000, totalSeries: 5000, totalGenres: 120, totalLanguages: 9 },
};
const book = (n, extra = {}) => ({
  id: String(n),
  title: `Book ${n}`,
  authors: `Author ${n}`,
  series: "Cycle",
  seriesNo: n,
  ...extra,
});

let responses;
let calls;

function render(widget = {}, service = {}) {
  return renderWithProviders(
    <Component service={{ href: HREF, widget: { type: "inpxlibrary", ...widget }, ...service }} />,
    { settings: { hideErrors: false } },
  );
}

describe("widgets/inpxlibrary/component", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls = [];
    responses = {
      IndexStatus: { data: status },
      Reading: { data: { items: [book(1), book(2), book(3)] } },
      Want: { data: { items: [book(4)] } },
      Shelves: { data: [{ id: 7, name: "Favorites" }] },
      ShelfBooks: { data: [book(8), book(9)] },
    };
    useWidgetAPI.mockImplementation((_widget, endpoint, query, swrConfig) => {
      if (endpoint) calls.push({ endpoint, query, swrConfig });
      return responses[endpoint] ?? { data: undefined, error: undefined };
    });
    useSWR.mockImplementation((url) => (url ? (responses.ShelfBooks ?? { data: undefined }) : { data: undefined }));
  });

  it("shows the default counters", () => {
    render();
    expect(screen.getByText("inpxlibrary.books")).toBeInTheDocument();
    expect(screen.getByText("412000")).toBeInTheDocument();
    expect(screen.getByText("98000")).toBeInTheDocument();
    expect(screen.getByText("inpxlibrary.genres")).toBeInTheDocument();
  });

  it("uses only the configured, known fields", () => {
    render({ fields: ["languages", "nope", "books"] });
    expect(screen.getByText("inpxlibrary.languages")).toBeInTheDocument();
    expect(screen.queryByText("inpxlibrary.authors")).toBeNull();
    expect(screen.queryByText("nope")).toBeNull();
  });

  it("shows placeholders while stats are missing", () => {
    responses.IndexStatus = { data: { active: false } };
    render();
    expect(screen.getAllByText("-").length).toBeGreaterThan(0);
  });

  it("shows indexing progress without NaN, or the last index time", () => {
    responses.IndexStatus = { data: { ...status, active: true, processedArchives: 12, totalArchives: 40 } };
    const { unmount } = render();
    expect(screen.getByText(/inpxlibrary\.indexing/)).toHaveTextContent("12 / 40");
    unmount();

    responses.IndexStatus = { data: { ...status, active: true } };
    const second = render();
    expect(document.body.textContent).not.toContain("NaN");
    expect(screen.getByText(/inpxlibrary\.indexing/)).toHaveTextContent("0 / 0");
    second.unmount();

    responses.IndexStatus = { data: status };
    render();
    expect(screen.getByText(/inpxlibrary\.updated/)).toHaveTextContent("2026-11-25T10:00:00Z");
  });

  it("hides the indexing line when showIndexing is false", () => {
    render({ showIndexing: false });
    expect(screen.queryByText(/inpxlibrary\.updated/)).toBeNull();
  });

  it("makes no personal request when no option is enabled", () => {
    render();
    expect(calls.map((c) => c.endpoint)).toEqual(["IndexStatus"]);
    expect(useSWR).not.toHaveBeenCalled();
  });

  it("lists up to count books of the reading list with cover, link, title and authors", () => {
    render({ showReading: true, count: 2 });

    const section = screen.getByText("inpxlibrary.reading").closest("details");
    expect(section).not.toHaveAttribute("open");
    expect(within(section).getAllByRole("link")).toHaveLength(2);
    expect(within(section).getByText("Book 1")).toBeInTheDocument();
    expect(within(section).getByText("Author 1")).toBeInTheDocument();
    expect(within(section).queryByText("Book 3")).toBeNull();
    expect(within(section).getAllByRole("link")[0]).toHaveAttribute("href", `${HREF}/book/1`);
    expect(within(section).getAllByRole("img")[0]).toHaveAttribute("src", `${HREF}/api/books/1/cover-thumb`);
    expect(calls.find((c) => c.endpoint === "Reading").query).toMatchObject({ pageSize: 2 });
  });

  it("opens the sections when expandSections is set", () => {
    render({ showWant: true, expandSections: true });
    expect(screen.getByText("inpxlibrary.want").closest("details")).toHaveAttribute("open");
  });

  it("stops polling a personal list after an error and shows a hint", () => {
    responses.Reading = { data: { error: { message: "HTTP Error" } }, error: { message: "HTTP Error" } };
    render({ showReading: true });

    expect(screen.getByText("inpxlibrary.auth_failed")).toBeInTheDocument();
    const { query, swrConfig } = calls.find((c) => c.endpoint === "Reading");
    expect(query.refreshInterval({ error: { message: "x" } })).toBe(0);
    expect(query.refreshInterval({ items: [] })).toBeGreaterThan(0);
    expect(swrConfig).toMatchObject({ revalidateOnFocus: false, shouldRetryOnError: false });
  });

  it("shows the books of the named shelf, newest first, limited to count", () => {
    responses.ShelfBooks = { data: [book(8), book(9), book(10)] };
    render({ shelf: "favorites", count: 2 });

    const section = screen.getByText(/inpxlibrary\.shelf/).closest("details");
    expect(section).toHaveTextContent("Favorites");
    expect(within(section).getByText("Book 8")).toBeInTheDocument();
    expect(within(section).queryByText("Book 10")).toBeNull();
    const url = useSWR.mock.calls.map((c) => c[0]).find(Boolean);
    expect(decodeURIComponent(url)).toContain('"shelfId":"7"');
    expect(url).toContain("endpoint=ShelfBooks");
  });

  it("says so when the shelf does not exist or is empty", () => {
    render({ shelf: "Missing" });
    expect(screen.getByText("inpxlibrary.shelf_not_found")).toBeInTheDocument();
    expect(useSWR.mock.calls.every((c) => c[0] === null)).toBe(true);
  });

  it("shows no_items for an empty list", () => {
    responses.Want = { data: { items: [] } };
    render({ showWant: true });
    expect(screen.getByText("inpxlibrary.no_items")).toBeInTheDocument();
  });

  it("omits links and covers without an href but keeps titles", () => {
    render({ showReading: true }, { href: undefined });
    const section = screen.getByText("inpxlibrary.reading").closest("details");
    expect(within(section).queryByRole("link")).toBeNull();
    expect(within(section).queryByRole("img")).toBeNull();
    expect(within(section).getByText("Book 1")).toBeInTheDocument();
  });

  it("copes with a book without authors or series and hides a cover that fails to load", () => {
    responses.Reading = { data: { items: [{ id: "5", title: "Bare" }] } };
    render({ showReading: true });

    const section = screen.getByText("inpxlibrary.reading").closest("details");
    expect(within(section).getByText("Bare")).toBeInTheDocument();
    fireEvent.error(within(section).getByRole("img"));
    expect(within(section).queryByRole("img")).toBeNull();
  });
});

// @vitest-environment jsdom

import { fireEvent, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

import { renderWithProviders } from "test-utils/render-with-providers";

const { useWidgetAPI } = vi.hoisted(() => ({ useWidgetAPI: vi.fn() }));
vi.mock("utils/proxy/use-widget-api", () => ({ default: useWidgetAPI }));

import LibrarySections from "./library";

const HREF = "https://jf.example.com";
const users = [
  { Id: "u1", Name: "Anna" },
  { Id: "u2", Name: "Bob" },
];
const views = {
  Items: [
    { Id: "lib-movies", Name: "Films", CollectionType: "movies" },
    { Id: "lib-tv", Name: "Shows", CollectionType: "tvshows" },
  ],
};
const movie = (n) => ({
  Id: `m${n}`,
  Name: `Movie ${n}`,
  ProductionYear: 2020 + n,
  CommunityRating: 7.84,
  ServerId: "srv",
  ImageTags: { Primary: `tag${n}` },
});
const episode = {
  Id: "e1",
  Type: "Episode",
  Name: "Woe's Hollow",
  SeriesId: "ser1",
  SeriesName: "Severance",
  SeriesPrimaryImageTag: "serTag",
  ParentIndexNumber: 2,
  IndexNumber: 4,
  CommunityRating: 8.5,
  ServerId: "srv",
};

let responses;
let calls;
let storage;

function render(widget = {}, extra = {}) {
  return renderWithProviders(
    <LibrarySections
      service={{
        href: HREF,
        widget: { type: "jellyfin", service_group: "Media", service_name: "Jellyfin", ...widget },
        ...extra,
      }}
    />,
    { settings: {} },
  );
}

describe("widgets/jellyfin/library", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    calls = [];
    storage = new Map();
    vi.stubGlobal("localStorage", {
      getItem: (k) => storage.get(k) ?? null,
      setItem: (k, v) => storage.set(k, String(v)),
      removeItem: (k) => storage.delete(k),
    });
    responses = {
      Users: { data: users },
      Views: { data: views },
      Resume: { data: { Items: [episode] } },
      Latest: { data: [movie(1), movie(2), movie(3), movie(4), movie(5), movie(6)] },
    };
    useWidgetAPI.mockImplementation((_widget, endpoint, query) => {
      if (endpoint) calls.push({ endpoint, query });
      return responses[endpoint] ?? { data: undefined, error: undefined };
    });
  });

  it("renders nothing when no section is enabled", () => {
    const { container } = render({});
    expect(container).toBeEmptyDOMElement();
    expect(calls).toEqual([]);
  });

  it("links to every library", () => {
    render({ showLibraries: true });

    expect(screen.getByRole("link", { name: "Films" })).toHaveAttribute(
      "href",
      `${HREF}/web/#/movies?topParentId=lib-movies&collectionType=movies`,
    );
    expect(screen.getByRole("link", { name: "Shows" })).toHaveAttribute(
      "href",
      `${HREF}/web/#/tv?topParentId=lib-tv&collectionType=tvshows`,
    );
  });

  it("shows continue watching episodes with poster, title, rating and link, closed by default", () => {
    render({ showContinueWatching: true });

    const section = screen.getByText("jellyfin.continue_watching").closest("details");
    expect(section).not.toHaveAttribute("open");
    expect(within(section).getByText("Severance")).toBeInTheDocument();
    expect(within(section).getByText("S02E04 · Woe's Hollow")).toBeInTheDocument();
    expect(within(section).getByText("★ 8.5")).toBeInTheDocument();
    expect(within(section).getByRole("img")).toHaveAttribute(
      "src",
      `${HREF}/Items/ser1/Images/Primary?maxHeight=360&tag=serTag`,
    );
    expect(within(section).getByRole("link")).toHaveAttribute("href", `${HREF}/web/#/details?id=e1&serverId=srv`);
    expect(calls.find((c) => c.endpoint === "Resume").query).toMatchObject({
      userId: "u1",
      limit: 5,
      includeItemTypes: "Episode",
    });
  });

  it("opens the accordions when expandSections is set", () => {
    render({ showContinueWatching: true, expandSections: true });
    expect(screen.getByText("jellyfin.continue_watching").closest("details")).toHaveAttribute("open");
  });

  it("shows recently added per library, limited to latestCount", () => {
    render({ showLatest: true, latestCount: 4 });

    const films = screen.getByText("Films").closest("details");
    expect(within(films).getAllByRole("img")).toHaveLength(4);
    expect(within(films).getByText("Movie 1")).toBeInTheDocument();
    expect(within(films).getAllByText("★ 7.8").length).toBe(4);
    const latestCall = calls.find((c) => c.endpoint === "Latest");
    expect(latestCall.query).toMatchObject({ userId: "u1", parentId: "lib-movies", limit: 4 });
  });

  it("clamps an out-of-range latestCount", () => {
    render({ showLatest: true, latestCount: 99 });
    expect(calls.find((c) => c.endpoint === "Latest").query.limit).toBe(5);
  });

  it("says so when a library has no recent items", () => {
    responses.Latest = { data: [] };
    render({ showLatest: true });
    expect(screen.getAllByText("jellyfin.no_items").length).toBe(2);
  });

  it("lets the viewer switch user and remembers the choice", () => {
    render({ showContinueWatching: true });

    const select = screen.getByLabelText("jellyfin.user");
    expect(select).toHaveValue("u1");
    fireEvent.change(select, { target: { value: "u2" } });

    expect(storage.get("jellyfin-user:Media/Jellyfin")).toBe("u2");
    expect(calls.filter((c) => c.endpoint === "Resume").at(-1).query.userId).toBe("u2");
  });

  it("preselects the configured user and ignores a stored id that no longer exists", () => {
    storage.set("jellyfin-user:Media/Jellyfin", "gone");
    render({ showContinueWatching: true, user: "bob" });

    expect(screen.getByLabelText("jellyfin.user")).toHaveValue("u2");
  });

  it("hides the switcher when enableUserSwitch is false", () => {
    render({ showContinueWatching: true, enableUserSwitch: false });
    expect(screen.queryByLabelText("jellyfin.user")).toBeNull();
    expect(screen.getByText("Severance")).toBeInTheDocument();
  });

  it("shows a hint and runs no section queries when the user list is unavailable", () => {
    responses.Users = { data: { error: "forbidden" }, error: { message: "forbidden" } };
    render({ showContinueWatching: true, showLatest: true });

    expect(screen.getByText("jellyfin.users_unavailable")).toBeInTheDocument();
    expect(screen.queryByLabelText("jellyfin.user")).toBeNull();
    expect(calls.map((c) => c.endpoint).filter((e) => e !== "Users")).toEqual([]);
  });

  it("omits posters and links without an href, but keeps titles", () => {
    render({ showContinueWatching: true }, { href: undefined });

    const section = screen.getByText("jellyfin.continue_watching").closest("details");
    expect(within(section).queryByRole("img")).toBeNull();
    expect(within(section).queryByRole("link")).toBeNull();
    expect(within(section).getByText("Severance")).toBeInTheDocument();
  });

  it("omits the rating when the item has none and the poster when it has no image", () => {
    responses.Latest = { data: [{ Id: "m9", Name: "Bare", ImageTags: {} }] };
    render({ showLatest: true });

    const films = screen.getByText("Films").closest("details");
    expect(within(films).getByText("Bare")).toBeInTheDocument();
    expect(within(films).queryByRole("img")).toBeNull();
    expect(within(films).queryByText(/★/)).toBeNull();
  });
});

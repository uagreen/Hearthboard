/* eslint-disable @next/next/no-img-element */
import { useTranslation } from "next-i18next/pages";
import { useState } from "react";

import { clampCount, formatRating, itemTitle, itemUrl, libraryUrl, pickUser, posterUrl } from "./library-utils";

import useWidgetAPI from "utils/proxy/use-widget-api";

const ROW = "text-theme-700 dark:text-theme-200 text-xs rounded-md bg-theme-200/50 dark:bg-theme-900/20 mt-1";

function ItemCard({ href, item }) {
  const { title, subtitle } = itemTitle(item);
  const poster = posterUrl(href, item);
  const link = itemUrl(href, item);
  const rating = formatRating(item);

  const content = (
    <>
      {poster && (
        <img
          src={poster}
          alt={title ?? ""}
          loading="lazy"
          className="w-full aspect-[2/3] object-cover rounded-sm bg-theme-300/40 dark:bg-theme-900/40"
        />
      )}
      <div className="mt-1 leading-tight">
        <div className="font-medium whitespace-nowrap overflow-hidden text-ellipsis" title={title}>
          {title}
        </div>
        {subtitle && (
          <div className="opacity-70 whitespace-nowrap overflow-hidden text-ellipsis" title={subtitle}>
            {subtitle}
          </div>
        )}
        {rating && <div className="opacity-80">{rating}</div>}
      </div>
    </>
  );

  return link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className="block w-20 shrink-0 text-[11px]">
      {content}
    </a>
  ) : (
    <div className="w-20 shrink-0 text-[11px]">{content}</div>
  );
}

function ItemStrip({ href, items }) {
  const { t } = useTranslation();
  if (!items.length) return <div className="px-2 py-1 opacity-70">{t("jellyfin.no_items")}</div>;
  return (
    <div className="flex gap-2 overflow-x-auto px-2 py-2">
      {items.map((item) => (
        <ItemCard key={item.Id} href={href} item={item} />
      ))}
    </div>
  );
}

function Accordion({ summary, open, children }) {
  return (
    <details className={ROW} open={open || undefined}>
      <summary className="cursor-pointer px-2 py-1 select-none">{summary}</summary>
      {children}
    </details>
  );
}

function LatestInLibrary({ widget, href, userId, view, count, open }) {
  const libraryLink = libraryUrl(href, view);
  const { data } = useWidgetAPI(widget, "Latest", { userId, parentId: view.Id, limit: count });
  const items = Array.isArray(data) ? data.slice(0, count) : null;

  return (
    <Accordion
      open={open}
      summary={
        libraryLink ? (
          <a href={libraryLink} target="_blank" rel="noopener noreferrer" onClick={(e) => e.stopPropagation()}>
            {view.Name}
          </a>
        ) : (
          view.Name
        )
      }
    >
      {items && <ItemStrip href={href} items={items} />}
    </Accordion>
  );
}

export default function LibrarySections({ service }) {
  const { t } = useTranslation();
  const { widget, href } = service;
  const { showLibraries, showContinueWatching, showLatest } = widget;
  const enableUserSwitch = widget.enableUserSwitch !== false;
  const open = !!widget.expandSections;
  const latestCount = clampCount(widget.latestCount);
  const continueCount = clampCount(widget.continueCount);
  const storageKey = `jellyfin-user:${widget.service_group}/${widget.service_name}`;

  // Read on the client only; the user is not known before the user list has loaded, so no hydration mismatch.
  const [storedId, setStoredId] = useState(() => {
    try {
      return typeof localStorage === "undefined" ? undefined : (localStorage.getItem(storageKey) ?? undefined);
    } catch {
      return undefined; // storage unavailable (private mode): keep the default user
    }
  });

  const { data: usersData, error: usersError } = useWidgetAPI(
    widget,
    showLibraries || showContinueWatching || showLatest ? "Users" : "",
  );
  const users = Array.isArray(usersData) ? usersData : undefined;
  const user = pickUser(users, storedId, widget.user);
  const userId = user?.Id;

  const { data: viewsData } = useWidgetAPI(widget, userId && (showLibraries || showLatest) ? "Views" : "", { userId });
  const { data: resumeData } = useWidgetAPI(widget, userId && showContinueWatching ? "Resume" : "", {
    userId,
    limit: continueCount,
    includeItemTypes: "Episode",
  });

  if (!showLibraries && !showContinueWatching && !showLatest) return null;

  if (!user) {
    return usersError || usersData?.error ? (
      <div className={`${ROW} px-2 py-1 mx-1`}>{t("jellyfin.users_unavailable")}</div>
    ) : null;
  }

  const views = Array.isArray(viewsData?.Items) ? viewsData.Items : [];
  const resume = Array.isArray(resumeData?.Items) ? resumeData.Items.slice(0, continueCount) : null;

  const changeUser = (event) => {
    const id = event.target.value;
    setStoredId(id);
    try {
      localStorage.setItem(storageKey, id);
    } catch {
      // storage unavailable: the choice just won't persist
    }
  };

  return (
    <div className="flex flex-col pb-1 mx-1">
      {enableUserSwitch && users.length > 1 && (
        <select
          aria-label={t("jellyfin.user")}
          value={userId}
          onChange={changeUser}
          className="self-end text-xs rounded-md bg-theme-200/50 dark:bg-theme-900/40 text-theme-700 dark:text-theme-200 px-1"
        >
          {users.map((u) => (
            <option key={u.Id} value={u.Id}>
              {u.Name}
            </option>
          ))}
        </select>
      )}

      {showLibraries && views.length > 0 && (
        <div className={`${ROW} px-2 py-1 flex flex-wrap gap-x-3 gap-y-1`}>
          <span className="opacity-70">{t("jellyfin.libraries")}:</span>
          {views.map((view) => {
            const link = libraryUrl(href, view);
            return link ? (
              <a key={view.Id} href={link} target="_blank" rel="noopener noreferrer" className="underline">
                {view.Name}
              </a>
            ) : (
              <span key={view.Id}>{view.Name}</span>
            );
          })}
        </div>
      )}

      {showContinueWatching && (
        <Accordion summary={t("jellyfin.continue_watching")} open={open}>
          {resume && <ItemStrip href={href} items={resume} />}
        </Accordion>
      )}

      {showLatest && views.length > 0 && (
        <>
          <div className="text-xs opacity-70 mt-1 px-1">{t("jellyfin.recently_added")}</div>
          {views.map((view) => (
            <LatestInLibrary
              key={view.Id}
              widget={widget}
              href={href}
              userId={userId}
              view={view}
              count={latestCount}
              open={open}
            />
          ))}
        </>
      )}
    </div>
  );
}

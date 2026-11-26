/* eslint-disable @next/next/no-img-element */
import Block from "components/services/widget/block";
import Container from "components/services/widget/container";
import { useTranslation } from "next-i18next/pages";
import { useState } from "react";
import useSWR from "swr";

import { authorsText, bookUrl, clampCount, coverUrl, findShelf, indexingLine, statValue } from "./library-utils";

import { formatProxyUrl } from "utils/proxy/api-helpers";
import useWidgetAPI from "utils/proxy/use-widget-api";
import withWidgetFields from "utils/widget-fields";

const FIELDS = ["books", "authors", "series", "genres", "languages"];
const DEFAULT_FIELDS = ["books", "authors", "series", "genres"];
const ROW = "text-theme-700 dark:text-theme-200 text-xs rounded-md bg-theme-200/50 dark:bg-theme-900/20 mt-1";

// After an error (wrong login, library down) stop polling: the server rate-limits failed Basic logins.
const pollUnlessError = (data) => (data?.error ? 0 : 60000);
const SWR_CONFIG = { revalidateOnFocus: false, revalidateOnReconnect: false, shouldRetryOnError: false };

function BookRow({ book, href }) {
  const [coverFailed, setCoverFailed] = useState(false);
  const cover = coverFailed ? null : coverUrl(href, book.id);
  const link = bookUrl(href, book.id);
  const authors = authorsText(book);

  const content = (
    <>
      {cover && (
        <img
          src={cover}
          alt={book.title}
          loading="lazy"
          onError={() => setCoverFailed(true)}
          className="w-8 h-12 shrink-0 rounded-sm object-cover bg-theme-300/40 dark:bg-theme-900/40"
        />
      )}
      <div className="min-w-0 leading-tight">
        <div className="whitespace-nowrap overflow-hidden text-ellipsis font-medium" title={book.title}>
          {book.title}
        </div>
        {authors && <div className="whitespace-nowrap overflow-hidden text-ellipsis opacity-70">{authors}</div>}
      </div>
    </>
  );

  return link ? (
    <a href={link} target="_blank" rel="noopener noreferrer" className="flex gap-2 items-center px-2 py-1">
      {content}
    </a>
  ) : (
    <div className="flex gap-2 items-center px-2 py-1">{content}</div>
  );
}

function BookList({ summary, response, count, href, open }) {
  const { t } = useTranslation();
  const failed = Boolean(response?.error);
  const books = Array.isArray(response?.data) ? response.data : (response?.data?.items ?? null);

  return (
    <details className={ROW} open={open || undefined}>
      <summary className="cursor-pointer px-2 py-1 select-none">{summary}</summary>
      {failed && <div className="px-2 py-1 opacity-70">{t("inpxlibrary.auth_failed")}</div>}
      {!failed && books && books.length === 0 && (
        <div className="px-2 py-1 opacity-70">{t("inpxlibrary.no_items")}</div>
      )}
      {!failed && books?.slice(0, count).map((book) => <BookRow key={book.id} book={book} href={href} />)}
    </details>
  );
}

function PersonalList({ summary, endpoint, widget, count, href, open }) {
  const { data, error } = useWidgetAPI(
    widget,
    endpoint,
    { pageSize: count, refreshInterval: pollUnlessError },
    SWR_CONFIG,
  );
  return (
    <BookList
      summary={summary}
      response={{ data, error: error ?? data?.error }}
      count={count}
      href={href}
      open={open}
    />
  );
}

function ShelfList({ widget, shelfName, count, href, open }) {
  const { t } = useTranslation();
  const { data: shelves, error: shelvesError } = useWidgetAPI(
    widget,
    "Shelves",
    { refreshInterval: pollUnlessError },
    SWR_CONFIG,
  );
  const shelf = findShelf(shelves, shelfName);
  const booksUrl = shelf
    ? `${formatProxyUrl(widget, "ShelfBooks")}&segments=${encodeURIComponent(JSON.stringify({ shelfId: String(shelf.id) }))}`
    : null;
  const { data: books, error: booksError } = useSWR(booksUrl, { ...SWR_CONFIG, refreshInterval: pollUnlessError });

  const failed = shelvesError ?? shelves?.error ?? booksError ?? books?.error;
  if (!failed && shelves && !shelf) {
    return <div className={`${ROW} px-2 py-1`}>{t("inpxlibrary.shelf_not_found")}</div>;
  }
  return (
    <BookList
      summary={`${t("inpxlibrary.shelf")}: ${shelf?.name ?? shelfName}`}
      response={{ data: books, error: failed }}
      count={count}
      href={href}
      open={open}
    />
  );
}

export default function Component({ service: configuredService }) {
  const { t } = useTranslation();
  const service = withWidgetFields(configuredService, DEFAULT_FIELDS, 5);
  const { widget, href } = service;
  const fields = widget.fields.filter((field) => FIELDS.includes(field));
  const count = clampCount(widget.count);
  const open = Boolean(widget.expandSections);

  const { data: status, error: statusError } = useWidgetAPI(widget, "IndexStatus", { refreshInterval: 30000 });
  const line = widget.showIndexing === false ? null : indexingLine(status);

  return (
    <>
      {statusError ? (
        <Container service={service} error={statusError} />
      ) : (
        <Container service={{ ...service, widget: { ...widget, fields } }}>
          {fields.map((field) => {
            const value = statValue(status?.stats, field);
            return (
              <Block
                key={field}
                label={`inpxlibrary.${field}`}
                value={value === undefined ? undefined : t("common.number", { value })}
              />
            );
          })}
        </Container>
      )}

      {line && (
        <div className={`${ROW} px-2 py-1 mx-1`}>
          {line.kind === "indexing"
            ? `${t("inpxlibrary.indexing")} ${line.done} / ${line.total}`
            : `${t("inpxlibrary.updated")} ${t("common.date", { value: line.at })}`}
        </div>
      )}

      <div className="flex flex-col pb-1 mx-1">
        {widget.showReading && (
          <PersonalList
            summary={t("inpxlibrary.reading")}
            endpoint="Reading"
            widget={widget}
            count={count}
            href={href}
            open={open}
          />
        )}
        {widget.showWant && (
          <PersonalList
            summary={t("inpxlibrary.want")}
            endpoint="Want"
            widget={widget}
            count={count}
            href={href}
            open={open}
          />
        )}
        {widget.shelf && <ShelfList widget={widget} shelfName={widget.shelf} count={count} href={href} open={open} />}
      </div>
    </>
  );
}

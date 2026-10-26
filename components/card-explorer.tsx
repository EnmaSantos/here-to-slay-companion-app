"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { LoaderCircle, Search, SlidersHorizontal } from "lucide-react";
import {
  HERE_TO_SLAY_API,
  type Card,
  type CardMetadata,
  type Pagination,
} from "@/lib/here-to-slay-api";
import { formatClassName } from "@/lib/game-engine";

type CardExplorerProps = {
  initialCards: Card[];
  initialPagination: Pagination;
  metadata: CardMetadata;
};

async function fetchCards(filters: {
  search: string;
  type: string;
  className: string;
  setName: string;
  offset: number;
}) {
  const parameters = new URLSearchParams({
    limit: "24",
    offset: String(filters.offset),
  });

  if (filters.search.trim()) parameters.set("search", filters.search.trim());
  if (filters.type) parameters.set("type", filters.type);
  if (filters.className) parameters.set("class", filters.className);
  if (filters.setName) parameters.set("set", filters.setName);

  const response = await fetch(
    `${HERE_TO_SLAY_API}/api/v1/cards?${parameters.toString()}`,
  );
  const body = await response.json() as { data: Card[]; pagination: Pagination; error?: { message?: string } };

  if (!response.ok) {
    throw new Error(body.error?.message ?? "The card catalog could not be loaded.");
  }

  return body as { data: Card[]; pagination: Pagination };
}

export function CardExplorer({
  initialCards,
  initialPagination,
  metadata,
}: CardExplorerProps) {
  const [cards, setCards] = useState(initialCards);
  const [pagination, setPagination] = useState(initialPagination);
  const [search, setSearch] = useState("");
  const [type, setType] = useState("");
  const [className, setClassName] = useState("");
  const [setName, setSetName] = useState("");
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const firstRender = useRef(true);

  useEffect(() => {
    if (firstRender.current) {
      firstRender.current = false;
      return;
    }

    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const result = await fetchCards({
          search,
          type,
          className,
          setName,
          offset: 0,
        });
        setCards(result.data);
        setPagination(result.pagination);
      } catch (requestError) {
        setError(
          requestError instanceof Error
            ? requestError.message
            : "The card catalog could not be loaded.",
        );
      } finally {
        setLoading(false);
      }
    }, 350);

    return () => window.clearTimeout(timeout);
  }, [search, type, className, setName]);

  async function loadMore() {
    setLoadingMore(true);
    setError(null);
    try {
      const result = await fetchCards({
        search,
        type,
        className,
        setName,
        offset: cards.length,
      });
      setCards((current) => [...current, ...result.data]);
      setPagination(result.pagination);
    } catch (requestError) {
      setError(
        requestError instanceof Error
          ? requestError.message
          : "More cards could not be loaded.",
      );
    } finally {
      setLoadingMore(false);
    }
  }

  return (
    <>
      <section className="catalog-controls" aria-label="Card filters">
        <label className="search-field">
          <Search size={21} aria-hidden="true" />
          <span className="sr-only">Search cards</span>
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search names, effects, or rules…"
          />
          {loading && <LoaderCircle className="spin" size={20} aria-label="Searching" />}
        </label>
        <div className="filter-row">
          <span className="filter-label">
            <SlidersHorizontal size={17} /> Filters
          </span>
          <label>
            <span className="sr-only">Card type</span>
            <select value={type} onChange={(event) => setType(event.target.value)}>
              <option value="">All types</option>
              {metadata.filters.types.map((option) => (
                <option value={option} key={option}>
                  {formatClassName(option)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Hero class</span>
            <select
              value={className}
              onChange={(event) => setClassName(event.target.value)}
            >
              <option value="">All classes</option>
              {metadata.filters.classes.map((option) => (
                <option value={option} key={option}>
                  {formatClassName(option)}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span className="sr-only">Release set</span>
            <select
              value={setName}
              onChange={(event) => setSetName(event.target.value)}
            >
              <option value="">All sets</option>
              {metadata.filters.sets.map((option) => (
                <option value={option} key={option}>
                  {formatClassName(option)}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      <div className="catalog-summary" aria-live="polite">
        <p>
          <strong>{pagination.total}</strong> cards found
        </p>
        <p>Updated {new Date(metadata.generatedAt).toLocaleDateString()}</p>
      </div>

      {error && <div className="inline-error">{error}</div>}

      <section className={`card-grid ${loading ? "is-loading" : ""}`}>
        {cards.map((card) => (
          <Link href={`/cards/${card.slug}`} className="reference-card" key={card.id}>
            <div className="card-art">
              {card.imageUrl ? (
                // Source-hosted card art; the API guide notes that URLs may change.
                // eslint-disable-next-line @next/next/no-img-element
                <img src={card.imageUrl} alt="" loading="lazy" />
              ) : (
                <span>{card.name.slice(0, 1)}</span>
              )}
              {card.rollRequirement && (
                <span className="roll-badge">Roll {card.rollRequirement}</span>
              )}
            </div>
            <div className="reference-card-body">
              <div className="tag-row">
                <span className={`type-tag type-${card.type}`}>{formatClassName(card.type)}</span>
                {card.classes[0] && <span>{formatClassName(card.classes[0])}</span>}
              </div>
              <h2>{card.name}</h2>
              <p>{card.effect ?? "Reference details available on the card page."}</p>
              <span className="card-set">{formatClassName(card.set)}</span>
            </div>
          </Link>
        ))}
      </section>

      {!loading && cards.length === 0 && (
        <div className="empty-state">
          <span>0</span>
          <h2>No cards match that quest.</h2>
          <p>Try removing a filter or using a broader search.</p>
        </div>
      )}

      {pagination.hasMore && (
        <div className="load-more-wrap">
          <button className="button button-secondary" onClick={loadMore} disabled={loadingMore}>
            {loadingMore ? <LoaderCircle className="spin" size={19} /> : null}
            {loadingMore ? "Loading cards…" : "Load more cards"}
          </button>
        </div>
      )}
    </>
  );
}

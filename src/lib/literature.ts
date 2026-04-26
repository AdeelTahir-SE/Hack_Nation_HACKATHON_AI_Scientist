import type { LiteratureReference, NoveltySignal } from "@/types/plan";

type LiteratureResult = {
  novelty: NoveltySignal;
  references: LiteratureReference[];
  protocols: ProtocolReference[];
};

export type ProtocolReference = {
  title: string;
  source: string;
  url: string;
  type: "protocol";
};

/* ─── Helpers ────────────────────────────────────────────────── */

function pickQuery(text: string): string {
  return text.split(/\s+/).slice(0, 12).join(" ").trim();
}

function clean(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

/* ─── Stopwords / keyword extraction ────────────────────────── */

const STOPWORDS = new Set([
  "with", "that", "this", "from", "have", "will", "been", "were", "they",
  "their", "than", "more", "also", "into", "when", "which", "such", "over",
  "after", "study", "using", "based", "among", "both", "used", "show",
  "shown", "high", "level", "levels", "effect", "effects", "role", "result",
  "results", "data", "analysis", "method", "methods", "patient", "patients",
  "improve", "increase", "decrease", "testing", "alternative", "instead",
  "morning", "better", "good", "make", "does", "would", "could", "should",
]);

function keywordsOf(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length > 3 && !STOPWORDS.has(t));
}

function relevanceScore(hypothesis: string, titleOrDesc: string): number {
  const hypoTokens = new Set(keywordsOf(hypothesis));
  const titleTokens = keywordsOf(titleOrDesc);
  return titleTokens.filter((t) => hypoTokens.has(t)).length;
}

/* ─── Academic literature fetchers ──────────────────────────── */

function parseArxivEntries(xml: string): LiteratureReference[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];
  return entries.slice(0, 3).map((entry) => ({
    title: clean(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "Untitled arXiv preprint"),
    source: "arXiv",
    year: entry.match(/<published>(\d{4})-/)?.[1]
      ? Number(entry.match(/<published>(\d{4})-/)![1])
      : undefined,
    url: clean(entry.match(/<id>([\s\S]*?)<\/id>/)?.[1] || "https://arxiv.org"),
  }));
}

async function fetchArxiv(query: string): Promise<LiteratureReference[]> {
  try {
    const url = `https://export.arxiv.org/api/query?search_query=all:${encodeURIComponent(query)}&start=0&max_results=3`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    return parseArxivEntries(await res.text());
  } catch { return []; }
}

async function fetchOpenAlex(query: string): Promise<LiteratureReference[]> {
  try {
    const url = `https://api.openalex.org/works?search=${encodeURIComponent(query)}&per-page=3&sort=relevance_score:desc`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{
        title?: string;
        publication_year?: number;
        primary_location?: { landing_page_url?: string };
        id?: string;
      }>;
    };
    return (json.results || []).map((item) => ({
      title: clean(item.title || "Untitled OpenAlex work"),
      source: "OpenAlex",
      year: item.publication_year,
      url: item.primary_location?.landing_page_url || item.id || "https://openalex.org",
    }));
  } catch { return []; }
}

async function fetchCrossref(query: string): Promise<LiteratureReference[]> {
  try {
    const url = `https://api.crossref.org/works?query=${encodeURIComponent(query)}&rows=3&sort=relevance`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      message?: {
        items?: Array<{
          title?: string[];
          DOI?: string;
          issued?: { "date-parts"?: number[][] };
        }>;
      };
    };
    return (json.message?.items || []).map((item) => ({
      title: clean(item.title?.[0] || "Untitled Crossref record"),
      source: "Crossref",
      year: item.issued?.["date-parts"]?.[0]?.[0],
      url: item.DOI ? `https://doi.org/${item.DOI}` : "https://www.crossref.org",
    }));
  } catch { return []; }
}

/* ─── Protocol repository fetchers ──────────────────────────── */

/**
 * protocols.io public search API (no auth needed for read-only search).
 * Docs: https://www.protocols.io/developers
 */
async function fetchProtocolsIO(query: string): Promise<ProtocolReference[]> {
  try {
    const url = `https://www.protocols.io/api/v3/protocols?key=${encodeURIComponent(query)}&filter=public&order_field=relevance&order_dir=desc&page_size=3`;
    const res = await fetch(url, {
      headers: { "Content-Type": "application/json" },
      next: { revalidate: 3600 },
    });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      items?: Array<{ title?: string; uri?: string; alias?: string }>;
    };
    return (json.items || []).map((p) => ({
      title: clean(p.title || "Protocol"),
      source: "protocols.io",
      url: p.uri
        ? `https://www.protocols.io/view/${p.uri}`
        : `https://www.protocols.io/view/${p.alias || ""}`,
      type: "protocol" as const,
    }));
  } catch { return []; }
}

/**
 * OpenWetWare is a MediaWiki — use the standard MediaWiki search API.
 */
async function fetchOpenWetWare(query: string): Promise<ProtocolReference[]> {
  try {
    const url =
      `https://openwetware.org/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srnamespace=0&srlimit=3&format=json&origin=*`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      query?: { search?: Array<{ title?: string; pageid?: number }> };
    };
    return (json.query?.search || []).map((item) => ({
      title: clean(item.title || "OpenWetWare Protocol"),
      source: "OpenWetWare",
      url: `https://openwetware.org/wiki/${encodeURIComponent((item.title || "").replace(/ /g, "_"))}`,
      type: "protocol" as const,
    }));
  } catch { return []; }
}

/**
 * Bio-protocol doesn't have a public API but its papers are indexed in OpenAlex
 * under source display_name "Bio-protocol". We query OpenAlex with a source filter.
 */
async function fetchBioProtocol(query: string): Promise<ProtocolReference[]> {
  try {
    const url =
      `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=locations.source.display_name:Bio-protocol&per-page=2`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{
        title?: string;
        primary_location?: { landing_page_url?: string };
        id?: string;
      }>;
    };
    return (json.results || []).map((item) => ({
      title: clean(item.title || "Bio-protocol article"),
      source: "Bio-protocol",
      url: item.primary_location?.landing_page_url || item.id || "https://bio-protocol.org",
      type: "protocol" as const,
    }));
  } catch { return []; }
}

/**
 * Nature Protocols — indexed in OpenAlex under source display_name "Nature Protocols"
 */
async function fetchNatureProtocols(query: string): Promise<ProtocolReference[]> {
  try {
    const url =
      `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=locations.source.display_name:Nature%20Protocols&per-page=2&sort=relevance_score:desc`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{
        title?: string;
        primary_location?: { landing_page_url?: string };
        id?: string;
      }>;
    };
    return (json.results || []).map((item) => ({
      title: clean(item.title || "Nature Protocols article"),
      source: "Nature Protocols",
      url: item.primary_location?.landing_page_url || item.id || "https://nature.com/nprot",
      type: "protocol" as const,
    }));
  } catch { return []; }
}

/**
 * JOVE (Journal of Visualized Experiments) — indexed in OpenAlex
 */
async function fetchJOVE(query: string): Promise<ProtocolReference[]> {
  try {
    const url =
      `https://api.openalex.org/works?search=${encodeURIComponent(query)}&filter=locations.source.display_name:JoVE%20Journal&per-page=2&sort=relevance_score:desc`;
    const res = await fetch(url, { next: { revalidate: 3600 } });
    if (!res.ok) return [];
    const json = (await res.json()) as {
      results?: Array<{
        title?: string;
        primary_location?: { landing_page_url?: string };
        id?: string;
      }>;
    };
    return (json.results || []).map((item) => ({
      title: clean(item.title || "JoVE protocol"),
      source: "JOVE",
      url: item.primary_location?.landing_page_url || item.id || "https://jove.com",
      type: "protocol" as const,
    }));
  } catch { return []; }
}

/* ─── Novelty assessment ─────────────────────────────────────── */

function assessNovelty(hypothesis: string, references: LiteratureReference[]): NoveltySignal {
  if (!references.length) return "not_found";
  const maxOverlap = references.reduce(
    (best, ref) => Math.max(best, relevanceScore(hypothesis, ref.title)),
    0,
  );
  if (maxOverlap >= 7) return "exact";
  if (maxOverlap >= 3) return "similar";
  return "not_found";
}

/* ─── Main export ────────────────────────────────────────────── */

export async function searchLiterature(hypothesis: string): Promise<LiteratureResult> {
  const query = pickQuery(hypothesis);

  // Fire all sources in parallel
  const [arxiv, openalex, crossref, protocolsIO, openWetWare, bioProtocol, natureProtocols, jove] =
    await Promise.allSettled([
      fetchArxiv(query),
      fetchOpenAlex(query),
      fetchCrossref(query),
      fetchProtocolsIO(query),
      fetchOpenWetWare(query),
      fetchBioProtocol(query),
      fetchNatureProtocols(query),
      fetchJOVE(query),
    ]);

  // Collect and deduplicate academic references
  const rawRefs = [arxiv, openalex, crossref]
    .filter((r): r is PromiseFulfilledResult<LiteratureReference[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  const dedupedRefs = Array.from(
    new Map(rawRefs.map((item) => [item.title.toLowerCase(), item])).values(),
  );

  // Filter by relevance (≥1 shared meaningful keyword), then rank by score desc
  const MIN_RELEVANCE = 1;
  const relevantRefs = dedupedRefs
    .map((ref) => ({ ref, score: relevanceScore(hypothesis, ref.title) }))
    .filter(({ score }) => score >= MIN_RELEVANCE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ ref }) => ref);

  // Collect and deduplicate protocols from all 5 protocol sources
  const rawProtocols = [protocolsIO, openWetWare, bioProtocol, natureProtocols, jove]
    .filter((r): r is PromiseFulfilledResult<ProtocolReference[]> => r.status === "fulfilled")
    .flatMap((r) => r.value);

  const dedupedProtocols = Array.from(
    new Map(rawProtocols.map((p) => [p.title.toLowerCase(), p])).values(),
  );

  const relevantProtocols = dedupedProtocols
    .map((p) => ({ p, score: relevanceScore(hypothesis, p.title) }))
    .filter(({ score }) => score >= MIN_RELEVANCE)
    .sort((a, b) => b.score - a.score)
    .slice(0, 4)
    .map(({ p }) => p);

  return {
    novelty: assessNovelty(hypothesis, relevantRefs),
    references: relevantRefs,
    protocols: relevantProtocols,
  };
}


import type { LiteratureReference, NoveltySignal } from "@/types/plan";

type LiteratureResult = {
  novelty: NoveltySignal;
  references: LiteratureReference[];
};

function pickQuery(text: string): string {
  return text
    .split(/\s+/)
    .slice(0, 14)
    .join(" ")
    .trim();
}

function clean(input: string): string {
  return input.replace(/\s+/g, " ").trim();
}

function parseArxivEntries(xml: string): LiteratureReference[] {
  const entries = xml.match(/<entry>[\s\S]*?<\/entry>/g) || [];

  return entries.slice(0, 2).map((entry) => {
    const title = clean(entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] || "Untitled arXiv preprint");
    const url = clean(entry.match(/<id>([\s\S]*?)<\/id>/)?.[1] || "https://arxiv.org");
    const published = entry.match(/<published>(\d{4})-/)?.[1];

    return {
      title,
      source: "arXiv",
      year: published ? Number(published) : undefined,
      url,
    };
  });
}

async function fetchArxiv(query: string): Promise<LiteratureReference[]> {
  const base = process.env.ARXIV_BASE_URL || "https://export.arxiv.org/api/query";
  const url = `${base}?search_query=all:${encodeURIComponent(query)}&start=0&max_results=2`;

  const res = await fetch(url, { next: { revalidate: 3600 } });
  if (!res.ok) return [];

  const xml = await res.text();
  return parseArxivEntries(xml);
}

async function fetchOpenAlex(query: string): Promise<LiteratureReference[]> {
  const base = process.env.OPENALEX_BASE_URL || "https://api.openalex.org";
  const url = `${base}/works?search=${encodeURIComponent(query)}&per-page=2`;
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
}

async function fetchCrossref(query: string): Promise<LiteratureReference[]> {
  const base = process.env.CROSSREF_BASE_URL || "https://api.crossref.org";
  const url = `${base}/works?query=${encodeURIComponent(query)}&rows=2`;
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
}

function assessNovelty(hypothesis: string, references: LiteratureReference[]): NoveltySignal {
  if (!references.length) return "not_found";

  const normalized = clean(hypothesis).toLowerCase();
  const maxOverlap = references.reduce((best, ref) => {
    const title = ref.title.toLowerCase();
    const overlap = title
      .split(" ")
      .filter((token) => token.length > 3)
      .filter((token) => normalized.includes(token)).length;
    return Math.max(best, overlap);
  }, 0);

  if (maxOverlap >= 7) return "exact";
  if (maxOverlap >= 3) return "similar";
  return "not_found";
}

export async function searchLiterature(hypothesis: string): Promise<LiteratureResult> {
  const query = pickQuery(hypothesis);

  const [arxiv, openalex, crossref] = await Promise.allSettled([
    fetchArxiv(query),
    fetchOpenAlex(query),
    fetchCrossref(query),
  ]);

  const combined = [arxiv, openalex, crossref]
    .filter((result): result is PromiseFulfilledResult<LiteratureReference[]> => result.status === "fulfilled")
    .flatMap((result) => result.value);

  const deduped = Array.from(new Map(combined.map((item) => [item.title.toLowerCase(), item])).values())
    .slice(0, 3);

  return {
    novelty: assessNovelty(hypothesis, deduped),
    references: deduped,
  };
}

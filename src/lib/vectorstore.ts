type VectorMetadata = {
  source?: string;
  title?: string;
  domain?: string;
};

type VectorDocument = {
  id: string;
  text: string;
  metadata?: VectorMetadata;
  embedding: number[];
};

type InsertDocument = {
  id: string;
  text: string;
  metadata?: VectorMetadata;
};

type SearchResult = {
  id: string;
  text: string;
  metadata?: VectorMetadata;
  score: number;
};

const DIMENSION = 256;

function memoryStore(): VectorDocument[] {
  const globalWithStore = globalThis as typeof globalThis & {
    __aiScientistVectorStore?: VectorDocument[];
  };

  if (!globalWithStore.__aiScientistVectorStore) {
    globalWithStore.__aiScientistVectorStore = [];
  }

  return globalWithStore.__aiScientistVectorStore;
}

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((token) => token.length > 1);
}

function hashToken(token: string): number {
  let hash = 0;
  for (let i = 0; i < token.length; i += 1) {
    hash = (hash * 31 + token.charCodeAt(i)) % 2147483647;
  }
  return hash;
}

function buildEmbedding(text: string): number[] {
  const vector = new Array<number>(DIMENSION).fill(0);
  const tokens = tokenize(text);

  for (const token of tokens) {
    const index = hashToken(token) % DIMENSION;
    vector[index] += 1;
  }

  const norm = Math.sqrt(vector.reduce((sum, value) => sum + value * value, 0));
  if (norm === 0) return vector;

  return vector.map((value) => value / norm);
}

function cosine(a: number[], b: number[]): number {
  let score = 0;
  for (let i = 0; i < DIMENSION; i += 1) {
    score += (a[i] || 0) * (b[i] || 0);
  }
  return score;
}

export function upsertDocuments(documents: InsertDocument[]): number {
  const store = memoryStore();
  const byId = new Map(store.map((doc) => [doc.id, doc]));

  for (const doc of documents) {
    byId.set(doc.id, {
      id: doc.id,
      text: doc.text,
      metadata: doc.metadata,
      embedding: buildEmbedding(doc.text),
    });
  }

  const merged = Array.from(byId.values());
  store.length = 0;
  store.push(...merged);

  return documents.length;
}

export function searchSimilar(query: string, topK = 4): SearchResult[] {
  const queryEmbedding = buildEmbedding(query);
  const store = memoryStore();

  return store
    .map((doc) => ({
      id: doc.id,
      text: doc.text,
      metadata: doc.metadata,
      score: cosine(queryEmbedding, doc.embedding),
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);
}

export function vectorStoreSize(): number {
  return memoryStore().length;
}

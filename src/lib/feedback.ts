import type { ReviewPayload } from "@/types/plan";

type StoredReview = ReviewPayload & {
  createdAt: string;
};

function reviewStore(): StoredReview[] {
  const globalWithStore = globalThis as typeof globalThis & {
    __aiScientistReviews?: StoredReview[];
  };

  if (!globalWithStore.__aiScientistReviews) {
    globalWithStore.__aiScientistReviews = [];
  }

  return globalWithStore.__aiScientistReviews;
}

export function saveReview(review: ReviewPayload): StoredReview {
  const item: StoredReview = {
    ...review,
    createdAt: new Date().toISOString(),
  };

  const store = reviewStore();
  store.push(item);
  return item;
}

export function getReviewExamples(hypothesis: string, limit = 3): string[] {
  const normalized = hypothesis.toLowerCase();
  return reviewStore()
    .filter((review) =>
      review.hypothesis.toLowerCase().split(" ").some((token) => normalized.includes(token)),
    )
    .slice(-limit)
    .map(
      (review) =>
        `Review score ${review.score}/5: ${review.comments || "No comments provided."}`,
    );
}

export type NoveltySignal = "not_found" | "similar" | "exact";

export type LiteratureReference = {
  title: string;
  source: string;
  year?: number;
  url: string;
};

export type PlanMaterial = {
  item: string;
  catalog: string;
  supplier: string;
  estimatedCostUSD: number;
};

export type PlanBudgetLine = {
  category: string;
  amountUSD: number;
  notes: string;
};

export type PlanTimelinePhase = {
  phase: string;
  duration: string;
  dependencies: string[];
};

export type ExperimentPlan = {
  hypothesis: string;
  novelty: NoveltySignal;
  references: LiteratureReference[];
  retrievedEvidence: string[];
  protocol: string[];
  materials: PlanMaterial[];
  budget: PlanBudgetLine[];
  timeline: PlanTimelinePhase[];
  validation: string[];
};

export type ReviewPayload = {
  hypothesis: string;
  score: number;
  comments?: string;
};

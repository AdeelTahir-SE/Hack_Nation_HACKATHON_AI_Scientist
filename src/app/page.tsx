"use client";

import { useMemo, useState } from "react";
import type { LiteratureReference, NoveltySignal } from "@/types/plan";

type Reference = {
  title: string;
  source: string;
  year?: number;
  url: string;
};

type PlanMaterial = {
  item: string;
  catalog: string;
  supplier: string;
  estimatedCostUSD: number | null;
};

type PlanBudget = {
  category: string;
  amountUSD: number;
  notes: string;
};

type PlanTimeline = {
  phase: string;
  duration: string;
  dependencies: string[];
};

type PlanResponse = {
  hypothesis: string;
  novelty: "not_found" | "similar" | "exact";
  references: Reference[];
  retrievedEvidence: string[];
  protocol: string[];
  materials: PlanMaterial[];
  budget: PlanBudget[];
  timeline: PlanTimeline[];
  validation: string[];
};

const SAMPLE =
  "Replacing sucrose with trehalose as a cryoprotectant will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to standard DMSO protocol.";

const generationSteps = [
  "Now fetching papers...",
  "Now retrieving evidence...",
  "Now generating report...",
  "Finalizing output...",
];

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  }).format(value);
}

export default function Home() {
  const [hypothesis, setHypothesis] = useState(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);

  const [reviewScore, setReviewScore] = useState(4);
  const [reviewText, setReviewText] = useState("");
  const [reviewStatus, setReviewStatus] = useState<string | null>(null);
  const [currentStep, setCurrentStep] = useState<number | null>(null);

  const noveltyLabel = useMemo(() => {
    if (!plan) return "";
    if (plan.novelty === "exact") return "Exact match found";
    if (plan.novelty === "similar") return "Similar prior work";
    return "Novel direction";
  }, [plan]);

  const priorWorkMessage = useMemo(() => {
    if (!plan) return "";
    if (plan.novelty === "exact") {
      return "This work appears to be already done with closely matching results. Reproduce or extend it with a meaningful variation.";
    }
    if (plan.novelty === "similar") {
      return "Related work already exists. Continue by improving controls, conditions, or outcome targets.";
    }
    return "No strong prior match found. Continue with the proposed experiment plan.";
  }, [plan]);

  async function generatePlan() {
    setError(null);
    setLoading(true);
    setReviewStatus(null);
    setCurrentStep(0);

    try {
      const literatureRes = await fetch("/api/literature-qc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hypothesis }),
      });

      if (!literatureRes.ok) {
        const payload = (await literatureRes.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to fetch papers");
      }

      const literature = (await literatureRes.json()) as {
        novelty: NoveltySignal;
        references: LiteratureReference[];
      };

      setCurrentStep(1);
      setCurrentStep(2);
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hypothesis, literature }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as {
          error?: string;
        };
        throw new Error(payload.error || "Failed to generate plan");
      }

      const payload = (await res.json()) as PlanResponse;
      setCurrentStep(3);
      setPlan(payload);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      setError(message);
    } finally {
      setCurrentStep(null);
      setLoading(false);
    }
  }

  async function submitReview() {
    if (!plan) return;
    setReviewStatus("Submitting review...");

    const res = await fetch("/api/submit-review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        hypothesis: plan.hypothesis,
        score: reviewScore,
        comments: reviewText,
      }),
    });

    if (res.ok) {
      setReviewStatus("Review saved. Future plans can use this feedback.");
      setReviewText("");
      return;
    }

    setReviewStatus("Could not save review. Please try again.");
  }

  return (
    <div className="page-shell">
      <main className="content-wrap">
        <header className="hero">
          <p className="eyebrow">Fulcrum Science x MIT Challenge</p>
          <h1>AI Scientist</h1>
          <p>
            Turn a natural-language hypothesis into an operational experiment
            plan with literature QC, retrieval grounding, and structured output.
          </p>
        </header>

        <section className="card">
          <h2>1. Hypothesis Input</h2>
          <textarea
            value={hypothesis}
            onChange={(event) => setHypothesis(event.target.value)}
            rows={5}
            className="input"
            placeholder="Describe a testable scientific hypothesis..."
          />
          <div className="actions">
            <button onClick={generatePlan} disabled={loading || !hypothesis.trim()}>
              {loading ? "Generating..." : "Generate Experiment Plan"}
            </button>
          </div>
          {loading && currentStep !== null ? (
            <div className="steps-loader" aria-live="polite">
              <p className="steps-title">{generationSteps[currentStep]}</p>
              <ul className="steps-list">
                {generationSteps.map((step, index) => {
                  const status =
                    index < currentStep ? "done" : index === currentStep ? "active" : "pending";

                  return (
                    <li key={step} className={`step-item step-${status}`}>
                      <span className="step-icon" aria-hidden="true">
                        {status === "done" ? "\u2713" : status === "active" ? "" : "\u2022"}
                      </span>
                      <span>{step}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          ) : null}
          {error ? <p className="error">{error}</p> : null}
        </section>

        {plan ? (
          <>
            <section className="card">
              <h2>2. Literature QC</h2>
              <p className="pill">{noveltyLabel}</p>
              <div className="status-box">
                <strong>Decision</strong>
                <p>{priorWorkMessage}</p>
              </div>
              <ul className="list">
                {plan.references.map((ref) => (
                  <li key={ref.url}>
                    <a href={ref.url} target="_blank" rel="noreferrer">
                      {ref.title}
                    </a>
                    <span>
                      {ref.source}
                      {ref.year ? `, ${ref.year}` : ""}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <h2>3. Retrieval Evidence</h2>
              <ul className="list">
                {plan.retrievedEvidence.map((chunk) => (
                  <li key={chunk}>
                    <span>{chunk}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <h2>4. Full Experiment Plan</h2>

              <h3>Protocol</h3>
              <ol className="ordered">
                {plan.protocol.map((step) => (
                  <li key={step}>{step}</li>
                ))}
              </ol>

              <h3>Materials</h3>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Item</th>
                      <th>Catalog</th>
                      <th>Supplier</th>
                      <th>Cost (USD)</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.materials.map((material) => (
                      <tr key={`${material.item}-${material.catalog}`}>
                        <td>{material.item}</td>
                        <td>{material.catalog}</td>
                        <td>{material.supplier}</td>
                        <td>
                          {typeof material.estimatedCostUSD === "number"
                            ? formatCurrency(material.estimatedCostUSD)
                            : "N/A"}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <h3>Budget</h3>
              <ul className="list">
                {plan.budget.map((line) => (
                  <li key={`${line.category}-${line.notes}`}>
                    <span>
                      <strong>{line.category}:</strong> {formatCurrency(line.amountUSD)}
                    </span>
                    <span>
                      <strong>Notes:</strong> {line.notes || "N/A"}
                    </span>
                  </li>
                ))}
              </ul>

              <h3>Timeline</h3>
              <ul className="list">
                {plan.timeline.map((phase) => (
                  <li key={phase.phase}>
                    <span>
                      <strong>{phase.phase}</strong> ({phase.duration})
                    </span>
                    <span>Depends on: {phase.dependencies.join(", ") || "None"}</span>
                  </li>
                ))}
              </ul>

              <h3>Validation</h3>
              <ul className="list">
                {plan.validation.map((item) => (
                  <li key={item}>
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
            </section>

            <section className="card">
              <h2>Scientist Review</h2>
              <div className="review-row">
                <label htmlFor="score">Score (1 to 5)</label>
                <input
                  id="score"
                  type="number"
                  min={1}
                  max={5}
                  value={reviewScore}
                  onChange={(event) => setReviewScore(Number(event.target.value || 4))}
                />
              </div>
              <textarea
                value={reviewText}
                onChange={(event) => setReviewText(event.target.value)}
                rows={4}
                className="input"
                placeholder="What should be improved in protocol, materials, budget, or timeline?"
              />
              <div className="actions">
                <button onClick={submitReview}>Submit Review</button>
              </div>
              {reviewStatus ? <p>{reviewStatus}</p> : null}
            </section>
          </>
        ) : null}
      </main>
    </div>
  );
}

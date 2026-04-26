"use client";

import { useMemo, useState } from "react";
import type { LiteratureReference, NoveltySignal } from "@/types/plan";

/* ─── Types ─────────────────────────────────────────────────── */
type Reference = {
  title: string;
  source: string;
  year?: number;
  url: string;
};

type ProtocolRef = {
  title: string;
  source: string;
  url: string;
  type: "protocol";
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
  protocols: ProtocolRef[];
  retrievedEvidence: string[];
  protocol: string[];
  materials: PlanMaterial[];
  budget: PlanBudget[];
  timeline: PlanTimeline[];
  validation: string[];
};

type PlanTab = "protocol" | "materials" | "budget" | "timeline" | "validation";

/* ─── Constants ─────────────────────────────────────────────── */
const SAMPLE =
  "Replacing sucrose with trehalose as a cryoprotectant will increase post-thaw viability of HeLa cells by at least 15 percentage points compared to standard DMSO protocol.";

const EXAMPLES = [
  "Trehalose vs DMSO cryoprotectant in HeLa cells",
  "CRISPR-Cas9 knockout of TP53 in lung cancer",
  "Ketogenic diet reduces glioma proliferation in mice",
];

const GENERATION_STEPS = [
  { label: "Fetching literature", icon: "📚" },
  { label: "Retrieving evidence", icon: "🔍" },
  { label: "Generating experiment plan", icon: "🧪" },
  { label: "Finalizing output", icon: "✅" },
];

const PLAN_TABS: { key: PlanTab; label: string; icon: string }[] = [
  { key: "protocol", label: "Protocol", icon: "🔬" },
  { key: "materials", label: "Materials", icon: "🧫" },
  { key: "budget", label: "Budget", icon: "💰" },
  { key: "timeline", label: "Timeline", icon: "📅" },
  { key: "validation", label: "Validation", icon: "✓" },
];

/* ─── Helpers ────────────────────────────────────────────────── */
function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

function totalBudget(budget: PlanBudget[]): number {
  return budget.reduce((sum, b) => sum + b.amountUSD, 0);
}

/* ─── Icons ──────────────────────────────────────────────────── */
function FlaskIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M9 3h6M9 3v6l-4 8h14l-4-8V3"/>
    </svg>
  );
}

function ArrowRightIcon() {
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M5 12h14M12 5l7 7-7 7"/>
    </svg>
  );
}

function ExternalIcon() {
  return (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M18 13v6a2 2 0 01-2 2H5a2 2 0 01-2-2V8a2 2 0 012-2h6M15 3h6v6M10 14L21 3"/>
    </svg>
  );
}

function AlertIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
      <circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/>
    </svg>
  );
}

function CheckIcon() {
  return (
    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
      <polyline points="20 6 9 17 4 12"/>
    </svg>
  );
}

/* ─── Main Component ─────────────────────────────────────────── */
export default function Home() {
  const [hypothesis, setHypothesis] = useState(SAMPLE);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [plan, setPlan] = useState<PlanResponse | null>(null);
  const [activeTab, setActiveTab] = useState<PlanTab>("protocol");

  const [currentStep, setCurrentStep] = useState<number | null>(null);

  const noveltyMeta = useMemo(() => {
    if (!plan) return null;
    if (plan.novelty === "exact")
      return {
        label: "Exact Match Found",
        icon: "🔴",
        variant: "novelty-exact",
        message:
          "This work appears to be already done with closely matching results. Consider reproducing it with a meaningful variation or extending the scope.",
      };
    if (plan.novelty === "similar")
      return {
        label: "Similar Prior Work",
        icon: "🟡",
        variant: "novelty-similar",
        message:
          "Related work already exists. Strengthen your contribution by improving controls, experimental conditions, or outcome targets.",
      };
    return {
      label: "Novel Direction",
      icon: "🟢",
      variant: "novelty-novel",
      message:
        "No strong prior match found in the literature. Your hypothesis explores a genuinely new direction — proceed with the proposed experiment plan.",
    };
  }, [plan]);

  async function generatePlan() {
    setError(null);
    setLoading(true);
    setPlan(null);
    setCurrentStep(0);

    try {
      const literatureRes = await fetch("/api/literature-qc", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hypothesis }),
      });

      if (!literatureRes.ok) {
        const payload = (await literatureRes.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to fetch papers");
      }

      const literature = (await literatureRes.json()) as {
        novelty: NoveltySignal;
        references: LiteratureReference[];
        protocols: ProtocolRef[];
      };

      setCurrentStep(2);
      const res = await fetch("/api/generate-plan", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ hypothesis, literature }),
      });

      if (!res.ok) {
        const payload = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(payload.error || "Failed to generate plan");
      }

      const payload = (await res.json()) as PlanResponse;
      setCurrentStep(3);
      setPlan(payload);
      setActiveTab("protocol");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setCurrentStep(null);
      setLoading(false);
    }
  }



  return (
    <div className="page-shell">
      <div className="grid-bg" />

      {/* ── Navbar ── */}
      <nav className="navbar">
        <div className="nav-brand">
          <div className="nav-logo">AI</div>
          <span className="nav-title">AI Scientist</span>
        </div>
        <span className="nav-badge">Fulcrum × MIT</span>
      </nav>

      <main className="content-wrap" style={{ paddingTop: "5rem" }}>

        {/* ── Hero ── */}
        <header className="hero" style={{ paddingTop: "3rem" }}>
          <div className="hero-eyebrow">
            Retrieval-Grounded Experiment Planning
          </div>
          <h1>Turn Your Hypothesis<br />Into a Complete Experiment</h1>
          <p className="hero-subtitle">
            Enter a scientific question in plain language. Our AI searches real papers,
            evaluates novelty, retrieves evidence, and generates a structured experiment plan
            with protocol, materials, budget, and timeline.
          </p>
          {!plan && (
            <div className="hero-stats">
              <div className="hero-stat">
                <div className="hero-stat-value">4</div>
                <div className="hero-stat-label">Pipeline Steps</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">RAG</div>
                <div className="hero-stat-label">Grounded Retrieval</div>
              </div>
              <div className="hero-stat">
                <div className="hero-stat-value">LLM</div>
                <div className="hero-stat-label">Gemini-Powered</div>
              </div>
            </div>
          )}
        </header>

        {/* ── Step 1: Input ── */}
        <section className="card" id="hypothesis-input">
          <div className="section-label">
            <div className="section-num">1</div>
            <h2>Hypothesis Input</h2>
          </div>

          <div className="example-chips">
            <span className="example-label">Try:</span>
            {EXAMPLES.map((ex) => (
              <button
                key={ex}
                className="chip"
                onClick={() => setHypothesis(ex)}
                type="button"
              >
                {ex}
              </button>
            ))}
          </div>

          <div className="input-wrapper">
            <label className="input-label" htmlFor="hypothesis-textarea">
              Scientific Hypothesis
            </label>
            <textarea
              id="hypothesis-textarea"
              value={hypothesis}
              onChange={(e) => setHypothesis(e.target.value)}
              rows={5}
              className="input"
              placeholder="Describe a testable scientific hypothesis in plain language…"
              style={{ minHeight: "130px" }}
            />
            <div className="input-footer">
              <span className="char-count">{hypothesis.length} characters</span>
            </div>
          </div>

          <div className="actions">
            <button
              className="btn-primary"
              onClick={generatePlan}
              disabled={loading || !hypothesis.trim()}
              id="generate-btn"
            >
              <span><FlaskIcon /></span>
              <span>{loading ? "Generating…" : "Generate Experiment Plan"}</span>
              {!loading && <span><ArrowRightIcon /></span>}
            </button>
            {plan && (
              <button
                className="btn-secondary"
                onClick={() => { setPlan(null); setError(null); }}
              >
                ↺ Start over
              </button>
            )}
          </div>

          {/* Loading stepper */}
          {loading && currentStep !== null && (
            <div className="steps-loader" aria-live="polite">
              <div className="steps-header">
                <div className="steps-spinner" />
                <span className="steps-title">{GENERATION_STEPS[currentStep]?.label}…</span>
              </div>
              <ul className="steps-list">
                {GENERATION_STEPS.map((step, idx) => {
                  const status =
                    idx < currentStep ? "done" : idx === currentStep ? "active" : "pending";
                  return (
                    <li key={step.label} className={`step-item step-${status}`}>
                      <span className="step-icon" aria-hidden="true">
                        {status === "done" ? "✓" : status === "active" ? "" : "·"}
                      </span>
                      <span>{step.icon} {step.label}</span>
                    </li>
                  );
                })}
              </ul>
            </div>
          )}

          {error && (
            <div className="error-box">
              <AlertIcon />
              <span>{error}</span>
            </div>
          )}
        </section>

        {/* ── Results ── */}
        {plan && noveltyMeta && (
          <>
            {/* ── Step 2: Literature QC ── */}
            <section className="card card-accent" id="literature-qc">
              <div className="section-label">
                <div className="section-num">2</div>
                <h2>Literature QC</h2>
              </div>

              <div className={`novelty-banner ${noveltyMeta.variant}`}>
                <div className="novelty-icon">
                  <span style={{ fontSize: "1.4rem" }}>{noveltyMeta.icon}</span>
                </div>
                <div className="novelty-content">
                  <div className="novelty-pill">{noveltyMeta.label}</div>
                  <p className="novelty-message">{noveltyMeta.message}</p>
                </div>
              </div>

              {plan.references.length > 0 ? (
                <>
                  <div className="section-divider">
                    {plan.references.length} Related Reference{plan.references.length !== 1 ? "s" : ""}
                  </div>
                  <div className="ref-list" style={{ marginTop: "1rem" }}>
                    {plan.references.map((ref, i) => (
                      <a
                        key={ref.url}
                        href={ref.url}
                        target="_blank"
                        rel="noreferrer"
                        className="ref-item"
                      >
                        <div className="ref-num">{i + 1}</div>
                        <div className="ref-body">
                          <span className="ref-title">{ref.title}</span>
                          <div className="ref-meta">
                            <span>{ref.source}</span>
                            {ref.year && (
                              <>
                                <span style={{ color: "var(--border)" }}>·</span>
                                <span>{ref.year}</span>
                              </>
                            )}
                          </div>
                        </div>
                        <div className="ref-arrow"><ExternalIcon /></div>
                      </a>
                    ))}
                  </div>
                </>
              ) : (
                <div className="empty-refs">
                  <span style={{ fontSize: "1.5rem" }}>🔍</span>
                  <div>
                    <p className="empty-refs-title">No related research found</p>
                    <p className="empty-refs-sub">
                      We searched arXiv, OpenAlex, and Crossref but found no closely
                      matching papers. This may be an underexplored area — a good sign
                      for novelty.
                    </p>
                  </div>
                </div>
              )}
            </section>

            {/* ── Protocol Repositories ── */}
            {plan.protocols?.length > 0 && (
              <section className="card" id="protocol-repos">
                <div className="section-label">
                  <div className="section-num" style={{ background: "linear-gradient(135deg,#818cf8,#c084fc)" }}>P</div>
                  <h2>Matched Protocols</h2>
                </div>
                <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
                  Existing protocols from repositories that match your hypothesis — used to ground the generated plan.
                </p>
                <div className="ref-list">
                  {plan.protocols.map((p, i) => (
                    <a
                      key={p.url}
                      href={p.url}
                      target="_blank"
                      rel="noreferrer"
                      className="ref-item"
                    >
                      <div className="ref-num" style={{ background: "rgba(192,132,252,0.12)", borderColor: "rgba(192,132,252,0.3)", color: "#c084fc" }}>
                        {i + 1}
                      </div>
                      <div className="ref-body">
                        <span className="ref-title">{p.title}</span>
                        <div className="ref-meta">
                          <span className="proto-badge">{p.source}</span>
                        </div>
                      </div>
                      <div className="ref-arrow"><ExternalIcon /></div>
                    </a>
                  ))}
                </div>
              </section>
            )}
            {plan.retrievedEvidence.length > 0 && (
              <section className="card" id="retrieval-evidence">
                <div className="section-label">
                  <div className="section-num">3</div>
                  <h2>Retrieval Evidence</h2>
                </div>
                <p style={{ fontSize: "0.88rem", color: "var(--text-muted)", marginBottom: "1.25rem" }}>
                  Relevant passages retrieved from the knowledge base to ground the generated plan.
                </p>
                <div className="evidence-list">
                  {plan.retrievedEvidence.map((chunk, i) => (
                    <div key={i} className="evidence-item" style={{ animationDelay: `${i * 0.06}s` }}>
                      <span className="evidence-quote-icon">❝</span>
                      <p className="evidence-text">{chunk}</p>
                    </div>
                  ))}
                </div>
              </section>
            )}

            {/* ── Step 4: Full Experiment Plan ── */}
            <section className="card" id="experiment-plan">
              <div className="section-label">
                <div className="section-num">4</div>
                <h2>Full Experiment Plan</h2>
              </div>

              {/* Summary bar */}
              <div className="plan-summary-bar">
                <div className="summary-stat">
                  <div className="summary-stat-value">{plan.protocol.length}</div>
                  <div className="summary-stat-label">Protocol Steps</div>
                </div>
                <div className="summary-stat">
                  <div className="summary-stat-value">{plan.materials.length}</div>
                  <div className="summary-stat-label">Materials</div>
                </div>
                <div className="summary-stat">
                  <div className="summary-stat-value">
                    {formatCurrency(totalBudget(plan.budget))}
                  </div>
                  <div className="summary-stat-label">Total Budget</div>
                </div>
                <div className="summary-stat">
                  <div className="summary-stat-value">{plan.timeline.length}</div>
                  <div className="summary-stat-label">Timeline Phases</div>
                </div>
              </div>

              {/* Tabs */}
              <div className="plan-tabs" role="tablist">
                {PLAN_TABS.map((tab) => (
                  <button
                    key={tab.key}
                    role="tab"
                    aria-selected={activeTab === tab.key}
                    className={`plan-tab ${activeTab === tab.key ? "active" : ""}`}
                    onClick={() => setActiveTab(tab.key)}
                    id={`tab-${tab.key}`}
                  >
                    <span>{tab.icon}</span>
                    <span>{tab.label}</span>
                  </button>
                ))}
              </div>

              {/* Protocol */}
              {activeTab === "protocol" && (
                <div role="tabpanel" aria-labelledby="tab-protocol">
                  <ol className="protocol-list">
                    {plan.protocol.map((step, i) => (
                      <li
                        key={i}
                        className="protocol-item"
                        style={{ animationDelay: `${i * 0.05}s` }}
                      >
                        <div className="protocol-step-num">{i + 1}</div>
                        <p className="protocol-text">{step}</p>
                      </li>
                    ))}
                  </ol>
                </div>
              )}

              {/* Materials */}
              {activeTab === "materials" && (
                <div role="tabpanel" aria-labelledby="tab-materials">
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Item</th>
                          <th>Catalog #</th>
                          <th>Supplier</th>
                          <th>Est. Cost</th>
                        </tr>
                      </thead>
                      <tbody>
                        {plan.materials.map((m, i) => (
                          <tr key={`${m.item}-${i}`}>
                            <td style={{ color: "var(--text-primary)", fontWeight: 600 }}>{m.item}</td>
                            <td style={{ fontFamily: "'JetBrains Mono', monospace", fontSize: "0.85rem" }}>
                              {m.catalog || "—"}
                            </td>
                            <td>{m.supplier}</td>
                            <td className="cost-cell">
                              {typeof m.estimatedCostUSD === "number"
                                ? formatCurrency(m.estimatedCostUSD)
                                : "N/A"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* Budget */}
              {activeTab === "budget" && (
                <div role="tabpanel" aria-labelledby="tab-budget">
                  <div className="budget-grid">
                    {plan.budget.map((line, i) => (
                      <div key={`${line.category}-${i}`} className="budget-card">
                        <div className="budget-category">{line.category}</div>
                        <div className="budget-amount">{formatCurrency(line.amountUSD)}</div>
                        <div className="budget-notes">{line.notes || "—"}</div>
                      </div>
                    ))}
                  </div>
                  <div className="budget-total-row">
                    <span className="budget-total-label">Total Estimated Budget</span>
                    <span className="budget-total-value">{formatCurrency(totalBudget(plan.budget))}</span>
                  </div>
                </div>
              )}

              {/* Timeline */}
              {activeTab === "timeline" && (
                <div role="tabpanel" aria-labelledby="tab-timeline">
                  <div className="timeline-track">
                    {plan.timeline.map((phase, i) => (
                      <div key={phase.phase} className="timeline-item" style={{ animationDelay: `${i * 0.07}s` }}>
                        <div className="timeline-phase">{phase.phase}</div>
                        <div className="timeline-duration">⏱ {phase.duration}</div>
                        {phase.dependencies.length > 0 && (
                          <div>
                            <div className="timeline-deps">Depends on:</div>
                            <div className="timeline-deps-chips">
                              {phase.dependencies.map((dep) => (
                                <span key={dep} className="dep-chip">{dep}</span>
                              ))}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Validation */}
              {activeTab === "validation" && (
                <div role="tabpanel" aria-labelledby="tab-validation">
                  <div className="validation-list">
                    {plan.validation.map((item, i) => (
                      <div
                        key={i}
                        className="validation-item"
                        style={{ animationDelay: `${i * 0.05}s` }}
                      >
                        <div className="validation-check"><CheckIcon /></div>
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </section>

          </>
        )}
      </main>
    </div>
  );
}

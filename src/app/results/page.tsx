import Link from "next/link";

export default function ResultsPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 840, margin: "0 auto" }}>
      <h1>Results Workspace</h1>
      <p>
        Generate a plan from the home page and use this route for a dedicated
        future results explorer view.
      </p>
      <p>
        <Link href="/">Back to hypothesis input</Link>
      </p>
    </main>
  );
}

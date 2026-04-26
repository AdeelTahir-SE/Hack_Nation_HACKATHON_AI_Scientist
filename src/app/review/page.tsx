import Link from "next/link";

export default function ReviewPage() {
  return (
    <main style={{ padding: "2rem", maxWidth: 840, margin: "0 auto" }}>
      <h1>Scientist Review Workspace</h1>
      <p>
        Submit detailed annotations through the review block on the homepage.
        This route is reserved for an expanded review dashboard.
      </p>
      <p>
        <Link href="/">Back to hypothesis input</Link>
      </p>
    </main>
  );
}

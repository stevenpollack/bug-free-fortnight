import type { Health } from "@api/schemas";

const sampleHealth: Health = { ok: true };

export function HomePage() {
  return (
    <main className="min-h-screen bg-amber-50 px-4 py-8">
      <div className="mx-auto max-w-sm">
        <h1 className="mb-2 text-3xl font-bold text-amber-900">Family Recipes</h1>
        <p className="text-amber-700">Your household recipe collection.</p>
        <p className="mt-4 text-xs text-amber-500">
          API status: {sampleHealth.ok ? "ok" : "error"}
        </p>
      </div>
    </main>
  );
}

/** Shown instantly while the Home page loads, so a tap always responds right away. */
export default function HomeLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      data-testid="page-loading"
      className="mx-auto w-full max-w-2xl flex-1 animate-pulse space-y-6 px-4 py-8"
    >
      <div className="h-7 w-48 rounded-md bg-line" />
      <div className="card space-y-3">
        <div className="h-5 w-56 rounded bg-line" />
        <div className="h-4 w-full rounded bg-line" />
        <div className="h-4 w-3/4 rounded bg-line" />
        <div className="h-11 w-40 rounded-lg bg-line" />
      </div>
      <div className="card space-y-3">
        <div className="h-5 w-40 rounded bg-line" />
        <div className="h-4 w-full rounded bg-line" />
      </div>
    </main>
  );
}

/** Shown instantly while Settings loads, so a tap always responds right away. */
export default function SettingsLoading() {
  return (
    <main
      aria-busy="true"
      aria-label="Loading"
      data-testid="page-loading"
      className="mx-auto w-full max-w-2xl flex-1 animate-pulse space-y-6 px-4 py-8"
    >
      <div className="h-7 w-32 rounded-md bg-line" />
      {[0, 1, 2].map((i) => (
        <div key={i} className="card space-y-4">
          <div className="h-5 w-44 rounded bg-line" />
          <div className="h-11 w-full rounded-lg bg-line" />
          <div className="h-11 w-full rounded-lg bg-line" />
        </div>
      ))}
    </main>
  );
}

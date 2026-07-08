export default function Loading() {
  return (
    <div className="animate-pulse space-y-4">
      <div className="h-6 w-48 rounded bg-zinc-200" />
      <div className="h-4 w-32 rounded bg-zinc-100" />
      <div className="mt-6 grid grid-cols-2 gap-3 lg:grid-cols-5">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-20 rounded-lg border border-zinc-200 bg-white" />
        ))}
      </div>
      <div className="mt-6 h-64 rounded-lg border border-zinc-200 bg-white" />
    </div>
  );
}

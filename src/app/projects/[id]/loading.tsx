export default function ProjectLoading() {
  return (
    <main className="mx-auto w-full max-w-[1500px] animate-pulse px-6 py-8" aria-busy="true" aria-label="Loading project">
      <div className="h-4 w-24 rounded bg-slate-200" />
      <div className="mt-5 h-36 rounded-2xl bg-white" />
      <div className="mt-5 grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
        <div className="h-96 rounded-2xl bg-slate-200" />
        <div className="h-80 rounded-2xl bg-white" />
      </div>
    </main>
  );
}

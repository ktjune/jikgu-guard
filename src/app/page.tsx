import { Suspense } from "react";
import HomeClient from "./_home-client";

interface PageProps {
  searchParams: Promise<{ q?: string; status?: string }>;
}

export default async function Page({ searchParams }: PageProps) {
  const params = await searchParams;
  const q = params.q ?? "";
  const status = (
    ["all", "blocked", "released"].includes(params.status ?? "")
      ? params.status
      : "all"
  ) as "all" | "blocked" | "released";

  return (
    <Suspense>
      <HomeClient initialQ={q} initialStatus={status} />
    </Suspense>
  );
}

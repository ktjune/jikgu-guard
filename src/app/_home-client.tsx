"use client";

import { useState, useEffect } from "react";
import UnifiedSearch from "@/components/unified-search";

interface StatsData {
  blockedCount: number;
  totalCount: number;
  lastSyncedAt: string | null;
}

interface RecentItem {
  id: string;
  rawIrdntNm: string;
  rawIrdntEngNm: string | null;
  appnDt: string | null;
  appnRsn: string | null;
}

export interface HomeClientProps {
  initialQ: string;
  initialStatus: "all" | "blocked" | "released";
}

function formatDate(iso: string | null): string {
  if (!iso) return "-";
  return iso.slice(0, 10);
}

export default function HomeClient({ initialQ, initialStatus }: HomeClientProps) {
  const [stats, setStats] = useState<StatsData | null>(null);
  const [recentItems, setRecentItems] = useState<RecentItem[]>([]);

  useEffect(() => {
    Promise.all([
      fetch("/api/stats").then((r) => r.json()),
      fetch("/api/ingredients/recent").then((r) => r.json()),
    ])
      .then(([statsData, recentData]: [{ ok: boolean } & Partial<StatsData>, { ok: boolean; items?: RecentItem[] }]) => {
        if (statsData.ok) setStats(statsData as StatsData);
        if (recentData.ok) setRecentItems(recentData.items ?? []);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-4 py-8">

        {/* ── 헤더 ── */}
        <header className="mb-10 text-center">
          <h1 className="text-4xl font-extrabold tracking-tight bg-gradient-to-r from-indigo-600 to-violet-600 bg-clip-text text-transparent sm:text-5xl">
            직구가드 🛡️
          </h1>
          <p className="mt-3 text-base text-gray-600 sm:text-lg">
            해외직구 영양제·다이어트약의 위해성분을 즉시 확인하세요
          </p>
          <p className="mt-1 text-sm text-gray-400">
            식약처 공공데이터 기반 · 실시간 차단성분 검색
          </p>

          {/* 통계 뱃지 */}
          {stats && stats.totalCount > 0 && (
            <div className="mt-4 flex flex-wrap justify-center gap-2.5">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-red-50 border border-red-200 px-3 py-1 text-sm text-red-700 font-medium">
                🚫 현재 차단 성분{" "}
                <strong>{stats.blockedCount.toLocaleString()}</strong>개
              </span>
              {stats.lastSyncedAt && (
                <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-100 border border-gray-200 px-3 py-1 text-sm text-gray-500">
                  📅 마지막 업데이트 {formatDate(stats.lastSyncedAt)}
                </span>
              )}
            </div>
          )}
        </header>

        {/* ── 통합 검색 ── */}
        <UnifiedSearch
          initialQ={initialQ}
          initialStatus={initialStatus}
          recentItems={recentItems}
        />

      </div>
    </div>
  );
}

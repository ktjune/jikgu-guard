"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

// ─── 유효성 검사 스키마 ───────────────────────────────────────────
const searchSchema = z.object({
  q: z
    .string()
    .min(1, "검색어를 입력해주세요.")
    .max(100, "검색어는 100자 이내로 입력해주세요."),
  status: z.enum(["all", "blocked", "released"]),
});

type SearchFormValues = z.infer<typeof searchSchema>;

// ─── 상태 필터 옵션 ───────────────────────────────────────────────
const STATUS_OPTIONS: { value: SearchFormValues["status"]; label: string }[] =
  [
    { value: "all", label: "전체" },
    { value: "blocked", label: "차단 중" },
    { value: "released", label: "해제됨" },
  ];

// ─── Props ────────────────────────────────────────────────────────
interface SearchFormProps {
  onSearch: (q: string, status: "all" | "blocked" | "released") => void;
  isLoading: boolean;
  defaultQ?: string;
  defaultStatus?: "all" | "blocked" | "released";
}

// ─── 컴포넌트 ─────────────────────────────────────────────────────
export default function SearchForm({
  onSearch,
  isLoading,
  defaultQ = "",
  defaultStatus = "all",
}: SearchFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<SearchFormValues>({
    resolver: zodResolver(searchSchema),
    defaultValues: {
      q: defaultQ,
      status: defaultStatus,
    },
  });

  const onSubmit = (data: SearchFormValues) => {
    onSearch(data.q, data.status);
  };

  return (
    <div className="mx-auto w-full max-w-2xl rounded-2xl bg-white px-6 py-8 shadow-md ring-1 ring-gray-100">
      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        {/* 검색어 입력 */}
        <div className="mb-5">
          <label
            htmlFor="search-q"
            className="mb-1.5 block text-sm font-medium text-gray-700"
          >
            성분명 검색
          </label>
          <input
            id="search-q"
            type="text"
            autoComplete="off"
            placeholder="성분명을 입력하세요 (예: 에페드린, ephedrine)"
            aria-invalid={errors.q ? "true" : "false"}
            aria-describedby={errors.q ? "search-q-error" : undefined}
            className={[
              "w-full rounded-lg border px-4 py-3 text-sm text-gray-900",
              "placeholder:text-gray-400",
              "outline-none transition",
              "focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500",
              errors.q
                ? "border-red-500 bg-red-50 focus:ring-red-400 focus:border-red-400"
                : "border-gray-300 bg-white",
            ].join(" ")}
            {...register("q")}
          />
          {errors.q && (
            <p
              id="search-q-error"
              role="alert"
              className="mt-1.5 text-sm text-red-600"
            >
              {errors.q.message}
            </p>
          )}
        </div>

        {/* 상태 필터 (라디오) */}
        <div className="mb-6">
          <fieldset>
            <legend className="mb-2 text-sm font-medium text-gray-700">
              차단 상태 필터
            </legend>
            <div className="flex flex-wrap gap-3">
              {STATUS_OPTIONS.map(({ value, label }) => (
                <label
                  key={value}
                  className="flex cursor-pointer items-center gap-2 rounded-lg border border-gray-200 px-4 py-2 text-sm
                             has-[:checked]:border-indigo-500 has-[:checked]:bg-indigo-50 has-[:checked]:text-indigo-700
                             hover:border-indigo-300 transition"
                >
                  <input
                    type="radio"
                    value={value}
                    className="accent-indigo-600"
                    {...register("status")}
                  />
                  {label}
                </label>
              ))}
            </div>
          </fieldset>
        </div>

        {/* 검색 버튼 */}
        <button
          type="submit"
          disabled={isLoading}
          aria-busy={isLoading}
          className={[
            "w-full rounded-lg px-6 py-3 text-sm font-semibold text-white transition",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2",
            isLoading
              ? "cursor-not-allowed bg-indigo-300"
              : "bg-indigo-600 hover:bg-indigo-700 active:bg-indigo-800",
          ].join(" ")}
        >
          {isLoading ? "검색 중..." : "검색"}
        </button>
      </form>
    </div>
  );
}

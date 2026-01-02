"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StockReturnSummaryRow, SortMetric } from "../../types";

type Props = {
    rows: StockReturnSummaryRow[];
};

type SortState = {
    metric: SortMetric;
    dir: "desc" | "asc";
};

// Formatting Helpers
function fmtPct(v: number | null) {
    if (v === null || !Number.isFinite(v)) return <span className="text-gray-300">-</span>;
    const isPos = v > 0;
    const isNeg = v < 0;
    const colorClass = isPos ? "text-green-600 bg-green-50 dark:bg-green-900/20 dark:text-green-400"
        : isNeg ? "text-red-600 bg-red-50 dark:bg-red-900/20 dark:text-red-400"
            : "text-gray-500 bg-gray-100 dark:bg-gray-800 dark:text-gray-400";

    return (
        <span className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium tabular-nums ${colorClass}`}>
            {v > 0 ? "+" : ""}{v.toFixed(2)}%
        </span>
    );
}

function fmtPrice(v: number) {
    if (!Number.isFinite(v)) return <span className="text-gray-300">-</span>;
    return <span className="font-mono text-gray-700 dark:text-gray-300">${v.toFixed(2)}</span>;
}

export default function RankingsTable({ rows }: Props) {
    const [query, setQuery] = useState("");
    const [sort, setSort] = useState<SortState>({ metric: "ret_6m_pct", dir: "desc" });

    function fmtPct(val: number | null) {
        if (val === null || !Number.isFinite(val)) return "-";
        const color = val > 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
        return <span className={`font-medium ${color}`}>{val > 0 ? "+" : ""}{val.toFixed(2)}%</span>;
    }

    function fmtPeGap(val: number | null) {
        if (val === null || !Number.isFinite(val)) return "-";
        // Inverse logic: Negative gap is "cheaper" (Better/Green), Positive is "expensive" (Worse/Red)
        const color = val < 0 ? "text-green-600 dark:text-green-400" : "text-red-600 dark:text-red-400";
        return <span className={`font-medium ${color}`}>{val > 0 ? "+" : ""}{val.toFixed(2)}%</span>;
    }

    function fmtPrice(val: number) {
        return <span className="font-medium text-gray-900 dark:text-white">${val.toFixed(2)}</span>;
    }

    const sortedAndFiltered = useMemo(() => {
        // 1. Sort the full dataset first
        const allSorted = [...rows].sort((a, b) => {
            const av = a[sort.metric];
            const bv = b[sort.metric];

            const aBad = av === null || !Number.isFinite(av);
            const bBad = bv === null || !Number.isFinite(bv);

            if (aBad && bBad) return 0;
            if (aBad) return 1;
            if (bBad) return -1;

            const diff = (bv as number) - (av as number);
            return sort.dir === "desc" ? diff : -diff;
        });

        // 2. Attach Rank (1-based index)
        const withRank = allSorted.map((r, i) => ({ ...r, originalRank: i + 1 }));

        // 3. Filter by query
        const q = query.trim().toUpperCase();
        if (!q) return withRank;

        return withRank.filter((r) => r.ticker.toUpperCase().includes(q));
    }, [rows, sort, query]);

    const top10 = sortedAndFiltered.slice(0, 10);

    function toggle(metric: SortMetric) {
        setSort((prev) => {
            if (prev.metric !== metric) return { metric, dir: "desc" };
            return { metric, dir: prev.dir === "desc" ? "asc" : "desc" };
        });
    }

    const header = (metric: SortMetric, label: string, tooltip?: { text: string; preference: "high" | "low" | "neutral" }) => (
        <div className="group relative flex items-center gap-1 cursor-pointer" onClick={() => toggle(metric)}>
            <span
                className={`text-xs font-semibold uppercase tracking-wider transition-colors ${sort.metric === metric
                    ? "text-indigo-600 dark:text-indigo-400"
                    : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
                    }`}
            >
                {label}
            </span>
            {sort.metric === metric && (
                <span className="text-indigo-500 text-[10px]">
                    {sort.dir === "asc" ? "▲" : "▼"}
                </span>
            )}

            {/* Tooltip */}
            {tooltip && (
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 w-56 p-2 bg-gray-900 text-white text-xs rounded shadow-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-[100]">
                    <p className="mb-1">{tooltip.text}</p>
                    <p className={`font-bold ${tooltip.preference === "high" ? "text-green-400" :
                        tooltip.preference === "low" ? "text-green-400" : "text-gray-400"
                        }`}>
                        {tooltip.preference === "high" ? "Higher is better" :
                            tooltip.preference === "low" ? "Lower is better" : "Reference Value"}
                    </p>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-4 border-transparent border-t-gray-900"></div>
                </div>
            )}
        </div>
    );

    return (
        <div className="w-full bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800">
            {/* Toolbar */}
            <div className="p-4 border-b border-gray-100 dark:border-gray-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-gray-50/50 dark:bg-gray-900/50">
                <div className="flex items-center gap-2">
                    <h2 className="font-semibold text-gray-900 dark:text-white">Market Rankings</h2>
                    <span className="px-2 py-0.5 rounded-full bg-gray-200 dark:bg-gray-800 text-xs font-medium text-gray-600 dark:text-gray-400">
                        {sortedAndFiltered.length} Assets
                    </span>
                </div>

                <div className="relative">
                    <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                        <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                            <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                        </svg>
                    </div>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="Search ticker..."
                        className="pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full sm:w-64 transition-all"
                    />
                </div>
            </div>

            {/* Mobile Card View (Visible on small screens) */}
            <div className="block sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
                {top10.map((r, i) => (
                    <div key={r.ticker} className="p-4 hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                        <div className="flex justify-between items-start mb-3">
                            <div className="flex items-center gap-3">
                                <span className="text-xs font-mono text-gray-400">#{String(r.originalRank).padStart(2, '0')}</span>
                                <Link href={`/stock/${r.ticker}`}>
                                    <span className="text-lg font-bold text-gray-900 dark:text-white hover:text-indigo-600 transition-colors">
                                        {r.ticker}
                                    </span>
                                </Link>
                            </div>
                            {fmtPrice(r.current_close)}
                        </div>

                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                            <div className="flex justify-between">
                                <span className="text-gray-500 text-xs">EPS Growth</span>
                                {fmtPct(r.eps_yoy_growth_avg_last4q_pct)}
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 text-xs text-right">PE Ratio</span>
                                <span className="font-mono text-gray-700 dark:text-gray-300">{r.current_pe ? `${r.current_pe.toFixed(1)}x` : '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 text-xs">PE Gap</span>
                                {fmtPeGap(r.current_pe_gap_pct)}
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 text-xs text-right">1Y Return</span>
                                {fmtPct(r.ret_1y_pct)}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {/* Desktop Table View (Hidden on mobile) */}
            <div className="hidden sm:block overflow-x-visible">
                <table className="min-w-full">
                    <thead>
                        <tr className="bg-gray-50 dark:bg-gray-800/50 border-b border-gray-100 dark:border-gray-800">
                            <th className="py-3 px-6 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider w-16">Rank</th>
                            <th className="py-3 px-6 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Asset</th>
                            <th className="py-3 px-6 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">Close Price</th>
                            <th className="py-3 px-6 text-left">{header("eps_yoy_growth_avg_last4q_pct", "EPS Growth (1Y)", { text: "Avg YoY EPS growth (last 4 quarters)", preference: "high" })}</th>
                            <th className="py-3 px-6 text-left">{header("pe_mid_used", "1Y Mid PE", { text: "Median PE ratio over last year used for projections", preference: "neutral" })}</th>
                            <th className="py-3 px-6 text-left">{header("current_pe", "Current PE", { text: "Current Price-to-Earnings ratio", preference: "low" })}</th>
                            <th className="py-3 px-6 text-left">{header("current_pe_gap_pct", "PE Gap", { text: "Gap between Current PE and 1Y Mid PE", preference: "low" })}</th>
                            <th className="py-3 px-6 text-left">{header("ret_6m_pct", "6M Return", { text: "Estimated 6-month model return", preference: "high" })}</th>
                            <th className="py-3 px-6 text-left">{header("ret_1y_pct", "1Y Return", { text: "Estimated 1-year model return", preference: "high" })}</th>
                            <th className="py-3 px-6 text-left">{header("ret_2y_pct", "2Y Return", { text: "Estimated 2-year model return", preference: "high" })}</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {top10.map((r, i) => (
                            <tr
                                key={r.ticker}
                                className="group hover:bg-gray-50/80 dark:hover:bg-gray-800/50 transition-colors"
                            >
                                <td className="py-4 px-6 text-sm text-gray-500 font-mono">
                                    {String(r.originalRank).padStart(2, '0')}
                                </td>
                                <td className="py-4 px-6">
                                    <Link href={`/stock/${r.ticker}`} className="flex items-center gap-3 group-hover:translate-x-1 transition-transform">
                                        <div>
                                            <span className="block font-bold text-gray-900 dark:text-white group-hover:text-indigo-600 transition-colors">
                                                {r.ticker}
                                            </span>
                                        </div>
                                    </Link>
                                </td>
                                <td className="py-4 px-6 text-sm">
                                    {fmtPrice(r.current_close)}
                                </td>
                                <td className="py-4 px-6 text-sm">
                                    {fmtPct(r.eps_yoy_growth_avg_last4q_pct)}
                                </td>
                                <td className="py-4 px-6 text-sm font-mono text-gray-600 dark:text-gray-400">
                                    {r.pe_mid_used ? `${r.pe_mid_used.toFixed(1)}x` : '-'}
                                </td>
                                <td className="py-4 px-6 text-sm font-mono text-gray-600 dark:text-gray-400">
                                    {r.current_pe ? `${r.current_pe.toFixed(1)}x` : '-'}
                                </td>
                                <td className="py-4 px-6 text-sm">
                                    {fmtPeGap(r.current_pe_gap_pct)}
                                </td>
                                <td className="py-4 px-6 text-sm">
                                    {fmtPct(r.ret_6m_pct)}
                                </td>
                                <td className="py-4 px-6 text-sm">
                                    {fmtPct(r.ret_1y_pct)}
                                </td>
                                <td className="py-4 px-6 text-sm">
                                    {fmtPct(r.ret_2y_pct)}
                                </td>
                            </tr>
                        ))}
                        {sortedAndFiltered.length === 0 && (
                            <tr>
                                <td colSpan={10} className="py-12 text-center text-gray-400 text-sm">
                                    No assets found matching "{query}"
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30 flex flex-col gap-1">
                <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                    <span>Showing Top 10 by default</span>
                    <span>Click headers to sort</span>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> Returns are model estimates based on historical EPS trends and the 1-year PE ratio mid-point. PE ratios are based on interpolated EPS (as actual trailing EPS are spot values only on earning report days).
                </div>
            </div>
        </div>
    );
}

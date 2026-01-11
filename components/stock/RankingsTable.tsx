"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import type { StockReturnSummaryRow, SortMetric } from "../../types";

export type FilterState = {
    minMktCap: string; maxMktCap: string;
    minPe: string; maxPe: string;
    minGrowth: string; maxGrowth: string;
    minFairVal: string; maxFairVal: string;
};

export const INITIAL_FILTERS: FilterState = {
    minMktCap: "", maxMktCap: "",
    minPe: "", maxPe: "",
    minGrowth: "", maxGrowth: "",
    minFairVal: "", maxFairVal: "",
};

type Props = {
    rows: StockReturnSummaryRow[];
    query: string;
    onQueryChange: (q: string) => void;
    filters: FilterState;
    onFilterChange: (filters: FilterState) => void;
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

export default function RankingsTable({ rows, query, onQueryChange, filters, onFilterChange }: Props) {
    const [sort, setSort] = useState<SortState>({ metric: "market_cap", dir: "desc" });
    const [showFilters, setShowFilters] = useState(false);
    const [limit, setLimit] = useState(10);

    const handleFilterChange = (key: keyof FilterState, val: string) => {
        onFilterChange({ ...filters, [key]: val });
    };

    const resetFilters = () => onFilterChange(INITIAL_FILTERS);

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


    function fmtMarketCap(val: number | null) {
        if (val === null || !Number.isFinite(val)) return "-";
        if (val >= 1e12) return <span className="font-mono text-gray-700 dark:text-gray-300">{(val / 1e12).toFixed(2)}T</span>;
        if (val >= 1e9) return <span className="font-mono text-gray-700 dark:text-gray-300">{(val / 1e9).toFixed(2)}B</span>;
        if (val >= 1e6) return <span className="font-mono text-gray-700 dark:text-gray-300">{(val / 1e6).toFixed(2)}M</span>;
        return <span className="font-mono text-gray-700 dark:text-gray-300">{val.toLocaleString()}</span>;
    }

    const sortedAndFiltered = useMemo(() => {
        // 1. Sort the pre-filtered dataset
        const allSorted = [...rows].sort((a, b) => {
            const av = a[sort.metric];
            const bv = b[sort.metric];

            if (sort.metric === "ticker") {
                const sA = (av as string).toUpperCase();
                const sB = (bv as string).toUpperCase();
                if (sA < sB) return sort.dir === "asc" ? -1 : 1;
                if (sA > sB) return sort.dir === "asc" ? 1 : -1;
                return 0;
            }

            const aBad = av === null || !Number.isFinite(av as number);
            const bBad = bv === null || !Number.isFinite(bv as number);

            if (aBad && bBad) return 0;
            if (aBad) return 1;
            if (bBad) return -1;

            const diff = (bv as number) - (av as number);
            return sort.dir === "desc" ? diff : -diff;
        });

        // 2. Attach Rank (1-based index)
        const withRank = allSorted.map((r, i) => ({ ...r, originalRank: i + 1 }));

        return withRank;
    }, [rows, sort]);

    const visibleRows = sortedAndFiltered.slice(0, limit);
    const hasMore = sortedAndFiltered.length > limit;

    const handleLoadMore = () => setLimit(prev => prev + 20);

    function toggle(metric: SortMetric) {
        setSort((prev) => {
            if (prev.metric !== metric) return { metric, dir: "desc" };
            return { metric, dir: prev.dir === "desc" ? "asc" : "desc" };
        });
    }

    const header = (metric: SortMetric, label: string, tooltip?: { text: string; preference: "high" | "low" | "neutral" }) => (
        <div className="group relative flex items-center gap-1.5 cursor-pointer" onClick={() => toggle(metric)}>
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
                <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-sm rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[100] border-2 border-indigo-400">
                    <p className="mb-2 leading-relaxed">{tooltip.text}</p>
                    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold ${tooltip.preference === "high" ? "bg-green-500/20 text-green-200 border border-green-400" :
                        tooltip.preference === "low" ? "bg-green-500/20 text-green-200 border border-green-400" :
                            "bg-gray-500/20 text-gray-200 border border-gray-400"
                        }`}>
                        {tooltip.preference === "high" ? "📈 Higher is better" :
                            tooltip.preference === "low" ? "📉 Lower is better" : "📊 Reference Value"}
                    </div>
                    <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-indigo-600"></div>
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

                <div className="flex flex-col sm:flex-row gap-3 w-full sm:w-auto">
                    <button
                        onClick={() => setShowFilters(!showFilters)}
                        className={`px-4 py-2 rounded-lg text-sm font-medium border transition-colors flex items-center gap-2 ${showFilters
                            ? "bg-indigo-50 border-indigo-200 text-indigo-600 dark:bg-indigo-900/20 dark:border-indigo-800 dark:text-indigo-400"
                            : "bg-white border-gray-200 text-gray-600 hover:bg-gray-50 dark:bg-gray-800 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-700"
                            }`}
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 4a1 1 0 011-1h16a1 1 0 011 1v2.586a1 1 0 01-.293.707l-6.414 6.414a1 1 0 00-.293.707V17l-4 4v-6.586a1 1 0 00-.293-.707L3.293 7.293A1 1 0 013 6.586V4z" />
                        </svg>
                        Filters
                        {(Object.values(filters).some(v => v !== "")) && (
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        )}
                    </button>

                    <div className="relative flex-1">
                        <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                            <svg className="h-4 w-4 text-gray-400" viewBox="0 0 20 20" fill="currentColor">
                                <path fillRule="evenodd" d="M8 4a4 4 0 100 8 4 4 0 000-8zM2 8a6 6 0 1110.89 3.476l4.817 4.817a1 1 0 01-1.414 1.414l-4.816-4.816A6 6 0 012 8z" clipRule="evenodd" />
                            </svg>
                        </div>
                        <input
                            value={query}
                            onChange={(e) => onQueryChange(e.target.value)}
                            placeholder="Search ticker..."
                            className="pl-9 pr-4 py-2 border border-gray-200 dark:border-gray-700 rounded-lg text-sm bg-white dark:bg-gray-800 focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 outline-none w-full transition-all"
                        />
                    </div>
                </div>
            </div>

            {/* Filter Panel */}
            {showFilters && (
                <div className="p-4 border-b border-gray-100 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/30 animate-in slide-in-from-top-2 duration-200">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                        {/* Market Cap */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase">Market Cap ($B)</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={filters.minMktCap}
                                    onChange={(e) => handleFilterChange("minMktCap", e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={filters.maxMktCap}
                                    onChange={(e) => handleFilterChange("maxMktCap", e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* EPS Growth */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase">EPS Growth (%)</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={filters.minGrowth}
                                    onChange={(e) => handleFilterChange("minGrowth", e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={filters.maxGrowth}
                                    onChange={(e) => handleFilterChange("maxGrowth", e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* PE Ratio */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase">PE Ratio</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={filters.minPe}
                                    onChange={(e) => handleFilterChange("minPe", e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={filters.maxPe}
                                    onChange={(e) => handleFilterChange("maxPe", e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>

                        {/* vs Fair Value */}
                        <div className="space-y-1">
                            <label className="text-xs font-semibold text-gray-500 uppercase">vs Fair Value (%)</label>
                            <div className="flex gap-2">
                                <input
                                    type="number"
                                    placeholder="Min"
                                    value={filters.minFairVal}
                                    onChange={(e) => handleFilterChange("minFairVal", e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                                <input
                                    type="number"
                                    placeholder="Max"
                                    value={filters.maxFairVal}
                                    onChange={(e) => handleFilterChange("maxFairVal", e.target.value)}
                                    className="w-full px-3 py-1.5 text-sm border border-gray-200 dark:border-gray-700 rounded bg-white dark:bg-gray-800 focus:ring-1 focus:ring-indigo-500 outline-none"
                                />
                            </div>
                        </div>
                    </div>

                    <div className="mt-4 flex justify-end">
                        <button
                            onClick={resetFilters}
                            className="px-3 py-1.5 text-xs font-medium text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded transition-colors"
                        >
                            Reset Filters
                        </button>
                    </div>
                </div>
            )}

            {/* Mobile Card View (Visible on small screens) */}
            <div className="block sm:hidden divide-y divide-gray-100 dark:divide-gray-800">
                {visibleRows.map((r, i) => (
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
                                <span className="text-gray-500 text-xs">Market Cap</span>
                                {fmtMarketCap(r.market_cap)}
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 text-xs">EPS Growth</span>
                                {fmtPct(r.eps_yoy_growth_avg_last4q_pct)}
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 text-xs text-right">PE Ratio</span>
                                <span className="font-mono text-gray-700 dark:text-gray-300">{r.current_pe ? `${r.current_pe.toFixed(1)}x` : '-'}</span>
                            </div>
                            <div className="flex justify-between">
                                <span className="text-gray-500 text-xs">vs Fair Value</span>
                                {fmtPeGap(r.current_pe_gap_pct)}
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
                            <th className="py-3 px-6 text-left">{header("ticker", "Asset")}</th>
                            <th className="py-3 px-6 text-left">{header("market_cap", "Market Cap", { text: "🏢 The total value of the company's shares. (Share Price × Total Shares)", preference: "high" })}</th>
                            <th className="py-3 px-6 text-left">{header("current_close", "Close Price")}</th>
                            <th className="py-3 px-6 text-left">{header("eps_yoy_growth_avg_last4q_pct", "EPS Growth (1Y)", { text: "🍰 How much BIGGER is each person's slice of the profit pie compared to last year? This shows if the company is earning MORE money per share!", preference: "high" })}</th>
                            <th className="py-3 px-6 text-left">{header("pe_mid_used", "1Y Mid PE", { text: "🏷️ The 'typical price tag' investors paid for this stock over the last year. Think of it as the average sticker price!", preference: "neutral" })}</th>
                            <th className="py-3 px-6 text-left">{header("current_pe", "Current PE", { text: "🏷️ How many years of profit you're paying for TODAY. Like buying a lemonade stand: if it earns $5/year and costs $50, the PE is 10 (you'd wait 10 years to break even).", preference: "low" })}</th>
                            <th className="py-3 px-6 text-left">{header("current_pe_gap_pct", "vs Fair Value", { text: "💰 Is this stock ON SALE or OVERPRICED? Negative (green) = Cheaper than usual! Positive (red) = More expensive than usual!", preference: "low" })}</th>

                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                        {visibleRows.map((r, i) => (
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
                                    {fmtMarketCap(r.market_cap)}
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

                            </tr>
                        ))}
                        {sortedAndFiltered.length === 0 && (
                            <tr>
                                <td colSpan={8} className="py-12 text-center text-gray-400 text-sm">
                                    No assets found matching "{query}"
                                </td>
                            </tr>
                        )}
                    </tbody>
                </table>
            </div>

            {/* Load More Button */}
            {hasMore && (
                <div className="p-4 border-t border-gray-100 dark:border-gray-800 flex justify-center bg-gray-50/20 dark:bg-gray-900/20">
                    <button
                        onClick={handleLoadMore}
                        className="px-6 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg text-sm font-semibold text-indigo-600 dark:text-indigo-400 hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-all shadow-sm"
                    >
                        Load More Assets ({sortedAndFiltered.length - limit} remaining)
                    </button>
                </div>
            )}

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 dark:border-gray-800 bg-gray-50/30 dark:bg-gray-900/30 flex flex-col gap-1">
                <div className="flex justify-between items-center text-xs text-gray-500 mb-2">
                    <span>Showing {visibleRows.length} of {sortedAndFiltered.length} assets</span>
                    <span>Click headers to sort • Hover over column headers for explanations</span>
                </div>
                <div className="p-3 bg-amber-50 dark:bg-amber-900/20 border border-amber-100 dark:border-amber-900/30 rounded-lg text-xs text-amber-800 dark:text-amber-200">
                    <strong>Note:</strong> Returns are model estimates based on historical EPS trends and the 1-year PE ratio mid-point. PE ratios are based on interpolated EPS (as actual trailing EPS are spot values only on earning report days).
                </div>
            </div>
        </div>
    );
}

"use client";

import { useMemo, useState } from "react";
import RankingsTable, { FilterState, INITIAL_FILTERS } from "./RankingsTable";
import MarketScatterPlotD3 from "./MarketScatterPlotD3";
import { StockReturnSummaryRow } from "../../types";

type Props = {
    data: StockReturnSummaryRow[];
};

export default function DashboardClient({ data }: Props) {
    const [tickerInput, setTickerInput] = useState("");
    const [watchlist, setWatchlist] = useState<string[]>([]);

    // Standard numerical filters
    const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

    const filteredRows = useMemo(() => {
        let rows = data;

        // 1. Is Watchlist Active?
        // If watchlist has items, show ONLY those items.
        // If empty, show ALL (default behavior).
        if (watchlist.length > 0) {
            rows = rows.filter(r => watchlist.includes(r.ticker));
        }

        // 2. Numerical Filters
        if (filters.minMktCap) rows = rows.filter(r => (r.market_cap || 0) >= Number(filters.minMktCap) * 1e9);
        if (filters.maxMktCap) rows = rows.filter(r => (r.market_cap || 0) <= Number(filters.maxMktCap) * 1e9);
        if (filters.minPe) rows = rows.filter(r => (r.current_pe || 0) >= Number(filters.minPe));
        if (filters.maxPe) rows = rows.filter(r => (r.current_pe || 0) <= Number(filters.maxPe));
        if (filters.minGrowth) rows = rows.filter(r => (r.eps_yoy_growth_avg_last4q_pct || 0) >= Number(filters.minGrowth));
        if (filters.maxGrowth) rows = rows.filter(r => (r.eps_yoy_growth_avg_last4q_pct || 0) <= Number(filters.maxGrowth));
        if (filters.minFairVal) rows = rows.filter(r => (r.current_pe_gap_pct || 0) >= Number(filters.minFairVal));
        if (filters.maxFairVal) rows = rows.filter(r => (r.current_pe_gap_pct || 0) <= Number(filters.maxFairVal));

        return rows;
    }, [data, filters, watchlist]);

    // Handle Adding Ticker
    const handleAddTicker = () => {
        const t = tickerInput.trim().toUpperCase();
        if (!t) return;

        // Basic deduplication
        if (!watchlist.includes(t)) {
            setWatchlist(prev => [...prev, t]);
        }
        setTickerInput("");
    };

    const handleRemoveTicker = (t: string) => {
        setWatchlist(prev => prev.filter(x => x !== t));
    };

    const handleClearWatchlist = () => {
        setWatchlist([]);
    };

    return (
        <div className="space-y-6">
            {/* Watchlist Input Section */}
            <div className="bg-white dark:bg-gray-900 p-4 rounded-xl border border-gray-200 dark:border-gray-800 shadow-sm flex flex-col md:flex-row gap-4 items-center justify-between">

                <div className="flex flex-col md:flex-row gap-2 w-full md:w-auto items-center">
                    <div className="relative w-full md:w-auto">
                        <input
                            type="text"
                            placeholder="Type Ticker (e.g. NVDA)..."
                            className="pl-4 pr-10 py-2 border rounded-lg bg-gray-50 dark:bg-gray-800 dark:border-gray-700 w-full md:w-64 uppercase font-bold focus:ring-2 focus:ring-blue-500 outline-none"
                            value={tickerInput}
                            onChange={e => setTickerInput(e.target.value)}
                            onKeyDown={e => e.key === 'Enter' && handleAddTicker()}
                        />
                        <button
                            onClick={handleAddTicker}
                            className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-blue-500"
                        >
                            ⏎
                        </button>
                    </div>
                    <button
                        onClick={handleAddTicker}
                        disabled={!tickerInput}
                        className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 font-medium text-sm w-full md:w-auto whitespace-nowrap"
                    >
                        Add to Compare
                    </button>
                </div>

                {/* Active Watchlist Chips */}
                {watchlist.length > 0 ? (
                    <div className="flex flex-wrap gap-2 items-center flex-1 justify-end">
                        <span className="text-xs text-gray-500 font-medium mr-2 hidden md:inline">Evaluating:</span>
                        {watchlist.map(t => (
                            <span key={t} className="inline-flex items-center gap-1 px-3 py-1 bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 rounded-full text-sm font-bold">
                                {t}
                                <button
                                    onClick={() => handleRemoveTicker(t)}
                                    className="hover:text-red-500 ml-1"
                                >
                                    ×
                                </button>
                            </span>
                        ))}
                        <button
                            onClick={handleClearWatchlist}
                            className="text-xs text-red-500 hover:text-red-700 underline ml-2 whitespace-nowrap"
                        >
                            Clear All
                        </button>
                    </div>
                ) : (
                    <div className="text-sm text-gray-400 italic hidden md:block">
                        Displaying all stocks. Add specific tickers to filter view.
                    </div>
                )}
            </div>

            {/* Table (Top) */}
            <RankingsTable
                rows={filteredRows}
                query=""
                onQueryChange={() => { }}
                filters={filters}
                onFilterChange={setFilters}
                hideSearchBar={true}
            />

            {/* Scatter Plot (Bottom) */}
            <MarketScatterPlotD3 data={filteredRows} />
        </div>
    );
}

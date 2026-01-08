"use client";

import { useMemo, useState } from "react";
import RankingsTable, { FilterState, INITIAL_FILTERS } from "./RankingsTable";
import MarketScatterPlotD3 from "./MarketScatterPlotD3";
import { StockReturnSummaryRow } from "../../types";

type Props = {
    data: StockReturnSummaryRow[];
};

export default function DashboardClient({ data }: Props) {
    const [query, setQuery] = useState("");
    const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);

    const filteredRows = useMemo(() => {
        let rows = data;

        // Market Cap ($B)
        if (filters.minMktCap) rows = rows.filter(r => (r.market_cap || 0) >= Number(filters.minMktCap) * 1e9);
        if (filters.maxMktCap) rows = rows.filter(r => (r.market_cap || 0) <= Number(filters.maxMktCap) * 1e9);

        // PE Ratio
        if (filters.minPe) rows = rows.filter(r => (r.current_pe || 0) >= Number(filters.minPe));
        if (filters.maxPe) rows = rows.filter(r => (r.current_pe || 0) <= Number(filters.maxPe));

        // Growth (%)
        if (filters.minGrowth) rows = rows.filter(r => (r.eps_yoy_growth_avg_last4q_pct || 0) >= Number(filters.minGrowth));
        if (filters.maxGrowth) rows = rows.filter(r => (r.eps_yoy_growth_avg_last4q_pct || 0) <= Number(filters.maxGrowth));

        // Fair Value Diff (%)
        if (filters.minFairVal) rows = rows.filter(r => (r.current_pe_gap_pct || 0) >= Number(filters.minFairVal));
        if (filters.maxFairVal) rows = rows.filter(r => (r.current_pe_gap_pct || 0) <= Number(filters.maxFairVal));

        // Search Query
        const q = query.trim().toUpperCase();
        if (q) {
            rows = rows.filter((r) => r.ticker.toUpperCase().includes(q));
        }

        return rows;
    }, [data, filters, query]);

    return (
        <>
            <RankingsTable
                rows={filteredRows}
                query={query}
                onQueryChange={setQuery}
                filters={filters}
                onFilterChange={setFilters}
            />
            {/* Scatter Plot */}
            <MarketScatterPlotD3 data={filteredRows} />
        </>
    );
}

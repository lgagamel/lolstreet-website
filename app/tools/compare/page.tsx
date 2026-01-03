"use client";

import React, { useState } from "react";
import { fetchStockSeriesForComparison, ComparisonSeries } from "@/app/actions";
import ComparisonChartD3 from "@/components/tools/ComparisonChartD3";

export default function ComparePage() {
    const [inputs, setInputs] = useState<string[]>(["NVDA", "AAPL"]);
    const [startDate, setStartDate] = useState<string>(() => {
        const d = new Date();
        d.setFullYear(d.getFullYear() - 1);
        return d.toISOString().split('T')[0];
    });

    const [loading, setLoading] = useState(false);
    const [series, setSeries] = useState<ComparisonSeries[]>([]);
    const [isRacing, setIsRacing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleAddTicker = () => {
        if (inputs.length < 3) {
            setInputs([...inputs, ""]);
        }
    };

    const handleRemoveTicker = (idx: number) => {
        const next = [...inputs];
        next.splice(idx, 1);
        setInputs(next);
    };

    const handleInputChange = (idx: number, val: string) => {
        const next = [...inputs];
        next[idx] = val.toUpperCase();
        setInputs(next);
    };

    const handleRun = async () => {
        setLoading(true);
        setError(null);
        setIsRacing(false);
        setSeries([]); // Clear old

        try {
            const promises = inputs
                .filter(t => t.trim().length > 0)
                .map(t => fetchStockSeriesForComparison(t.trim(), startDate));

            const results = await Promise.all(promises);
            const valid = results.filter((s): s is ComparisonSeries => s !== null);

            if (valid.length === 0) {
                setError("No data found for the given tickers/date.");
            } else {
                setSeries(valid);
                // Trigger Race
                setTimeout(() => setIsRacing(true), 100);
            }
        } catch (err) {
            console.error(err);
            setError("Failed to fetch updated data.");
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="max-w-7xl mx-auto px-4 py-8">
            <div className="mb-8 text-center">
                <h1 className="text-4xl font-black mb-2 bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-pink-500">
                    Stock Price Race 🏎️
                </h1>
                <p className="text-gray-500 dark:text-gray-400">
                    Visualize relative returns and see who wins the race!
                </p>
            </div>

            <div className="max-w-3xl mx-auto bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-800 mb-8">
                <div className="flex flex-col md:flex-row gap-6 items-end">
                    <div className="flex-1 space-y-3 w-full">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Racers (Tickers)</label>
                        {inputs.map((tic, i) => (
                            <div key={i} className="flex gap-2">
                                <input
                                    type="text"
                                    value={tic}
                                    placeholder="e.g. MSFT"
                                    onChange={e => handleInputChange(i, e.target.value)}
                                    className="flex-1 bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2 font-mono uppercase focus:ring-2 focus:ring-indigo-500 outline-none"
                                />
                                {inputs.length > 1 && (
                                    <button
                                        onClick={() => handleRemoveTicker(i)}
                                        className="text-red-400 hover:text-red-600 px-2"
                                    >
                                        ✕
                                    </button>
                                )}
                            </div>
                        ))}
                        {inputs.length < 3 && (
                            <button
                                onClick={handleAddTicker}
                                className="text-sm text-indigo-500 font-medium hover:text-indigo-600 flex items-center gap-1"
                            >
                                + Add Racer
                            </button>
                        )}
                    </div>

                    <div className="w-full md:w-auto space-y-3">
                        <label className="text-sm font-semibold text-gray-700 dark:text-gray-300">Start Date</label>
                        <input
                            type="date"
                            value={startDate}
                            onChange={e => setStartDate(e.target.value)}
                            className="w-full bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg px-3 py-2"
                        />
                    </div>

                    <div className="w-full md:w-auto">
                        <button
                            onClick={handleRun}
                            disabled={loading}
                            className={`w-full md:w-auto px-8 py-3 rounded-xl font-bold text-white shadow-lg transition-all ${loading
                                    ? "bg-gray-400 cursor-not-allowed"
                                    : "bg-gradient-to-r from-indigo-500 to-pink-500 hover:scale-105 active:scale-95 shadow-indigo-500/25"
                                }`}
                        >
                            {loading ? "Starting Engines..." : "RUN RACE 🏁"}
                        </button>
                    </div>
                </div>
                {error && <div className="mt-4 text-center text-red-500 text-sm font-medium">{error}</div>}
            </div>

            {/* Chart Area */}
            {series.length > 0 && (
                <div className="bg-white dark:bg-gray-900 rounded-2xl p-6 shadow-xl border border-gray-100 dark:border-gray-800">
                    <ComparisonChartD3 series={series} isRacing={isRacing} />

                    <div className="mt-6 grid grid-cols-1 md:grid-cols-3 gap-4">
                        {series.map((s, i) => (
                            <div key={s.ticker} className="flex items-center gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-800">
                                <div
                                    className="w-10 h-10 rounded-full flex items-center justify-center text-white font-bold shadow-md"
                                    style={{ backgroundColor: ["#8b5cf6", "#ec4899", "#f59e0b", "#10b981", "#3b82f6"][i % 5] }}
                                >
                                    #{i + 1}
                                </div>
                                <div>
                                    <div className="font-bold text-lg">{s.ticker}</div>
                                    <div className={`text-sm font-mono font-bold ${s.returnPct >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {s.returnPct > 0 ? '+' : ''}{s.returnPct.toFixed(2)}%
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            )}
        </main>
    );
}

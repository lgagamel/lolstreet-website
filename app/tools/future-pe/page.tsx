"use client";

import React, { useState, useEffect, useMemo } from "react";
import { fetchFuturePEToolData, FuturePEToolData } from "@/app/actions";
import FuturePEChartD3 from "@/components/tools/FuturePEChartD3";
import FuturePEComparisonChartD3, { ComparisonScenario } from "@/components/tools/FuturePEComparisonChartD3";
import { generateEarningsDates, buildDefaultAssumptions, calculatePEProjection, FutureAssumption } from "@/lib/tools/futurePeLogic";
import { StockDailyRow } from "@/types";

// Types
interface StockScenario {
    id: string; // Unique ID (e.g. ticker-timestamp)
    ticker: string;
    data: FuturePEToolData;
    assumptions: FutureAssumption[]; // The "Source of Truth" state
    editMode: 'growth' | 'eps';
    color: string;
}

const COLORS = ["#3b82f6", "#10b981", "#f59e0b", "#ec4899", "#8b5cf6"];

export default function FuturePEMainPage() {
    // Input State
    const [tickerInput, setTickerInput] = useState("");
    const [loading, setLoading] = useState(false);

    // Scenarios State
    const [scenarios, setScenarios] = useState<StockScenario[]>([]);

    // Load Handler
    const handleLoad = async () => {
        if (!tickerInput) return;
        setLoading(true);
        try {
            const res = await fetchFuturePEToolData(tickerInput);
            if (res) {
                addScenario(res);
                setTickerInput(""); // Clear input on success
            } else {
                alert("Ticker not found or missing data.");
            }
        } catch (e) {
            console.error(e);
            alert("Error loading data.");
        } finally {
            setLoading(false);
        }
    };

    const addScenario = (baseData: FuturePEToolData) => {
        const id = `${baseData.ticker}-${Date.now()}`; // Unique ID even for same ticker
        const color = COLORS[scenarios.length % COLORS.length];

        // 1. Generate Defaults
        let baseDate = new Date();
        if (baseData.currentDate) {
            baseDate = new Date(baseData.currentDate);
        }

        let dates: Date[];
        if (baseData.nextEarningsDate) {
            const nextDate = new Date(baseData.nextEarningsDate);
            // Ensure nextDate is future relative to base? Or just take it.
            // Consistency logic:
            if (nextDate > baseDate) {
                // ok
            }
            const subsequentDates = generateEarningsDates(nextDate, 11);
            dates = [nextDate, ...subsequentDates];
        } else {
            dates = generateEarningsDates(baseDate, 12);
        }

        const defaults = buildDefaultAssumptions(baseData.currentEPS, baseData.growthRate, dates);

        const newScenario: StockScenario = {
            id,
            ticker: baseData.ticker,
            data: baseData,
            assumptions: defaults,
            editMode: 'growth',
            color
        };

        setScenarios(prev => [...prev, newScenario]);
    };

    const handleRemove = (id: string) => {
        setScenarios(prev => prev.filter(s => s.id !== id));
    };

    const handleReset = (id: string) => {
        setScenarios(prev => prev.map(s => {
            if (s.id !== id) return s;

            // Re-generate defaults
            const baseData = s.data;
            let baseDate = new Date();
            if (baseData.currentDate) {
                baseDate = new Date(baseData.currentDate);
            }

            let dates: Date[];
            if (baseData.nextEarningsDate) {
                const nextDate = new Date(baseData.nextEarningsDate);
                const subsequentDates = generateEarningsDates(nextDate, 11);
                dates = [nextDate, ...subsequentDates];
            } else {
                dates = generateEarningsDates(baseDate, 12);
            }

            const defaults = buildDefaultAssumptions(baseData.currentEPS, baseData.growthRate, dates);

            return { ...s, assumptions: defaults };
        }));
    };

    const handleEditModeToggle = (id: string, mode: 'growth' | 'eps') => {
        setScenarios(prev => prev.map(s => s.id === id ? { ...s, editMode: mode } : s));
    };


    // Assumption Change Handler (Unified)
    const handleAssumptionChange = (scenarioId: string, index: number, field: 'growthRate' | 'eps', value: string) => {
        const numVal = parseFloat(value);
        if (isNaN(numVal)) return;

        setScenarios(prev => prev.map(scenario => {
            if (scenario.id !== scenarioId) return scenario;

            const newAssumptions = [...scenario.assumptions];
            const item = { ...newAssumptions[index] };
            const data = scenario.data;

            if (field === 'growthRate') {
                // User input: Annual. Store: Quarterly.
                const ann = numVal;
                const q = (Math.pow(1 + ann / 100, 0.25) - 1) * 100;
                item.growthRate = q;

                // Sync EPS
                const prevEPS = index === 0 ? data.currentEPS : newAssumptions[index - 1].eps;
                item.eps = prevEPS * (1 + q / 100);

            } else {
                // User input: EPS. Store: EPS. Sync Growth.
                item.eps = numVal;
                const prevEPS = index === 0 ? data.currentEPS : newAssumptions[index - 1].eps;
                if (prevEPS !== 0) {
                    item.growthRate = ((item.eps / prevEPS) - 1) * 100;
                } else {
                    item.growthRate = 0;
                }
            }
            newAssumptions[index] = item;

            // Cascade Updates
            let current_eps = item.eps;
            for (let i = index + 1; i < newAssumptions.length; i++) {
                const nextItem = { ...newAssumptions[i] };
                const g = nextItem.growthRate / 100;
                nextItem.eps = current_eps * (1 + g);
                newAssumptions[i] = nextItem;
                current_eps = nextItem.eps;
            }

            return { ...scenario, assumptions: newAssumptions };
        }));
    };

    const handleChartDrag = (scenarioId: string, date: Date, newAnnualGrowth: number) => {
        const s = scenarios.find(x => x.id === scenarioId);
        if (!s) return;
        const index = s.assumptions.findIndex(a => a.date.getTime() === date.getTime());
        if (index === -1) return;

        handleAssumptionChange(scenarioId, index, 'growthRate', newAnnualGrowth.toString());
    };

    const handleGrowthAdjustment = (scenarioId: string, delta: number) => {
        setScenarios(prev => prev.map(scenario => {
            if (scenario.id !== scenarioId) return scenario;

            const newAssumptions = [...scenario.assumptions];
            const data = scenario.data;
            let current_eps = data.currentEPS; // Starting point

            // Iterate and update all
            for (let i = 0; i < newAssumptions.length; i++) {
                const item = { ...newAssumptions[i] };

                // Get current annual growth
                const currentQ = item.growthRate / 100;
                const currentAnn = (Math.pow(1 + currentQ, 4) - 1) * 100;

                // Apply delta
                const newAnn = currentAnn + delta;

                // Convert back to Quarterly
                const newQ = (Math.pow(1 + newAnn / 100, 0.25) - 1) * 100;
                item.growthRate = newQ;

                // Re-calculate EPS based on prev (either initial data or prev item)
                const prevEPS = i === 0 ? current_eps : newAssumptions[i - 1].eps;
                item.eps = prevEPS * (1 + newQ / 100);

                newAssumptions[i] = item;
            }
            // Note: Since we updated sequentially, we don't need a second pass for cascading,
            // because loop index i references the *already updated* newAssumptions[i-1].eps

            return { ...scenario, assumptions: newAssumptions };
        }));
    };


    // Derived Scenarios for Comp Charts and Render
    // We calculate projectionPoints on fly (in render map) or memoize?
    // Memoizing the array of "Processed Scenarios" is best.
    const processedScenarios = useMemo(() => {
        return scenarios.map(s => {
            const projection = calculatePEProjection(s.data.price, s.data.currentEPS, s.assumptions, s.data.currentDate ? new Date(s.data.currentDate) : undefined);

            // Chart Assumptions (Annualized for display)
            const chartAssumptions = s.assumptions.map(a => {
                const q = a.growthRate / 100;
                const ann = (Math.pow(1 + q, 4) - 1) * 100;
                return {
                    ...a,
                    growthRate: ann,
                    effectiveGrowthRate: ann
                };
            });

            return {
                ...s,
                projection,
                chartAssumptions
            };
        });
    }, [scenarios]);

    // Comparison Data Format
    const comparisonData: ComparisonScenario[] = useMemo(() => {
        return processedScenarios.map(s => {
            // Find points that match assumption dates for markers
            const markers = s.assumptions.map(a => {
                // Find closest point or exact match
                // Data is daily, assumption dates should exist in projection if strictly future?
                // Actually calculatePEProjection includes 'now' to 'last assumption'.
                // Using simple string matching or find
                const aTime = a.date.getTime();
                const match = s.projection.find(p => {
                    const pTime = new Date(p.date).getTime();
                    // Match day precision
                    return Math.abs(pTime - aTime) < 24 * 60 * 60 * 1000;
                });
                return match ? { date: new Date(match.date), pe: match.pe_ratio } : null;
            }).filter(Boolean) as { date: Date, pe: number }[];

            return {
                id: s.id,
                ticker: s.ticker,
                points: s.projection,
                color: s.color,
                markers
            };
        });
    }, [processedScenarios]);


    return (
        <main className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white p-4 md:p-8">
            <div className="max-w-7xl mx-auto space-y-8">
                {/* Header */}
                <div className="text-center space-y-2">
                    <h1 className="text-3xl md:text-4xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-green-600">
                        Future PE Simulator
                    </h1>
                    <p className="text-sm md:text-base text-gray-500 max-w-2xl mx-auto">
                        What will happen to the PE ratio if the current price continues?
                    </p>
                    <div className="flex flex-wrap gap-2 justify-center text-xs text-orange-600 dark:text-orange-400 mt-2">
                        <span className="bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded">⚠️ Future earnings dates are estimated</span>
                        <span className="bg-orange-100 dark:bg-orange-900/30 px-2 py-1 rounded">⚠️ Inputs are user assumptions</span>
                    </div>
                </div>

                {/* Input Section */}
                <div className="flex flex-col md:flex-row gap-4 items-center justify-center p-6 bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-200 dark:border-gray-800">
                    <input
                        type="text"
                        placeholder="Enter Ticker (e.g. AAPL)"
                        className="px-4 py-2 border rounded-lg bg-transparent dark:border-gray-700 w-full md:w-48 uppercase font-bold"
                        value={tickerInput}
                        onChange={(e) => setTickerInput(e.target.value.toUpperCase())}
                        onKeyDown={(e) => e.key === 'Enter' && handleLoad()}
                    />
                    <button
                        onClick={handleLoad}
                        disabled={loading || !tickerInput}
                        className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white font-medium rounded-lg disabled:opacity-50 transition-colors w-full md:w-auto"
                    >
                        {loading ? "Loading..." : "Add Stock"}
                    </button>
                    {scenarios.length > 0 && (
                        <button
                            onClick={() => setScenarios([])}
                            className="px-4 py-2 text-sm text-red-500 hover:text-red-700 underline"
                        >
                            Clear All
                        </button>
                    )}
                </div>

                {/* Summary Chart */}
                {scenarios.length > 0 && (
                    <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm relative">
                        <FuturePEComparisonChartD3
                            scenarios={comparisonData}
                            height={400}
                        />
                    </div>
                )}

                {/* Scenarios Grid */}
                <div className="grid gap-12">
                    {processedScenarios.map((s, idx) => (
                        <div key={s.id} className="space-y-4 border-t pt-8 first:border-t-0 first:pt-0 border-gray-200 dark:border-gray-800">
                            {/* Scenario Header */}
                            <div className="flex justify-between items-center">
                                <h2 className="text-2xl font-bold flex items-center gap-3">
                                    <span className="w-4 h-4 rounded-full" style={{ backgroundColor: s.color }} />
                                    {s.ticker}
                                    <span className="text-sm font-normal text-gray-400 ml-2">Assumes price stays at ${s.data.price.toFixed(2)}</span>
                                </h2>
                                <div className="flex gap-2">
                                    <button
                                        onClick={() => handleReset(s.id)}
                                        className="text-sm text-gray-500 hover:text-blue-500 px-3 py-1 rounded hover:bg-gray-100 dark:hover:bg-gray-800"
                                    >
                                        Reset
                                    </button>
                                    <button
                                        onClick={() => handleRemove(s.id)}
                                        className="text-sm text-red-500 hover:text-red-700 px-3 py-1 rounded hover:bg-red-50 dark:hover:bg-red-900/20"
                                    >
                                        Remove
                                    </button>
                                </div>
                            </div>

                            {/* Stats Box */}
                            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
                                <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800 text-center">
                                    <div className="text-[10px] text-gray-500 uppercase">Price</div>
                                    <div className="font-bold">${s.data.price.toFixed(2)}</div>
                                </div>
                                <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800 text-center">
                                    <div className="text-[10px] text-gray-500 uppercase">TTM EPS</div>
                                    <div className="font-bold">${s.data.currentEPS.toFixed(2)}</div>
                                </div>
                                <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800 text-center">
                                    <div className="text-[10px] text-gray-500 uppercase">YoY Avg Growth</div>
                                    <div className="font-bold text-green-600">{s.data.growthRate.toFixed(2)}%</div>
                                </div>
                                <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800 text-center">
                                    <div className="text-[10px] text-gray-500 uppercase">Current PE</div>
                                    <div className="font-bold text-blue-600">{(s.data.currentEPS > 0 ? (s.data.price / s.data.currentEPS) : 0).toFixed(2)}x</div>
                                </div>
                                {s.data.lastReportDate && (
                                    <div className="p-3 bg-white dark:bg-gray-900 rounded border border-gray-100 dark:border-gray-800 text-center col-span-2 md:col-span-1">
                                        <div className="text-[10px] text-gray-500 uppercase">Last Reported</div>
                                        <div className="font-bold text-gray-600 dark:text-gray-400">{new Date(s.data.lastReportDate).toLocaleDateString(undefined, { dateStyle: 'medium' })}</div>
                                    </div>
                                )}
                            </div>

                            {/* Chart + Table Layout */}
                            <div className="grid lg:grid-cols-3 gap-8">
                                <div className="lg:col-span-2 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-4 shadow-sm">
                                    <FuturePEChartD3
                                        data={s.projection}
                                        assumptions={s.chartAssumptions}
                                        height={400}
                                        onDragEnd={(date, newRate) => handleChartDrag(s.id, date, newRate)}
                                    />
                                </div>

                                <div className="lg:col-span-1 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 flex flex-col shadow-sm max-h-[500px]">
                                    {/* Table Header */}
                                    <div className="p-3 border-b border-gray-100 dark:border-gray-800 flex justify-between items-center bg-gray-50 dark:bg-gray-800/50 rounded-t-xl">
                                        <h3 className="font-semibold text-sm">Assumptions</h3>
                                        <div className="flex gap-2 items-center">
                                            {s.editMode === 'growth' && (
                                                <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-0.5 text-[10px] items-center mr-2">
                                                    <span className="px-1.5 text-gray-500 uppercase font-semibold">Adj All:</span>
                                                    <button
                                                        onClick={() => handleGrowthAdjustment(s.id, -1)}
                                                        className="px-2 py-0.5 hover:bg-white dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300 transition-colors"
                                                        title="Decrease all by 1%"
                                                    >
                                                        -1%
                                                    </button>
                                                    <div className="w-px h-3 bg-gray-300 dark:bg-gray-600 mx-0.5"></div>
                                                    <button
                                                        onClick={() => handleGrowthAdjustment(s.id, 1)}
                                                        className="px-2 py-0.5 hover:bg-white dark:hover:bg-gray-600 rounded text-gray-700 dark:text-gray-300 transition-colors"
                                                        title="Increase all by 1%"
                                                    >
                                                        +1%
                                                    </button>
                                                </div>
                                            )}
                                            <div className="flex bg-gray-200 dark:bg-gray-700 rounded-lg p-1 text-[10px] font-medium">
                                                <button
                                                    className={`px-2 py-1 rounded transition-all ${s.editMode === 'growth' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600' : 'text-gray-500'}`}
                                                    onClick={() => handleEditModeToggle(s.id, 'growth')}
                                                >
                                                    Growth
                                                </button>
                                                <button
                                                    className={`px-2 py-1 rounded transition-all ${s.editMode === 'eps' ? 'bg-white dark:bg-gray-600 shadow-sm text-blue-600' : 'text-gray-500'}`}
                                                    onClick={() => handleEditModeToggle(s.id, 'eps')}
                                                >
                                                    EPS
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                    {/* Table Body */}
                                    <div className="overflow-auto flex-1 p-2">
                                        <table className="w-full text-sm">
                                            <thead className="text-xs text-gray-500 border-b dark:border-gray-700 sticky top-0 bg-white dark:bg-gray-900 z-10">
                                                <tr>
                                                    <th className="py-2 text-left pl-2">Date</th>
                                                    <th className="py-2 text-right">YoY Growth %</th>
                                                    <th className="py-2 text-right pr-2">EPS $</th>
                                                </tr>
                                            </thead>
                                            <tbody className="divide-y divide-gray-100 dark:divide-gray-800">
                                                {s.chartAssumptions.map((row, i) => (
                                                    <tr key={i} className="group hover:bg-gray-50 dark:hover:bg-gray-800/50 transition-colors">
                                                        <td className="py-2 pl-2 font-mono text-xs text-gray-600 dark:text-gray-400">
                                                            {row.date.toLocaleDateString(undefined, { month: 'short', year: '2-digit' })}
                                                        </td>
                                                        <td className="py-2 text-right">
                                                            {s.editMode === 'growth' ? (
                                                                <input
                                                                    type="number"
                                                                    className="w-14 text-right bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-1 focus:ring-2 ring-blue-500 outline-none text-xs"
                                                                    value={row.growthRate.toFixed(1)}
                                                                    onChange={(e) => handleAssumptionChange(s.id, i, 'growthRate', e.target.value)}
                                                                />
                                                            ) : (
                                                                <span className="text-gray-400 text-xs">
                                                                    {row.effectiveGrowthRate?.toFixed(1)}%
                                                                </span>
                                                            )}
                                                        </td>
                                                        <td className="py-2 text-right pr-2">
                                                            {s.editMode === 'eps' ? (
                                                                <input
                                                                    type="number"
                                                                    step="0.01"
                                                                    className="w-14 text-right bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded px-1 focus:ring-2 ring-blue-500 outline-none text-xs"
                                                                    value={row.eps.toFixed(2)}
                                                                    onChange={(e) => handleAssumptionChange(s.id, i, 'eps', e.target.value)}
                                                                />
                                                            ) : (
                                                                <span className="font-bold text-gray-700 dark:text-gray-200 text-xs">${row.eps.toFixed(2)}</span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {scenarios.length === 0 && (
                    <div className="text-center py-20 text-gray-400 border-2 border-dashed border-gray-200 dark:border-gray-800 rounded-xl">
                        <p className="text-lg">Enter a stock ticker above to start analyzing.</p>
                        <p className="text-sm mt-2">Add multiple stocks to compare them side-by-side.</p>
                    </div>
                )}
            </div>
        </main>
    );
}

"use client";

import { useState, useEffect, useMemo } from "react";
import CompoundInterestChartD3, { CompoundDataPoint } from "@/components/tools/CompoundInterestChartD3";

// Determine emoji based on wealth
const getWealthEmoji = (amount: number) => {
    if (amount < 1000) return "🌱"; // Seed
    if (amount < 10000) return "🌿"; // Plant
    if (amount < 50000) return "🌳"; // Tree
    if (amount < 100000) return "🍎"; // Fruit
    if (amount < 500000) return "🏠"; // House
    if (amount < 1000000) return "🏎️"; // Lambo
    if (amount < 10000000) return "🚀"; // Rocket
    return "🪐"; // Planet
};

export default function CompoundInterestPage() {
    // State
    const [principal, setPrincipal] = useState(10000);
    const [monthlyContribution, setMonthlyContribution] = useState(500);
    const [years, setYears] = useState(20);
    const [rate, setRate] = useState(8); // Annual return %
    const [frequency, setFrequency] = useState<"yearly" | "monthly" | "daily">("yearly");

    // Calculation Logic
    const resultData = useMemo(() => {
        const data: CompoundDataPoint[] = [];
        let currentPrincipal = principal;
        let currentInterest = 0;
        let total = principal;

        // Normalize rate
        const r = rate / 100;

        // Calculations per year
        for (let y = 0; y <= years; y++) {
            if (y === 0) {
                data.push({ year: 0, principal: principal, interest: 0, total: principal });
                continue;
            }

            // Simple iterative calculation for accuracy with monthly contributions
            // We could use formula, but iteration is easier to track "interest vs principal" strictly

            let periods = 1;
            if (frequency === "monthly") periods = 12;
            if (frequency === "daily") periods = 365;

            // Days when monthly contributions are added (for daily frequency)
            const monthEnds = [31, 59, 90, 120, 151, 181, 212, 243, 273, 304, 334, 365];

            // Iterate through all periods in this year
            for (let p = 1; p <= periods; p++) {
                // Add Interest
                const interestEarned = total * (r / periods);
                currentInterest += interestEarned;
                total += interestEarned;

                // Add Contribution
                if (frequency === "monthly") {
                    total += monthlyContribution;
                    currentPrincipal += monthlyContribution;
                } else if (frequency === "daily") {
                    if (monthEnds.includes(p)) {
                        total += monthlyContribution;
                        currentPrincipal += monthlyContribution;
                    }
                }
            }

            // If yearly, add contributions at the end
            if (frequency === "yearly") {
                total += (monthlyContribution * 12);
                currentPrincipal += (monthlyContribution * 12);
            }

            data.push({
                year: y,
                principal: currentPrincipal,
                interest: currentInterest,
                total: total
            });
        }
        return data;
    }, [principal, monthlyContribution, years, rate, frequency]);

    const finalResult = resultData[resultData.length - 1];

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white p-8">
            <div className="max-w-6xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-green-500">
                        Visualizing Compound Growth 💸
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400">
                        See how money makes money over time.
                    </p>
                </div>

                <div className="grid lg:grid-cols-3 gap-8">
                    {/* Controls */}
                    <div className="lg:col-span-1 space-y-8 bg-white dark:bg-gray-900 p-8 rounded-3xl border border-gray-100 dark:border-gray-800 shadow-xl">
                        {/* Principal */}
                        <div className="space-y-2">
                            <label className="font-semibold text-gray-600 dark:text-gray-300">Initial Investment</label>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-indigo-500">$</span>
                                <input
                                    type="number"
                                    value={principal}
                                    onChange={(e) => setPrincipal(Number(e.target.value))}
                                    className="w-full bg-transparent text-2xl font-bold outline-none border-b focus:border-indigo-500 transition-colors"
                                />
                            </div>
                            <input
                                type="range" min="0" max="100000" step="1000"
                                value={principal} onChange={(e) => setPrincipal(Number(e.target.value))}
                                className="w-full accent-indigo-500"
                            />
                        </div>

                        {/* Monthly Contribution */}
                        <div className="space-y-2">
                            <label className="font-semibold text-gray-600 dark:text-gray-300">Monthly Contribution</label>
                            <div className="flex items-center gap-2">
                                <span className="text-2xl font-bold text-green-500">$</span>
                                <input
                                    type="number"
                                    value={monthlyContribution}
                                    onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                                    className="w-full bg-transparent text-2xl font-bold outline-none border-b focus:border-green-500 transition-colors"
                                />
                            </div>
                            <input
                                type="range" min="0" max="10000" step="100"
                                value={monthlyContribution} onChange={(e) => setMonthlyContribution(Number(e.target.value))}
                                className="w-full accent-green-500"
                            />
                        </div>

                        {/* Rate */}
                        <div className="space-y-2">
                            <label className="font-semibold text-gray-600 dark:text-gray-300">Annual Return</label>
                            <div className="flex items-center gap-2">
                                <span className="text-3xl font-bold text-orange-500">{rate}%</span>
                            </div>
                            <input
                                type="range" min="1" max="50" step="0.5"
                                value={rate} onChange={(e) => setRate(Number(e.target.value))}
                                className="w-full accent-orange-500"
                            />
                            <div className="flex justify-between text-xs text-gray-400">
                                <span>Conservative (4%)</span>
                                <span>S&P 500 (10%)</span>
                                <span>Aggressive (20%)</span>
                            </div>
                        </div>

                        {/* Years */}
                        <div className="space-y-2">
                            <label className="font-semibold text-gray-600 dark:text-gray-300">Time Period</label>
                            <div className="flex items-center gap-2">
                                <span className="text-3xl font-bold text-blue-500">{years} Years</span>
                            </div>
                            <input
                                type="range" min="1" max="50" step="1"
                                value={years} onChange={(e) => setYears(Number(e.target.value))}
                                className="w-full accent-blue-500"
                            />
                        </div>

                        {/* Frequency Toggle */}
                        <div className="p-4 bg-gray-50 dark:bg-gray-800 rounded-xl">
                            <label className="block text-sm font-semibold mb-3 text-gray-500 uppercase tracking-wider">Compound Frequency</label>
                            <div className="flex gap-2">
                                {(["yearly", "monthly", "daily"] as const).map((freq) => (
                                    <button
                                        key={freq}
                                        onClick={() => setFrequency(freq)}
                                        className={`flex-1 py-2 px-3 rounded-lg text-sm font-bold capitalize transition-all ${frequency === freq
                                            ? "bg-white dark:bg-black shadow text-indigo-600 dark:text-indigo-400"
                                            : "text-gray-400 hover:text-gray-600 hover:bg-gray-100"
                                            }`}
                                    >
                                        {freq}
                                    </button>
                                ))}
                            </div>
                        </div>
                    </div>

                    {/* Visualizer */}
                    <div className="lg:col-span-2 space-y-8">
                        {/* Big Numbers Card */}
                        <div className="grid md:grid-cols-2 gap-4">
                            <div className="bg-gradient-to-br from-indigo-500 to-indigo-700 rounded-3xl p-8 text-white shadow-lg transform hover:scale-105 transition-transform duration-300">
                                <div className="text-indigo-100 font-medium mb-1">Total Contributions</div>
                                <div className="text-4xl font-bold tracking-tight">
                                    ${finalResult.principal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                                <div className="mt-4 text-sm opacity-80 bg-white/10 inline-block px-3 py-1 rounded-full">
                                    Your Hard Work 💪
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-3xl p-8 text-white shadow-lg transform hover:scale-105 transition-transform duration-300">
                                <div className="text-green-100 font-medium mb-1">Total Interest Earned</div>
                                <div className="text-4xl font-bold tracking-tight">
                                    ${finalResult.interest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                                <div className="mt-4 text-sm opacity-80 bg-white/10 inline-block px-3 py-1 rounded-full">
                                    Money Working for You 🛌
                                </div>
                            </div>
                        </div>

                        {/* Total Result */}
                        <div className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

                            <div className="text-lg opacity-60 font-medium uppercase tracking-widest mb-2">Portfolio Value in {new Date().getFullYear() + years}</div>
                            <div className="text-5xl md:text-7xl font-black tracking-tighter mb-4 break-words px-4">
                                ${finalResult.total.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>

                            <div className="text-6xl animate-bounce">
                                {getWealthEmoji(finalResult.total)}
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-xl">
                            <h3 className="text-lg font-bold mb-6 text-gray-500">Growth Trajectory</h3>
                            <CompoundInterestChartD3 data={resultData} />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

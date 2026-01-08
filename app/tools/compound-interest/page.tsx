"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import CompoundInterestChartD3, { CompoundDataPoint } from "@/components/tools/CompoundInterestChartD3";

// Determine item based on investment amount with realistic prices
const getInvestmentItem = (amount: number): { emoji: string; name: string; price: number } => {
    if (amount < 15) return { emoji: "🍕", name: "Pizza", price: 10 };
    if (amount < 35) return { emoji: "📚", name: "Book", price: 25 };
    if (amount < 75) return { emoji: "🎮", name: "Video Game", price: 60 };
    if (amount < 150) return { emoji: "👟", name: "Sneakers", price: 120 };
    if (amount < 350) return { emoji: "🎧", name: "Headphones", price: 250 };
    if (amount < 750) return { emoji: "⌚", name: "Watch", price: 500 };
    if (amount < 1250) return { emoji: "📱", name: "Phone", price: 1000 };
    if (amount < 2500) return { emoji: "💻", name: "Laptop", price: 2000 };
    if (amount < 6000) return { emoji: "🖥️", name: "Gaming PC", price: 4000 };
    if (amount < 12500) return { emoji: "🏍️", name: "Motorcycle", price: 10000 };
    if (amount < 30000) return { emoji: "🚗", name: "Used Car", price: 25000 };
    if (amount < 60000) return { emoji: "🚙", name: "New Car", price: 50000 };
    if (amount < 125000) return { emoji: "⛵", name: "Boat", price: 100000 };
    if (amount < 200000) return { emoji: "🏠", name: "Down Payment", price: 150000 };
    if (amount < 400000) return { emoji: "🏡", name: "Small House", price: 300000 };
    if (amount < 750000) return { emoji: "🏘️", name: "House", price: 600000 };
    if (amount < 1500000) return { emoji: "🏰", name: "Large House", price: 1000000 };
    return { emoji: "🏢", name: "Building", price: 2000000 };
};

export default function CompoundInterestPage() {
    // State
    const [principal, setPrincipal] = useState(10000);
    const [monthlyContribution, setMonthlyContribution] = useState(0);
    const [years, setYears] = useState(20);
    const [rate, setRate] = useState(8); // Annual return %
    const [frequency, setFrequency] = useState<"yearly" | "monthly" | "daily">("yearly");

    // Animation state
    const [animatedYear, setAnimatedYear] = useState(0);
    const [animatedTotal, setAnimatedTotal] = useState(principal);
    const [animatedPrincipal, setAnimatedPrincipal] = useState(principal);
    const [animatedInterest, setAnimatedInterest] = useState(0);

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

    // Get item based on INITIAL investment
    const initialItem = getInvestmentItem(principal);

    // Calculate multiplier and current item
    const multiplier = animatedTotal / initialItem.price;
    const currentAnimatedYear = Math.floor(animatedYear);
    const currentAnimatedDay = Math.floor((animatedYear % 1) * 365);

    // Handle animation updates (wrapped in useCallback to prevent infinite loops)
    const handleAnimationUpdate = useCallback((year: number, total: number, principalVal: number, interest: number) => {
        setAnimatedYear(year);
        setAnimatedTotal(total);
        setAnimatedPrincipal(principalVal);
        setAnimatedInterest(interest);
    }, []);

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white p-8">
            <div className="max-w-6xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-indigo-500 to-green-500">
                        Investment Growth Calculator 💰
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400">
                        See how your money could grow with ANY investment - stocks, real estate, or anything else!
                    </p>
                    <p className="text-sm text-gray-500 dark:text-gray-500 max-w-3xl mx-auto">
                        Choose an expected annual return rate below, or use our benchmarks and model estimates as a starting point.
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
                                type="range" min="0" max="1000000" step="100"
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

                            {/* Benchmark Presets */}
                            <div className="pt-4 space-y-3">
                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">📊 Benchmarks</div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setRate(10)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-300 hover:bg-blue-200 dark:hover:bg-blue-900/50 transition-colors border border-blue-200 dark:border-blue-800"
                                    >
                                        S&P 500 (10%)
                                    </button>
                                    <button
                                        onClick={() => setRate(5)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300 hover:bg-amber-200 dark:hover:bg-amber-900/50 transition-colors border border-amber-200 dark:border-amber-800"
                                    >
                                        Real Estate (5%)
                                    </button>
                                </div>
                            </div>

                            {/* Stock Model Estimates */}
                            <div className="pt-2 space-y-3">
                                <div className="text-xs font-semibold text-gray-500 uppercase tracking-wider">🎯 Model Estimates (1Y)</div>
                                <div className="flex flex-wrap gap-2">
                                    <button
                                        onClick={() => setRate(149.86)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-300 hover:bg-purple-200 dark:hover:bg-purple-900/50 transition-colors border border-purple-200 dark:border-purple-800"
                                    >
                                        PLTR (149.9%)
                                    </button>
                                    <button
                                        onClick={() => setRate(61.68)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 hover:bg-green-200 dark:hover:bg-green-900/50 transition-colors border border-green-200 dark:border-green-800"
                                    >
                                        NVDA (61.7%)
                                    </button>
                                    <button
                                        onClick={() => setRate(29.51)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-indigo-100 dark:bg-indigo-900/30 text-indigo-700 dark:text-indigo-300 hover:bg-indigo-200 dark:hover:bg-indigo-900/50 transition-colors border border-indigo-200 dark:border-indigo-800"
                                    >
                                        META (29.5%)
                                    </button>
                                    <button
                                        onClick={() => setRate(16.73)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-cyan-100 dark:bg-cyan-900/30 text-cyan-700 dark:text-cyan-300 hover:bg-cyan-200 dark:hover:bg-cyan-900/50 transition-colors border border-cyan-200 dark:border-cyan-800"
                                    >
                                        MSFT (16.7%)
                                    </button>
                                    <button
                                        onClick={() => setRate(15.28)}
                                        className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-gray-100 dark:bg-gray-700 text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600 transition-colors border border-gray-200 dark:border-gray-600"
                                    >
                                        AAPL (15.3%)
                                    </button>
                                </div>
                                <p className="text-xs text-gray-400 italic">
                                    💡 These are model estimates, not guarantees!
                                </p>
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
                                    ${animatedPrincipal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                                <div className="mt-4 text-sm opacity-80 bg-white/10 inline-block px-3 py-1 rounded-full">
                                    Your Hard Work 💪
                                </div>
                            </div>

                            <div className="bg-gradient-to-br from-green-500 to-emerald-700 rounded-3xl p-8 text-white shadow-lg transform hover:scale-105 transition-transform duration-300">
                                <div className="text-green-100 font-medium mb-1">Investment Growth</div>
                                <div className="text-4xl font-bold tracking-tight">
                                    ${animatedInterest.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                                </div>
                                <div className="mt-4 text-sm opacity-80 bg-white/10 inline-block px-3 py-1 rounded-full">
                                    Money Working for You 🛌
                                </div>
                            </div>
                        </div>

                        {/* Total Result */}
                        <div className="bg-gray-900 dark:bg-white text-white dark:text-gray-900 rounded-3xl p-8 text-center shadow-2xl relative overflow-hidden group">
                            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-purple-500 to-pink-500"></div>

                            <div className="text-lg opacity-60 font-medium uppercase tracking-widest mb-2">
                                Year {currentAnimatedYear}, Day {currentAnimatedDay}
                            </div>
                            <div className="text-5xl md:text-7xl font-black tracking-tighter mb-4 break-words px-4">
                                ${animatedTotal.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                            </div>

                            <div className="text-4xl mb-1">
                                {multiplier.toFixed(1)}× {initialItem.emoji}
                            </div>
                            <div className="text-sm opacity-70 mb-2">
                                ({initialItem.name} @ ${initialItem.price.toLocaleString()})
                            </div>
                            <div className="text-sm opacity-60">
                                {multiplier >= 2 ? "You multiplied your investment!" : "Growing your wealth..."}
                            </div>
                        </div>

                        {/* Chart */}
                        <div className="bg-white dark:bg-gray-900 rounded-3xl p-6 border border-gray-100 dark:border-gray-800 shadow-xl">
                            <h3 className="text-lg font-bold mb-6 text-gray-500">Growth Trajectory</h3>
                            <CompoundInterestChartD3
                                data={resultData}
                                initialItemEmoji={initialItem.emoji}
                                initialItemPrice={initialItem.price}
                                onAnimationUpdate={handleAnimationUpdate}
                            />
                        </div>
                    </div>
                </div>
            </div>
        </main>
    );
}

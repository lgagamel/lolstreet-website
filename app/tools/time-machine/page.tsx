"use client";

import { useState, useEffect } from "react";
import { calculateTimeMachine, TimeMachineResult } from "@/app/actions";
import TimeMachineChartD3 from "@/components/tools/TimeMachineChartD3";

interface ProductPreset {
    id: string;
    emoji: string;
    name: string;
    ticker: string;
    date: string;
    price: number;
}

const PRESETS: ProductPreset[] = [
    { id: "iphone", emoji: "📱", name: "Original iPhone", ticker: "AAPL", date: "2007-06-29", price: 499 },
    { id: "model-s", emoji: "🚗", name: "Tesla Model S", ticker: "TSLA", date: "2012-06-22", price: 57400 },
    { id: "pltr", emoji: "💵", name: "Cash", ticker: "PLTR", date: "2021-05-11", price: 1000 },
    { id: "gtx1080", emoji: "💻", name: "Nvidia GTX 1080", ticker: "NVDA", date: "2016-05-27", price: 599 },
    { id: "oculus", emoji: "🥽", name: "Oculus Rift", ticker: "META", date: "2016-03-28", price: 599 },
    { id: "google-glass", emoji: "👓", name: "Google Glass", ticker: "GOOG", date: "2013-04-15", price: 1500 },
    { id: "xbox-one", emoji: "❎", name: "Xbox One", ticker: "MSFT", date: "2013-11-22", price: 499 },
    { id: "iphone-x", emoji: "📱", name: "iPhone X", ticker: "AAPL", date: "2017-11-03", price: 999 },
];

export default function TimeMachinePage() {
    const [selectedProduct, setSelectedProduct] = useState<ProductPreset | null>(null);
    const [loading, setLoading] = useState(false);
    const [result, setResult] = useState<TimeMachineResult | null>(null);
    const [error, setError] = useState<string | null>(null);

    const handleCalculate = async (product: ProductPreset) => {
        setLoading(true);
        setError(null);
        setSelectedProduct(product);
        setResult(null);

        try {
            const res = await calculateTimeMachine(product.ticker, product.date, product.price, product.name);
            if (!res) {
                setError(`Could not fetch data for ${product.ticker} around ${product.date}`);
            } else {
                setResult(res);
            }
        } catch (e) {
            setError("Something went wrong calculating the time travel math!");
            console.error(e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <main className="min-h-screen bg-gray-50 dark:bg-black text-gray-900 dark:text-white p-8">
            <div className="max-w-4xl mx-auto space-y-12">
                <div className="text-center space-y-4">
                    <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-blue-600 to-purple-600">
                        Investment Time Machine ⏳
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-400">
                        What if you bought stock instead of the product?
                    </p>
                </div>

                {/* Product Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-2md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {PRESETS.map((p) => (
                        <button
                            key={p.id}
                            onClick={() => handleCalculate(p)}
                            disabled={loading}
                            className={`p-6 rounded-2xl border transition-all duration-200 text-left group
                                ${selectedProduct?.id === p.id
                                    ? "border-blue-500 bg-blue-50 dark:bg-blue-900/20 ring-2 ring-blue-500/20"
                                    : "border-gray-200 dark:border-gray-800 bg-white dark:bg-gray-900 hover:border-blue-300 dark:hover:border-blue-700 hover:shadow-lg hover:-translate-y-1"
                                }`}
                        >
                            <div className="text-4xl mb-3 group-hover:scale-110 transition-transform duration-200">{p.emoji}</div>
                            <div className="font-bold text-lg">{p.name}</div>
                            <div className="text-sm text-gray-500 dark:text-gray-400 flex justify-between items-center mt-2">
                                <span>{new Date(p.date).getFullYear()}</span>
                                <span className="font-mono font-medium">${p.price}</span>
                            </div>
                            <div className="text-xs text-gray-400 mt-1 uppercase tracking-wider font-semibold group-hover:text-blue-500 transition-colors">
                                vs {p.ticker}
                            </div>
                        </button>
                    ))}
                </div>

                {/* Loading State */}
                {loading && (
                    <div className="flex flex-col items-center justify-center py-12 space-y-4 animate-in fade-in duration-500">
                        <div className="w-16 h-16 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
                        <p className="text-lg font-medium text-blue-600 animate-pulse">Crumpling space-time continuum...</p>
                    </div>
                )}

                {/* Error State */}
                {error && (
                    <div className="p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg text-red-600 dark:text-red-400 text-center">
                        {error}
                    </div>
                )}

                {/* Result Display */}
                {result && !loading && (
                    <ResultCard result={result} selectedEmoji={selectedProduct?.emoji} />
                )}
            </div>
        </main >
    );
}

function ResultCard({ result, selectedEmoji }: { result: TimeMachineResult; selectedEmoji?: string }) {
    const animatedValue = useAnimatedValue(result.productPrice, result.currentValue, 5000, 800);
    const animatedPercent = useAnimatedValue(0, result.percentChange, 5000, 800);

    return (
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-900 to-purple-900 text-white shadow-2xl p-8 md:p-12 animate-in slide-in-from-bottom-8 duration-700">
            {/* Background accents */}
            <div className="absolute top-0 right-0 -mt-12 -mr-12 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>
            <div className="absolute bottom-0 left-0 -mb-12 -ml-12 w-64 h-64 bg-blue-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20"></div>

            <div className="relative z-10 grid md:grid-cols-2 gap-12 items-center">
                <div className="space-y-6">
                    <div className="inline-block px-3 py-1 rounded-full bg-white/10 backdrop-blur text-sm font-medium border border-white/20">
                        The "What If" Scenario
                    </div>
                    <h2 className="text-3xl font-light leading-relaxed">
                        If you had invested <span className="font-bold text-green-300">${result.productPrice}</span> in <span className="font-bold text-yellow-300">{result.ticker}</span> instead of {
                            result.productName === "Cash"
                                ? <span className="font-bold border-b border-white/30">Keeping the Cash</span>
                                : <>buying the <span className="font-bold border-b border-white/30">{result.productName}</span></>
                        } in {new Date(result.originalDate).getFullYear()}...
                    </h2>
                    <div className="pt-4">
                        <div className="text-sm opacity-70">Price then: ${result.pastStockPrice.toFixed(2)}</div>
                        <div className="text-sm opacity-70">Price now: ${result.currentStockPrice.toFixed(2)}</div>
                    </div>
                </div>

                <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/10 text-center transform transition-transform hover:scale-105 duration-300 overflow-hidden">
                    <div className="text-sm uppercase tracking-widest text-indigo-200 mb-2">Current Value</div>
                    <div className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold bg-clip-text text-transparent bg-gradient-to-b from-white to-indigo-200 font-mono tracking-tight break-words">
                        ${animatedValue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </div>
                    <div className="mt-4 flex items-center justify-center gap-2">
                        <span className="text-3xl">🚀</span>
                        <span className="text-2xl font-bold text-green-400">+{animatedPercent.toLocaleString(undefined, { maximumFractionDigits: 0 })}%</span>
                    </div>
                </div>
            </div>

            {/* Animated Chart */}
            <div className="mt-12 bg-white/5 backdrop-blur-sm rounded-xl p-4 border border-white/10">
                <div className="text-sm uppercase tracking-widest text-indigo-300 mb-4 font-semibold">Asset Growth Over Time</div>
                <TimeMachineChartD3
                    data={result.seriesData || []}
                    productName={result.productName}
                    productEmoji={selectedEmoji}
                    initialValue={result.productPrice}
                    currentValue={result.currentValue}
                    color="#a855f7" // Purple-500
                />
            </div>
        </div>
    );
}

// Custom hook for number animation
function useCountUp(endValue: number, duration: number = 2000, delay: number = 0) {
    const [value, setValue] = useState(0);

    useEffect(() => {
        let startTime: number | null = null;
        let animationFrameId: number;
        let timeoutId: NodeJS.Timeout;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const progress = timestamp - startTime;

            if (progress < duration) {
                const easeOutExpo = (x: number): number => {
                    return x === 1 ? 1 : 1 - Math.pow(2, -10 * x);
                }
                // Use a slightly modified easing to match the chart curve if possible, but standard easeOut is fine
                // Chart uses d3.easeCubicOut => 1 - Math.pow(1 - x, 3)
                const easeCubicOut = (x: number): number => 1 - Math.pow(1 - x, 3);

                const ratio = Math.min(progress / duration, 1);
                // We want to start from the initial investment amount roughly? 
                // Or just 0 to endValue? 
                // User said "current value and +XX% text can be dynamically changed as the chart animation goes".
                // Chart goes from left (start date) to right (end date).
                // So value should go from `initialValue` to `endValue`.
                // Actually the hook implementation below just does 0 to endValue by default. 
                // Let's make it simpler: start from 0 is fine for "Current Value", or maybe start from 'startValue' if provided.
                // For simplicity, let's interpolate 0 -> endValue. 
                // Wait, if I started with $1000, it shouldn't show $0 at start. It should show $1000.
                // So I need a startValue.

                setValue(startVal + (endValue - startVal) * easeCubicOut(ratio));
                animationFrameId = requestAnimationFrame(animate);
            } else {
                setValue(endValue);
            }
        };

        const startVal = 0; // Ideally passed in, but 0 is safe default if not. 
        // Actually, let's hardcode startVal inside the component usage logic effectively by handling it in the render or passed prop.
        // For now, let's assume we want to animate from 0 to endValue for simpler hook signature, 
        // BUT for "Current Value" it makes sense to animate from `productPrice` to `currentValue`.

        // Let's just create a simple 0-1 progress hook and do math in component? 
        // Or improved hook:

        setValue(0); // Reset

        timeoutId = setTimeout(() => {
            animationFrameId = requestAnimationFrame(animate);
        }, delay);

        return () => {
            cancelAnimationFrame(animationFrameId);
            clearTimeout(timeoutId);
        };
    }, [endValue, duration, delay]);

    return value;
}

// Improved hook that supports start value
function useAnimatedValue(start: number, end: number, duration: number, delay: number) {
    const [value, setValue] = useState(start);

    useEffect(() => {
        setValue(start); // Reset to start immediately on change

        let startTime: number | null = null;
        let animationFrameId: number;

        const animate = (timestamp: number) => {
            if (!startTime) startTime = timestamp;
            const elapsed = timestamp - startTime;
            const progress = Math.min(elapsed / duration, 1);
            const easeCubicOut = (x: number): number => 1 - Math.pow(1 - x, 3);

            setValue(start + (end - start) * easeCubicOut(progress));

            if (progress < 1) {
                animationFrameId = requestAnimationFrame(animate);
            }
        };

        const timeoutId = setTimeout(() => {
            animationFrameId = requestAnimationFrame(animate);
        }, delay);

        return () => {
            clearTimeout(timeoutId);
            cancelAnimationFrame(animationFrameId);
        };
    }, [start, end, duration, delay]);

    return value;
}

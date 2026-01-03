"use client";

import { useState, useEffect } from "react";
import { fetchFinancialMetrics, FinancialMetrics } from "@/app/actions";

const STOCKS = [
    { ticker: "AAPL", name: "Apple", emoji: "🍎" },
    { ticker: "TSLA", name: "Tesla", emoji: "🚗" },
    { ticker: "NVDA", name: "Nvidia", emoji: "💻" },
    { ticker: "META", name: "Meta", emoji: "📘" },
    { ticker: "GOOG", name: "Google", emoji: "🔍" },
    { ticker: "MSFT", name: "Microsoft", emoji: "🪟" },
];

type Term = "eps" | "pe" | "marketcap";

const TERMS: { id: Term; title: string; emoji: string }[] = [
    { id: "eps", title: "EPS (Earnings Per Share)", emoji: "🍰" },
    { id: "pe", title: "PE Ratio", emoji: "🏷️" },
    { id: "marketcap", title: "Market Cap", emoji: "🏰" },
];

export default function DictionaryPage() {
    const [selectedTicker, setSelectedTicker] = useState("AAPL");
    const [selectedTerm, setSelectedTerm] = useState<Term>("eps");
    const [metrics, setMetrics] = useState<FinancialMetrics | null>(null);
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        async function loadData() {
            setLoading(true);
            const data = await fetchFinancialMetrics(selectedTicker);
            setMetrics(data);
            setLoading(false);
        }
        loadData();
    }, [selectedTicker]);

    return (
        <main className="min-h-screen bg-gradient-to-br from-purple-50 via-pink-50 to-blue-50 dark:from-gray-900 dark:via-purple-900 dark:to-indigo-900 p-8">
            <div className="max-w-6xl mx-auto space-y-12">
                {/* Header */}
                <div className="text-center space-y-4">
                    <h1 className="text-5xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-purple-600 to-pink-600">
                        Investment Dictionary for Kids 📚
                    </h1>
                    <p className="text-xl text-gray-600 dark:text-gray-300">
                        Learn the secret language of Wall Street! 🎓
                    </p>
                </div>

                {/* Stock Selector */}
                <div className="bg-white dark:bg-gray-800 rounded-3xl p-6 shadow-xl border border-gray-100 dark:border-gray-700">
                    <h2 className="text-lg font-bold mb-4 text-gray-700 dark:text-gray-200">Pick Your Favorite Company</h2>
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                        {STOCKS.map((stock) => (
                            <button
                                key={stock.ticker}
                                onClick={() => setSelectedTicker(stock.ticker)}
                                className={`p-4 rounded-xl border-2 transition-all duration-200 ${selectedTicker === stock.ticker
                                    ? "border-purple-500 bg-purple-50 dark:bg-purple-900/30 scale-105 shadow-lg"
                                    : "border-gray-200 dark:border-gray-700 hover:border-purple-300 hover:scale-105"
                                    }`}
                            >
                                <div className="text-4xl mb-2">{stock.emoji}</div>
                                <div className="font-bold text-sm">{stock.name}</div>
                                <div className="text-xs text-gray-500 dark:text-gray-400">{stock.ticker}</div>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Term Selector */}
                <div className="grid md:grid-cols-3 gap-4">
                    {TERMS.map((term) => (
                        <button
                            key={term.id}
                            onClick={() => setSelectedTerm(term.id)}
                            className={`p-6 rounded-2xl border-2 transition-all duration-200 text-left ${selectedTerm === term.id
                                ? "border-pink-500 bg-gradient-to-br from-pink-50 to-purple-50 dark:from-pink-900/30 dark:to-purple-900/30 shadow-lg scale-105"
                                : "border-gray-200 dark:border-gray-700 bg-white dark:bg-gray-800 hover:border-pink-300 hover:scale-105"
                                }`}
                        >
                            <div className="text-5xl mb-3">{term.emoji}</div>
                            <div className="font-bold text-lg">{term.title}</div>
                        </button>
                    ))}
                </div>

                {/* Explanation Section */}
                {metrics && !loading && (
                    <div className="bg-white dark:bg-gray-800 rounded-3xl p-8 md:p-12 shadow-2xl border border-gray-100 dark:border-gray-700">
                        {selectedTerm === "eps" && <EPSExplanation metrics={metrics} />}
                        {selectedTerm === "pe" && <PEExplanation metrics={metrics} />}
                        {selectedTerm === "marketcap" && <MarketCapExplanation metrics={metrics} />}
                    </div>
                )}

                {loading && (
                    <div className="flex justify-center py-12">
                        <div className="w-16 h-16 border-4 border-purple-500 border-t-transparent rounded-full animate-spin"></div>
                    </div>
                )}
            </div>
        </main>
    );
}

function EPSExplanation({ metrics }: { metrics: FinancialMetrics }) {
    return (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-4xl font-bold mb-2">🍰 Your Slice of the Profit Pie</h2>
                <p className="text-lg text-gray-600 dark:text-gray-300">EPS = Earnings Per Share</p>
            </div>

            {/* Analogy */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-2xl p-6 border-2 border-yellow-200 dark:border-yellow-700">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span>🍋</span> The Lemonade Stand Story
                </h3>
                <p className="text-lg leading-relaxed">
                    Imagine you and 9 friends run a lemonade stand together. At the end of summer, you made <strong>$100 profit</strong>.
                    How much does each person get? <strong>$100 ÷ 10 friends = $10 each!</strong>
                </p>
                <p className="text-lg leading-relaxed mt-4">
                    That <strong>$10</strong> is like your "Earnings Per Share" – it's YOUR slice of the profit pie! 🍰
                </p>
            </div>

            {/* Real Math */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border-2 border-blue-200 dark:border-blue-700">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span>🧮</span> The Real {metrics.ticker} Math
                </h3>

                <div className="mb-4 p-3 bg-purple-100 dark:bg-purple-900/30 rounded-lg border border-purple-300 dark:border-purple-700">
                    <p className="text-sm font-bold text-purple-800 dark:text-purple-300">
                        💡 Note: When people say "EPS", they usually mean <strong>quarterly EPS</strong> (one quarter).
                        But for PE Ratio, we use <strong>trailing 12-month EPS</strong> (4 quarters added up)!
                    </p>
                </div>

                <div className="space-y-4 text-lg">
                    {/* Quarterly EPS Breakdown */}
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-2 border-yellow-300 dark:border-yellow-700">
                        <div className="text-sm font-bold text-yellow-800 dark:text-yellow-300 mb-2">📊 Last 4 Quarters → Trailing 12-Month EPS</div>
                        <div className="flex items-center justify-center gap-2 text-base font-mono flex-wrap">
                            {metrics.quarterlyEPS.map((qeps, idx) => (
                                <span key={idx}>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">${qeps.toFixed(2)}</span>
                                    {idx < 3 && <span className="mx-2 text-gray-400">+</span>}
                                </span>
                            ))}
                            <span className="mx-2 text-gray-400">=</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">${metrics.eps?.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="text-center text-2xl font-bold text-gray-400 my-2">How is EPS calculated?</div>

                    {/* The Formula */}
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-indigo-300 dark:border-indigo-700">
                        <div className="text-center space-y-3">
                            <div className="text-sm font-bold text-gray-500 dark:text-gray-400">Total Profit (12 months)</div>
                            <div className="text-3xl font-black text-green-600 dark:text-green-400">
                                ${metrics.netIncome ? (metrics.netIncome / 1_000_000_000).toFixed(2) : "N/A"}B
                            </div>
                            <div className="text-4xl font-bold text-gray-400">÷</div>
                            <div className="text-sm font-bold text-gray-500 dark:text-gray-400">Total Shares</div>
                            <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                                {metrics.shares ? (metrics.shares / 1_000_000_000).toFixed(2) : "N/A"}B
                            </div>
                            <div className="text-4xl font-bold text-gray-400">=</div>
                            <div className="text-sm font-bold text-gray-500 dark:text-gray-400">EPS (Trailing 12-Month)</div>
                            <div className="text-4xl font-black text-purple-600 dark:text-purple-400">
                                ${metrics.eps?.toFixed(2) || "N/A"}
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Verdict */}
            <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border-2 border-green-200 dark:border-green-700">
                <p className="text-xl">
                    <strong>What does this mean?</strong> If you owned 1 share of {metrics.ticker},
                    you'd get <strong>${metrics.eps?.toFixed(2)}</strong> of their yearly profits! 💰
                </p>
            </div>
        </div>
    );
}

function PEExplanation({ metrics }: { metrics: FinancialMetrics }) {
    return (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-4xl font-bold mb-2">🏷️ The Price Tag for Future Growth</h2>
                <p className="text-lg text-gray-600 dark:text-gray-300">PE Ratio = Price-to-Earnings</p>
            </div>

            {/* Analogy */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-2xl p-6 border-2 border-yellow-200 dark:border-yellow-700">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span>🎮</span> The Video Game Trade Story
                </h3>
                <p className="text-lg leading-relaxed">
                    Your friend sells video games. Each game earns him <strong>$5 profit per year</strong>.
                    He wants to sell you his "game business" for <strong>$100</strong>.
                </p>
                <p className="text-lg leading-relaxed mt-4">
                    <strong>$100 ÷ $5 = 20</strong>. That means you'd need to wait <strong>20 years</strong> to get your money back!
                    That "20" is the PE Ratio! 📊
                </p>
                <p className="text-lg leading-relaxed mt-4 font-bold text-orange-600 dark:text-orange-400">
                    Higher PE = You're paying more for future growth (riskier but exciting!) 🚀<br />
                    Lower PE = Cheaper, but maybe slower growth 🐢
                </p>
            </div>

            {/* Real Math */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border-2 border-blue-200 dark:border-blue-700">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span>🧮</span> The Real {metrics.ticker} Math
                </h3>

                <div className="space-y-4 text-lg">
                    {/* Quarterly EPS Breakdown */}
                    <div className="p-4 bg-yellow-50 dark:bg-yellow-900/20 rounded-xl border-2 border-yellow-300 dark:border-yellow-700">
                        <div className="text-sm font-bold text-yellow-800 dark:text-yellow-300 mb-2">📊 Trailing 12-Month EPS (Last 4 Quarters)</div>
                        <div className="flex items-center justify-center gap-2 text-base font-mono flex-wrap">
                            {metrics.quarterlyEPS.map((qeps, idx) => (
                                <span key={idx}>
                                    <span className="font-bold text-blue-600 dark:text-blue-400">${qeps.toFixed(2)}</span>
                                    {idx < 3 && <span className="mx-2 text-gray-400">+</span>}
                                </span>
                            ))}
                            <span className="mx-2 text-gray-400">=</span>
                            <span className="font-bold text-purple-600 dark:text-purple-400">${metrics.eps?.toFixed(2)}</span>
                        </div>
                    </div>

                    <div className="text-center text-2xl font-bold text-gray-400 my-2">How is PE Ratio calculated?</div>

                    {/* The Formula */}
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-indigo-300 dark:border-indigo-700">
                        <div className="text-center space-y-3">
                            <div className="text-sm font-bold text-gray-500 dark:text-gray-400">Stock Price</div>
                            <div className="text-3xl font-black text-green-600 dark:text-green-400">
                                ${metrics.price.toFixed(2)}
                            </div>
                            <div className="text-4xl font-bold text-gray-400">÷</div>
                            <div className="text-sm font-bold text-gray-500 dark:text-gray-400">Yearly Profit Per Share (EPS)</div>
                            <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                                ${metrics.eps?.toFixed(2) || "N/A"}
                            </div>
                            <div className="text-4xl font-bold text-gray-400">=</div>
                            <div className="text-sm font-bold text-gray-500 dark:text-gray-400">PE Ratio</div>
                            <div className="text-4xl font-black text-purple-600 dark:text-purple-400">
                                {metrics.pe?.toFixed(1) || "N/A"}x
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Verdict */}
            <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border-2 border-green-200 dark:border-green-700">
                <p className="text-xl">
                    <strong>What does this mean?</strong> You're paying <strong>{metrics.pe?.toFixed(1)}x</strong> the yearly earnings.
                    {metrics.pe && metrics.pe > 30 && " That's pretty high – investors expect BIG growth! 🚀"}
                    {metrics.pe && metrics.pe <= 30 && metrics.pe > 15 && " That's moderate – a balanced bet! ⚖️"}
                    {metrics.pe && metrics.pe <= 15 && " That's low – maybe a bargain or slow growth! 🐢"}
                </p>
            </div>
        </div>
    );
}

function MarketCapExplanation({ metrics }: { metrics: FinancialMetrics }) {
    return (
        <div className="space-y-8">
            <div className="text-center">
                <h2 className="text-4xl font-bold mb-2">🏰 The Price of the Whole Castle</h2>
                <p className="text-lg text-gray-600 dark:text-gray-300">Market Cap = Total Company Value</p>
            </div>

            {/* Analogy */}
            <div className="bg-gradient-to-r from-yellow-50 to-orange-50 dark:from-yellow-900/20 dark:to-orange-900/20 rounded-2xl p-6 border-2 border-yellow-200 dark:border-yellow-700">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span>🏰</span> The LEGO Castle Story
                </h3>
                <p className="text-lg leading-relaxed">
                    Imagine a LEGO castle made of <strong>100 bricks</strong>. Each brick costs <strong>$2</strong>.
                    How much is the whole castle worth?
                </p>
                <p className="text-lg leading-relaxed mt-4">
                    <strong>100 bricks × $2 = $200!</strong> That's the "Market Cap" – the price to buy the ENTIRE castle! 🏰
                </p>
            </div>

            {/* Real Math */}
            <div className="bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-2xl p-6 border-2 border-blue-200 dark:border-blue-700">
                <h3 className="text-2xl font-bold mb-4 flex items-center gap-2">
                    <span>🧮</span> The Real {metrics.ticker} Math
                </h3>

                <div className="space-y-4 text-lg">
                    <div className="text-center text-2xl font-bold text-gray-400 my-2">How is Market Cap calculated?</div>

                    {/* The Formula */}
                    <div className="p-6 bg-white dark:bg-gray-800 rounded-xl border-2 border-indigo-300 dark:border-indigo-700">
                        <div className="text-center space-y-3">
                            <div className="text-sm font-bold text-gray-500 dark:text-gray-400">Total Shares (Bricks)</div>
                            <div className="text-3xl font-black text-green-600 dark:text-green-400">
                                {metrics.shares ? (metrics.shares / 1_000_000_000).toFixed(2) : "N/A"}B
                            </div>
                            <div className="text-4xl font-bold text-gray-400">×</div>
                            <div className="text-sm font-bold text-gray-500 dark:text-gray-400">Price Per Share</div>
                            <div className="text-3xl font-black text-blue-600 dark:text-blue-400">
                                ${metrics.price.toFixed(2)}
                            </div>
                            <div className="text-4xl font-bold text-gray-400">=</div>
                            <div className="text-sm font-bold text-gray-500 dark:text-gray-400">Market Cap (Total Value)</div>
                            <div className="text-4xl font-black text-purple-600 dark:text-purple-400">
                                ${metrics.marketCap ? (metrics.marketCap / 1_000_000_000_000).toFixed(2) : "N/A"}T
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Verdict */}
            <div className="text-center p-6 bg-gradient-to-r from-green-50 to-emerald-50 dark:from-green-900/20 dark:to-emerald-900/20 rounded-2xl border-2 border-green-200 dark:border-green-700">
                <p className="text-xl">
                    <strong>What does this mean?</strong> To buy ALL of {metrics.ticker}, you'd need{" "}
                    <strong>${metrics.marketCap ? (metrics.marketCap / 1_000_000_000_000).toFixed(2) : "N/A"} TRILLION dollars!</strong>
                    {metrics.marketCap && metrics.marketCap > 1_000_000_000_000 && " That's HUGE! 🌍"}
                    {metrics.marketCap && metrics.marketCap <= 1_000_000_000_000 && metrics.marketCap > 100_000_000_000 && " That's a big company! 🏢"}
                </p>
            </div>
        </div>
    );
}

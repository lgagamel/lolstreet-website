import Link from "next/link";
import { getCurrentClose, getStockSeries, getFinanceData, getFinanceForecast, getYoutubeLink } from "../../../lib/api";
import StockDashboard from "../../../components/stock/StockDashboard";
import YoutubeEmbed from "../../../components/stock/YoutubeEmbed";

type PageProps = {
    params: Promise<{ ticker?: string }>;
};

function parseDateSafe(s: string | undefined | null): Date | null {
    if (!s) return null;
    const d = new Date(s);
    return Number.isFinite(d.getTime()) ? d : null;
}

function formatDate(d: Date | null): string {
    if (!d) return "NA";
    return d.toISOString().slice(0, 10);
}

function daysBetween(a: Date, b: Date): number {
    const ms = b.getTime() - a.getTime();
    return Math.max(0, Math.round(ms / (1000 * 60 * 60 * 24)));
}

export default async function Page(props: PageProps) {
    const params = await props.params;

    const rawTicker = params?.ticker ?? "";
    const ticker = typeof rawTicker === "string" ? rawTicker.toUpperCase() : "";

    if (!ticker) {
        return (
            <main className="p-6">
                <div className="mb-4">
                    <Link className="underline text-sm" href="/">
                        ← Back
                    </Link>
                </div>
                <div className="text-red-600">Missing ticker in route params.</div>
                <div className="text-xs text-gray-500 mt-2">
                    Open like: <code>/stock/NVDA</code>
                </div>
            </main>
        );
    }

    const [series, finance, forecast, videoLink] = await Promise.all([
        getStockSeries(ticker),
        getFinanceData(ticker),
        getFinanceForecast(ticker),
        getYoutubeLink(ticker),
    ]);
    const cur = getCurrentClose(series);

    const allDates = series
        .map((r) => parseDateSafe(r.date))
        .filter((d): d is Date => !!d);

    const minDate = allDates.length ? new Date(Math.min(...allDates.map((d) => d.getTime()))) : null;
    const maxDate = allDates.length ? new Date(Math.max(...allDates.map((d) => d.getTime()))) : null;

    const spanDays = minDate && maxDate ? daysBetween(minDate, maxDate) : 0;
    const spanYears = spanDays ? spanDays / 365.0 : 0;

    return (
        <main className="p-6 max-w-5xl mx-auto">
            <div className="mb-6">
                <Link className="text-sm text-gray-500 hover:text-gray-800 transition-colors" href="/">
                    ← Back to list
                </Link>
            </div>


            <div className="mb-8 border-b border-gray-200 dark:border-gray-800 pb-6">
                <h1 className="text-4xl font-black tracking-tight mb-2">{ticker}</h1>

                {cur ? (
                    <div>
                        <div className="flex items-baseline gap-3">
                            <span className="text-3xl font-light text-gray-900 dark:text-gray-100">
                                ${cur.close.toFixed(2)}
                            </span>
                            <span className="text-sm text-gray-500 font-mono">
                                {cur.date}
                            </span>
                        </div>

                        {/* 1-Year PE Stats */}
                        {(() => {
                            const curDate = parseDateSafe(cur.date);
                            if (!curDate) return null;

                            const oneYearAgo = new Date(curDate);
                            oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

                            const peValues = series
                                .filter(r => {
                                    const d = parseDateSafe(r.date);
                                    // Filter for last 1 year, up to current date (exclude future)
                                    return d && d >= oneYearAgo && d <= curDate && typeof r.pe_ratio === 'number' && Number.isFinite(r.pe_ratio);
                                })
                                .map(r => r.pe_ratio!)
                                .sort((a, b) => a - b);

                            if (peValues.length === 0) return null;

                            const mid = peValues[Math.floor(peValues.length / 2)]; // Median
                            const p05 = peValues[Math.floor(peValues.length * 0.05)];
                            const p95 = peValues[Math.floor(peValues.length * 0.95)];

                            // Find current PE
                            const currentRow = series.find(r => r.date === cur.date);
                            const currentPE = currentRow?.pe_ratio;

                            return (
                                <div className="mt-3 grid grid-cols-1 xs:grid-cols-2 sm:flex sm:flex-wrap items-center gap-4 text-xs">
                                    {currentPE && Number.isFinite(currentPE) && (
                                        <>
                                            <div className="flex items-center gap-2 bg-violet-50 dark:bg-violet-900/20 px-3 py-1.5 rounded-lg border border-violet-100 dark:border-violet-900/30">
                                                <span className="font-semibold text-violet-700 dark:text-violet-300">Current PE</span>
                                                <span className="font-mono font-medium text-violet-900 dark:text-violet-100">
                                                    {currentPE.toFixed(2)}
                                                </span>
                                            </div>

                                            <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                                                <span className="font-semibold text-gray-500 dark:text-gray-400">Gap to the 1-Year PE Median</span>
                                                {(() => {
                                                    const gap = (currentPE - mid) / mid;
                                                    const isPremium = gap > 0;
                                                    const colorClass = isPremium ? 'text-red-600 dark:text-red-400' : 'text-emerald-600 dark:text-emerald-400';
                                                    return (
                                                        <span className={`font-mono font-medium ${colorClass}`}>
                                                            {gap > 0 ? '+' : ''}{(gap * 100).toFixed(1)}%
                                                        </span>
                                                    );
                                                })()}
                                            </div>
                                        </>
                                    )}

                                    <div className="flex items-center gap-2 bg-gray-50 dark:bg-gray-800 px-3 py-1.5 rounded-lg border border-gray-100 dark:border-gray-700">
                                        <span className="font-semibold text-gray-500 dark:text-gray-400">1-Year PE Median</span>
                                        <span className="font-mono font-medium text-gray-900 dark:text-gray-200">
                                            {mid.toFixed(2)}
                                        </span>
                                    </div>

                                    <div className="flex items-center gap-2 bg-blue-50 dark:bg-blue-900/20 px-3 py-1.5 rounded-lg border border-blue-100 dark:border-blue-900/30">
                                        <span className="font-semibold text-blue-700 dark:text-blue-300">1-Year PE Range (90% CI)</span>
                                        <span className="font-mono font-medium text-blue-900 dark:text-blue-100">
                                            {p05.toFixed(2)} - {p95.toFixed(2)}
                                        </span>
                                    </div>
                                </div>
                            );
                        })()}
                    </div>
                ) : (
                    <div className="text-red-600">No valid close price found.</div>
                )}

                <div className="mt-3">
                    {(() => {
                        // Sort by reportedDate desc
                        const sorted = [...finance]
                            .filter(r => r.reportedEPS !== null)
                            .sort((a, b) => new Date(b.reportedDate).getTime() - new Date(a.reportedDate).getTime());

                        if (sorted.length < 5) {
                            return <div className="text-xs text-gray-400">Not enough data for EPS growth</div>;
                        }

                        // Take last 4 quarters
                        const recent = sorted.slice(0, 4);
                        const growthRates: number[] = [];

                        for (const r of recent) {
                            // Find same quarter last year (approx 365 days ago, or just take index + 4)
                            // Since it's sorted desc, previous year is index + 4
                            const idx = sorted.indexOf(r);
                            const prev = sorted[idx + 4];

                            if (prev && prev.reportedEPS !== null && prev.reportedEPS !== 0) {
                                const g = (r.reportedEPS! - prev.reportedEPS) / Math.abs(prev.reportedEPS);
                                growthRates.push(g);
                            }
                        }

                        if (growthRates.length === 0) return null;

                        const avgGrowth = growthRates.reduce((a, b) => a + b, 0) / growthRates.length;
                        const isPos = avgGrowth >= 0;

                        return (
                            <div className="flex items-center gap-2 text-xs">
                                <span className="text-gray-500 dark:text-gray-400 font-medium">Avg. YoY EPS Growth (Past 4 Quarters):</span>
                                <span className={`font-mono font-bold ${isPos ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
                                    {isPos ? '+' : ''}{(avgGrowth * 100).toFixed(1)}%
                                </span>
                            </div>
                        );
                    })()}
                </div>
            </div>

            {/* Featured Story (YouTube Embed) - Placed after header stats, before charts */}
            {
                videoLink && (
                    <section className="mb-12 animate-in fade-in slide-in-from-top-4 duration-700">
                        <div className="w-full">
                            <YoutubeEmbed embedUrl={videoLink} />
                        </div>
                    </section>
                )
            }

            <StockDashboard series={series} finance={finance} forecast={forecast} />

            <div className="mt-12 pt-6 border-t border-gray-100 dark:border-gray-800 text-xs text-gray-400 text-center">
                Loaded {series.length} data points
            </div>
        </main >
    );
}

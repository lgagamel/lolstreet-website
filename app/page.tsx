import { getRankings } from "@/lib/api";
import RankingsTable from "@/components/stock/RankingsTable";
import MarketScatterPlotD3 from "@/components/stock/MarketScatterPlotD3";

export const revalidate = 3600; // revalidate every hour

export default async function Home() {
  const csvData = await getRankings();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black font-sans pb-20">
      {/* Header */}
      <header className="bg-white dark:bg-gray-900 border-b border-gray-100 dark:border-gray-800 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 bg-gradient-to-br from-indigo-500 to-purple-600 rounded-lg flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-500/20">
              L
            </div>
            <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-gray-900 to-gray-600 dark:from-white dark:to-gray-400">
              LOLStreet
            </span>
          </div>
        </div>
      </header>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Intro */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
            Market Intelligence <span className="text-indigo-500">Simplified</span>
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400">
            Advanced valuation metrics and growth forecasts for top market movers.
          </p>
        </div>

        {/* Rankings Table */}
        <RankingsTable rows={csvData} />

        {/* Scatter Plot */}
        <MarketScatterPlotD3 data={csvData} />
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-200 dark:border-gray-800 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>© 2024 LOLStreet. All rights reserved.</p>
          <p>
            Data source: <span className="font-mono text-indigo-500">stock_return_summary.csv</span>
          </p>
        </div>
      </footer>
    </main>
  );
}

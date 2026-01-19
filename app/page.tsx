import { getRankings } from "@/lib/api";
import DashboardClient from "@/components/stock/DashboardClient";

export const revalidate = 3600; // revalidate every hour

export default async function Home() {
  const csvData = await getRankings();

  return (
    <main className="min-h-screen bg-gray-50 dark:bg-black font-sans pb-20">


      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 space-y-8">
        {/* Intro */}
        <div className="text-center max-w-2xl mx-auto mb-12">
          <h1 className="text-4xl font-extrabold text-gray-900 dark:text-white tracking-tight mb-4">
            LOL Street: Market Intelligence <span className="text-indigo-500">Simplified</span>
          </h1>
          <p className="text-lg text-gray-500 dark:text-gray-400">
            Advanced valuation metrics and growth forecasts for top market movers.
          </p>
        </div>

        <DashboardClient data={csvData} />
      </div>

      {/* Footer */}
      <footer className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12 border-t border-gray-200 dark:border-gray-800 mt-12">
        <div className="flex flex-col md:flex-row justify-between items-center gap-4 text-sm text-gray-500">
          <p>© {new Date().getFullYear()} LOLStreet. All rights reserved.</p>

        </div>
      </footer>
    </main>
  );
}

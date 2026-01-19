"use server";

import { getStockSeries } from "@/lib/api";
import { StockDailyRow } from "@/types";

export interface ComparisonSeries {
    ticker: string;
    data: StockDailyRow[];
    normalized: { date: string; value: number }[];
    startPrice: number;
    endPrice: number;
    returnPct: number;
}

export async function fetchStockSeriesForComparison(ticker: string, startDateStr: string): Promise<ComparisonSeries | null> {
    const series = await getStockSeries(ticker);

    if (!series || series.length === 0) return null;

    const startDate = new Date(startDateStr);

    // Filter data >= start date
    // Sort ascending by date
    const filtered = series
        .filter(r => {
            const d = new Date(r.date);
            // Must be >= startDate
            if (d < startDate) return false;

            // Must have valid close price
            if (r.close === null || !Number.isFinite(r.close)) return false;

            // Must NOT be a forecast point (if flag exists)
            if (r.is_forecast_point === 1) return false;

            // Optional: Limit to today? User said "most recent date where we have close price".
            // Ideally the data file only has valid close prices for past. 
            // If future rows have empty close, the check above handles it.
            // If future rows have projected close, the is_forecast_point check handles it.

            return true;
        })
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    if (filtered.length < 2) return null;

    // Normalize: (Price / StartPrice) - 1
    // Find first valid price
    let startPrice = NaN;
    for (const row of filtered) {
        if (row.close !== null && Number.isFinite(row.close)) {
            startPrice = row.close;
            break;
        }
    }

    if (Number.isNaN(startPrice)) return null;

    const normalized = filtered.map(r => {
        // Guaranteed to have valid close from filter above
        const val = r.close!;
        const ret = (val / startPrice) - 1;
        return { date: r.date, value: ret * 100 }; // As percentage
    });

    const lastRow = filtered[filtered.length - 1];
    const endPrice = lastRow.close ?? 0;
    const returnPct = ((endPrice / startPrice) - 1) * 100;

    return {
        ticker: ticker.toUpperCase(),
        data: filtered,
        normalized,
        startPrice,
        endPrice,
        returnPct
    };
}

export interface TimeMachineResult {
    ticker: string;
    productName: string;
    productPrice: number;
    purchaseDate: string;
    originalDate: string; // The requested date (preset date)
    pastStockPrice: number;
    currentStockPrice: number;
    currentValue: number;
    percentChange: number;
    sharesBought: number;
    seriesData: { date: string; value: number }[];
}

export async function calculateTimeMachine(ticker: string, dateStr: string, amount: number, productName: string): Promise<TimeMachineResult | null> {
    const series = await getStockSeries(ticker);

    if (!series || series.length === 0) return null;

    const targetDate = new Date(dateStr);

    // Find closest date on or after targetDate
    const sorted = series
        .filter(r => r.close !== null && Number.isFinite(r.close) && (r.is_forecast_point !== 1))
        .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime());

    let startRow: StockDailyRow | null = null;
    let startIndex = -1;

    for (let i = 0; i < sorted.length; i++) {
        if (new Date(sorted[i].date) >= targetDate) {
            startRow = sorted[i];
            startIndex = i;
            break;
        }
    }

    if (!startRow || !startRow.close || startIndex === -1) return null;

    const endRow = sorted[sorted.length - 1];
    if (!endRow || !endRow.close) return null;

    const startPrice = startRow.close;
    const endPrice = endRow.close;
    const shares = amount / startPrice;
    const currentValue = shares * endPrice;
    const percentChange = ((currentValue - amount) / amount) * 100;

    // Generate value series
    const seriesData = sorted.slice(startIndex).map(r => ({
        date: r.date,
        value: (r.close! / startPrice) * amount
    }));

    return {
        ticker: ticker.toUpperCase(),
        productName,
        productPrice: amount,
        purchaseDate: startRow.date,
        originalDate: dateStr, // return original requested date
        pastStockPrice: startPrice,
        currentStockPrice: endPrice,
        currentValue,
        percentChange,
        sharesBought: shares,
        seriesData
    };
}

export interface FinancialMetrics {
    ticker: string;
    price: number;
    pe: number | null;
    eps: number | null;
    quarterlyEPS: number[]; // Last 4 quarters breakdown
    netIncome: number | null;
    shares: number | null;
    marketCap: number | null;
}

export async function fetchFinancialMetrics(ticker: string): Promise<FinancialMetrics | null> {
    const { getRankings, getFinanceData } = await import("@/lib/api");

    // Get current price from summary
    const rankings = await getRankings();
    const summary = rankings.find(r => r.ticker.toUpperCase() === ticker.toUpperCase());

    if (!summary) return null;

    // Get finance data
    const financeData = await getFinanceData(ticker);
    if (!financeData || financeData.length < 4) return null;

    // Get last 4 quarters for trailing 12-month calculation
    const last4Quarters = financeData.slice(-4);

    // Calculate trailing 12-month EPS (sum of last 4 quarters)
    let trailingEPS = 0;
    let trailingNetIncome = 0;
    const quarterlyEPS: number[] = [];
    for (const quarter of last4Quarters) {
        const qEPS = quarter.reportedEPS || 0;
        quarterlyEPS.push(qEPS);
        trailingEPS += qEPS;
        if (quarter.netIncome) trailingNetIncome += quarter.netIncome;
    }

    // Get shares from most recent quarter
    const latest = financeData[financeData.length - 1];
    const shares = latest.commonStockSharesOutstanding;

    const price = summary.current_close;

    // Calculate PE ratio: Price / Trailing 12-month EPS
    const pe = trailingEPS > 0 ? price / trailingEPS : null;

    const marketCap = shares && price ? shares * price : null;

    return {
        ticker: ticker.toUpperCase(),
        price,
        pe,
        eps: trailingEPS, // This is now trailing 12-month EPS
        quarterlyEPS, // Breakdown of last 4 quarters
        netIncome: trailingNetIncome, // This is now trailing 12-month Net Income
        shares,
        marketCap
    };
}

export interface FuturePEToolData {
    ticker: string;
    price: number;
    currentEPS: number;
    growthRate: number; // YoY growth as percentage (e.g., 15.5 for 15.5%)
    nextEarningsDate?: string; // ISO Date string
    currentDate?: string; // ISO Date string for the price
    lastReportDate?: string; // ISO Date string for last EPS
}

export async function fetchFuturePEToolData(ticker: string): Promise<FuturePEToolData | null> {
    const { getRankings, getFinanceData, getFinanceForecast } = await import("@/lib/api");

    // 1. Get Summary Data (Price, Growth)
    const rankings = await getRankings();
    const summary = rankings.find(r => r.ticker.toUpperCase() === ticker.toUpperCase());

    // We need price at minimum. Growth can be defaulted if missing.
    if (!summary || !summary.current_close) return null;

    const price = summary.current_close || 0;
    // 'eps_yoy_growth_avg_last4q_pct' maps to 'eps_ttm_yoy_pct' in getRankings
    const growthRate = summary.eps_yoy_growth_avg_last4q_pct || 0;
    const currentDate = summary.current_date; // Available from summary

    // 2. Get Finance Data (Current TTM EPS)
    // Filter to only include rows with actual reported EPS to avoid including future estimates/empty rows in TTM sum
    const financeDataRaw = await getFinanceData(ticker);
    const financeData = financeDataRaw?.filter(r => r.reportedEPS !== null && Number.isFinite(r.reportedEPS)) || [];

    // Sort by date just in case
    financeData.sort((a, b) => new Date(a.reportedDate).getTime() - new Date(b.reportedDate).getTime());

    let currentEPS = 0;
    let lastReportDate: string | undefined = undefined;

    if (financeData.length >= 4) {
        // Get last 4 quarters of REPORTED data
        const last4Quarters = financeData.slice(-4);
        for (const quarter of last4Quarters) {
            currentEPS += (quarter.reportedEPS || 0);
        }
        // Last row is the most recent report
        lastReportDate = financeData[financeData.length - 1].reportedDate;
    } else if (summary.current_pe && summary.current_pe > 0) {
        // Fallback
        currentEPS = price / summary.current_pe;
    }

    // 3. Get Forecast Data (Next Earnings Date)
    const forecastRaw = await getFinanceForecast(ticker);
    let nextEarningsDate: string | undefined = undefined;

    if (forecastRaw && forecastRaw.length > 0) {
        // Find the first forecast with a reportedDate in the future
        // OR simply the first row if the file is sorted by date? 
        // Typically forecast files might be sorted. Let's filter for future dates.
        const today = new Date();
        const futureForecasts = forecastRaw.filter(r => {
            const d = new Date(r.reportedDate);
            return d > today;
        }).sort((a, b) => new Date(a.reportedDate).getTime() - new Date(b.reportedDate).getTime());

        if (futureForecasts.length > 0) {
            nextEarningsDate = futureForecasts[0].reportedDate;
        }
    }

    return {
        ticker: ticker.toUpperCase(),
        price,
        currentEPS,
        growthRate,
        nextEarningsDate,
        currentDate,
        lastReportDate
    };
}

import { StockDailyRow } from "@/types";

export interface FutureAssumption {
    date: Date;
    eps: number;
    growthRate: number; // Quarterly growth rate implied or set
    isEstimate: boolean;
}

export interface PEProjectionPoint {
    date: Date;
    eps: number;
    pe: number;
    isEarningsDate: boolean;
}

/**
 * Generates estimated future earnings dates.
 * Assumes quarterly reporting.
 * 
 * @param startDate The starting date (usually today or last reported date).
 * @param quarters Number of quarters to project.
 * @returns Array of estimated earnings dates.
 */
export function generateEarningsDates(startDate: Date, quarters: number = 12): Date[] {
    const dates: Date[] = [];
    const current = new Date(startDate);

    // Align to next likely quarter end/report date.
    // Simplifying assumption: Report +3 months from last.
    // But since we don't always have exact last report date here easily without more data,
    // let's project from "Now" + ~1-2 months for first, then 3 months intervals.
    // BETTER: Just project 3 months from 'startDate' iteratively.

    for (let i = 1; i <= quarters; i++) {
        // Add 3 months * i
        const d = new Date(current);
        d.setMonth(d.getMonth() + (3 * i));
        dates.push(d);
    }
    return dates;
}

/**
 * Builds default assumptions based on current EPS and annual growth rate.
 * 
 * @param currentEPS The starting TTM EPS.
 * @param annualGrowthRatePct Annual growth rate in percent (e.g. 15 for 15%).
 * @param earningsDates Array of future earnings dates.
 */
export function buildDefaultAssumptions(currentEPS: number, annualGrowthRatePct: number, earningsDates: Date[]): FutureAssumption[] {
    const assumptions: FutureAssumption[] = [];

    // Convert Annual Growth to Quarterly Growth
    // Formula: (1 + g_annual)^(1/4) - 1
    const g_annual = annualGrowthRatePct / 100;
    const g_quarterly = Math.pow(1 + g_annual, 0.25) - 1;

    let previousEPS = currentEPS;

    for (const date of earningsDates) {
        // Apply quarterly growth to the previous EPS
        // Note: EPS here usually implies "Trailing 12-Month EPS" moving forward, 
        // OR "Quarterly EPS". 
        // The prompt says: "Future EPS value (editable)" and "recompute PE = current_price / trailing_eps(t)".
        // Usually PE is based on TTM EPS. 
        // If we grow TTM EPS by the quarterly rate, that is mathematically sound for maintaining the annual growth trend.

        const newEPS = previousEPS * (1 + g_quarterly);

        assumptions.push({
            date: date,
            eps: newEPS,
            growthRate: g_quarterly * 100, // Store as percentage
            isEstimate: true
        });

        previousEPS = newEPS;
    }

    return assumptions;
}

/**
 * Calculates the PE projection time series.
 * Interpolates EPS linearly between earnings dates.
 * 
 * @param currentPrice Current fixed stock price.
 * @param currentEPS Current TTM EPS (start point).
 * @param assumptions List of future assumptions (ordered by date).
 * @param deltaGrowth Global modifier in percentage points for annual growth.
 */
export function calculatePEProjection(
    currentPrice: number,
    currentEPS: number,
    assumptions: FutureAssumption[],
    explicitNow?: Date // Optional: Use this instead of new Date()
): StockDailyRow[] {
    // 1. Calculate the 'Effective EPS' for each quarter
    // Since page now manages 'eps' and 'growthRate' fully, including any user edits,
    // we can rely on `assumptions` as the source of truth for the EPS values.

    // However, if we want to robustly ensure the EPS chain is correct based on growth rates:
    // (If the page logic already ensures this, we can skip it. The page logic DOES ensure cascade.)
    // So we can simply trust 'assumptions.eps'.

    let today = explicitNow ? new Date(explicitNow) : new Date();
    // Normalize "now" to midnight for consistent plotting
    today.setHours(0, 0, 0, 0);

    return interpolatePE(currentPrice, currentEPS, assumptions, today);
}

function interpolatePE(price: number, currentEPS: number, points: FutureAssumption[], startDate: Date): StockDailyRow[] {
    // Helper to keep the main function clean
    const series: StockDailyRow[] = [];

    // Start Point
    series.push({
        date: startDate.toISOString().split('T')[0],
        pe_ratio: currentEPS !== 0 ? price / currentEPS : 0,
        close: price,
        trailing_eps_4q: currentEPS,
        reportedDate_point: "",
        trailing_eps_4q_point: null,
        is_forecast_point: null,
        pe_assumed_low: null,
        pe_assumed_mid: null,
        pe_assumed_high: null,
        price_est_low: null,
        price_est_mid: null,
        price_est_high: null,
        valuation_gap_mid: null,
        pe_band_sample_n: null,
        pe_band_window_start: "",
        pe_band_window_end: ""
    });

    for (let i = 0; i < points.length; i++) {
        const startNode = i === 0
            ? { date: startDate, eps: currentEPS }
            : { date: points[i - 1].date, eps: points[i - 1].eps };
        const endNode = points[i];

        const days = (endNode.date.getTime() - startNode.date.getTime()) / (1000 * 3600 * 24);
        const steps = Math.ceil(days);

        for (let d = 1; d <= steps; d++) {
            const t = d / steps;
            const interpDate = new Date(startNode.date.getTime() + d * (24 * 3600 * 1000));
            // Linear Interp of EPS
            const interpEPS = startNode.eps + (endNode.eps - startNode.eps) * t;
            const pe = interpEPS !== 0 ? price / interpEPS : 0;

            series.push({
                date: interpDate.toISOString().split('T')[0],
                pe_ratio: pe,
                close: price,
                trailing_eps_4q: interpEPS,
                reportedDate_point: "",
                trailing_eps_4q_point: null,
                is_forecast_point: null,
                pe_assumed_low: null,
                pe_assumed_mid: null,
                pe_assumed_high: null,
                price_est_low: null,
                price_est_mid: null,
                price_est_high: null,
                valuation_gap_mid: null,
                pe_band_sample_n: null,
                pe_band_window_start: "",
                pe_band_window_end: ""
            });
        }

    }

    return series;
}

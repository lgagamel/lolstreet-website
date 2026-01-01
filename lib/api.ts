// lib/api.ts
import { promises as fs } from "fs";
import path from "path";
import type { SortMetric, StockDailyRow, StockReturnSummaryRow } from "../types";

// Repo root: process.cwd()
const DATA_DIR = path.join(process.cwd(), "data");

function clean(s: string | undefined): string {
    return (s ?? "").trim();
}

function toNullIfEmpty(s: string | undefined): string | null {
    const v = clean(s);
    if (!v) return null;
    const lower = v.toLowerCase();
    if (lower === "nan" || lower === "null" || lower === "none") return null;
    return v;
}

function toNumberOrNull(s: string | undefined): number | null {
    const v = toNullIfEmpty(s);
    if (v === null) return null;
    const n = Number(v);
    return Number.isFinite(n) ? n : null;
}

function toNumberOrNaN(s: string | undefined): number {
    const v = toNullIfEmpty(s);
    if (v === null) return NaN;
    const n = Number(v);
    return Number.isFinite(n) ? n : NaN;
}

// Minimal CSV parser: assumes no quoted commas in fields
function parseCSV(text: string): { headers: string[]; rows: string[][] } {
    const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length === 0) return { headers: [], rows: [] };
    const headers = lines[0].split(",").map((h) => h.trim());
    const rows = lines.slice(1).map((line) => line.split(","));
    return { headers, rows };
}

function idx(headers: string[], name: string): number {
    return headers.indexOf(name);
}

// -----------------------
// Summary: rankings
// -----------------------
export async function getRankings(sortMetric: SortMetric): Promise<StockReturnSummaryRow[]> {
    const filePath = path.join(DATA_DIR, "summary", "stock_return_summary.csv");
    const text = await fs.readFile(filePath, "utf-8");
    const { headers, rows } = parseCSV(text);

    const it = (col: string) => idx(headers, col);

    const out: StockReturnSummaryRow[] = rows
        .map((r) => ({
            ticker: clean(r[it("ticker")]),
            current_date: clean(r[it("current_date")]),
            current_close: toNumberOrNaN(r[it("current_close")]),
            note: clean(r[it("note")]),

            mid_6m: toNumberOrNull(r[it("mid_6m")]),
            ret_6m_pct: toNumberOrNull(r[it("ret_6m_pct")]),

            mid_1y: toNumberOrNull(r[it("mid_1y")]),
            ret_1y_pct: toNumberOrNull(r[it("ret_1y_pct")]),

            mid_2y: toNumberOrNull(r[it("mid_2y")]),
            ret_2y_pct: toNumberOrNull(r[it("ret_2y_pct")]),
            current_close: parseFloat(r[it("current_close")]) || 0,
            pe_mid_used: toNumberOrNull(r[it("pe_mid_used")]),
            current_pe: toNumberOrNull(r[it("current_pe")]),
            current_pe_gap_pct: toNumberOrNull(r[it("current_pe_gap_pct")]),
            eps_yoy_growth_avg_last4q_pct: toNumberOrNull(r[it("eps_yoy_growth_avg_last4q_pct")]),
        }))
        .filter((x) => x.ticker.length > 0);

    // sort descending, null/NaN last
    out.sort((a, b) => {
        const av = a[sortMetric];
        const bv = b[sortMetric];
        const aBad = av === null || !Number.isFinite(av);
        const bBad = bv === null || !Number.isFinite(bv);
        if (aBad && bBad) return 0;
        if (aBad) return 1;
        if (bBad) return -1;
        return (bv as number) - (av as number);
    });

    return out;
}

// -----------------------
// Per-ticker series
// -----------------------
export async function getStockSeries(ticker: string): Promise<StockDailyRow[]> {
    const safe = ticker.toUpperCase().replace(/[^A-Z0-9.\-_]/g, "");
    const filePath = path.join(DATA_DIR, "price", `${safe}.csv`);
    const text = await fs.readFile(filePath, "utf-8");
    const { headers, rows } = parseCSV(text);

    const it = (col: string) => idx(headers, col);

    const out: StockDailyRow[] = rows
        .map((r) => ({
            date: clean(r[it("date")]),
            close: toNumberOrNull(r[it("close")]),

            reportedDate_point: clean(r[it("reportedDate_point")]),
            trailing_eps_4q_point: toNumberOrNull(r[it("trailing_eps_4q_point")]),
            is_forecast_point: toNumberOrNull(r[it("is_forecast_point")]),

            trailing_eps_4q: toNumberOrNull(r[it("trailing_eps_4q")]),
            pe_ratio: toNumberOrNull(r[it("pe_ratio")]),

            pe_assumed_low: toNumberOrNull(r[it("pe_assumed_low")]),
            pe_assumed_mid: toNumberOrNull(r[it("pe_assumed_mid")]),
            pe_assumed_high: toNumberOrNull(r[it("pe_assumed_high")]),

            price_est_low: toNumberOrNull(r[it("price_est_low")]),
            price_est_mid: toNumberOrNull(r[it("price_est_mid")]),
            price_est_high: toNumberOrNull(r[it("price_est_high")]),

            valuation_gap_mid: toNumberOrNull(r[it("valuation_gap_mid")]),
            pe_band_sample_n: toNumberOrNull(r[it("pe_band_sample_n")]),

            pe_band_window_start: clean(r[it("pe_band_window_start")]),
            pe_band_window_end: clean(r[it("pe_band_window_end")]),
        }))
        .filter((x) => x.date.length > 0);

    return out;
}

export async function getFinanceData(ticker: string): Promise<import("../types").StockFinanceRow[]> {
    const safe = ticker.toUpperCase().replace(/[^A-Z0-9.\-_]/g, "");
    const filePath = path.join(DATA_DIR, "finance", `${safe}.csv`);

    try {
        const text = await fs.readFile(filePath, "utf-8");
        const { headers, rows } = parseCSV(text);
        const it = (col: string) => idx(headers, col);

        // Required headers validation could go here, but for now we soft-fail if missing
        return rows.map(r => ({
            fiscalDateEnding: clean(r[it("fiscalDateEnding")]),
            totalRevenue: toNumberOrNull(r[it("totalRevenue")]),
            netIncome: toNumberOrNull(r[it("netIncome")]),
            reportedDate: clean(r[it("reportedDate")]),
            reportedEPS: toNumberOrNull(r[it("reportedEPS")]),
            estimatedEPS: toNumberOrNull(r[it("estimatedEPS")]),
            operatingCashflow: toNumberOrNull(r[it("operatingCashflow")]),
            capitalExpenditures: toNumberOrNull(r[it("capitalExpenditures")]),
            freeCashFlow: toNumberOrNull(r[it("freeCashFlow")]),
            // computed field example: 
            // eps_computed_simple: toNumberOrNull(r[it("eps_computed_simple")]),
        })).filter(x => x.reportedDate.length > 0);
    } catch (e) {
        console.error(`Failed to load finance data for ${ticker}`, e);
        return [];
    }
}

export async function getFinanceForecast(ticker: string): Promise<import("../types").StockFinanceForecastRow[]> {
    const safe = ticker.toUpperCase().replace(/[^A-Z0-9.\-_]/g, "");
    const filePath = path.join(DATA_DIR, "finance_forecast", `${safe}.csv`);

    try {
        const text = await fs.readFile(filePath, "utf-8");
        const { headers, rows } = parseCSV(text);
        const it = (col: string) => idx(headers, col);

        return rows.map(r => ({
            ticker: clean(r[it("ticker")]),
            fiscalDateEnding: clean(r[it("fiscalDateEnding")]),
            reportedDate: clean(r[it("reportedDate")]),
            revenue_forecast: toNumberOrNull(r[it("revenue_forecast")]),
            eps_forecast: toNumberOrNull(r[it("eps_forecast")]),
            netIncome_forecast: toNumberOrNull(r[it("netIncome_forecast")]),
            report_lag_days_used: toNumberOrNull(r[it("report_lag_days_used")]),
        })).filter(x => x.reportedDate.length > 0);
    } catch (e) {
        console.warn(`Failed to load finance forecast for ${ticker} (file might not exist)`, e);
        return [];
    }
}

// -----------------------
// Helpers
// -----------------------
export function getCurrentClose(series: StockDailyRow[]): { date: string; close: number } | null {
    for (let i = series.length - 1; i >= 0; i--) {
        const c = series[i].close;
        if (c !== null && Number.isFinite(c)) {
            return { date: series[i].date, close: c };
        }
    }
    return null;
}

export async function getYoutubeLink(ticker: string): Promise<string | null> {
    const filePath = path.join(DATA_DIR, "youtube", `${ticker}.txt`);

    try {
        await fs.access(filePath);
    } catch {
        return null;
    }

    const fileContent = await fs.readFile(filePath, "utf-8");
    let rawUrl = fileContent.trim();
    if (!rawUrl) return null;

    // Remove trailing punctuation (dots, etc)
    rawUrl = rawUrl.replace(/[.]+$/, "");

    let videoId = "";
    try {
        const urlObj = new URL(rawUrl);
        if (urlObj.hostname.includes("youtube.com")) {
            if (urlObj.pathname.startsWith("/shorts/")) {
                videoId = urlObj.pathname.split("/shorts/")[1];
            } else if (urlObj.searchParams.has("v")) {
                videoId = urlObj.searchParams.get("v") || "";
            }
        } else if (urlObj.hostname.includes("youtu.be")) {
            videoId = urlObj.pathname.slice(1);
        }
    } catch (e) {
        console.error("Invalid YouTube URL:", rawUrl);
        return null;
    }

    if (videoId.includes("&")) videoId = videoId.split("&")[0];
    if (videoId.includes("?")) videoId = videoId.split("?")[0];

    if (!videoId) return null;

    return `https://www.youtube.com/embed/${videoId}`;
}

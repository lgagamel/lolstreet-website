// types/index.ts

export type SortMetric = "ret_6m_pct" | "ret_1y_pct" | "ret_2y_pct" | "pe_mid_used" | "eps_yoy_growth_avg_last4q_pct" | "current_pe" | "current_pe_gap_pct";

// data/summary/stock_return_summary.csv
export interface StockReturnSummaryRow {
    ticker: string;
    current_date: string;
    current_close: number;
    note: string;

    mid_6m: number | null;
    ret_6m_pct: number | null;

    mid_1y: number | null;
    ret_1y_pct: number | null;

    mid_2y: number | null;
    ret_2y_pct: number | null;
    pe_low_used: number | null;
    pe_mid_used: number | null;
    pe_high_used: number | null;
    current_pe: number | null;
    current_pe_gap_pct: number | null;
    eps_yoy_growth_avg_last4q_pct: number | null;
}

// data/finance/{TICKER}.csv
export interface StockFinanceRow {
    fiscalDateEnding: string;
    totalRevenue: number | null;
    netIncome: number | null;
    reportedDate: string;
    reportedEPS: number | null;
    estimatedEPS: number | null;
    commonStockSharesOutstanding: number | null;
    operatingCashflow: number | null;
    capitalExpenditures: number | null;
    freeCashFlow: number | null;
}

// data/finance_forecast/{TICKER}.csv
export interface StockFinanceForecastRow {
    ticker: string;
    fiscalDateEnding: string;
    reportedDate: string;
    revenue_forecast: number | null;
    eps_forecast: number | null;
    netIncome_forecast: number | null;
    report_lag_days_used: number | null;
}

// data/stocks/{TICKER}.csv
export interface StockDailyRow {
    date: string;
    close: number | null;

    reportedDate_point: string;
    trailing_eps_4q_point: number | null;
    is_forecast_point: number | null;

    trailing_eps_4q: number | null;
    pe_ratio: number | null;

    pe_assumed_low: number | null;
    pe_assumed_mid: number | null;
    pe_assumed_high: number | null;

    price_est_low: number | null;
    price_est_mid: number | null;
    price_est_high: number | null;

    valuation_gap_mid: number | null;
    pe_band_sample_n: number | null;

    pe_band_window_start: string;
    pe_band_window_end: string;
}

// data/news/{TICKER}.csv
export interface NewsEvent {
    date: string;
    headline_short: string;
    source: string;
}

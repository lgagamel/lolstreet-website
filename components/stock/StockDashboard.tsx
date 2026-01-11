"use client";

import React, { useState, useMemo } from "react";
import type { StockDailyRow, StockFinanceRow, StockFinanceForecastRow, StockReturnSummaryRow, NewsEvent } from "../../types";
import { buildPriceBandModel } from "../../lib/charts/priceBandModel";
import { buildPEBandModel } from "../../lib/charts/peBandModel";
import PriceChartD3 from "./PriceChartD3";
import PEChartD3 from "./PEChartD3";
import EPSChartD3 from "./EPSChartD3";
import RevenueChartD3 from "./RevenueChartD3";
import NetIncomeChartD3 from "./NetIncomeChartD3";
import CashFlowChartD3 from "./CashFlowChartD3";
import PEGaugeD3 from "./PEGaugeD3";
import InfoTooltip from "../InfoTooltip";

type Props = {
    series: StockDailyRow[];
    finance: StockFinanceRow[];
    forecast: StockFinanceForecastRow[];
    summary?: StockReturnSummaryRow | null;
    news?: NewsEvent[];
};

export default function StockDashboard({ series, finance, forecast, summary, news }: Props) {
    // Initial Models (Raw)
    const peModelRaw = useMemo(() => buildPEBandModel(series), [series]);

    // Check if there is ANY valid PE data in the entire history
    const hasValidPE = useMemo(() => {
        return peModelRaw.points.some(p => p.pe_ratio !== null);
    }, [peModelRaw]);

    // Section Visibility State
    const [visibility, setVisibility] = useState({
        peGauge: true,
        price: true,
        pe: true,
        eps: true,
        revenue: true,
        netIncome: true,
        cashFlow: true,
    });

    const toggleSection = (key: keyof typeof visibility) => {
        setVisibility(prev => ({ ...prev, [key]: !prev[key] }));
    };

    // State for Assumed PE
    const [assumedPE, setAssumedPE] = useState({
        low: peModelRaw.assumed.low,
        mid: peModelRaw.assumed.mid,
        high: peModelRaw.assumed.high,
    });

    // State for X-Axis Domain (Shared Zoom)
    // Default: Today - 6 Months to End of Data + 1 Month
    const getDefaultXDomain = (): [Date, Date] => {
        // Find latest date with a valid close price
        const lastWithClose = [...series].reverse().find(s => s.close !== null);
        let lastHistoricalDate = lastWithClose ? new Date(lastWithClose.date) : new Date();

        let absoluteMaxDate = new Date(lastHistoricalDate);
        if (series.length > 0) {
            const lastSeries = new Date(series[series.length - 1].date);
            if (lastSeries > absoluteMaxDate) absoluteMaxDate = lastSeries;
        }
        if (forecast.length > 0) {
            const lastForecast = new Date(forecast[forecast.length - 1].reportedDate);
            if (lastForecast > absoluteMaxDate) absoluteMaxDate = lastForecast;
        }
        if (finance.length > 0) {
            const lastFinance = new Date(finance[finance.length - 1].reportedDate);
            if (lastFinance > absoluteMaxDate) absoluteMaxDate = lastFinance;
        }

        const start = new Date(lastHistoricalDate);
        start.setFullYear(lastHistoricalDate.getFullYear() - 1); // Default 1 year back from last close

        const end = new Date(absoluteMaxDate);
        end.setMonth(end.getMonth() + 1);

        return [start, end];
    };

    const [xDomain, setXDomain] = useState<[Date, Date]>(getDefaultXDomain);
    const [enableTransition, setEnableTransition] = useState(true);

    const handleXDomainChange = (domain: [Date, Date]) => {
        setEnableTransition(false);
        setXDomain(domain);
    };

    const handleRangeSelect = (period: '1M' | '3M' | '6M' | '1Y' | '5Y' | 'MAX') => {
        // Find latest date with a valid close price
        const lastWithClose = [...series].reverse().find(s => s.close !== null);
        let lastHistoricalDate = lastWithClose ? new Date(lastWithClose.date) : new Date();

        let absoluteMaxDate = new Date(lastHistoricalDate);
        if (series.length > 0) {
            const lastSeries = new Date(series[series.length - 1].date);
            if (lastSeries > absoluteMaxDate) absoluteMaxDate = lastSeries;
        }
        if (forecast.length > 0) {
            const lastForecast = new Date(forecast[forecast.length - 1].reportedDate);
            if (lastForecast > absoluteMaxDate) absoluteMaxDate = lastForecast;
        }
        if (finance.length > 0) {
            const lastFinance = new Date(finance[finance.length - 1].reportedDate);
            if (lastFinance > absoluteMaxDate) absoluteMaxDate = lastFinance;
        }

        const end = new Date(absoluteMaxDate);
        end.setMonth(end.getMonth() + 1);

        let start = new Date(lastHistoricalDate);
        if (period === '1M') start.setMonth(lastHistoricalDate.getMonth() - 1);
        else if (period === '3M') start.setMonth(lastHistoricalDate.getMonth() - 3);
        else if (period === '6M') start.setMonth(lastHistoricalDate.getMonth() - 6);
        else if (period === '1Y') start.setFullYear(lastHistoricalDate.getFullYear() - 1);
        else if (period === '5Y') start.setFullYear(lastHistoricalDate.getFullYear() - 5);
        else if (period === 'MAX') {
            if (series.length > 0) {
                start = new Date(series[0].date);
            } else if (finance.length > 0) {
                start = new Date(finance[0].reportedDate);
            } else {
                start.setFullYear(lastHistoricalDate.getFullYear() - 10);
            }
        }

        setEnableTransition(true);
        setXDomain([start, end]);
    };

    // Re-calculate derived models when assumedPE changes
    const priceModel = useMemo(() => {
        const updatedRows = series.map(r => {
            const eps = r.trailing_eps_4q ?? 0;

            if (!hasValidPE) {
                // If no valid PE history, suppress bands
                return {
                    ...r,
                    pe_assumed_low: null,
                    pe_assumed_mid: null,
                    pe_assumed_high: null,
                    price_est_low: null,
                    price_est_mid: null,
                    price_est_high: null,
                } as StockDailyRow;
            }

            return {
                ...r,
                pe_assumed_low: assumedPE.low,
                pe_assumed_mid: assumedPE.mid,
                pe_assumed_high: assumedPE.high,
                price_est_low: eps * (assumedPE.low ?? 0),
                price_est_mid: eps * (assumedPE.mid ?? 0),
                price_est_high: eps * (assumedPE.high ?? 0),
            } as StockDailyRow;
        });

        return buildPriceBandModel(updatedRows);
    }, [series, assumedPE, hasValidPE]);

    const peModel = useMemo(() => {
        const m = buildPEBandModel(series);
        m.assumed = assumedPE;
        return m;
    }, [series, assumedPE]);

    const handleUpdatePE = (vals: { low?: number; mid?: number; high?: number }) => {
        setAssumedPE((prev) => {
            const next = { ...prev, ...vals };

            // Proportional Logic
            if (vals.mid !== undefined && prev.mid && prev.mid > 0.1) {
                const ratio = (next.mid ?? 0) / (prev.mid ?? 1);
                if (next.low !== undefined) next.low = prev.low! * ratio;
                else if (prev.low) next.low = prev.low * ratio;

                if (next.high !== undefined) next.high = prev.high! * ratio;
                else if (prev.high) next.high = prev.high * ratio;
            }
            return next;
        });
    };


    const renderHeader = (title: string, colorClass: string, key: keyof typeof visibility, rightElement?: React.ReactNode, tooltip?: React.ReactNode) => (
        <div
            className="flex items-center justify-between mb-4 cursor-pointer select-none group"
            onClick={() => toggleSection(key)}
        >
            <div role="heading" aria-level={2} className="text-xl font-bold flex items-center gap-1.5 group-hover:opacity-80 transition-opacity">
                <span className={`w-1 h-6 ${colorClass} rounded-full flex-shrink-0`}></span>
                <span className="whitespace-nowrap">{title}</span>
                {tooltip && <InfoTooltip>{tooltip}</InfoTooltip>}
                <svg
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${visibility[key] ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </div>
            {rightElement}
        </div>
    );

    return (
        <div className="grid grid-cols-1 gap-12">
            {hasValidPE && (
                <section>
                    {renderHeader("PE Valuation Gauge", "bg-indigo-600", "peGauge", undefined, <>🎯 <strong>Is this stock cheap, fair, or expensive right now?</strong> The gauge shows where the current PE sits compared to historical ranges.</>)}
                    {visibility.peGauge && summary && summary.current_pe !== null && (
                        <>
                            <div className="mb-4 grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                                <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                    <span className="w-3 h-3 rounded-full bg-green-500 flex-shrink-0"></span>
                                    <span className="font-medium text-green-700 dark:text-green-300">🟢 Bargain Zone - Might be undervalued!</span>
                                </div>
                                <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                    <span className="w-3 h-3 rounded-full bg-yellow-500 flex-shrink-0"></span>
                                    <span className="font-medium text-yellow-700 dark:text-yellow-300">🟡 Fair Price - About average</span>
                                </div>
                                <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                    <span className="w-3 h-3 rounded-full bg-red-500 flex-shrink-0"></span>
                                    <span className="font-medium text-red-700 dark:text-red-300">🔴 Premium Zone - Paying extra for growth!</span>
                                </div>
                            </div>
                            <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm flex justify-center h-[200px] sm:h-[280px]">
                                <PEGaugeD3
                                    current={summary.current_pe}
                                    low={summary.pe_low_used ?? 0}
                                    mid={summary.pe_mid_used ?? 0}
                                    high={summary.pe_high_used ?? 100}
                                />
                            </div>
                        </>
                    )}
                </section>
            )}

            <section>
                <div className="flex items-center gap-1 sm:gap-2 pb-2 pl-1 no-scrollbar overflow-x-auto">
                    {(['1M', '3M', '6M', '1Y', '5Y', 'MAX'] as const).map((period) => (
                        <button
                            key={period}
                            onClick={(e) => {
                                handleRangeSelect(period);
                            }}
                            className="text-[10px] sm:text-xs px-2 py-1 bg-white hover:bg-gray-100 dark:bg-gray-900/50 dark:hover:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded transition-all active:scale-95 whitespace-nowrap"
                        >
                            {period}
                        </button>
                    ))}
                    <button
                        onClick={(e) => {
                            setEnableTransition(true);
                            setXDomain(getDefaultXDomain());
                        }}
                        className="text-[10px] sm:text-xs px-2 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded transition-colors whitespace-nowrap ml-1"
                    >
                        Reset
                    </button>
                </div>
                {renderHeader("Price vs. Fair Value", "bg-violet-600", "price",
                    undefined,
                    <>📊 <strong>See if the stock is trading above or below our estimate.</strong> The bands show our fair value range based on PE ratios and earnings growth.</>
                )}
                {visibility.price && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl p-4">
                        <PriceChartD3
                            model={priceModel}
                            height={400}
                            xDomain={xDomain}
                            onXDomainChange={handleXDomainChange}
                            news={news}
                            finance={finance}
                            forecast={forecast}
                            enableTransition={enableTransition}
                        />
                    </div>
                )}
            </section>

            {hasValidPE && (
                <section>
                    {renderHeader("Historical PE Ratio", "bg-blue-600", "pe", undefined, <>🏷️ <strong>How the 'price tag' has changed over time.</strong> Watch how investors' willingness to pay for earnings shifts!</>)}
                    {visibility.pe && (
                        <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl p-4">
                            <PEChartD3
                                model={peModel}
                                height={340}
                                onUpdateAssumedPE={handleUpdatePE}
                                xDomain={xDomain}
                                onXDomainChange={handleXDomainChange}
                                enableTransition={enableTransition}
                            />
                        </div>
                    )}
                </section>
            )}

            <section>
                {renderHeader("EPS History & Forecast", "bg-emerald-600", "eps", undefined, <>🍰 <strong>Watch the profit-per-share grow (or shrink)!</strong> This shows how much the company earns for each share over time.</>)}
                {visibility.eps && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl p-4">
                        <EPSChartD3
                            data={finance}
                            forecast={forecast}
                            height={300}
                            xDomain={xDomain}
                            onXDomainChange={handleXDomainChange}
                            enableTransition={enableTransition}
                        />
                    </div>
                )}
            </section>

            <section>
                {renderHeader("Revenue History", "bg-sky-500", "revenue", undefined, <>💵 <strong>Total money the company brings in.</strong> Like a lemonade stand's total sales before paying for lemons and sugar!</>)}
                {visibility.revenue && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl p-4">
                        <RevenueChartD3
                            data={finance}
                            height={300}
                            xDomain={xDomain}
                            onXDomainChange={handleXDomainChange}
                            enableTransition={enableTransition}
                        />
                    </div>
                )}
            </section>

            <section>
                {renderHeader("Net Income History", "bg-emerald-600", "netIncome", undefined, <>💰 <strong>Actual profit after all expenses.</strong> This is what's left after paying for everything – the real money in the piggy bank!</>)}
                {visibility.netIncome && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl p-4">
                        <NetIncomeChartD3
                            data={finance}
                            height={300}
                            xDomain={xDomain}
                            onXDomainChange={handleXDomainChange}
                            enableTransition={enableTransition}
                        />
                    </div>
                )}
            </section>

            <section>
                {renderHeader("Cash Flow", "bg-green-500", "cashFlow", undefined, <>🏦 <strong>Real cash coming in vs. going out.</strong> Like tracking actual dollars in your wallet, not just promises to pay!</>)}
                {visibility.cashFlow && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl p-4">
                        <CashFlowChartD3
                            data={finance}
                            height={300}
                            xDomain={xDomain}
                            onXDomainChange={handleXDomainChange}
                            enableTransition={enableTransition}
                        />
                    </div>
                )}
            </section>
        </div>
    );
}

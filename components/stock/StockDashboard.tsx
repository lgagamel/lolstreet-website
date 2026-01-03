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

    // Section Visibility State
    const [visibility, setVisibility] = useState({
        peGauge: true,
        price: true,
        pe: true,
        eps: false,
        revenue: false,
        netIncome: false,
        cashFlow: false,
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
    // Default: Today - 1 Year to Today + 1 Year
    const [xDomain, setXDomain] = useState<[Date, Date]>(() => {
        // If series has data, use last date as anchor? Or real today?
        // Real today is better for "Today" context.
        const today = new Date();
        const start = new Date(today);
        start.setFullYear(today.getFullYear() - 1);
        const end = new Date(today);
        end.setFullYear(today.getFullYear() + 1);
        return [start, end];
    });

    // Re-calculate derived models when assumedPE changes
    const priceModel = useMemo(() => {
        const updatedRows = series.map(r => {
            const eps = r.trailing_eps_4q ?? 0;
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
    }, [series, assumedPE]);

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
            <h2 className="text-xl font-bold flex items-center gap-1.5 group-hover:opacity-80 transition-opacity">
                <span className={`w-1 h-6 ${colorClass} rounded-full flex-shrink-0`}></span>
                <span className="whitespace-nowrap">{title}</span>
                {tooltip && <InfoTooltip>{tooltip}</InfoTooltip>}
                <svg
                    className={`w-5 h-5 text-gray-400 transition-transform duration-200 flex-shrink-0 ${visibility[key] ? 'rotate-180' : ''}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor"
                >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </h2>
            {rightElement}
        </div>
    );

    return (
        <div className="grid grid-cols-1 gap-12">
            <section>
                {renderHeader("PE Valuation Gauge", "bg-indigo-600", "peGauge", undefined, <>🎯 <strong>Is this stock cheap, fair, or expensive right now?</strong> The gauge shows where the current PE sits compared to historical ranges.</>)}
                {visibility.peGauge && summary && summary.current_pe !== null && (
                    <>
                        <div className="mb-4 grid grid-cols-3 gap-3 text-xs">
                            <div className="flex items-center gap-2 p-2 bg-green-50 dark:bg-green-900/20 rounded-lg border border-green-200 dark:border-green-800">
                                <span className="w-3 h-3 rounded-full bg-green-500"></span>
                                <span className="font-medium text-green-700 dark:text-green-300">🟢 Bargain Zone - Might be undervalued!</span>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded-lg border border-yellow-200 dark:border-yellow-800">
                                <span className="w-3 h-3 rounded-full bg-yellow-500"></span>
                                <span className="font-medium text-yellow-700 dark:text-yellow-300">🟡 Fair Price - About average</span>
                            </div>
                            <div className="flex items-center gap-2 p-2 bg-red-50 dark:bg-red-900/20 rounded-lg border border-red-200 dark:border-red-800">
                                <span className="w-3 h-3 rounded-full bg-red-500"></span>
                                <span className="font-medium text-red-700 dark:text-red-300">🔴 Premium Zone - Paying extra for growth!</span>
                            </div>
                        </div>
                        <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm overflow-hidden flex justify-center">
                            <PEGaugeD3
                                current={summary.current_pe}
                                low={summary.pe_low_used ?? 0}
                                mid={summary.pe_mid_used ?? 0}
                                high={summary.pe_high_used ?? 100}
                                width={400}
                                height={250}
                            />
                        </div>
                    </>
                )}
            </section>

            <section>
                {renderHeader("Price vs. Fair Value", "bg-violet-600", "price",
                    <button
                        onClick={(e) => {
                            e.stopPropagation();
                            const today = new Date();
                            const start = new Date(today);
                            start.setFullYear(today.getFullYear() - 1);
                            const end = new Date(today);
                            end.setFullYear(today.getFullYear() + 1);
                            setXDomain([start, end]);
                        }}
                        className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                        Reset Zoom
                    </button>,
                    <>📊 <strong>See if the stock is trading above or below our estimate.</strong> The bands show our fair value range based on PE ratios and earnings growth.</>
                )}
                {visibility.price && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm">
                        <PriceChartD3
                            model={priceModel}
                            height={400}
                            xDomain={xDomain}
                            onXDomainChange={setXDomain}
                            news={news}
                            finance={finance}
                            forecast={forecast}
                        />
                    </div>
                )}
            </section>

            <section>
                {renderHeader("Historical PE Ratio", "bg-blue-600", "pe", undefined, <>🏷️ <strong>How the 'price tag' has changed over time.</strong> Watch how investors' willingness to pay for earnings shifts!</>)}
                {visibility.pe && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm overflow-hidden">
                        <PEChartD3
                            model={peModel}
                            height={340}
                            onUpdateAssumedPE={handleUpdatePE}
                            xDomain={xDomain}
                            onXDomainChange={setXDomain}
                        />
                    </div>
                )}
            </section>

            <section>
                {renderHeader("EPS History & Forecast", "bg-emerald-600", "eps", undefined, <>🍰 <strong>Watch the profit-per-share grow (or shrink)!</strong> This shows how much the company earns for each share over time.</>)}
                {visibility.eps && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm overflow-hidden">
                        <EPSChartD3
                            data={finance}
                            forecast={forecast}
                            height={300}
                            xDomain={xDomain}
                            onXDomainChange={setXDomain}
                        />
                    </div>
                )}
            </section>

            <section>
                {renderHeader("Revenue History & Forecast", "bg-sky-500", "revenue", undefined, <>💵 <strong>Total money the company brings in.</strong> Like a lemonade stand's total sales before paying for lemons and sugar!</>)}
                {visibility.revenue && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm overflow-hidden">
                        <RevenueChartD3
                            data={finance}
                            forecast={forecast}
                            height={300}
                            xDomain={xDomain}
                            onXDomainChange={setXDomain}
                        />
                    </div>
                )}
            </section>

            <section>
                {renderHeader("Net Income History & Forecast", "bg-emerald-600", "netIncome", undefined, <>💰 <strong>Actual profit after all expenses.</strong> This is what's left after paying for everything – the real money in the piggy bank!</>)}
                {visibility.netIncome && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm overflow-hidden">
                        <NetIncomeChartD3
                            data={finance}
                            forecast={forecast}
                            height={300}
                            xDomain={xDomain}
                            onXDomainChange={setXDomain}
                        />
                    </div>
                )}
            </section>

            <section>
                {renderHeader("Cash Flow", "bg-green-500", "cashFlow", undefined, <>🏦 <strong>Real cash coming in vs. going out.</strong> Like tracking actual dollars in your wallet, not just promises to pay!</>)}
                {visibility.cashFlow && (
                    <div className="bg-gray-50/50 dark:bg-gray-900/50 rounded-xl border border-gray-100 dark:border-gray-800 p-4 shadow-sm overflow-hidden">
                        <CashFlowChartD3
                            data={finance}
                            height={300}
                            xDomain={xDomain}
                            onXDomainChange={setXDomain}
                        />
                    </div>
                )}
            </section>
        </div>
    );
}

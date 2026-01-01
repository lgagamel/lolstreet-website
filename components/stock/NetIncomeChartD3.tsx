// components/stock/NetIncomeChartD3.tsx
"use client";

import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import type { StockFinanceRow, StockFinanceForecastRow } from "../../types";

interface Props {
    data: StockFinanceRow[];
    forecast: StockFinanceForecastRow[];
    height?: number;
    xDomain?: [Date, Date];
    onXDomainChange?: (domain: [Date, Date]) => void;
}

// Helper to format large numbers (Billion, Million)
function formatValue(v: number | null): string {
    if (v === null) return "-";
    const abs = Math.abs(v);
    if (abs >= 1e9) return `$${(v / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(v / 1e6).toFixed(2)}M`;
    return `$${v.toFixed(0)}`;
}

export default function NetIncomeChartD3({ data, forecast, height = 300, xDomain, onXDomainChange }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const [tooltip, setTooltip] = useState<{
        visible: boolean;
        x: number;
        y: number;
        data?: { date: string; value: number; type: 'reported' | 'forecast' };
    }>({ visible: false, x: 0, y: 0 });

    // Y-Axis State
    const [yDomain, setYDomain] = useState<[number, number] | null>(null);

    // Initial Y Domain Calculation
    useEffect(() => {
        if (!data.length && !forecast.length) return;
        const allVals = [
            ...data.map(d => d.netIncome || 0),
            ...forecast.map(f => f.netIncome_forecast || 0)
        ];
        const yMax = d3.max(allVals) || 1;
        const yMin = d3.min(allVals) || 0;
        setYDomain([Math.min(0, yMin), yMax * 1.1]);
    }, [data, forecast]);

    useEffect(() => {
        if (!containerRef.current || (!data.length && !forecast.length)) return;

        const width = containerRef.current.clientWidth;
        const h = height;
        const margin = { top: 20, right: 80, left: 10, bottom: 50 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = h - margin.top - margin.bottom;

        if (!svgRef.current) {
            const svg = d3.select(containerRef.current)
                .append("svg")
                .attr("width", width)
                .attr("height", h)
                .style("overflow", "visible")
                .attr("class", "chart-svg");

            svgRef.current = svg;

            const defs = svg.append("defs");
            defs.append("clipPath").attr("id", "clip-net-income").append("rect");

            const mainG = svg.append("g").attr("class", "main-g");
            mainG.append("rect").attr("class", "zoom-capture").attr("fill", "transparent");
            mainG.append("g").attr("class", "grid-lines opacity-10");
            mainG.append("g").attr("class", "bars-layer").attr("clip-path", "url(#clip-net-income)");
            mainG.append("g").attr("class", "axis-x");
            mainG.append("g").attr("class", "axis-y");
            mainG.append("g").attr("class", "scrollbars");
        }

        const svg = svgRef.current!;
        svg.attr("width", width).attr("height", h).attr("viewBox", `0 0 ${width} ${h}`);
        svg.select("#clip-net-income rect").attr("width", innerWidth).attr("height", innerHeight);
        const mainG = svg.select(".main-g").attr("transform", `translate(${margin.left},${margin.top})`);

        // X scale
        const allDates = [
            ...data.map(d => new Date(d.reportedDate)),
            ...forecast.map(d => new Date(d.reportedDate))
        ];
        const xExt = d3.extent(allDates) as [Date, Date];
        let currentXDomain = xDomain;
        if (!currentXDomain) {
            const start = xExt[0] ? new Date(xExt[0].getTime() - 30 * 24 * 3600 * 1000) : new Date();
            const end = xExt[1] ? new Date(xExt[1].getTime() + 30 * 24 * 3600 * 1000) : new Date();
            currentXDomain = [start, end];
        }
        const x = d3.scaleTime().domain(currentXDomain).range([0, innerWidth]);

        // Y scale
        const yMaxAll = d3.max([...data.map(d => d.netIncome || 0), ...forecast.map(f => f.netIncome_forecast || 0)]) || 1;
        const fullYDomain: [number, number] = [0, yMaxAll * 1.5];
        const currentYDomain = yDomain || [0, yMaxAll * 1.1];
        const y = d3.scaleLinear().domain(currentYDomain).range([innerHeight, 0]);

        // Axes
        mainG.select<SVGGElement>(".axis-x")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(x).ticks(6).tickSize(0).tickPadding(10))
            .attr("class", "axis-x text-xs font-mono text-gray-500")
            .select(".domain").remove();

        mainG.select<SVGGElement>(".axis-y")
            .attr("transform", `translate(${innerWidth}, 0)`)
            .call(d3.axisRight(y).ticks(5).tickSize(0).tickPadding(10).tickFormat(d => formatValue(d as number)))
            .attr("class", "axis-y text-xs font-mono text-gray-500")
            .select(".domain").remove();

        mainG.select<SVGGElement>(".grid-lines")
            .call(d3.axisLeft(y).tickSize(-innerWidth).ticks(5).tickFormat(() => ""))
            .style("stroke-dasharray", "4 4")
            .selectAll("line").attr("stroke", "currentColor");
        mainG.select(".grid-lines").select(".domain").remove();

        // Bars
        const barWidth = Math.max(4, innerWidth / ((data.length + forecast.length) * 3));
        const barsLayer = mainG.select(".bars-layer");
        barsLayer.selectAll("*").remove();

        // Hist
        barsLayer.selectAll(".bar-hist")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "bar-hist")
            .attr("x", d => x(new Date(d.reportedDate)) - barWidth / 2)
            .attr("y", d => y(Math.max(0, d.netIncome || 0)))
            .attr("width", barWidth)
            .attr("height", d => Math.abs(y(d.netIncome || 0) - y(0)))
            .attr("fill", "#14b8a6")
            .attr("rx", 2);

        // Fore
        barsLayer.selectAll(".bar-forecast")
            .data(forecast)
            .enter()
            .append("rect")
            .attr("class", "bar-forecast")
            .attr("x", d => x(new Date(d.reportedDate)) - barWidth / 2)
            .attr("y", d => y(Math.max(0, d.netIncome_forecast || 0)))
            .attr("width", barWidth)
            .attr("height", d => Math.abs(y(d.netIncome_forecast || 0) - y(0)))
            .attr("fill", "transparent")
            .attr("stroke", "#14b8a6")
            .attr("stroke-width", 1.5)
            .attr("rx", 2)
            .style("stroke-dasharray", "4 2");

        // Scrollbars
        const scrollG = mainG.select<SVGGElement>(".scrollbars");

        const renderScrollbar = (
            parent: d3.Selection<SVGGElement, unknown, null, undefined>,
            classSelector: string,
            xPos: number, yPos: number,
            length: number, thickness: number,
            orientation: 'horizontal' | 'vertical',
            fullDomain: [number, number],
            currentDomain: [number, number],
            onChange: (d: [number, number]) => void
        ) => {
            const isH = orientation === 'horizontal';
            let g = parent.select<SVGGElement>(`.${classSelector}`);
            if (g.empty()) {
                g = parent.append("g").attr("class", classSelector);
                g.append("rect").attr("class", "track").attr("fill", "#f1f5f9");
                const thumbG = g.append("g").attr("class", "thumb-group");
                thumbG.append("rect").attr("class", "thumb").attr("fill", "#cbd5e1").style("cursor", "grab");
                thumbG.append("g").attr("class", "grips").attr("pointer-events", "none");
                thumbG.append("rect").attr("class", "handle-start").attr("fill", "transparent");
                thumbG.append("rect").attr("class", "handle-end").attr("fill", "transparent");
            }

            const barScale = d3.scaleLinear().domain(fullDomain).range([0, length]);
            let startPos = barScale(currentDomain[0]);
            let endPos = barScale(currentDomain[1]);
            if (startPos > endPos) [startPos, endPos] = [endPos, startPos];

            startPos = Math.max(0, Math.min(length, startPos));
            endPos = Math.max(0, Math.min(length, endPos));
            let thumbSize = Math.max(20, endPos - startPos);

            g.attr("transform", `translate(${xPos},${yPos})`);
            g.select(".track").attr("width", isH ? length : thickness).attr("height", isH ? thickness : length).attr("rx", thickness / 2);
            const thumbG = g.select(".thumb-group").attr("transform", isH ? `translate(${startPos}, 0)` : `translate(0, ${startPos})`);
            const thumb = thumbG.select(".thumb").attr("width", isH ? thumbSize : thickness).attr("height", isH ? thickness : thumbSize).attr("rx", thickness / 2);

            const gripG = thumbG.select(".grips").html("");
            if (thumbSize > 30) {
                const gripPath = isH
                    ? `M 6,3 L 6,${thickness - 3} M 9,3 L 9,${thickness - 3} M ${thumbSize - 9},3 L ${thumbSize - 9},${thickness - 3} M ${thumbSize - 6},3 L ${thumbSize - 6},${thickness - 3}`
                    : `M 3,6 L ${thickness - 3},6 M 3,9 L ${thickness - 3},9 M 3,${thumbSize - 9} L ${thickness - 3},${thumbSize - 9} M 3,${thumbSize - 6} L ${thickness - 3},${thumbSize - 6}`;
                gripG.append("path").attr("d", gripPath).attr("stroke", "white").attr("stroke-width", 1.5).attr("opacity", 0.8);
            }

            thumb.call((d3.drag<SVGRectElement, unknown>()
                .container(g.node() as any)
                .on("start", function (event) {
                    const p = isH ? event.x : event.y;
                    // @ts-ignore
                    this.__dragOffset = p - startPos;
                    d3.select(this).style("cursor", "grabbing");
                })
                .on("drag", function (event) {
                    const p = isH ? event.x : event.y;
                    // @ts-ignore
                    const offset = this.__dragOffset || 0;
                    let ns = p - offset;
                    ns = Math.max(0, Math.min(length - thumbSize, ns));
                    onChange([barScale.invert(ns), barScale.invert(ns + thumbSize)]);
                })
                .on("end", function () { d3.select(this).style("cursor", "grab"); })
            ) as any);

            const handleThickness = 12;
            const updateHandle = (type: 'start' | 'end') => {
                const sel = thumbG.select(type === 'start' ? ".handle-start" : ".handle-end");
                const xLoc = isH ? (type === 'start' ? 0 : thumbSize - handleThickness) : 0;
                const yLoc = isH ? 0 : (type === 'start' ? 0 : thumbSize - handleThickness);
                const w = isH ? handleThickness : thickness;
                const h = isH ? thickness : handleThickness;
                sel.attr("x", xLoc).attr("y", yLoc).attr("width", w).attr("height", h)
                    .style("cursor", isH ? "ew-resize" : "ns-resize")
                    .call((d3.drag<SVGRectElement, unknown>()
                        .container(g.node() as any)
                        .on("start", function (event) {
                            const p = isH ? event.x : event.y;
                            // @ts-ignore
                            this.__dragOffset = p - (type === 'start' ? startPos : endPos);
                        })
                        .on("drag", function (event) {
                            const p = isH ? event.x : event.y;
                            // @ts-ignore
                            let nep = p - (this.__dragOffset || 0);
                            if (type === 'start') onChange([barScale.invert(Math.max(0, Math.min(endPos - 20, nep))), currentDomain[1]]);
                            else onChange([currentDomain[0], barScale.invert(Math.max(startPos + 20, Math.min(length, nep)))]);
                        })
                    ) as any);
            };
            updateHandle('start');
            updateHandle('end');
        };

        const twoYearsFuture = new Date().setFullYear(new Date().getFullYear() + 2);
        const fullX: [number, number] = [xExt[0]?.getTime() || Date.now(), Math.max(xExt[1]?.getTime() || Date.now(), twoYearsFuture)];
        renderScrollbar(scrollG, "scrollbar-x", 0, innerHeight + 35, innerWidth, 16, 'horizontal', fullX, [currentXDomain[0].getTime(), currentXDomain[1].getTime()],
            (d) => onXDomainChange?.([new Date(d[0]), new Date(d[1])]));

        renderScrollbar(scrollG, "scrollbar-y", innerWidth + 64, 0, innerHeight, 16, 'vertical', [fullYDomain[1], fullYDomain[0]], [currentYDomain[1], currentYDomain[0]], (d) => setYDomain([d[1], d[0]]));

        const zoomRect = mainG.select<SVGRectElement>(".zoom-capture")
            .attr("width", innerWidth).attr("height", innerHeight)
            .style("cursor", "crosshair")
            .attr("pointer-events", "all");

        const bisectHist = d3.bisector<StockFinanceRow, Date>(d => new Date(d.reportedDate)).center;
        const bisectFore = d3.bisector<StockFinanceForecastRow, Date>(f => new Date(f.reportedDate)).center;

        zoomRect.on("mousemove", event => {
            const [mx] = d3.pointer(event);
            const date = x.invert(mx);
            const iHist = bisectHist(data, date);
            const iFore = bisectFore(forecast, date);
            const dHist = data[iHist];
            const dFore = forecast[iFore];
            let best = null;
            if (dHist && dFore) {
                const distH = Math.abs(new Date(dHist.reportedDate).getTime() - date.getTime());
                const distF = Math.abs(new Date(dFore.reportedDate).getTime() - date.getTime());
                best = distH < distF ? { date: dHist.reportedDate, value: dHist.netIncome || 0, type: 'reported' as const } : { date: dFore.reportedDate, value: dFore.netIncome_forecast || 0, type: 'forecast' as const };
            } else if (dHist) best = { date: dHist.reportedDate, value: dHist.netIncome || 0, type: 'reported' as const };
            else if (dFore) best = { date: dFore.reportedDate, value: dFore.netIncome_forecast || 0, type: 'forecast' as const };

            if (best) setTooltip({ visible: true, x: mx + margin.left, y: d3.pointer(event)[1] + margin.top, data: best });
        }).on("mouseleave", () => setTooltip(p => ({ ...p, visible: false })));

    }, [data, forecast, height, xDomain, yDomain, onXDomainChange]);

    return (
        <div className="relative w-full" ref={containerRef}>
            <div className="w-full" />
            {tooltip.visible && tooltip.data && (
                <div
                    className="pointer-events-none absolute z-50 rounded-lg border border-gray-200 bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:border-gray-800 dark:bg-black/90 text-sm"
                    style={{ transform: `translate(${Math.min(tooltip.x + 15, (containerRef.current?.clientWidth || 0) - 150)}px, ${tooltip.y}px)` }}
                >
                    <div className="mb-1 font-mono text-gray-500">{tooltip.data.date}</div>
                    <div className="flex items-center gap-2">
                        <span className={`w-2 h-2 rounded-sm ${tooltip.data.type === 'reported' ? 'bg-teal-500' : 'border border-teal-500 border-dashed'}`}></span>
                        <span className="text-gray-600 dark:text-gray-400">{tooltip.data.type === 'reported' ? 'Net Income:' : 'Forecast:'}</span>
                        <span className="font-mono font-bold">{formatValue(tooltip.data.value)}</span>
                    </div>
                </div>
            )}
            <div className="flex gap-4 justify-center mt-8 text-xs text-gray-500">
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-teal-500 rounded-sm"></span> Net Income</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 border border-teal-500 border-dashed rounded-sm"></span> Forecast</div>
            </div>
        </div>
    );
}

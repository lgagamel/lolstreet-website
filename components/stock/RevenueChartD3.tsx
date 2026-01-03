"use client";

import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { StockFinanceRow, StockFinanceForecastRow } from "../../types";

type Props = {
    data: StockFinanceRow[];
    forecast?: StockFinanceForecastRow[];
    height?: number;
    className?: string;
    xDomain?: [Date, Date];
    onXDomainChange?: (domain: [Date, Date]) => void;
};

// Helper to format billions
const formatCurrency = (val: number) => {
    if (val >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (val >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toFixed(0)}`;
};

export default function RevenueChartD3({ data, forecast = [], height = 300, className = "", xDomain, onXDomainChange }: Props) {
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

        const histMax = d3.max(data, d => d.totalRevenue || 0) || 0;
        const histMin = d3.min(data, d => d.totalRevenue || 0) || 0;

        const foreMax = d3.max(forecast, d => d.revenue_forecast || 0) || 0;
        const foreMin = d3.min(forecast, d => d.revenue_forecast || 0) || 0;

        const yMax = Math.max(histMax, foreMax) || 1;
        const yMin = Math.min(histMin, foreMin) || 0;

        // Start from 0 typically for Revenue
        setYDomain([0, yMax * 1.1]);
    }, [data, forecast]);

    useEffect(() => {
        if (!containerRef.current || (!data.length && !forecast.length)) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const h = height;
        const margin = { top: 20, right: 80, left: 10, bottom: 50 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = h - margin.top - margin.bottom;

        if (!svgRef.current) {
            const svg = d3.select(container)
                .append("svg")
                .attr("width", width)
                .attr("height", h)
                .style("overflow", "visible")
                .attr("class", "chart-svg");

            svgRef.current = svg;

            const defs = svg.append("defs");
            const grad = defs.append("linearGradient").attr("id", "gradientRevenue").attr("x1", "0").attr("y1", "0").attr("x2", "0").attr("y2", "1");
            grad.append("stop").attr("offset", "0%").attr("stop-color", "#38bdf8"); // Sky-400
            grad.append("stop").attr("offset", "100%").attr("stop-color", "#0284c7"); // Sky-600

            defs.append("clipPath").attr("id", "clip-revenue").append("rect");

            const mainG = svg.append("g").attr("class", "main-g");
            mainG.append("rect").attr("class", "zoom-capture").attr("fill", "transparent");
            mainG.append("g").attr("class", "grid-lines opacity-10");
            mainG.append("g").attr("class", "bars-layer").attr("clip-path", "url(#clip-revenue)");
            mainG.append("g").attr("class", "forecast-layer").attr("clip-path", "url(#clip-revenue)");
            mainG.append("g").attr("class", "axis-x");
            mainG.append("g").attr("class", "axis-y");
            mainG.append("g").attr("class", "scrollbars");
        }

        const svg = svgRef.current!;
        svg.attr("width", width).attr("height", h).attr("viewBox", `0 0 ${width} ${h}`);
        svg.select("#clip-revenue rect").attr("width", innerWidth).attr("height", innerHeight);
        const mainG = svg.select(".main-g").attr("transform", `translate(${margin.left},${margin.top})`);

        // X Axis: Combined Time
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

        // Y Axis: Revenue (Linear)
        const histMax = d3.max(data, d => d.totalRevenue || 0) || 0;
        const foreMax = d3.max(forecast, d => d.revenue_forecast || 0) || 0;
        const dataYMax = Math.max(histMax, foreMax) || 1;
        // const dataYMin = 0; // Revenue usually > 0

        const fullYDomain: [number, number] = [0, dataYMax * 1.5]; // 1.5x for headroom
        const currentYDomain = yDomain || [0, dataYMax * 1.1];
        const y = d3.scaleLinear().domain(currentYDomain).range([innerHeight, 0]);

        // Axes
        const xAxis = d3.axisBottom(x).ticks(6).tickSize(0).tickPadding(10);
        mainG.select<SVGGElement>(".axis-x")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxis)
            .attr("class", "axis-x text-xs font-mono text-gray-500")
            .select(".domain").remove();

        const yAxis = d3.axisRight(y)
            .ticks(5)
            .tickFormat((d) => d3.format(".2s")(d).replace("G", "B")) // Format billions
            .tickSize(0)
            .tickPadding(10);

        mainG.select<SVGGElement>(".axis-y")
            .attr("transform", `translate(${innerWidth}, 0)`)
            .call(yAxis)
            .attr("class", "axis-y text-xs font-mono text-gray-500")
            .select(".domain").remove();

        mainG.select<SVGGElement>(".grid-lines")
            .call(d3.axisLeft(y).tickSize(-innerWidth).ticks(5).tickFormat(() => ""))
            .style("stroke-dasharray", "4 4")
            .selectAll("line").attr("stroke", "currentColor");
        mainG.select(".grid-lines").select(".domain").remove();

        // Bars
        const barWidth = Math.max(4, innerWidth / ((data.length + forecast.length) * 3));

        // Historical Bars
        const barsLayer = mainG.select(".bars-layer");
        barsLayer.selectAll("*").remove();

        barsLayer.selectAll(".bar-reported")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "bar-reported")
            .attr("x", (d) => x(new Date(d.reportedDate)) - barWidth / 2)
            .attr("y", (d) => y(d.totalRevenue || 0))
            .attr("width", barWidth)
            .attr("height", (d) => Math.abs(y(d.totalRevenue || 0) - y(0)))
            .attr("fill", "url(#gradientRevenue)") // Gradient
            .attr("rx", 3);

        // Forecast Bars
        const forecastLayer = mainG.select(".forecast-layer");
        forecastLayer.selectAll("*").remove();

        forecastLayer.selectAll(".bar-forecast")
            .data(forecast)
            .enter()
            .append("rect")
            .attr("class", "bar-forecast")
            .attr("x", (d) => x(new Date(d.reportedDate)) - barWidth / 2)
            .attr("y", (d) => y(d.revenue_forecast || 0))
            .attr("width", barWidth)
            .attr("height", (d) => Math.abs(y(d.revenue_forecast || 0) - y(0)))
            .attr("fill", "transparent") // Hollow
            .attr("stroke", "#0ea5e9") // Sky blue outline
            .attr("stroke-width", 1.5)
            .attr("rx", 2)
            .style("stroke-dasharray", "4 2");

        // Professional Box Legend
        const legendG = mainG.select(".forecast-layer"); // Using forecast-layer or append new? standard is usually separate layer.
        // Actually earlier code appended smart labels to forecastLayer/barsLayer.
        // Let's create a dedicated legend group attached to mainG to ensure z-index.
        // But mainG doesn't have a dedicated .legend-layer in this file yet.
        // I will append it if missing or just append to mainG.
        // Ideally I should add .legend-layer in initialization, but simpler to just append 'g.legend-box' at end of mainG.

        mainG.select(".legend-box").remove(); // Clear prev
        const lg = mainG.append("g").attr("class", "legend-box").attr("transform", "translate(16, 10)");

        const legendItems = [
            { label: "Revenue", type: "reported", color: "#0ea5e9" },
            { label: "Forecast", type: "forecast", color: "#0ea5e9" }
        ];

        if (data.length > 0 || forecast.length > 0) {
            const itemHeight = 18;
            const padding = 10;
            const boxWidth = 90;
            const boxHeight = legendItems.length * itemHeight + padding * 2;

            // Background
            lg.append("rect")
                .attr("width", boxWidth)
                .attr("height", boxHeight)
                .attr("rx", 6)
                .attr("fill", "white")
                .attr("fill-opacity", 0.8)
                .attr("stroke", "#e5e7eb")
                .attr("stroke-width", 1)
                .style("filter", "drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))");

            // Items
            legendItems.forEach((item, i) => {
                const g = lg.append("g").attr("transform", `translate(${padding}, ${padding + i * itemHeight + 9})`);

                // Symbol
                if (item.type === 'reported') {
                    g.append("circle").attr("r", 4).attr("fill", item.color);
                } else {
                    g.append("circle")
                        .attr("r", 4)
                        .attr("fill", "white")
                        .attr("stroke", item.color)
                        .attr("stroke-width", 1.5)
                        .attr("stroke-dasharray", "2 2");
                }

                g.append("text")
                    .attr("x", 12).attr("y", 4)
                    .attr("font-size", "11px").attr("font-weight", "500").attr("font-family", "monospace")
                    .attr("fill", "#374151")
                    .text(item.label);
            });
        }

        // --- Scrollbar Logic ---
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

            // 1. Enter
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

            // 2. Logic
            const barScale = d3.scaleLinear().domain(fullDomain).range([0, length]);
            let startPos = barScale(currentDomain[0]);
            let endPos = barScale(currentDomain[1]);

            if (startPos > endPos) {
                const temp = startPos;
                startPos = endPos;
                endPos = temp;
            }
            startPos = Math.max(0, Math.min(length, startPos));
            endPos = Math.max(0, Math.min(length, endPos));
            let thumbSize = Math.max(20, endPos - startPos);
            if (endPos - startPos < 20) {
                const center = (startPos + endPos) / 2;
                startPos = center - 10;
                if (startPos < 0) startPos = 0;
                if (startPos + 20 > length) startPos = length - 20;
            }

            // 3. Update Attributes
            g.attr("transform", `translate(${xPos},${yPos})`);
            g.select(".track").attr("width", isH ? length : thickness).attr("height", isH ? thickness : length).attr("rx", thickness / 2);
            const thumbG = g.select(".thumb-group").attr("transform", isH ? `translate(${startPos}, 0)` : `translate(0, ${startPos})`);
            const thumb = thumbG.select(".thumb").attr("width", isH ? thumbSize : thickness).attr("height", isH ? thickness : thumbSize).attr("rx", thickness / 2);

            // Grips logic (abbreviated here for brevity, keeping existing detail)
            const gripG = thumbG.select(".grips").html("");
            if (thumbSize > 30) {
                const gripPath = isH
                    ? `M 6,3 L 6,${thickness - 3} M 9,3 L 9,${thickness - 3} M ${thumbSize - 9},3 L ${thumbSize - 9},${thickness - 3} M ${thumbSize - 6},3 L ${thumbSize - 6},${thickness - 3}`
                    : `M 3,6 L ${thickness - 3},6 M 3,9 L ${thickness - 3},9 M 3,${thumbSize - 9} L ${thickness - 3},${thumbSize - 9} M 3,${thumbSize - 6} L ${thickness - 3},${thumbSize - 6}`;
                gripG.append("path").attr("d", gripPath).attr("stroke", "white").attr("stroke-width", 1.5).attr("opacity", 0.8);
            }

            // 4. Update Interaction
            thumb.call((d3.drag<SVGRectElement, unknown>().container(g.node() as any)
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
                    let newStart = p - offset;
                    newStart = Math.max(0, Math.min(length - thumbSize, newStart));
                    let newValStart = barScale.invert(newStart);
                    let newValEnd = barScale.invert(newStart + thumbSize);
                    onChange([newValStart, newValEnd]);
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
                    .call((d3.drag<SVGRectElement, unknown>().container(g.node() as any)
                        .on("start", function (event) {
                            const p = isH ? event.x : event.y;
                            const edgePos = type === 'start' ? startPos : endPos;
                            // @ts-ignore
                            this.__dragOffset = p - edgePos;
                        })
                        .on("drag", function (event) {
                            const p = isH ? event.x : event.y;
                            // @ts-ignore
                            const offset = this.__dragOffset || 0;
                            let newEdgePos = p - offset;
                            const minPxGap = 20;
                            if (type === 'start') {
                                newEdgePos = Math.max(0, Math.min(endPos - minPxGap, newEdgePos));
                                const val = barScale.invert(newEdgePos);
                                onChange([val, currentDomain[1]]);
                            } else {
                                newEdgePos = Math.max(startPos + minPxGap, Math.min(length, newEdgePos));
                                const val = barScale.invert(newEdgePos);
                                onChange([currentDomain[0], val]);
                            }
                        })
                    ) as any);
            };
            updateHandle('start');
            updateHandle('end');
        };

        // 2 Years from now logic + combined data
        const xExtFullLocal = d3.extent(allDates) as [Date, Date];
        const twoYearsFromNow = new Date().setFullYear(new Date().getFullYear() + 2);
        const fullX: [number, number] = [
            (xExtFullLocal[0] ? xExtFullLocal[0].getTime() : Date.now()),
            Math.max((xExtFullLocal[1] ? xExtFullLocal[1].getTime() : Date.now()), twoYearsFromNow)
        ];

        renderScrollbar(scrollG, "scrollbar-x", 0, innerHeight + 35, innerWidth, 16, 'horizontal', fullX, [currentXDomain[0].getTime(), currentXDomain[1].getTime()],
            (d) => onXDomainChange && onXDomainChange([new Date(d[0]), new Date(d[1])]));

        // Vertical Scrollbar (Y)
        renderScrollbar(scrollG, "scrollbar-y", innerWidth + 64, 0, innerHeight, 16, 'vertical',
            [fullYDomain[1], fullYDomain[0]],
            [currentYDomain[1], currentYDomain[0]],
            (d) => setYDomain([d[1], d[0]])
        );

        // Zoom Capture & Tooltip
        const zoomRect = mainG.select<SVGRectElement>(".zoom-capture")
            .attr("width", innerWidth).attr("height", innerHeight)
            .style("cursor", "crosshair")
            .attr("pointer-events", "all")
            .on(".zoom", null);

        const bisectHist = d3.bisector<StockFinanceRow, Date>((d) => new Date(d.reportedDate)).center;
        const bisectFore = d3.bisector<StockFinanceForecastRow, Date>((d) => new Date(d.reportedDate)).center;

        zoomRect.on("mousemove", (event) => {
            const [mx] = d3.pointer(event);
            const date = x.invert(mx);

            const iHist = bisectHist(data, date);
            const iFore = bisectFore(forecast, date);

            const dHist = data[iHist];
            const dFore = forecast[iFore];

            let best = null;
            if (dHist && dFore) {
                const distHist = Math.abs(new Date(dHist.reportedDate).getTime() - date.getTime());
                const distFore = Math.abs(new Date(dFore.reportedDate).getTime() - date.getTime());
                best = distHist < distFore
                    ? { date: dHist.reportedDate, value: dHist.totalRevenue || 0, type: 'reported' as const }
                    : { date: dFore.reportedDate, value: dFore.revenue_forecast || 0, type: 'forecast' as const };
            } else if (dHist) {
                best = { date: dHist.reportedDate, value: dHist.totalRevenue || 0, type: 'reported' as const };
            } else if (dFore) {
                best = { date: dFore.reportedDate, value: dFore.revenue_forecast || 0, type: 'forecast' as const };
            }

            if (best) setTooltip({ visible: true, x: mx + margin.left, y: d3.pointer(event)[1] + margin.top, data: best });
        }).on("mouseleave", () => setTooltip(prev => ({ ...prev, visible: false })));

    }, [data, forecast, height, xDomain, yDomain, onXDomainChange]);

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            <div ref={containerRef} className="w-full" />
            {tooltip.visible && tooltip.data && (
                <div
                    className="pointer-events-none absolute z-50 rounded-lg border border-gray-200 bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:border-gray-800 dark:bg-black/90 text-sm"
                    style={{
                        top: 0,
                        left: 0,
                        transform: `translate(${Math.min(tooltip.x + 15, containerRef.current!.clientWidth - 150)}px, ${tooltip.y}px) translateY(-100%) translateY(-10px)`
                    }}
                >
                    <div className="mb-1 font-mono text-gray-500">{tooltip.data.date}</div>

                    {tooltip.data.type === 'reported' ? (
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 bg-sky-500 rounded-sm"></span>
                            <span className="text-gray-600 dark:text-gray-400">Revenue:</span>
                            <span className="font-mono font-bold">{formatCurrency(tooltip.data.value)}</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 border border-sky-500 border-dashed rounded-sm"></span>
                            <span className="text-gray-600 dark:text-gray-400">Model Forecast:</span>
                            <span className="font-mono font-bold">{formatCurrency(tooltip.data.value)}</span>
                        </div>
                    )}
                </div>
            )}
            <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500 absolute bottom-0 w-full pointer-events-none" style={{ bottom: "-20px" }}>
            </div>
        </div>
    );
}

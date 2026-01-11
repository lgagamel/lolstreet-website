// components/stock/NetIncomeChartD3.tsx
"use client";

import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import type { StockFinanceRow, StockFinanceForecastRow } from "../../types";

interface Props {
    data: StockFinanceRow[];
    // forecast removed
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

export default function NetIncomeChartD3({ data, height = 300, xDomain, onXDomainChange }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const [tooltip, setTooltip] = useState<{
        visible: boolean;
        x: number;
        y: number;
        data?: { date: string; value: number; type: 'reported' | 'forecast' };
    }>({ visible: false, x: 0, y: 0 });

    // Refs for Drag Handlers
    const xDomainRef = useRef<[Date, Date] | null>(null);
    const yDomainRef = useRef<[number, number] | null>(null);
    const dragContextX = useRef<{ startX: number, domain: [Date, Date] } | null>(null);
    const dragContextY = useRef<{ startY: number, domain: [number, number] } | null>(null);

    // Y-Axis State
    const [yDomain, setYDomain] = useState<[number, number] | null>(null);

    // Initial Y Domain Calculation
    // Initial Y Domain Calculation removed to allow dynamic scaling
    // useEffect(() => { ... }, [data]);

    useEffect(() => {
        if (!containerRef.current || !data.length) return;

        const width = containerRef.current.clientWidth;
        const isMobile = width < 640;
        const h = height;
        // Margins: Left Y-axis, No Scrollbars
        const margin = {
            top: 20,
            right: isMobile ? 10 : 30,
            left: isMobile ? 45 : 60,
            bottom: isMobile ? 40 : 50
        };
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
            const grad = defs.append("linearGradient").attr("id", "gradientNetIncome").attr("x1", "0").attr("y1", "0").attr("x2", "0").attr("y2", "1");
            grad.append("stop").attr("offset", "0%").attr("stop-color", "#6366f1"); // Indigo-500
            grad.append("stop").attr("offset", "100%").attr("stop-color", "#4338ca"); // Indigo-700

            defs.append("clipPath").attr("id", "clip-net-income").append("rect");

            const mainG = svg.append("g").attr("class", "main-g");
            mainG.append("rect").attr("class", "zoom-capture").attr("fill", "transparent");
            mainG.append("g").attr("class", "grid-lines opacity-5");
            mainG.append("g").attr("class", "bars-layer").attr("clip-path", "url(#clip-net-income)").style("pointer-events", "none");
            mainG.append("g").attr("class", "price-line").attr("clip-path", "url(#clip-net-income)").style("pointer-events", "none");

            // Axes
            // Axes
            const xAxisG = mainG.append("g").attr("class", "axis-x");
            const yAxisG = mainG.append("g").attr("class", "axis-y");
            mainG.append("g").attr("class", "scroll-layer");
        }

        const svg = svgRef.current!;
        svg.attr("width", width).attr("height", h).attr("viewBox", `0 0 ${width} ${h}`);
        svg.select("#clip-net-income rect").attr("width", innerWidth).attr("height", innerHeight);
        const mainG = svg.select<SVGGElement>(".main-g").attr("transform", `translate(${margin.left},${margin.top})`);

        // X scale
        const allDates = [
            ...data.map(d => new Date(d.reportedDate))
        ];
        const xExt = d3.extent(allDates) as [Date, Date];
        let currentXDomain = xDomain;
        if (!currentXDomain) {
            const start = xExt[0] ? new Date(xExt[0].getTime() - 30 * 24 * 3600 * 1000) : new Date();
            const end = xExt[1] ? new Date(xExt[1].getTime() + 30 * 24 * 3600 * 1000) : new Date();
            currentXDomain = [start, end];
        }
        const x = d3.scaleTime().domain(currentXDomain).range([0, innerWidth]);

        // Calculate Y domain based on visible data in the X range
        const calculateYDomain = (): [number, number] => {
            if (yDomain) return yDomain;

            const visibleData = data.filter(d => {
                const date = new Date(d.reportedDate);
                return date >= currentXDomain[0] && date <= currentXDomain[1];
            });

            if (visibleData.length === 0) return [0, 1];

            const values = visibleData.map(d => d.netIncome || 0).filter(v => v !== 0);
            if (values.length === 0) return [0, 1];

            const maxVal = Math.max(...values);
            const minVal = Math.min(...values);

            // Handle negative values properly
            const absMax = Math.max(Math.abs(maxVal), Math.abs(minVal));
            const yMax = maxVal > 0 ? maxVal * 1.1 : maxVal * 0.9; // Add headroom above
            const yMin = minVal < 0 ? minVal * 1.1 : 0; // Add headroom below if negative

            return [Math.min(0, yMin), Math.max(1, yMax)];
        };
        const currentYDomain: [number, number] = calculateYDomain();

        // Update Refs
        xDomainRef.current = currentXDomain;
        yDomainRef.current = currentYDomain;
        const y = d3.scaleLinear().domain(currentYDomain).range([innerHeight, 0]);

        // Axes
        const xAxis = d3.axisBottom(x).ticks(isMobile ? 3 : 6).tickSize(0).tickPadding(10);
        const yAxis = d3.axisLeft(y).ticks(isMobile ? 4 : 6).tickSize(0).tickPadding(10).tickFormat(d => formatValue(d as number));

        mainG.select<SVGGElement>(".axis-x")
            .attr("transform", `translate(0,${innerHeight})`)
            .transition().duration(750)
            .call(xAxis)
            .on("end", function () {
                d3.select(this).attr("class", "axis-x text-xs font-mono text-gray-500").select(".domain").remove();
            });

        mainG.select<SVGGElement>(".axis-y")
            .transition().duration(750)
            .call(yAxis)
            .on("end", function () {
                d3.select(this).attr("class", "axis-y text-xs font-mono text-gray-500").select(".domain").remove();
            });

        mainG.select<SVGGElement>(".grid-lines")
            .transition().duration(750)
            .call(d3.axisLeft(y).tickSize(-innerWidth).ticks(5).tickFormat(() => ""))
            .style("stroke-dasharray", "4 4")
            .selectAll("line").attr("stroke", "currentColor");
        mainG.select(".grid-lines").select(".domain").remove();

        // Bars
        const barWidth = Math.max(4, innerWidth / ((data.length) * 3));
        // Historical Bars
        const barsLayer = mainG.select(".bars-layer");
        const barsHist = barsLayer.selectAll<SVGRectElement, any>(".bar-hist").data(data, d => d.reportedDate);
        barsHist.exit().transition().duration(750).attr("height", 0).attr("y", y(0)).remove();
        barsHist.enter()
            .append("rect")
            .attr("class", "bar-hist")
            .attr("x", d => x(new Date(d.reportedDate)) - barWidth / 2)
            .attr("y", y(0))
            .attr("width", barWidth)
            .attr("height", 0)
            .merge(barsHist as any)
            .transition().duration(750)
            .attr("x", d => x(new Date(d.reportedDate)) - barWidth / 2)
            .attr("y", d => y(Math.max(0, d.netIncome || 0)))
            .attr("width", barWidth)
            .attr("height", d => Math.abs(y(d.netIncome || 0) - y(0)))
            .attr("fill", "#14b8a6")
            .attr("rx", 3);

        // Forecast bars removed

        // Professional Box Legend
        mainG.select(".legend-box").remove();
        const lg = mainG.append("g").attr("class", "legend-box").attr("transform", "translate(16, 10)");

        const legendItems = [
            { label: "Net Income", type: "reported", color: "#14b8a6" }
        ];

        if (data.length > 0) {
            const itemHeight = isMobile ? 14 : 18;
            const padding = isMobile ? 6 : 10;
            const boxWidth = isMobile ? 80 : 95; // Slightly wider for "Net Income"
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
                    .attr("font-size", isMobile ? "9px" : "11px").attr("font-weight", "500").attr("font-family", "monospace")
                    .attr("fill", "#374151")
                    .text(item.label);
            });
        }

        // Zoom Capture & Tooltip
        const scrollG = mainG.select<SVGGElement>(".scroll-layer");

        const renderScrollbar = (
            parent: d3.Selection<SVGGElement, unknown, null, undefined>,
            classSelector: string,
            x: number, y: number,
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
                thumbG.append("rect").attr("class", "thumb-hit").attr("fill", "transparent").style("cursor", "grab");
                thumbG.append("rect").attr("class", "thumb").attr("fill", "#cbd5e1").style("cursor", "grab");
                thumbG.append("g").attr("class", "grips").attr("pointer-events", "none");
                thumbG.append("rect").attr("class", "handle-start").attr("fill", "transparent");
                thumbG.append("rect").attr("class", "handle-end").attr("fill", "transparent");
            }

            // 2. Logic
            const barScale = d3.scaleLinear().domain(fullDomain).range([0, length]);
            let startPos = barScale(currentDomain[0]);
            let endPos = barScale(currentDomain[1]);
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
            g.attr("transform", `translate(${x},${y})`);

            g.select(".track")
                .attr("width", isH ? length : thickness)
                .attr("height", isH ? thickness : length)
                .attr("rx", thickness / 2);

            const thumbG = g.select(".thumb-group")
                .attr("transform", isH
                    ? `translate(${startPos}, 0)`
                    : `translate(0, ${startPos})`
                );

            const hitThickness = isMobile ? 48 : thickness;
            const thumbHit = thumbG.select(".thumb-hit")
                .attr("width", isH ? thumbSize : hitThickness)
                .attr("height", isH ? hitThickness : thumbSize)
                .attr("x", isH ? 0 : -(hitThickness - thickness) / 2)
                .attr("y", isH ? -(hitThickness - thickness) / 2 : 0)
                .attr("rx", hitThickness / 2);

            const thumb = thumbG.select(".thumb")
                .attr("width", isH ? thumbSize : thickness)
                .attr("height", isH ? thickness : thumbSize)
                .attr("rx", thickness / 2);

            const gripG = thumbG.select(".grips").html("");
            if (thumbSize > 30) {
                const gripPath = isH
                    ? `M 6,3 L 6,${thickness - 3} M 9,3 L 9,${thickness - 3} M ${thumbSize - 9},3 L ${thumbSize - 9},${thickness - 3} M ${thumbSize - 6},3 L ${thumbSize - 6},${thickness - 3}`
                    : `M 3,6 L ${thickness - 3},6 M 3,9 L ${thickness - 3},9 M 3,${thumbSize - 9} L ${thickness - 3},${thumbSize - 9} M 3,${thumbSize - 6} L ${thickness - 3},${thumbSize - 6}`;
                gripG.append("path").attr("d", gripPath).attr("stroke", "white").attr("stroke-width", 1.5).attr("opacity", 0.8);
            }

            // 4. Update Interaction - Drag on hit area
            thumbHit.call((d3.drag<SVGRectElement, unknown>()
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
                    let newStart = p - offset;

                    // Pixel Clamping
                    newStart = Math.max(0, Math.min(length - thumbSize, newStart));

                    // Invert
                    let newValStart = barScale.invert(newStart);
                    let newValEnd = barScale.invert(newStart + thumbSize);

                    onChange([newValStart, newValEnd]);
                })
                .on("end", function () { d3.select(this).style("cursor", "grab"); })
            ) as any);

            const handleThickness = 12;
            const updateHandle = (type: 'start' | 'end') => {
                const sel = thumbG.select(type === 'start' ? ".handle-start" : ".handle-end");
                const hThickness = isMobile ? 24 : handleThickness;
                const hitThick = isMobile ? 48 : thickness;

                const w = isH ? hThickness : hitThick;
                const h = isH ? hitThick : hThickness;

                const xAdjust = isH
                    ? (type === 'start' ? 0 : thumbSize - hThickness)
                    : -(hitThick - thickness) / 2;

                const yAdjust = isH
                    ? -(hitThick - thickness) / 2
                    : (type === 'start' ? 0 : thumbSize - hThickness);

                sel.attr("x", xAdjust).attr("y", yAdjust).attr("width", w).attr("height", h)
                    .style("cursor", isH ? "ew-resize" : "ns-resize")
                    .call((d3.drag<SVGRectElement, unknown>()
                        .container(g.node() as any)
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

        // xExt is already calculated at line 104
        const maxDate = new Date(xExt[1]);
        maxDate.setMonth(maxDate.getMonth() + 1);
        const fullX: [number, number] = [xExt[0]?.getTime() || 0, maxDate.getTime()];
        const fullY: [number, number] = [0, (d3.max(data, d => d.netIncome || 0) || 1) * 1.5];

        const scrollThickness = isMobile ? 8 : 16;
        renderScrollbar(scrollG, "scrollbar-x", 0, innerHeight + 35, innerWidth, scrollThickness, 'horizontal', fullX, [currentXDomain[0].getTime(), currentXDomain[1].getTime()],
            (d) => onXDomainChange && onXDomainChange([new Date(d[0]), new Date(d[1])]));


        renderScrollbar(scrollG, "scrollbar-y", -margin.left - 20, 0, innerHeight, scrollThickness, 'vertical', [fullY[1], fullY[0]], [currentYDomain[1], currentYDomain[0]],
            (d) => setYDomain([d[1], d[0]]));





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
            const dHist = data[iHist];
            if (dHist) {
                const best = { date: dHist.reportedDate, value: dHist.netIncome || 0, type: 'reported' as const };
                setTooltip({ visible: true, x: mx + margin.left, y: d3.pointer(event)[1] + margin.top, data: best });
            }
        }).on("mouseleave", () => setTooltip(p => ({ ...p, visible: false })));

    }, [data, height, xDomain, yDomain, onXDomainChange]);

    return (
        <div className="relative w-full" ref={containerRef}>
            {tooltip.visible && tooltip.data && (
                <div
                    className="pointer-events-none absolute z-50 rounded-lg border border-gray-200 bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:border-gray-800 dark:bg-black/90 text-sm"
                    style={{ transform: `translate(${Math.min(tooltip.x + 15, (containerRef.current?.clientWidth || 0) - 150)}px, ${tooltip.y}px)` }}
                >
                    <div className="mb-1 font-mono text-gray-500">{tooltip.data.date}</div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 rounded-sm bg-teal-500"></span>
                        <span className="text-gray-600 dark:text-gray-400">Net Income:</span>
                        <span className="font-mono font-bold">{formatValue(tooltip.data.value)}</span>
                    </div>
                </div>
            )}
            <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500 absolute bottom-0 w-full pointer-events-none" style={{ bottom: "-20px" }}>
            </div>
        </div>
    );
}

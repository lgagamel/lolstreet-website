"use client";

import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { StockFinanceRow } from "../../types";

type Props = {
    data: StockFinanceRow[];
    height?: number;
    className?: string;
    xDomain?: [Date, Date];
    onXDomainChange?: (domain: [Date, Date]) => void;
};

// Helper format
const formatCurrency = (val: number) => {
    const abs = Math.abs(val);
    if (abs >= 1e9) return `$${(val / 1e9).toFixed(2)}B`;
    if (abs >= 1e6) return `$${(val / 1e6).toFixed(2)}M`;
    return `$${val.toFixed(0)}`;
};

export default function CashFlowChartD3({ data, height = 300, className = "", xDomain, onXDomainChange }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const [tooltip, setTooltip] = useState<{
        visible: boolean;
        x: number;
        y: number;
        data?: StockFinanceRow;
    }>({ visible: false, x: 0, y: 0 });

    const [yDomain, setYDomain] = useState<[number, number] | null>(null);

    // Initial Y Domain
    useEffect(() => {
        if (!data.length) return;
        // Fields: operatingCashflow, capitalExpenditures (negative), freeCashFlow
        const vals = data.flatMap(d => [
            d.operatingCashflow || 0,
            -(d.capitalExpenditures || 0), // visualize as negative
            d.freeCashFlow || 0
        ]);
        const yMax = d3.max(vals) || 0;
        const yMin = d3.min(vals) || 0;

        // Add some padding
        setYDomain([yMin * 1.1, yMax * 1.1]);
    }, [data]);

    useEffect(() => {
        if (!containerRef.current || !data.length) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const h = height;
        const margin = { top: 20, right: 80, left: 10, bottom: 50 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = h - margin.top - margin.bottom;

        if (!svgRef.current) {
            const svg = d3.select(container)
                .append("svg")
                .attr("class", "chart-svg")
                .style("overflow", "visible");

            svgRef.current = svg;

            const defs = svg.append("defs");
            defs.append("clipPath").attr("id", "clip-cf").append("rect");

            const mainG = svg.append("g").attr("class", "main-g");
            mainG.append("rect").attr("class", "zoom-capture").attr("fill", "transparent");
            mainG.append("g").attr("class", "grid-lines opacity-10");
            mainG.append("g").attr("class", "data-layer").attr("clip-path", "url(#clip-cf)"); // Shared layer for bars/lines
            mainG.append("line").attr("class", "zero-line").attr("stroke", "gray").attr("stroke-width", 1).style("opacity", 0.5);
            mainG.append("g").attr("class", "axis-x");
            mainG.append("g").attr("class", "axis-y");
            mainG.append("g").attr("class", "scrollbars");
        }

        const svg = svgRef.current!;
        svg.attr("width", width).attr("height", h).attr("viewBox", `0 0 ${width} ${h}`);
        svg.select("#clip-cf rect").attr("width", innerWidth).attr("height", innerHeight);

        const mainG = svg.select(".main-g").attr("transform", `translate(${margin.left},${margin.top})`);

        // X Axis
        const xExt = d3.extent(data, d => new Date(d.reportedDate)) as [Date, Date];
        let currentXDomain = xDomain;
        if (!currentXDomain) {
            const start = xExt[0] ? new Date(xExt[0].getTime() - 30 * 24 * 3600 * 1000) : new Date();
            const end = xExt[1] ? new Date(xExt[1].getTime() + 30 * 24 * 3600 * 1000) : new Date();
            currentXDomain = [start, end];
        }
        const x = d3.scaleTime().domain(currentXDomain).range([0, innerWidth]);

        // Y Axis
        const allVals = data.flatMap(d => [
            d.operatingCashflow || 0,
            -(d.capitalExpenditures || 0),
            d.freeCashFlow || 0
        ]);
        const fullYDomain: [number, number] = [d3.min(allVals)! * 1.2, d3.max(allVals)! * 1.2];
        const currentYDomain = yDomain || fullYDomain;
        const y = d3.scaleLinear().domain(currentYDomain).range([innerHeight, 0]);

        // Draw Axes
        const xAxis = d3.axisBottom(x).ticks(6).tickSize(0).tickPadding(10);
        mainG.select<SVGGElement>(".axis-x")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxis)
            .attr("class", "axis-x text-xs font-mono text-gray-500")
            .select(".domain").remove();

        mainG.select<SVGGElement>(".axis-y")
            .attr("transform", `translate(${innerWidth}, 0)`)
            .call(d3.axisRight(y).ticks(5).tickSize(0).tickPadding(10).tickFormat(d => formatCurrency(d as number)))
            .attr("class", "axis-y text-xs font-mono text-gray-500")
            .select(".domain").remove();

        mainG.select<SVGGElement>(".grid-lines")
            .call(d3.axisLeft(y).tickSize(-innerWidth).ticks(5).tickFormat(() => ""))
            .style("stroke-dasharray", "4 4")
            .selectAll("line").attr("stroke", "currentColor");
        mainG.select(".grid-lines").select(".domain").remove();

        // Zero Line
        mainG.select(".zero-line")
            .attr("x1", 0).attr("x2", innerWidth)
            .attr("y1", y(0)).attr("y2", y(0));


        // Data Painting
        const dataLayer = mainG.select(".data-layer");
        dataLayer.selectAll("*").remove();

        const barWidth = Math.max(4, innerWidth / (data.length * 4));

        // 1. Operating Cash Flow (Green Bars)
        dataLayer.selectAll(".bar-ocf")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "bar-ocf")
            .attr("x", d => x(new Date(d.reportedDate)) - barWidth * 1.5) // Offset left
            .attr("y", d => y(Math.max(0, d.operatingCashflow || 0)))
            .attr("width", barWidth)
            .attr("height", d => Math.abs(y(d.operatingCashflow || 0) - y(0)))
            .attr("fill", "#22c55e") // Green 500
            .attr("rx", 2);

        // 2. CapEx (Red Bars - Negative)
        // CapEx in DB is usually positive, request says "capitalExpenditures needs to be negative"
        dataLayer.selectAll(".bar-capex")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "bar-capex")
            .attr("x", d => x(new Date(d.reportedDate)) - barWidth * 0.5) // Center-ish
            .attr("y", d => y(Math.max(0, -(d.capitalExpenditures || 0)))) // Start from 0 if negative, basically y(0)
            .attr("height", d => Math.abs(y(-(d.capitalExpenditures || 0)) - y(0)))
            .attr("y", d => {
                const val = -(d.capitalExpenditures || 0);
                return val >= 0 ? y(val) : y(0);
            })
            // Fix height/y logic for negative bars:
            // if val < 0: y is y(0), height is y(val) - y(0)
            .attr("y", d => y(0))
            .attr("height", d => Math.abs(y(-(d.capitalExpenditures || 0)) - y(0)))
            .attr("width", barWidth)
            .attr("fill", "#ef4444") // Red 500
            .attr("rx", 2);

        // 3. Free Cash Flow (Blue Line/Points)
        const lineFCF = d3.line<StockFinanceRow>()
            .defined(d => d.freeCashFlow !== null)
            .curve(d3.curveMonotoneX)
            .x(d => x(new Date(d.reportedDate)))
            .y(d => y(d.freeCashFlow || 0));

        dataLayer.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", "#3b82f6") // Blue 500
            .attr("stroke-width", 2)
            .attr("d", lineFCF);

        // FCF Points
        dataLayer.selectAll(".point-fcf")
            .data(data)
            .enter()
            .append("circle")
            .attr("cx", d => x(new Date(d.reportedDate)))
            .attr("cy", d => y(d.freeCashFlow || 0))
            .attr("r", 3)
            .attr("fill", "#3b82f6")
            .attr("stroke", "white");


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
            // Ensure order
            if (startPos > endPos) [startPos, endPos] = [endPos, startPos];

            startPos = Math.max(0, Math.min(length, startPos));
            endPos = Math.max(0, Math.min(length, endPos));
            let thumbSize = Math.max(20, endPos - startPos);

            g.attr("transform", `translate(${xPos},${yPos})`);
            g.select(".track").attr("width", isH ? length : thickness).attr("height", isH ? thickness : length).attr("rx", thickness / 2);
            const thumbG = g.select(".thumb-group").attr("transform", isH ? `translate(${startPos}, 0)` : `translate(0, ${startPos})`);
            const thumb = thumbG.select(".thumb").attr("width", isH ? thumbSize : thickness).attr("height", isH ? thickness : thumbSize).attr("rx", thickness / 2);

            // Grips
            const gripG = thumbG.select(".grips").html("");
            if (thumbSize > 30) {
                // simple grip lines
                const gripPath = isH
                    ? `M 6,3 L 6,${thickness - 3} M 9,3 L 9,${thickness - 3}`
                    : `M 3,6 L ${thickness - 3},6 M 3,9 L ${thickness - 3},9`;
                gripG.append("path").attr("d", gripPath).attr("stroke", "white").attr("stroke-width", 1.5).attr("opacity", 0.8);
            }

            thumb.call((d3.drag<SVGRectElement, unknown>()
                .container(g.node() as any)
                .on("start", function (e) {
                    // @ts-ignore
                    this.__dragOffset = (isH ? e.x : e.y) - startPos;
                    d3.select(this).style("cursor", "grabbing");
                })
                .on("drag", function (e) {
                    // @ts-ignore
                    const off = this.__dragOffset || 0;
                    let ns = (isH ? e.x : e.y) - off;
                    ns = Math.max(0, Math.min(length - thumbSize, ns));
                    const v1 = barScale.invert(ns);
                    const v2 = barScale.invert(ns + thumbSize);
                    onChange([v1, v2]);
                })
                .on("end", function () { d3.select(this).style("cursor", "grab"); })
            ) as any);


            // Resize Handles
            const handleThickness = 12;
            const updateHandle = (type: 'start' | 'end') => {
                const sel = thumbG.select(type === 'start' ? ".handle-start" : ".handle-end");
                const xLoc = isH ? (type === 'start' ? 0 : thumbSize - handleThickness) : 0;
                const yLoc = isH ? 0 : (type === 'start' ? 0 : thumbSize - handleThickness);
                const w = isH ? handleThickness : thickness;
                const h = isH ? thickness : handleThickness;

                sel.attr("x", xLoc).attr("y", yLoc).attr("width", w).attr("height", h)
                    .style("cursor", isH ? "ew-resize" : "ns-resize")
                    .attr("pointer-events", "all") // Ensure it catches events
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

                            if (type === 'start') {
                                onChange([barScale.invert(Math.max(0, Math.min(endPos - 20, nep))), currentDomain[1]]);
                            } else {
                                onChange([currentDomain[0], barScale.invert(Math.max(startPos + 20, Math.min(length, nep)))]);
                            }
                        })
                    ) as any);
            };

            updateHandle('start');
            updateHandle('end');
        };

        const twoYearsFuture = new Date().setFullYear(new Date().getFullYear() + 2);
        const fullX: [number, number] = [xExt[0]?.getTime() || Date.now(), Math.max(xExt[1]?.getTime() || Date.now(), twoYearsFuture)];

        renderScrollbar(scrollG, "scrollbar-x", 0, innerHeight + 35, innerWidth, 16, 'horizontal',
            fullX,
            [currentXDomain[0].getTime(), currentXDomain[1].getTime()],
            (d) => onXDomainChange?.([new Date(d[0]), new Date(d[1])])
        );

        renderScrollbar(scrollG, "scrollbar-y", innerWidth + 64, 0, innerHeight, 16, 'vertical',
            [fullYDomain[1], fullYDomain[0]],
            [currentYDomain[1], currentYDomain[0]],
            (d) => setYDomain([d[1], d[0]])
        );


        // Interaction
        const zoomRect = mainG.select<SVGRectElement>(".zoom-capture")
            .attr("width", innerWidth).attr("height", innerHeight)
            .style("cursor", "crosshair")
            .attr("pointer-events", "all");

        const bisect = d3.bisector<StockFinanceRow, Date>(d => new Date(d.reportedDate)).center;

        zoomRect.on("mousemove", event => {
            const [mx] = d3.pointer(event);
            const date = x.invert(mx);
            const i = bisect(data, date);
            const d = data[i];
            if (d) setTooltip({ visible: true, x: mx + margin.left, y: d3.pointer(event)[1] + margin.top, data: d });
        }).on("mouseleave", () => setTooltip(prev => ({ ...prev, visible: false })));

    }, [data, height, xDomain, yDomain, onXDomainChange]);

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            <div className="w-full" />
            {tooltip.visible && tooltip.data && (
                <div
                    className="pointer-events-none absolute z-50 rounded-lg border border-gray-200 bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:border-gray-800 dark:bg-black/90 text-sm"
                    style={{
                        top: 0,
                        left: 0,
                        transform: `translate(${Math.min(tooltip.x + 15, containerRef.current!.clientWidth - 150)}px, ${tooltip.y}px)`
                    }}
                >
                    <div className="mb-1 font-mono text-gray-500">{tooltip.data.reportedDate}</div>

                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-green-500 rounded-sm"></span>
                        <span className="text-gray-600 dark:text-gray-400">Op. Cash Flow:</span>
                        <span className="font-mono font-bold">{formatCurrency(tooltip.data.operatingCashflow || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                        <span className="w-2 h-2 bg-red-500 rounded-sm"></span>
                        <span className="text-gray-600 dark:text-gray-400">CapEx:</span>
                        <span className="font-mono font-bold text-red-500">-{formatCurrency(Math.abs(tooltip.data.capitalExpenditures || 0))}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        <span className="text-gray-600 dark:text-gray-400 font-semibold">Free Cash Flow:</span>
                        <span className="font-mono font-bold text-blue-500">{formatCurrency(tooltip.data.freeCashFlow || 0)}</span>
                    </div>
                </div>
            )}
            <div className="flex gap-4 justify-center mt-8 text-xs text-gray-500">
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-green-500 rounded-sm"></span> Operating Cash Flow</div>
                <div className="flex items-center gap-1"><span className="w-3 h-3 bg-red-500 rounded-sm"></span> CapEx</div>
                <div className="flex items-center gap-1"><span className="w-2 h-2 bg-blue-500 rounded-full"></span> Free Cash Flow</div>
            </div>
        </div>
    );
}

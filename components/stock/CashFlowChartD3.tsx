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

    // Refs for Drag Handlers
    const xDomainRef = useRef<[Date, Date] | null>(null);
    const yDomainRef = useRef<[number, number] | null>(null);
    const dragContextX = useRef<{ startX: number, domain: [Date, Date] } | null>(null);
    const dragContextY = useRef<{ startY: number, domain: [number, number] } | null>(null);

    const [yDomain, setYDomain] = useState<[number, number] | null>(null);

    // Initial Y Domain
    // Initial Y Domain Calculation removed to allow dynamic scaling
    // useEffect(() => { ... }, [data]);

    useEffect(() => {
        if (!containerRef.current || !data.length) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const h = height;
        // Margins: Left Y-axis, No Scrollbars
        const margin = { top: 20, right: 30, left: 60, bottom: 50 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = h - margin.top - margin.bottom;

        if (!svgRef.current) {
            const svg = d3.select(container)
                .append("svg")
                .attr("class", "chart-svg")
                .style("overflow", "visible");

            svgRef.current = svg;

            const defs = svg.append("defs");

            // OCF Gradient
            const gradOCF = defs.append("linearGradient").attr("id", "gradientOCF").attr("x1", "0").attr("y1", "0").attr("x2", "0").attr("y2", "1");
            gradOCF.append("stop").attr("offset", "0%").attr("stop-color", "#22c55e"); // Green-500
            gradOCF.append("stop").attr("offset", "100%").attr("stop-color", "#16a34a"); // Green-600

            // CapEx Gradient
            const gradCapEx = defs.append("linearGradient").attr("id", "gradientCapEx").attr("x1", "0").attr("y1", "0").attr("x2", "0").attr("y2", "1");
            gradCapEx.append("stop").attr("offset", "0%").attr("stop-color", "#ef4444"); // Red-500
            gradCapEx.append("stop").attr("offset", "100%").attr("stop-color", "#dc2626"); // Red-600

            defs.append("clipPath").attr("id", "clip-cf").append("rect");
            defs.append("clipPath").attr("id", "clip-cash").append("rect"); // Added for price-line

            const mainG = svg.append("g").attr("class", "main-g");
            mainG.append("rect").attr("class", "zoom-capture").attr("fill", "transparent");
            mainG.append("g").attr("class", "grid-lines opacity-10");
            mainG.append("g").attr("class", "data-layer").attr("clip-path", "url(#clip-cf)").style("pointer-events", "none"); // Shared layer for bars/lines
            mainG.append("g").attr("class", "price-line").attr("clip-path", "url(#clip-cash)").style("pointer-events", "none");


            // Axes
            const xAxisG = mainG.append("g").attr("class", "axis-x");
            const yAxisG = mainG.append("g").attr("class", "axis-y");
            mainG.append("g").attr("class", "scroll-layer");
        }

        const svg = svgRef.current!;
        svg.attr("width", width).attr("height", h).attr("viewBox", `0 0 ${width} ${h}`);
        svg.select("#clip-cf rect").attr("width", innerWidth).attr("height", innerHeight);
        svg.select("#clip-cash rect").attr("width", innerWidth).attr("height", innerHeight); // Added for price-line clip

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
            d.capitalExpenditures || 0,
            d.freeCashFlow || 0
        ]);
        // Global Y Extent (for scrollbar)
        const globalYExtent: [number, number] = [d3.min(allVals)! * 1.2, d3.max(allVals)! * 1.2];

        // Calculate Y domain based on visible data in the X range
        const calculateYDomain = (): [number, number] => {
            if (yDomain) return yDomain;

            const visibleData = data.filter(d => {
                const date = new Date(d.reportedDate);
                return date >= currentXDomain[0] && date <= currentXDomain[1];
            });

            if (visibleData.length === 0) return globalYExtent;

            const visVals = visibleData.flatMap(d => [
                d.operatingCashflow || 0,
                d.capitalExpenditures || 0,
                d.freeCashFlow || 0
            ]);

            if (visVals.length === 0) return globalYExtent;

            const maxVal = Math.max(...visVals);
            const minVal = Math.min(...visVals);

            // Add padding
            const yMax = maxVal > 0 ? maxVal * 1.1 : maxVal * 0.9;
            const yMin = minVal < 0 ? minVal * 1.1 : minVal * 0.9;

            return [yMin, yMax];
        };
        const currentYDomain: [number, number] = calculateYDomain();

        // Update Refs
        xDomainRef.current = currentXDomain;
        yDomainRef.current = currentYDomain;
        const y = d3.scaleLinear().domain(currentYDomain).range([innerHeight, 0]);

        // Draw Axes
        const xAxis = d3.axisBottom(x).ticks(6).tickSize(0).tickPadding(10);
        // Changed to Axis Left
        const yAxis = d3.axisLeft(y).ticks(6).tickSize(0).tickPadding(10).tickFormat(d => formatCurrency(d as number));

        mainG.select<SVGGElement>(".axis-x")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxis)
            .attr("class", "axis-x text-xs font-mono text-gray-500")
            .select(".domain").remove();

        mainG.select<SVGGElement>(".axis-y")
            .attr("transform", `translate(0, 0)`)
            .call(yAxis)
            .attr("class", "axis-y text-xs font-mono text-gray-500")
            .select(".domain").remove();

        mainG.select<SVGGElement>(".grid-lines")
            .call(d3.axisLeft(y).tickSize(-innerWidth).ticks(5).tickFormat(() => ""))
            .style("stroke-dasharray", "4 4")
            .selectAll("line").attr("stroke", "currentColor");
        mainG.select(".grid-lines").select(".domain").remove();



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
            .attr("fill", "url(#gradientOCF)") // Gradient
            .attr("rx", 3);

        // 2. CapEx (Red Bars - Negative)
        // CapEx in DB is usually positive, request says "capitalExpenditures needs to be negative"
        dataLayer.selectAll(".bar-capex")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "bar-capex")
            .attr("x", d => x(new Date(d.reportedDate)) - barWidth * 0.5) // Center-ish
            .attr("y", d => y(Math.max(0, d.capitalExpenditures || 0)))
            .attr("height", d => Math.abs(y(d.capitalExpenditures || 0) - y(0)))
            .attr("width", barWidth)
            .attr("fill", "url(#gradientCapEx)")
            .attr("rx", 3);

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

        // Professional Box Legend
        mainG.select(".legend-box").remove();
        const lg = mainG.append("g").attr("class", "legend-box").attr("transform", "translate(16, 10)");

        const legendItems = [
            { label: "Op. Cash Flow (OCF)", color: "#22c55e" },
            { label: "CapEx", color: "#ef4444" },
            { label: "Free Cash Flow (OCF - CapEx)", color: "#3b82f6" }
        ];

        if (data.length > 0) {
            const itemHeight = 18;
            const padding = 10;
            const boxWidth = 200; // Wider for FCF formula
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

                g.append("circle").attr("r", 4).attr("fill", item.color);

                g.append("text")
                    .attr("x", 12).attr("y", 4)
                    .attr("font-size", "11px").attr("font-weight", "500").attr("font-family", "monospace")
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

            // 4. Update Interaction
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
                const xLoc = isH
                    ? (type === 'start' ? 0 : thumbSize - handleThickness)
                    : 0;
                const yLoc = isH
                    ? 0
                    : (type === 'start' ? 0 : thumbSize - handleThickness);
                const w = isH ? handleThickness : thickness;
                const h = isH ? thickness : handleThickness;

                sel.attr("x", xLoc).attr("y", yLoc).attr("width", w).attr("height", h)
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

        // xExt is already calculated at line 112
        const maxDate = new Date(xExt[1]);
        maxDate.setMonth(maxDate.getMonth() + 1);
        const fullX: [number, number] = [xExt[0].getTime(), maxDate.getTime()];
        const fullY: [number, number] = [globalYExtent[0], globalYExtent[1]];

        renderScrollbar(scrollG, "scrollbar-x", 0, innerHeight + 35, innerWidth, 16, 'horizontal', fullX, [currentXDomain[0].getTime(), currentXDomain[1].getTime()],
            (d) => onXDomainChange && onXDomainChange([new Date(d[0]), new Date(d[1])]));

        renderScrollbar(scrollG, "scrollbar-y", -margin.left - 20, 0, innerHeight, 16, 'vertical', [fullY[1], fullY[0]], [currentYDomain[1], currentYDomain[0]],
            (d) => setYDomain([d[1], d[0]]));





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
                        transform: `translate(${Math.min(tooltip.x + 15, containerRef.current!.clientWidth - 150)}px, ${tooltip.y}px) translateY(-100%) translateY(-10px)`
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
                        <span className="font-mono font-bold text-red-500">{formatCurrency(tooltip.data.capitalExpenditures || 0)}</span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 pt-1 border-t border-gray-100 dark:border-gray-800">
                        <span className="w-2 h-2 bg-blue-500 rounded-full"></span>
                        <span className="text-gray-600 dark:text-gray-400 font-semibold">Free Cash Flow:</span>
                        <span className="font-mono font-bold text-blue-500">{formatCurrency(tooltip.data.freeCashFlow || 0)}</span>
                    </div>
                </div>
            )}
            <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500 absolute bottom-0 w-full pointer-events-none" style={{ bottom: "-20px" }}>
            </div>
        </div>
    );
}

"use client";

import React, { useRef, useEffect, useMemo, useState } from "react";
import * as d3 from "d3";
import type { PriceBandModel, PriceBandPoint } from "../../lib/charts/priceBandModel";
import type { NewsEvent, StockFinanceRow, StockFinanceForecastRow } from "../../types";

type Props = {
    model: PriceBandModel;
    height?: number;
    className?: string;
    xDomain?: [Date, Date];
    onXDomainChange?: (domain: [Date, Date]) => void;
    news?: NewsEvent[];
    finance?: StockFinanceRow[];
    forecast?: StockFinanceForecastRow[];
};

export default function PriceChartD3({ model, height = 400, className = "", xDomain, onXDomainChange, news, finance, forecast }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const tooltipTimerRef = useRef<NodeJS.Timeout | null>(null);

    // Refs for Drag Handlers
    const xDomainRef = useRef<[Date, Date] | null>(null);
    const yDomainRef = useRef<[number, number] | null>(null);
    const dragContextX = useRef<{ startX: number, domain: [Date, Date] } | null>(null);
    const dragContextY = useRef<{ startY: number, domain: [number, number] } | null>(null);

    const [yDomain, setYDomain] = useState<[number, number] | null>(null);
    const [tooltip, setTooltip] = useState<{
        visible: boolean;
        x: number;
        y: number;
        data?: PriceBandPoint;
        newsData?: NewsEvent;
        financeData?: StockFinanceRow;
        forecastData?: StockFinanceForecastRow;
    }>({ visible: false, x: 0, y: 0 });

    const data = useMemo(() => model.points, [model]);

    // Removed useEffect that set yDomain to [model.yMin, model.yMax]
    // This allows the initial Y domain to be calculated based on visible data

    useEffect(() => {
        if (!data.length || !containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const isMobile = width < 640;
        const h = height;
        // Margins for Scrollbars
        const margin = {
            top: 20,
            right: isMobile ? 20 : 50,
            left: isMobile ? 45 : 60,
            bottom: isMobile ? 60 : 80
        };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = h - margin.top - margin.bottom;

        if (!svgRef.current) {
            const svg = d3.select(container)
                .append("svg")
                .style("overflow", "visible")
                .attr("class", "chart-svg");

            svgRef.current = svg;

            const defs = svg.append("defs");
            const grad = defs.append("linearGradient").attr("id", "gradientPrice").attr("x1", "0").attr("y1", "0").attr("x2", "0").attr("y2", "1");
            grad.append("stop").attr("offset", "0%").attr("stop-color", "#8b5cf6").attr("stop-opacity", 0.5);
            grad.append("stop").attr("offset", "100%").attr("stop-color", "#8b5cf6").attr("stop-opacity", 0);

            // Clip Path
            defs.append("clipPath").attr("id", "clip-price").append("rect");

            // Drop Shadow Filter
            const filter = defs.append("filter").attr("id", "dropShadow").attr("height", "130%");
            filter.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 1);
            filter.append("feOffset").attr("dx", 0).attr("dy", 1).attr("result", "offsetblur");
            filter.append("feComponentTransfer").append("feFuncA").attr("type", "linear").attr("slope", 0.3);
            const merge = filter.append("feMerge");
            merge.append("feMergeNode");
            merge.append("feMergeNode").attr("in", "SourceGraphic");

            const g = svg.append("g").attr("class", "main-g");
            g.append("rect").attr("class", "zoom-capture").attr("fill", "transparent").style("pointer-events", "all");
            g.append("g").attr("class", "grid-lines opacity-5").style("pointer-events", "none");
            g.append("g").attr("class", "bands-area").attr("clip-path", "url(#clip-price)").style("pointer-events", "none");
            g.append("g").attr("class", "price-line").attr("clip-path", "url(#clip-price)").style("pointer-events", "none");

            // Axes Groups
            const xAxisG = g.append("g").attr("class", "axis-x");
            const yAxisG = g.append("g").attr("class", "axis-y");


            g.append("g").attr("class", "news-markers").attr("clip-path", "url(#clip-price)");
            g.append("g").attr("class", "scroll-layer"); // Layer for scrollbars
            g.append("g").attr("class", "legend-layer"); // Unclipped and on top
        }

        const svg = svgRef.current!;
        svg.attr("width", width).attr("height", h).attr("viewBox", `0 0 ${width} ${h}`);
        svg.select("#clip-price rect").attr("width", innerWidth).attr("height", innerHeight);

        const mainG = svg.select<SVGGElement>(".main-g").attr("transform", `translate(${margin.left},${margin.top})`);

        // Define bisector for interactions
        const bisect = d3.bisector<PriceBandPoint, Date>((d) => new Date(d.date)).center;

        // Domains
        const calculateDefaultXDomain = () => {
            if (xDomain) return xDomain;

            // Default to ±3 months from today (6-month window)
            const today = new Date();
            const threeMonthsAgo = new Date(today);
            threeMonthsAgo.setMonth(today.getMonth() - 3);
            const threeMonthsAhead = new Date(today);
            threeMonthsAhead.setMonth(today.getMonth() + 3);

            return [threeMonthsAgo, threeMonthsAhead] as [Date, Date];
        };
        const currentXDomain = calculateDefaultXDomain();

        // Calculate Y domain based on visible data in the X range
        const calculateYDomain = (): [number, number] => {
            if (yDomain) return yDomain;

            const visibleData = data.filter(d => {
                const date = new Date(d.date);
                return date >= currentXDomain[0] && date <= currentXDomain[1];
            });

            if (visibleData.length === 0) return [model.yMin, model.yMax];

            // Include Price, High, and Low in the range calculation
            const values = visibleData.flatMap(d => [d.close, d.high, d.low]).filter(v => v !== null) as number[];
            if (values.length === 0) return [model.yMin, model.yMax];

            const minVal = Math.min(...values);
            const maxVal = Math.max(...values);
            const padding = (maxVal - minVal) * 0.1; // 10% padding

            return [Math.max(0, minVal - padding), maxVal + padding];
        };
        const currentYDomain: [number, number] = calculateYDomain();

        // Update Refs for Drag Handlers
        xDomainRef.current = currentXDomain;
        yDomainRef.current = currentYDomain;

        const xScale = d3.scaleTime().domain(currentXDomain).range([0, innerWidth]);
        const yScale = d3.scaleLinear().domain(currentYDomain).range([innerHeight, 0]);

        // Axes
        const xAxis = d3.axisBottom(xScale).ticks(isMobile ? 3 : 6).tickSize(0).tickPadding(10);
        const yAxis = d3.axisLeft(yScale).ticks(isMobile ? 4 : 6).tickSize(0).tickPadding(10);

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
            .call(d3.axisLeft(yScale).tickSize(-innerWidth).ticks(6).tickFormat(() => ""))
            .style("stroke-dasharray", "4 4")
            .selectAll("line").attr("stroke", "currentColor");
        mainG.select(".grid-lines").select(".domain").remove();

        // Content
        const lineGen = d3.line<PriceBandPoint>().defined(d => d.close !== null).curve(d3.curveMonotoneX).x(d => xScale(new Date(d.date))).y(d => yScale(d.close!));
        const areaMidHigh = d3.area<PriceBandPoint>().defined(d => d.mid !== null && d.high !== null).curve(d3.curveMonotoneX).x(d => xScale(new Date(d.date))).y0(d => yScale(d.mid!)).y1(d => yScale(d.high!));
        const areaLowMid = d3.area<PriceBandPoint>().defined(d => d.mid !== null && d.low !== null).curve(d3.curveMonotoneX).x(d => xScale(new Date(d.date))).y0(d => yScale(d.low!)).y1(d => yScale(d.mid!));
        const lineFair = d3.line<PriceBandPoint>().defined(d => d.mid !== null).curve(d3.curveMonotoneX).x(d => xScale(new Date(d.date))).y(d => yScale(d.mid!));
        const lineHigh = d3.line<PriceBandPoint>().defined(d => d.high !== null).curve(d3.curveMonotoneX).x(d => xScale(new Date(d.date))).y(d => yScale(d.high!));
        const lineLow = d3.line<PriceBandPoint>().defined(d => d.low !== null).curve(d3.curveMonotoneX).x(d => xScale(new Date(d.date))).y(d => yScale(d.low!));

        // Filter data for bands (Last 1 year only)
        const lastWithClose = [...data].reverse().find(d => d.close !== null);
        const lastDate = lastWithClose ? new Date(lastWithClose.date) : new Date();
        const oneYearAgo = new Date(lastDate);
        oneYearAgo.setFullYear(lastDate.getFullYear() - 1);

        const bandsData = data.filter(d => {
            const date = new Date(d.date);
            return date >= oneYearAgo;
        });

        const bandsG = mainG.select(".bands-area");

        const ensurePath = (group: d3.Selection<any, any, any, any>, className: string, styles: Record<string, string | number>) => {
            let p = group.select<SVGPathElement>(`path.${className}`);
            if (p.empty()) {
                p = group.append("path").attr("class", className);
                Object.entries(styles).forEach(([k, v]) => p.attr(k, v));
            }
            return p;
        };

        ensurePath(bandsG, "area-mid-high", { fill: "#fbbf24", opacity: 0.15, "pointer-events": "none" }).datum(bandsData).transition().duration(750).attr("d", areaMidHigh as any);
        ensurePath(bandsG, "area-low-mid", { fill: "#fbbf24", opacity: 0.15, "pointer-events": "none" }).datum(bandsData).transition().duration(750).attr("d", areaLowMid as any);
        ensurePath(bandsG, "line-fair", { fill: "none", stroke: "#f59e0b", "stroke-width": 1.5, "stroke-dasharray": "4 4", "pointer-events": "none" }).datum(bandsData).transition().duration(750).attr("d", lineFair as any);
        ensurePath(bandsG, "line-high", { fill: "none", stroke: "#9ca3af", "stroke-width": 1, "stroke-dasharray": "4 4", "pointer-events": "none" }).datum(bandsData).transition().duration(750).attr("d", lineHigh as any);
        ensurePath(bandsG, "line-low", { fill: "none", stroke: "#9ca3af", "stroke-width": 1, "stroke-dasharray": "4 4", "pointer-events": "none" }).datum(bandsData).transition().duration(750).attr("d", lineLow as any);

        // Fair Value & Bounds Labels with Collision Detection
        // Fair Value & Bounds & Price Labels with Collision Detection
        // Professional Box Legend
        const legendG = mainG.select(".legend-layer");
        legendG.selectAll("*").remove();

        // Legend Items
        const legendItems = [
            { label: "Price", color: "#8b5cf6" },
            { label: "Upper Bound", color: "#fbbf24" },
            { label: "Fair Value", color: "#f59e0b" },
            { label: "Lower Bound", color: "#fbbf24" }
        ];

        if (data.length > 0) {
            const legX = isMobile ? 10 : 16;
            const legY = 10;
            const itemHeight = isMobile ? 14 : 18;
            const padding = isMobile ? 6 : 10;
            const boxWidth = isMobile ? 90 : 110;
            const boxHeight = legendItems.length * itemHeight + padding * 2;

            const lg = legendG.append("g").attr("transform", `translate(${legX}, ${legY})`);

            // Background
            lg.append("rect")
                .attr("width", boxWidth)
                .attr("height", boxHeight)
                .attr("rx", 6)
                .attr("fill", "white")
                .attr("fill-opacity", 0.8)
                .attr("stroke", "#e5e7eb") // gray-200
                .attr("stroke-width", 1)
                .style("filter", "drop-shadow(0 1px 2px rgb(0 0 0 / 0.1))");

            // Items
            legendItems.forEach((item, i) => {
                const g = lg.append("g").attr("transform", `translate(${padding}, ${padding + i * itemHeight + 9})`); // +9 centers text vertically

                if (item.label === "Price") {
                    // Solid Line with Dot
                    g.append("line").attr("x1", 0).attr("x2", 15).attr("y1", 0).attr("y2", 0).attr("stroke", item.color).attr("stroke-width", 2);
                    g.append("circle").attr("cx", 7.5).attr("cy", 0).attr("r", 3).attr("fill", item.color);
                } else if (item.label === "Fair Value") {
                    // Dotted Line
                    g.append("line").attr("x1", 0).attr("x2", 15).attr("y1", 0).attr("y2", 0).attr("stroke", item.color).attr("stroke-width", 2).attr("stroke-dasharray", "2 2");
                } else {
                    // Gray Dotted Line
                    g.append("line").attr("x1", 0).attr("x2", 15).attr("y1", 0).attr("y2", 0).attr("stroke", "#9ca3af").attr("stroke-width", 1.5).attr("stroke-dasharray", "2 2");
                }

                // Text
                g.append("text")
                    .attr("x", 20)
                    .attr("y", 4) // visual alignment
                    .attr("font-size", isMobile ? "9px" : "11px")
                    .attr("font-weight", "500")
                    .attr("font-family", "monospace")
                    .attr("fill", "#374151") // gray-700
                    .text(item.label);
            });
        }

        const priceG = mainG.select(".price-line");
        ensurePath(priceG, "current-price-line", { fill: "none", stroke: "#8b5cf6", "stroke-width": 2.5, "pointer-events": "none" }).datum(data).transition().duration(750).attr("d", lineGen as any);

        // --- Clear Old Annotations ---
        mainG.selectAll(".current-price-highlight, .y-axis-bounds-annotations").remove();

        // --- Current Price Highlight ---
        const latestPoint = [...data].reverse().find(d => d.close !== null);
        if (latestPoint && latestPoint.mid !== null) {
            const px = xScale(new Date(latestPoint.date));
            const py = yScale(latestPoint.close!);

            // Only render if visible within Y range
            if (py >= 0 && py <= innerHeight) {
                const diff = ((latestPoint.close! - latestPoint.mid) / latestPoint.mid) * 100;
                const isExpensive = diff > 0;

                const currentG = mainG.append("g")
                    .attr("class", "current-price-highlight")
                    .attr("transform", `translate(${px}, ${py})`);

                // Animated Pulse Dot
                currentG.append("circle")
                    .attr("r", 5)
                    .attr("fill", "#8b5cf6")
                    .attr("stroke", "white")
                    .attr("stroke-width", 2);

                const pulseCircle = currentG.append("circle")
                    .attr("r", 5)
                    .attr("fill", "none")
                    .attr("stroke", "#8b5cf6")
                    .attr("stroke-width", 2)
                    .attr("opacity", 0.6);

                const animatePulse = (sel: d3.Selection<SVGCircleElement, any, any, any>) => {
                    sel.transition()
                        .duration(1500)
                        .attr("r", 15)
                        .attr("opacity", 0)
                        .transition()
                        .duration(0)
                        .attr("r", 5)
                        .attr("opacity", 0.6)
                        .on("end", () => animatePulse(sel));
                };
                animatePulse(pulseCircle);

                // Multi-line Label
                const labelText = isExpensive ? "Premium" : "Bargain";
                const subText = isExpensive ? `${diff.toFixed(1)}% Expensive` : `${Math.abs(diff).toFixed(1)}% Cheaper`;
                const labelColor = isExpensive ? "#ef4444" : "#22c55e"; // red-500 : green-500

                const textElement = currentG.append("text")
                    .attr("x", 10)
                    .attr("y", -10)
                    .attr("font-size", "12px")
                    .attr("font-weight", "bold")
                    .attr("fill", labelColor)
                    .style("filter", "drop-shadow(0 1px 1px rgb(0 0 0 / 0.1))");

                textElement.append("tspan")
                    .attr("x", 10)
                    .attr("dy", "-0.2em")
                    .text(labelText);

                textElement.append("tspan")
                    .attr("x", 10)
                    .attr("dy", "1.2em")
                    .attr("font-size", "10px")
                    .attr("font-weight", "600")
                    .text(subText);
            }

            // --- Y-Axis Bound Annotations ---
            const boundsG = mainG.append("g").attr("class", "y-axis-bounds-annotations");

            // Find data point at the right edge
            const rightEdgeDate = currentXDomain[1];
            const rightIdx = Math.min(data.length - 1, bisect(data, rightEdgeDate));
            const rightPoint = data[rightIdx] || latestPoint;

            const renderBoundLabel = (val: number, label: string, color: string) => {
                const yPos = yScale(val);
                if (yPos < 0 || yPos > innerHeight) return;

                const bg = boundsG.append("g").attr("transform", `translate(${innerWidth}, ${yPos})`);

                const text = bg.append("text")
                    .attr("x", 5)
                    .attr("y", 3)
                    .attr("font-size", "11px")
                    .attr("font-weight", "600")
                    .attr("fill", color)
                    .attr("font-style", "italic")
                    .style("filter", "drop-shadow(0 1px 1px rgb(0 0 0 / 0.1))")
                    .text(`${label}: $${val.toFixed(2)}`);

                // Add background rect based on text dimensions
                const bbox = (text.node() as SVGTextElement).getBBox();
                bg.insert("rect", "text")
                    .attr("x", bbox.x - 2)
                    .attr("y", bbox.y - 1)
                    .attr("width", bbox.width + 4)
                    .attr("height", bbox.height + 2)
                    .attr("fill", "white")
                    .attr("fill-opacity", 0.8)
                    .attr("rx", 2);
            };

            if (rightPoint.high !== null) renderBoundLabel(rightPoint.high, "Upper Bound", "#475569"); // slate-600
            if (rightPoint.mid !== null) renderBoundLabel(rightPoint.mid, "Fair Value", "#d97706"); // amber-600
            if (rightPoint.low !== null) renderBoundLabel(rightPoint.low, "Lower Bound", "#475569"); // slate-600
        }

        // --- News Markers ---
        const newsG = mainG.select(".news-markers");
        newsG.selectAll("*").remove();
        if (news && news.length > 0) {
            // Filter news within domain locally to avoid rendering invalid dates if any
            const visibleNews = news.filter(n => {
                const d = new Date(n.date);
                return d >= currentXDomain[0] && d <= currentXDomain[1];
            });

            // Marker Group
            const markers = newsG.selectAll(".news-marker")
                .data(visibleNews)
                .enter()
                .append("g")
                .attr("class", "news-marker")
                .attr("transform", d => `translate(${xScale(new Date(d.date))}, ${innerHeight})`)
                .style("cursor", "pointer");

            // Flag Pole
            markers.append("line")
                .attr("y1", 0)
                .attr("y2", -15)
                .attr("stroke", "#f97316") // Orange-500
                .attr("stroke-width", 1);

            // Pulse Animation
            const pulse = (selection: d3.Selection<SVGCircleElement, any, any, any>) => {
                selection
                    .transition()
                    .duration(1000)
                    .ease(d3.easeSinInOut)
                    .attr("r", 6)
                    .attr("stroke-width", 0)
                    .attr("opacity", 0.6)
                    .transition()
                    .duration(1000)
                    .attr("r", 4)
                    .attr("stroke-width", 1)
                    .attr("opacity", 1)
                    .on("end", function () { d3.select(this).call(pulse); });
            };

            // Flag/Icon
            markers.append("circle")
                .attr("cy", -15)
                .attr("r", 4)
                .attr("fill", "#f97316")
                .attr("stroke", "white")
                .attr("stroke-width", 1)
                .call(pulse as any);

            // Interaction
            markers
                .on("mouseover", (event, d) => {
                    // Clear any pending hide/show timers
                    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

                    // --- Visual Connection Logic ---
                    const newsDate = new Date(d.date);
                    const bisect = d3.bisector<PriceBandPoint, Date>((p) => new Date(p.date)).center;
                    const index = bisect(data, newsDate);
                    const point = data[index];

                    let tooltipX = 0;
                    let tooltipY = 0;
                    const animationDuration = 400; // Line animation time

                    if (point && point.close !== null) {
                        const px = xScale(new Date(point.date));
                        const py = yScale(point.close);

                        // Calculate absolute coordinates relative to container
                        tooltipX = px + margin.left;
                        tooltipY = py + margin.top;

                        // 1. Vertical Connection Line
                        mainG.append("line")
                            .attr("class", "news-connection-line")
                            .attr("x1", px).attr("x2", px)
                            .attr("y1", innerHeight - 15) // Start at top of flag pole
                            .attr("y2", innerHeight - 15) // Start closed
                            .attr("stroke", "#f97316")
                            .attr("stroke-width", 2)
                            .attr("stroke-dasharray", "3 3")
                            .attr("opacity", 0.8)
                            .transition()
                            .duration(animationDuration) // 400ms
                            .ease(d3.easeCubicOut)
                            .attr("y2", py);

                        // 2. Highlight Price Point
                        mainG.append("circle")
                            .attr("class", "news-price-highlight")
                            .attr("cx", px)
                            .attr("cy", py)
                            .attr("r", 0)
                            .attr("fill", "#fff")
                            .attr("stroke", "#f97316")
                            .attr("stroke-width", 3)
                            .transition()
                            .delay(animationDuration - 100) // Start slightly before line finishes
                            .duration(300)
                            .ease(d3.easeBackOut)
                            .attr("r", 6);
                    } else {
                        // Fallback use mouse position
                        const [mx, my] = d3.pointer(event, containerRef.current);
                        tooltipX = mx;
                        tooltipY = my;
                    }

                    // 3. Delayed Tooltip Reveal (800ms)
                    tooltipTimerRef.current = setTimeout(() => {
                        setTooltip({
                            visible: true,
                            x: tooltipX,
                            y: tooltipY - 20, // Slightly above price point
                            newsData: d,
                            data: undefined
                        });
                    }, 800); // User requested "more delay" -> 800ms
                })
                .on("mouseout", () => {
                    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
                    setTooltip(prev => ({ ...prev, visible: false }));
                    // Remove Connection Visuals immediately
                    mainG.selectAll(".news-connection-line").remove();
                    mainG.selectAll(".news-price-highlight").remove();
                });
        }

        // --- Earnings Markers ---
        const earningsG = mainG.select(".earnings-markers-layer");
        if (earningsG.empty()) mainG.append("g").attr("class", "earnings-markers-layer");
        const earnLayer = mainG.select(".earnings-markers-layer");
        earnLayer.selectAll("*").remove();

        if (finance && finance.length > 0) {
            // Filter visible earnings
            const visibleFinance = finance.filter(f => {
                const d = new Date(f.reportedDate);
                // Expand check slightly to avoid clipping markers on the exact edge
                return d >= currentXDomain[0] && d <= currentXDomain[1];
            });

            earnLayer.selectAll(".earnings-marker")
                .data(visibleFinance)
                .enter()
                .append("path")
                .attr("class", "earnings-marker")
                .attr("d", d3.symbol().type(d3.symbolDiamond).size(50))
                .attr("transform", d => `translate(${xScale(new Date(d.reportedDate))}, ${innerHeight + 10})`)
                .attr("fill", "#a855f7") // Purple-500
                .attr("stroke", "white")
                .attr("stroke-width", 1)
                .style("cursor", "pointer")
                .on("mouseover", (event, d) => {
                    const date = new Date(d.reportedDate);
                    const idx = bisect(data, date);
                    const pricePoint = data[idx];

                    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

                    if (pricePoint && pricePoint.close !== null) {
                        const tooltipX = xScale(date) + margin.left;
                        const tooltipY = yScale(pricePoint.close) + margin.top;

                        // 1. Animate Connection Line
                        mainG.append("line")
                            .attr("class", "news-connection-line")
                            .attr("x1", xScale(date)).attr("x2", xScale(date))
                            .attr("y1", innerHeight + 10)
                            .attr("y2", innerHeight + 10)
                            .attr("stroke", "#a855f7")
                            .attr("stroke-width", 1.5)
                            .attr("stroke-dasharray", "3 3")
                            .transition().duration(400).attr("y2", yScale(pricePoint.close!));

                        // 2. Animate Highlight Circle
                        setTimeout(() => {
                            mainG.append("circle")
                                .attr("class", "news-price-highlight")
                                .attr("cx", xScale(date)).attr("cy", yScale(pricePoint.close!))
                                .attr("r", 0)
                                .attr("fill", "#a855f7")
                                .attr("stroke", "white")
                                .attr("stroke-width", 2)
                                .transition().duration(300)
                                .attr("r", 6);
                        }, 400);

                        // 3. Delayed Tooltip
                        tooltipTimerRef.current = setTimeout(() => {
                            setTooltip({
                                visible: true,
                                x: tooltipX,
                                y: tooltipY - 20,
                                financeData: d,
                                data: undefined,
                                newsData: undefined
                            });
                        }, 800);
                    }
                })
                .on("mouseout", () => {
                    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
                    setTooltip(prev => ({ ...prev, visible: false }));
                    mainG.selectAll(".news-connection-line").remove();
                    mainG.selectAll(".news-price-highlight").remove();
                });
        }

        // --- Forecast Markers ---
        const forecastG = mainG.select(".forecast-markers-layer");
        if (forecastG.empty()) mainG.append("g").attr("class", "forecast-markers-layer");
        const foreLayer = mainG.select(".forecast-markers-layer");
        foreLayer.selectAll("*").remove();

        if (forecast && forecast.length > 0) {
            const visibleForecast = forecast.filter(f => {
                const d = new Date(f.reportedDate);
                return d >= currentXDomain[0] && d <= currentXDomain[1];
            });

            foreLayer.selectAll(".forecast-marker")
                .data(visibleForecast)
                .enter()
                .append("path")
                .attr("class", "forecast-marker")
                .attr("d", d3.symbol().type(d3.symbolDiamond).size(50))
                .attr("transform", d => `translate(${xScale(new Date(d.reportedDate))}, ${innerHeight + 10})`)
                .attr("fill", "white") // Hollow
                .attr("stroke", "#a855f7") // Purple-500
                .attr("stroke-width", 2)
                .attr("stroke-dasharray", "2 1")
                .style("cursor", "pointer")
                .on("mouseover", (event, d) => {
                    const date = new Date(d.reportedDate);
                    // No price point for future usually, but we might have band data?
                    // Or we just show vertical line to band?
                    // Let's try finding nearest band point (which might be forecasted price band)
                    const idx = bisect(data, date);
                    const pricePoint = data[idx];

                    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);

                    const tooltipX = xScale(date) + margin.left;
                    // If no price, use mid band or center?
                    const yVal = (pricePoint && pricePoint.mid) ? yScale(pricePoint.mid) : yScale(model.yMax / 2); // Fallback
                    const tooltipY = yVal + margin.top;

                    // 1. Connection Line (Dotted)
                    mainG.append("line")
                        .attr("class", "news-connection-line")
                        .attr("x1", xScale(date)).attr("x2", xScale(date))
                        .attr("y1", innerHeight + 10)
                        .attr("y2", innerHeight + 10)
                        .attr("stroke", "#a855f7")
                        .attr("stroke-width", 1.5)
                        .attr("stroke-dasharray", "2 2")
                        .transition().duration(400).attr("y2", yVal);

                    // 2. Highlight Circle
                    setTimeout(() => {
                        mainG.append("circle")
                            .attr("class", "news-price-highlight")
                            .attr("cx", xScale(date)).attr("cy", yVal)
                            .attr("r", 0)
                            .attr("fill", "white")
                            .attr("stroke", "#a855f7")
                            .attr("stroke-width", 2)
                            .transition().duration(300)
                            .attr("r", 5);
                    }, 400);

                    // 3. Tooltip
                    tooltipTimerRef.current = setTimeout(() => {
                        setTooltip({
                            visible: true,
                            x: tooltipX,
                            y: tooltipY - 20,
                            forecastData: d,
                            data: undefined,
                            newsData: undefined,
                            financeData: undefined
                        });
                    }, 800);
                })
                .on("mouseout", () => {
                    if (tooltipTimerRef.current) clearTimeout(tooltipTimerRef.current);
                    setTooltip(prev => ({ ...prev, visible: false }));
                    mainG.selectAll(".news-connection-line").remove();
                    mainG.selectAll(".news-price-highlight").remove();
                });
        }

        // --- Scrollbar Logic ---
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

        const xExt = d3.extent(data, d => new Date(d.date).getTime()) as [number, number];
        let maxDate = xExt[1];
        if (forecast && forecast.length > 0) {
            const lastFore = new Date(forecast[forecast.length - 1].reportedDate).getTime();
            if (lastFore > maxDate) maxDate = lastFore;
        }
        const oneMonthBuffer = new Date(maxDate);
        oneMonthBuffer.setMonth(oneMonthBuffer.getMonth() + 1);

        const fullX: [number, number] = [xExt[0], oneMonthBuffer.getTime()];
        const fullY: [number, number] = [0, model.yMax * 1.5];

        const scrollThickness = isMobile ? 8 : 16;
        renderScrollbar(scrollG, "scrollbar-x", 0, innerHeight + 35, innerWidth, scrollThickness, 'horizontal', fullX, [currentXDomain[0].getTime(), currentXDomain[1].getTime()],
            (d) => onXDomainChange && onXDomainChange([new Date(d[0]), new Date(d[1])]));

        renderScrollbar(scrollG, "scrollbar-y", -margin.left - 20, 0, innerHeight, scrollThickness, 'vertical', [fullY[1], fullY[0]], [currentYDomain[1], currentYDomain[0]],
            (d) => setYDomain([d[1], d[0]]));




        // --- Zoom Implementation (Pinch-to-zoom) ---
        const fullXScale = d3.scaleTime().domain(fullX).range([0, innerWidth]);
        const zoom = d3.zoom<SVGRectElement, unknown>()
            .scaleExtent([1, 20])
            .extent([[0, 0], [innerWidth, innerHeight]])
            .translateExtent([[0, 0], [innerWidth, innerHeight]])
            .on("zoom", (event) => {
                if (!event.sourceEvent || event.sourceEvent.type === 'zoom') return;
                const newXScale = event.transform.rescaleX(fullXScale);
                const [d0, d1] = newXScale.domain();
                onXDomainChange?.([new Date(d0), new Date(d1)]);
            });

        const zoomRect = mainG.select<SVGRectElement>(".zoom-capture")
            .attr("width", innerWidth).attr("height", innerHeight)
            .style("cursor", "crosshair")
            .attr("pointer-events", "all")
            .style("touch-action", "pan-y")
            .call(zoom);

        // Sync Zoom Transform from current xDomain (handle external button clicks)
        const s = innerWidth / (fullXScale(currentXDomain[1]) - fullXScale(currentXDomain[0]));
        const tx = -fullXScale(currentXDomain[0]) * s;
        zoomRect.call(zoom.transform, d3.zoomIdentity.translate(tx, 0).scale(s));

        // Remove previous d3.zoom call entirely
        // Just Tooltip logic
        // Tooltip Interaction with Focus Line
        zoomRect.on("mousemove touchmove", (event) => {
            if (event.touches && event.touches.length > 1) {
                setTooltip(p => ({ ...p, visible: false }));
                return;
            }
            const [mx] = d3.pointer(event);
            const date = xScale.invert(mx);
            const index = bisect(data, date);
            const d = data[index];

            // Clear existing focus elements
            mainG.selectAll(".focus-line, .focus-circle").remove();

            if (d && (d.close !== null || d.mid !== null)) {
                const px = xScale(new Date(d.date));
                // Use Price if available, otherwise fallback to Fair Value (mid)
                const py = d.close !== null ? yScale(d.close) : yScale(d.mid!);

                // Draw Focus Line
                mainG.append("line")
                    .attr("class", "focus-line")
                    .attr("x1", px).attr("x2", px)
                    .attr("y1", 0).attr("y2", innerHeight)
                    .attr("stroke", d.close !== null ? "#6366f1" : "#f59e0b") // Violet for Price, Amber for Forecast
                    .attr("stroke-width", 1.5)
                    .attr("stroke-dasharray", "3 3")
                    .attr("pointer-events", "none");

                // Draw Focus Circle
                mainG.append("circle")
                    .attr("class", "focus-circle")
                    .attr("cx", px)
                    .attr("cy", py)
                    .attr("r", 5)
                    .attr("fill", "white")
                    .attr("stroke", d.close !== null ? "#6366f1" : "#f59e0b")
                    .attr("stroke-width", 2)
                    .attr("pointer-events", "none");

                setTooltip({
                    visible: true,
                    x: px + margin.left,
                    y: py + margin.top, // Align near the point
                    data: d, newsData: undefined
                });
            }
        }).on("mouseleave", () => {
            setTooltip(prev => ({ ...prev, visible: false }));
            mainG.selectAll(".focus-line, .focus-circle").remove();
        });

        // --- Footnote ---
        mainG.append("text")
            .attr("x", innerWidth)
            .attr("y", height - margin.top - 5) // At the very bottom
            .attr("text-anchor", "end")
            .attr("font-size", "10px")
            .attr("fill", "#9ca3af") // gray-400
            .attr("font-style", "italic")
            .text("* Price vs. Fair Value: 'Bargain' or 'Premium' is calculated as the % difference between the current price and the Mid-Point (Fair Value).");

    }, [data, height, model, xDomain, yDomain, onXDomainChange, news]);

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            {tooltip.visible && (
                <div className="pointer-events-none absolute z-50 rounded-lg border border-gray-200 bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:border-gray-800 dark:bg-black/90 text-sm" style={{ top: 0, left: 0, transform: `translate(${Math.min(tooltip.x + 15, containerRef.current!.clientWidth - 150)}px, ${tooltip.y}px)` }}>
                    {tooltip.data && <div className="mb-1 font-mono text-gray-500">{tooltip.data.date}</div>}

                    {/* Historical Case: Show Price & PE */}
                    {tooltip.data && typeof tooltip.data.close === 'number' ? (
                        <>
                            <div className="flex items-center gap-2">
                                <span className="text-violet-500 font-semibold">Price:</span>
                                <span className="font-mono font-bold">${tooltip.data.close.toFixed(2)}</span>
                            </div>
                            {tooltip.data.pe_ratio !== null && (
                                <div className="flex items-center gap-2">
                                    <span className="text-blue-500 font-semibold">PE:</span>
                                    <span className="font-mono font-bold">{tooltip.data.pe_ratio.toFixed(2)}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        /* Forecast Case: Show Fair Value & Gap */
                        <>
                            {tooltip.data && tooltip.data.mid !== null && (
                                <div className="flex items-center gap-2">
                                    <span className="text-amber-500 font-semibold">Est. Fair Value:</span>
                                    <span className="font-mono font-bold">${tooltip.data.mid.toFixed(2)}</span>
                                </div>
                            )}
                            {tooltip.data && tooltip.data.mid !== null && model.lastClose && (
                                (() => {
                                    const gap = (tooltip.data!.mid! - model.lastClose!.close) / model.lastClose!.close * 100;
                                    const isPos = gap >= 0;
                                    return (
                                        <div className="mt-1 border-t border-gray-100 pt-1 dark:border-gray-800">
                                            <div className="text-xs text-gray-500 mb-0.5">Gap to Last Close</div>
                                            <div className={`font-mono font-bold ${isPos ? "text-green-500" : "text-red-500"}`}>
                                                {isPos ? "+" : ""}{gap.toFixed(1)}%
                                            </div>
                                        </div>
                                    );
                                })()
                            )}
                        </>
                    )}
                </div>
            )}

            {/* News/Earnings/Forecast Tooltip */}
            {tooltip.visible && (tooltip.newsData || tooltip.financeData || tooltip.forecastData) && (
                <div
                    className={`pointer-events-none absolute z-[60] rounded-lg border p-3 shadow-xl backdrop-blur-sm text-sm max-w-xs dark:bg-gray-900/95 ${tooltip.newsData
                        ? "border-orange-200 bg-orange-50/95 dark:border-orange-900/50"
                        : "border-purple-200 bg-purple-50/95 dark:border-purple-900/50"
                        }`}
                    style={{
                        top: 0,
                        left: 0,
                        transform: `translate(${Math.min(tooltip.x - 100, containerRef.current ? containerRef.current.clientWidth - 220 : 0)}px, ${tooltip.y}px) translateY(-100%)`
                    }}
                >
                    {tooltip.newsData && (
                        <>
                            <div className="mb-1 text-xs font-semibold text-orange-600 uppercase tracking-wider">{tooltip.newsData.source}</div>
                            <div className="text-sm font-medium text-gray-900 dark:text-gray-100 max-w-[200px] leading-snug">
                                {tooltip.newsData.headline_short}
                            </div>
                            <div className="mt-1 text-xs text-gray-500">{tooltip.newsData.date}</div>
                        </>
                    )}
                    {tooltip.financeData && (
                        <>
                            <div className="mb-1 text-xs font-semibold text-purple-600 uppercase tracking-wider">Earnings Report</div>
                            <div className="text-xs text-gray-500 mb-2">{tooltip.financeData.reportedDate}</div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Revenue:</span>
                                <span className="font-mono font-bold text-gray-900 dark:text-white">
                                    {tooltip.financeData.totalRevenue ? `$${(tooltip.financeData.totalRevenue / 1e9).toFixed(2)}B` : 'N/A'}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">Net Income:</span>
                                <span className="font-mono font-bold text-gray-900 dark:text-white">
                                    {tooltip.financeData.netIncome ? `$${(tooltip.financeData.netIncome / 1e9).toFixed(2)}B` : 'N/A'}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">EPS:</span>
                                <span className="font-mono font-bold text-gray-900 dark:text-white">
                                    {tooltip.financeData.reportedEPS || 'N/A'}
                                </span>
                            </div>
                        </>
                    )}
                    {tooltip.forecastData && (
                        <>
                            <div className="mb-1 text-xs font-semibold text-purple-600 uppercase tracking-wider">Est. Earnings (Model)</div>
                            <div className="text-xs text-gray-500 mb-2">{tooltip.forecastData.reportedDate}</div>
                            <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-sm">
                                <span className="text-gray-600 dark:text-gray-400">Est. EPS:</span>
                                <span className="font-mono font-bold text-gray-900 dark:text-white">
                                    {tooltip.forecastData.eps_forecast?.toFixed(2) || 'N/A'}
                                </span>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}

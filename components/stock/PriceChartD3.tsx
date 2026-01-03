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

    useEffect(() => {
        setYDomain([model.yMin, model.yMax]);
    }, [model.yMin, model.yMax]);

    useEffect(() => {
        if (!data.length || !containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const h = height;
        // Margins for Scrollbars
        const margin = { top: 20, right: 130, left: 10, bottom: 50 };
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
            g.append("rect").attr("class", "zoom-capture").attr("fill", "transparent");
            g.append("g").attr("class", "grid-lines opacity-10");
            g.append("g").attr("class", "bands-area").attr("clip-path", "url(#clip-price)");
            g.append("g").attr("class", "price-line").attr("clip-path", "url(#clip-price)");
            g.append("g").attr("class", "axis-x");
            g.append("g").attr("class", "axis-y");
            g.append("g").attr("class", "scrollbars");
            g.append("g").attr("class", "scrollbars");
            g.append("g").attr("class", "news-markers").attr("clip-path", "url(#clip-price)"); // Clip news to graph area? Or axis? Let's clip to chart area to hide out-of-bounds.
            g.append("g").attr("class", "legend-layer"); // Unclipped and on top
        }

        const svg = svgRef.current!;
        svg.attr("width", width).attr("height", h).attr("viewBox", `0 0 ${width} ${h}`);
        svg.select("#clip-price rect").attr("width", innerWidth).attr("height", innerHeight);

        const mainG = svg.select(".main-g").attr("transform", `translate(${margin.left},${margin.top})`);

        // Domains
        const calculateDefaultXDomain = () => {
            if (xDomain) return xDomain;
            const dataExtent = d3.extent(data, d => new Date(d.date)) as [Date, Date];
            if (!forecast || forecast.length === 0) return dataExtent;

            const forecastExtent = d3.extent(forecast, d => new Date(d.reportedDate)) as [Date, Date];
            return [
                dataExtent[0] < forecastExtent[0] ? dataExtent[0] : forecastExtent[0],
                dataExtent[1] > forecastExtent[1] ? dataExtent[1] : forecastExtent[1]
            ] as [Date, Date];
        };
        const currentXDomain = calculateDefaultXDomain();
        const currentYDomain = yDomain || [model.yMin, model.yMax];

        const xScale = d3.scaleTime().domain(currentXDomain).range([0, innerWidth]);
        const yScale = d3.scaleLinear().domain(currentYDomain).range([innerHeight, 0]);

        // Axes
        const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
        const yAxis = d3.axisRight(yScale).ticks(6).tickSize(0).tickPadding(10);
        mainG.select<SVGGElement>(".axis-x").attr("transform", `translate(0,${innerHeight})`).call(xAxis).attr("class", "axis-x text-xs font-mono text-gray-500").select(".domain").remove();
        mainG.select<SVGGElement>(".axis-y").attr("transform", `translate(${innerWidth}, 0)`).call(yAxis).attr("class", "axis-y text-xs font-mono text-gray-500").select(".domain").remove();
        mainG.select<SVGGElement>(".grid-lines").call(d3.axisLeft(yScale).tickSize(-innerWidth).ticks(6).tickFormat(() => "")).style("stroke-dasharray", "4 4").selectAll("line").attr("stroke", "currentColor");
        mainG.select(".grid-lines").select(".domain").remove();

        // Content
        const lineGen = d3.line<PriceBandPoint>().defined(d => d.close !== null).curve(d3.curveMonotoneX).x(d => xScale(new Date(d.date))).y(d => yScale(d.close!));
        const areaMidHigh = d3.area<PriceBandPoint>().defined(d => d.mid !== null && d.high !== null).curve(d3.curveMonotoneX).x(d => xScale(new Date(d.date))).y0(d => yScale(d.mid!)).y1(d => yScale(d.high!));
        const areaLowMid = d3.area<PriceBandPoint>().defined(d => d.mid !== null && d.low !== null).curve(d3.curveMonotoneX).x(d => xScale(new Date(d.date))).y0(d => yScale(d.low!)).y1(d => yScale(d.mid!));
        const lineFair = d3.line<PriceBandPoint>().defined(d => d.mid !== null).curve(d3.curveMonotoneX).x(d => xScale(new Date(d.date))).y(d => yScale(d.mid!));

        const bandsG = mainG.select(".bands-area");
        bandsG.selectAll("*").remove();
        bandsG.append("path").datum(data).attr("fill", "#fbbf24").attr("opacity", 0.1).attr("d", areaMidHigh).attr("pointer-events", "none");
        bandsG.append("path").datum(data).attr("fill", "#fbbf24").attr("opacity", 0.1).attr("d", areaLowMid).attr("pointer-events", "none");
        bandsG.append("path").datum(data).attr("fill", "none").attr("stroke", "#f59e0b").attr("stroke-width", 1.5).attr("stroke-dasharray", "4 4").attr("d", lineFair).attr("pointer-events", "none");

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
            const legX = 16;
            const legY = 10;
            const itemHeight = 18;
            const padding = 10;
            const boxWidth = 110;
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
                const g = lg.append("g").attr("transform", `translate(${padding}, ${padding + i * itemHeight + 9})`); // +9 centers text vertically in 18px height

                // Symbol (Circle)
                g.append("circle")
                    .attr("r", 4)
                    .attr("fill", item.color);

                // Text
                g.append("text")
                    .attr("x", 12)
                    .attr("y", 4) // visual alignment
                    .attr("font-size", "11px")
                    .attr("font-weight", "500")
                    .attr("font-family", "monospace")
                    .attr("fill", "#374151") // gray-700
                    .text(item.label);
            });
        }

        const priceG = mainG.select(".price-line");
        priceG.selectAll("*").remove();
        const areaGradient = d3.area<PriceBandPoint>().defined(d => d.close !== null).curve(d3.curveMonotoneX).x(d => xScale(new Date(d.date))).y0(innerHeight).y1(d => yScale(d.close!));
        priceG.append("path").datum(data).attr("fill", "url(#gradientPrice)").attr("d", areaGradient).attr("pointer-events", "none");
        priceG.append("path").datum(data).attr("fill", "none").attr("stroke", "#8b5cf6").attr("stroke-width", 2.5).attr("d", lineGen).attr("pointer-events", "none");

        // Price Label logic moved to main collision block

        // Price Label logic moved to main collision block

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
                .attr("d", d3.symbol().type(d3.symbolDiamond).size(80))
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
        const scrollG = mainG.select<SVGGElement>(".scrollbars");
        // Do NOT remove * here. We want to preserve state.

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

            // 1. Init (Enter)
            let g = parent.select<SVGGElement>(`.${classSelector}`);
            if (g.empty()) {
                g = parent.append("g").attr("class", classSelector);
                g.append("rect").attr("class", "track").attr("fill", "#f1f5f9");
                const thumbG = g.append("g").attr("class", "thumb-group");
                thumbG.append("rect").attr("class", "thumb").attr("fill", "#cbd5e1").style("cursor", "grab");
                thumbG.append("g").attr("class", "grips").attr("pointer-events", "none");
                // Handles
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

            // 3. Update (Attributes)
            g.attr("transform", `translate(${x},${y})`);

            const track = g.select(".track")
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

            // Grips
            const gripG = thumbG.select(".grips").html(""); // Clear old paths to redraw
            if (thumbSize > 30) {
                const gripPath = isH
                    ? `M 6,3 L 6,${thickness - 3} M 9,3 L 9,${thickness - 3} M ${thumbSize - 9},3 L ${thumbSize - 9},${thickness - 3} M ${thumbSize - 6},3 L ${thumbSize - 6},${thickness - 3}`
                    : `M 3,6 L ${thickness - 3},6 M 3,9 L ${thickness - 3},9 M 3,${thumbSize - 9} L ${thickness - 3},${thumbSize - 9} M 3,${thumbSize - 6} L ${thickness - 3},${thumbSize - 6}`;
                gripG.append("path").attr("d", gripPath).attr("stroke", "white").attr("stroke-width", 1.5).attr("opacity", 0.8);
            }

            // 4. Update Interactions (Re-attach with fresh closures)
            // Thumb Pan
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

                    // Pixel Clamping (Robust for all domains)
                    newStart = Math.max(0, Math.min(length - thumbSize, newStart));

                    // Helper: Current Width in Value Domain
                    const domainWidth = currentDomain[1] - currentDomain[0];

                    // Invert to get Value
                    let newValStart = barScale.invert(newStart);
                    let newValEnd = barScale.invert(newStart + thumbSize);

                    // Note: scale.invert might return [Max, Min] if inverted.
                    // But we want to preserve the domain structure passed in.
                    // Actually, if we just invert Start and End pixels, we get the new domain bounds directly.
                    // Check orientation of domain passed to onChange

                    // If domain is inverted (Max, Min), StartPixel -> Max, EndPixel -> Min.
                    // The order passed to onChange should match the input expectations.
                    if (fullDomain[0] > fullDomain[1]) {
                        // Inverted Input (Y-axis typically)
                        // startPixel corresponds to valStart (High), endPixel to valEnd (Low)
                        // But onChange typically expects [Bottom, Top] or [Top, Bottom]?
                        // The scale was: domain([Max, Min]) -> range([0, Length])
                        // So 0px = Max, Length = Min.
                        // newStart (Top Pixel) -> High Value.
                        // newStart + thumb (Bottom Pixel) -> Low Value.
                        // So newValStart > newValEnd.
                        // We pass [newValStart, newValEnd] which is [High, Low].
                        // The parent expects setYDomain([d[1], d[0]]) i.e. [Low, High].
                        // Wait, the parent call is: (d) => setYDomain([d[1], d[0]])
                        // The render call passed: [fullY[1], fullY[0]] (Max, Min).
                        // So it expects to receive [Max, Min] back?
                        // Yes, because barScale is consistent.
                    }

                    onChange([newValStart, newValEnd]);
                })
                .on("end", function () { d3.select(this).style("cursor", "grab"); })
            ) as any);

            // Resize Handles
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

                            // Pixel Clamping
                            const minPxGap = 20;

                            if (type === 'start') {
                                // Dragging Top/Left Edge
                                // Constraint: 0 <= newEdgePos <= (endPos - minPxGap)
                                newEdgePos = Math.max(0, Math.min(endPos - minPxGap, newEdgePos));

                                const val = barScale.invert(newEdgePos);
                                // For start handle, we are changing currentDomain[0]
                                onChange([val, currentDomain[1]]);
                            } else {
                                // Dragging Bottom/Right Edge
                                // Constraint: (startPos + minPxGap) <= newEdgePos <= length
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
        const twoYearsFromNow = new Date().setFullYear(new Date().getFullYear() + 2);
        const fullX: [number, number] = [xExt[0], Math.max(xExt[1], twoYearsFromNow)];
        const fullY: [number, number] = [0, model.yMax * 1.5];

        renderScrollbar(scrollG, "scrollbar-x", 0, innerHeight + 35, innerWidth, 16, 'horizontal', fullX, [currentXDomain[0].getTime(), currentXDomain[1].getTime()],
            (d) => onXDomainChange && onXDomainChange([new Date(d[0]), new Date(d[1])]));

        renderScrollbar(scrollG, "scrollbar-y", innerWidth + 100, 0, innerHeight, 16, 'vertical', [fullY[1], fullY[0]], [currentYDomain[1], currentYDomain[0]],
            (d) => setYDomain([d[1], d[0]]));

        // Disable Zoom on chart (keep tooltip capture)
        const zoomRect = mainG.select<SVGRectElement>(".zoom-capture")
            .attr("width", innerWidth).attr("height", innerHeight)
            .style("cursor", "crosshair") // Changed cursor
            .attr("pointer-events", "all")
            .on(".zoom", null); // Remove zoom listeners

        // Remove previous d3.zoom call entirely
        // Just Tooltip logic
        const bisect = d3.bisector<PriceBandPoint, Date>((d) => new Date(d.date)).center;
        zoomRect.on("mousemove", (event) => {
            const [mx] = d3.pointer(event);
            const date = xScale.invert(mx);
            const index = bisect(data, date);
            const d = data[index];
            if (d) setTooltip({ visible: true, x: mx + margin.left, y: d3.pointer(event)[1] + margin.top, data: d, newsData: undefined });
        }).on("mouseleave", () => setTooltip(prev => ({ ...prev, visible: false })));

    }, [data, height, model, xDomain, yDomain, onXDomainChange, news]);

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            {tooltip.visible && tooltip.data && (
                <div className="pointer-events-none absolute z-50 rounded-lg border border-gray-200 bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:border-gray-800 dark:bg-black/90 text-sm" style={{ top: 0, left: 0, transform: `translate(${Math.min(tooltip.x + 15, containerRef.current!.clientWidth - 150)}px, ${tooltip.y}px)` }}>
                    <div className="mb-1 font-mono text-gray-500">{tooltip.data.date}</div>

                    {/* Historical Case: Show Price & PE */}
                    {tooltip.data.close !== null ? (
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
                            {tooltip.data.mid !== null && (
                                <div className="flex items-center gap-2">
                                    <span className="text-amber-500 font-semibold">Est. Fair Value:</span>
                                    <span className="font-mono font-bold">${tooltip.data.mid.toFixed(2)}</span>
                                </div>
                            )}
                            {tooltip.data.mid !== null && model.lastClose && (
                                (() => {
                                    const gap = (tooltip.data.mid! - model.lastClose!.close) / model.lastClose!.close * 100;
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
                                <span className="text-gray-600 dark:text-gray-400">Est. Rev:</span>
                                <span className="font-mono font-bold text-gray-900 dark:text-white">
                                    {tooltip.forecastData.revenue_forecast ? `$${(tooltip.forecastData.revenue_forecast / 1e9).toFixed(2)}B` : 'N/A'}
                                </span>
                                <span className="text-gray-600 dark:text-gray-400">Est. Net Inc:</span>
                                <span className="font-mono font-bold text-gray-900 dark:text-white">
                                    {tooltip.forecastData.netIncome_forecast ? `$${(tooltip.forecastData.netIncome_forecast / 1e9).toFixed(2)}B` : 'N/A'}
                                </span>
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

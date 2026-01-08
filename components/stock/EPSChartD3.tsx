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

export default function EPSChartD3({ data, forecast = [], height = 300, className = "", xDomain, onXDomainChange }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const [tooltip, setTooltip] = useState<{
        visible: boolean;
        x: number;
        y: number;
        data?: { date: string; value: number; type: 'reported' | 'forecast'; est?: number };
    }>({ visible: false, x: 0, y: 0 });

    // Refs for Drag Handlers
    const xDomainRef = useRef<[Date, Date] | null>(null);
    const yDomainRef = useRef<[number, number] | null>(null);
    const dragContextX = useRef<{ startX: number, domain: [Date, Date] } | null>(null);
    const dragContextY = useRef<{ startY: number, domain: [number, number] } | null>(null);

    // Y-Axis State
    const [yDomain, setYDomain] = useState<[number, number] | null>(null);

    // Initial Y Domain Calculation (incorporating forecast)
    // Initial Y Domain Calculation removed to allow dynamic scaling
    // useEffect(() => { ... }, [data, forecast]);

    useEffect(() => {
        if (!containerRef.current || (!data.length && !forecast.length)) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const h = height;
        // Margins matching PriceChartD3
        // Margins: Left Y-axis, No Scrollbars
        const margin = { top: 20, right: 30, left: 60, bottom: 50 };
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

            // Positive Gradient
            const gradPos = defs.append("linearGradient").attr("id", "gradientEPSPos").attr("x1", "0").attr("y1", "0").attr("x2", "0").attr("y2", "1");
            gradPos.append("stop").attr("offset", "0%").attr("stop-color", "#34d399"); // Emerald-400
            gradPos.append("stop").attr("offset", "100%").attr("stop-color", "#059669"); // Emerald-600

            // Negative Gradient
            const gradNeg = defs.append("linearGradient").attr("id", "gradientEPSNeg").attr("x1", "0").attr("y1", "0").attr("x2", "0").attr("y2", "1");
            gradNeg.append("stop").attr("offset", "0%").attr("stop-color", "#fb7185"); // Rose-400
            gradNeg.append("stop").attr("offset", "100%").attr("stop-color", "#e11d48"); // Rose-600

            const pattern = defs.append("pattern")
                .attr("id", "stripe-pattern")
                .attr("patternUnits", "userSpaceOnUse")
                .attr("width", 4)
                .attr("height", 4)
                .attr("patternTransform", "rotate(45)");
            pattern.append("rect").attr("width", 2).attr("height", 4).attr("transform", "translate(0,0)").attr("fill", "#6366f1"); // Indigo

            // Clip Path
            defs.append("clipPath").attr("id", "clip-eps").append("rect");

            const mainG = svg.append("g").attr("class", "main-g");
            mainG.append("rect").attr("class", "zoom-capture").attr("fill", "transparent");
            mainG.append("g").attr("class", "grid-lines opacity-10");
            mainG.append("g").attr("class", "bars-layer").attr("clip-path", "url(#clip-eps)").style("pointer-events", "none");
            mainG.append("g").attr("class", "forecast-layer").attr("clip-path", "url(#clip-eps)").style("pointer-events", "none");
            mainG.append("g").attr("class", "price-line").attr("clip-path", "url(#clip-eps)").style("pointer-events", "none");

            // Axes
            const xAxisG = mainG.append("g").attr("class", "axis-x");
            const yAxisG = mainG.append("g").attr("class", "axis-y");
            mainG.append("g").attr("class", "scroll-layer"); // Layer for scrollbars

        }

        const svg = svgRef.current!;
        svg.attr("width", width).attr("height", h).attr("viewBox", `0 0 ${width} ${h}`);
        svg.select("#clip-eps rect").attr("width", innerWidth).attr("height", innerHeight);
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

        const xScale = d3.scaleTime().domain(currentXDomain).range([0, innerWidth]);

        // Calculate Y domain based on visible data in the X range
        const calculateYDomain = (): [number, number] => {
            if (yDomain) return yDomain;

            const visibleData = data.filter(d => {
                const date = new Date(d.reportedDate);
                return date >= currentXDomain[0] && date <= currentXDomain[1];
            });

            const visibleForecast = forecast.filter(d => {
                const date = new Date(d.reportedDate);
                return date >= currentXDomain[0] && date <= currentXDomain[1];
            });

            if (visibleData.length === 0 && visibleForecast.length === 0) return [0, 1];

            const histEPS = visibleData.flatMap(d => [d.reportedEPS || 0, d.estimatedEPS || 0]);
            const foreEPS = visibleForecast.map(d => d.eps_forecast || 0);
            const allValues = [...histEPS, ...foreEPS];

            if (allValues.length === 0) return [0, 1];

            const maxVal = Math.max(...allValues);
            const minVal = Math.min(...allValues);

            const yMax = maxVal > 0 ? maxVal * 1.1 : maxVal * 0.9;
            const yMin = minVal < 0 ? minVal * 1.1 : 0;

            return [Math.min(0, yMin), Math.max(0.1, yMax)];
        };
        const currentYDomain: [number, number] = calculateYDomain();

        // Update Refs
        xDomainRef.current = currentXDomain;
        yDomainRef.current = currentYDomain;
        const yScale = d3.scaleLinear().domain(currentYDomain).range([innerHeight, 0]);

        // Axes
        const xAxis = d3.axisBottom(xScale).ticks(6).tickSize(0).tickPadding(10);
        // Changed to Axis Left
        const yAxis = d3.axisLeft(yScale).ticks(6).tickSize(0).tickPadding(10);

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
            .call(d3.axisLeft(yScale).tickSize(-innerWidth).ticks(5).tickFormat(() => ""))
            .style("stroke-dasharray", "4 4")
            .selectAll("line").attr("stroke", "currentColor");
        mainG.select(".grid-lines").select(".domain").remove();

        // Bars
        const barWidth = Math.max(4, innerWidth / ((data.length + forecast.length) * 3)); // Heuristic

        // Historical Bars
        const barsLayer = mainG.select(".bars-layer");
        barsLayer.selectAll("*").remove();

        barsLayer.selectAll(".bar-reported")
            .data(data)
            .enter()
            .append("rect")
            .attr("class", "bar-reported")
            .attr("x", (d) => xScale(new Date(d.reportedDate)) - barWidth / 2)
            .attr("y", (d) => yScale(Math.max(0, d.reportedEPS || 0)))
            .attr("width", barWidth)
            .attr("height", (d) => Math.abs(yScale(d.reportedEPS || 0) - yScale(0)))
            .attr("fill", (d) => (d.reportedEPS && d.reportedEPS >= 0 ? "url(#gradientEPSPos)" : "url(#gradientEPSNeg)"))
            .attr("rx", 3);

        barsLayer.selectAll(".point-est")
            .data(data)
            .enter()
            .append("circle")
            .attr("cx", (d) => xScale(new Date(d.reportedDate)))
            .attr("cy", (d) => yScale(d.estimatedEPS || 0))
            .attr("r", 3)
            .attr("fill", "#6366f1")
            .attr("stroke", "white")
            .attr("stroke-width", 1);

        // Forecast Bars
        const forecastLayer = mainG.select(".forecast-layer");
        forecastLayer.selectAll("*").remove();

        forecastLayer.selectAll(".bar-forecast")
            .data(forecast)
            .enter()
            .append("rect")
            .attr("class", "bar-forecast")
            .attr("x", (d) => xScale(new Date(d.reportedDate)) - barWidth / 2)
            .attr("y", (d) => yScale(Math.max(0, d.eps_forecast || 0)))
            .attr("width", barWidth)
            .attr("height", (d) => Math.abs(yScale(d.eps_forecast || 0) - yScale(0)))
            .attr("fill", "transparent") // Hollow
            .attr("stroke", "#6366f1") // Indigo outline
            .attr("stroke-width", 1.5)
            .attr("rx", 2)
            .style("stroke-dasharray", "4 2"); // Dashed outline to indicate estimate

        // Professional Box Legend
        mainG.select(".legend-box").remove();
        const lg = mainG.append("g").attr("class", "legend-box").attr("transform", "translate(16, 10)");

        const legendItems = [
            { label: "Reported", type: "reported", color: "#10b981" },
            { label: "Forecast", type: "forecast", color: "#6366f1" }
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

        // --- Axis Interaction Rects dimensions ---
        mainG.select(".axis-x .axis-drag-rect")
            .attr("x", 0).attr("y", 0)
            .attr("width", innerWidth).attr("height", margin.bottom);

        // Visual indicator line for X
        const axG = mainG.select(".axis-x");
        if (axG.select(".axis-drag-line").empty()) {
            axG.append("line").attr("class", "axis-drag-line").attr("stroke", "#6366f1").attr("stroke-width", 2).attr("opacity", 0).style("pointer-events", "none");
        }
        axG.select(".axis-drag-line")
            .attr("x1", 0).attr("x2", innerWidth)
            .attr("y1", 0).attr("y2", 0);

        mainG.select(".axis-y .axis-drag-rect")
            .attr("x", -margin.left).attr("y", 0) // Align to cover labels
            .attr("width", margin.left).attr("height", innerHeight);

        // Visual indicator line for Y
        const ayG = mainG.select(".axis-y");
        if (ayG.select(".axis-drag-line").empty()) {
            ayG.append("line").attr("class", "axis-drag-line").attr("stroke", "#6366f1").attr("stroke-width", 2).attr("opacity", 0).style("pointer-events", "none");
        }
        ayG.select(".axis-drag-line")
            .attr("x1", 0).attr("x2", 0)
            .attr("y1", 0).attr("y2", innerHeight);

        // --- Embedded Axis Dragging (Panning) ---

        const setDragState = (axisClass: string, active: boolean) => {
            mainG.select(`.${axisClass} .axis-drag-line`).transition().duration(200).attr("opacity", active ? 1 : 0);
        };




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

        const maxDate = xExt[1] ? new Date(xExt[1]) : new Date();
        maxDate.setMonth(maxDate.getMonth() + 1);
        const fullX: [number, number] = [xExt[0]?.getTime() || 0, maxDate.getTime()];

        // Calculate global Y extent for scrollbar
        let dataYMin = 0;
        let dataYMax = 0;
        if (data.length > 0 || forecast.length > 0) {
            const allValues: number[] = [];
            data.forEach(d => {
                if (d.reportedEPS !== null) allValues.push(d.reportedEPS);
                if (d.estimatedEPS !== null) allValues.push(d.estimatedEPS);
            });
            forecast.forEach(d => {
                if (d.eps_forecast !== null) allValues.push(d.eps_forecast);
            });
            if (allValues.length > 0) {
                dataYMin = Math.min(...allValues);
                dataYMax = Math.max(...allValues);
            }
        }
        console.log("EPSChart calculated Y extent:", { dataYMin, dataYMax });

        // EPS Y Max assumption: 0 to max + padding. EPS can be negative, so min/max extent?
        // Let's use current yDomain logic fallback or existing assumption. 
        // EPSChartD3 has `yDomain` prop or local calc.
        const fullY: [number, number] = [yDomain ? yDomain[0] : Math.min(0, dataYMin), yDomain ? yDomain[1] * 1.5 : dataYMax * 1.5];

        renderScrollbar(scrollG, "scrollbar-x", 0, innerHeight + 35, innerWidth, 16, 'horizontal', fullX, [currentXDomain[0].getTime(), currentXDomain[1].getTime()],
            (d) => onXDomainChange && onXDomainChange([new Date(d[0]), new Date(d[1])]));

        renderScrollbar(scrollG, "scrollbar-y", -margin.left - 20, 0, innerHeight, 16, 'vertical', [fullY[1], fullY[0]], [currentYDomain[1], currentYDomain[0]],
            (d) => setYDomain([d[1], d[0]]));
        const zoomRect = mainG.select<SVGRectElement>(".zoom-capture")
            .attr("width", innerWidth).attr("height", innerHeight)
            .style("cursor", "crosshair")
            .attr("pointer-events", "all")
            .on(".zoom", null);

        const bisectHist = d3.bisector<StockFinanceRow, Date>((d) => new Date(d.reportedDate)).center;
        const bisectFore = d3.bisector<StockFinanceForecastRow, Date>((d) => new Date(d.reportedDate)).center;

        zoomRect.on("mousemove", (event) => {
            const [mx] = d3.pointer(event);
            const date = xScale.invert(mx);

            // Check nearest in both datasets
            const iHist = bisectHist(data, date);
            const iFore = bisectFore(forecast, date);

            const dHist = data[iHist];
            const dFore = forecast[iFore];

            let best = null;
            if (dHist && dFore) {
                const distHist = Math.abs(new Date(dHist.reportedDate).getTime() - date.getTime());
                const distFore = Math.abs(new Date(dFore.reportedDate).getTime() - date.getTime());
                best = distHist < distFore
                    ? { date: dHist.reportedDate, value: dHist.reportedEPS || 0, type: 'reported' as const, est: dHist.estimatedEPS || undefined }
                    : { date: dFore.reportedDate, value: dFore.eps_forecast || 0, type: 'forecast' as const };
            } else if (dHist) {
                best = { date: dHist.reportedDate, value: dHist.reportedEPS || 0, type: 'reported' as const, est: dHist.estimatedEPS || undefined };
            } else if (dFore) {
                best = { date: dFore.reportedDate, value: dFore.eps_forecast || 0, type: 'forecast' as const };
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
                        <>
                            <div className="flex items-center gap-2">
                                <span className="w-2 h-2 bg-emerald-500 rounded-sm"></span>
                                <span className="text-gray-600 dark:text-gray-400">Reported:</span>
                                <span className="font-mono font-bold">{tooltip.data.value}</span>
                            </div>
                            {tooltip.data.est !== undefined && (
                                <div className="flex items-center gap-2">
                                    <span className="w-2 h-2 bg-indigo-500 rounded-full border border-white" style={{ borderWidth: '1px' }}></span>
                                    <span className="text-gray-600 dark:text-gray-400">Est:</span>
                                    <span className="font-mono font-bold">{tooltip.data.est}</span>
                                </div>
                            )}
                        </>
                    ) : (
                        <div className="flex items-center gap-2">
                            <span className="w-2 h-2 border border-indigo-500 border-dashed rounded-sm"></span>
                            <span className="text-gray-600 dark:text-gray-400">Model Forecast:</span>
                            <span className="font-mono font-bold">{tooltip.data.value.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            )}
            <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500 absolute bottom-0 w-full pointer-events-none" style={{ bottom: "-20px" }}>
            </div>
            <div className="flex gap-4 justify-center mt-2 text-xs text-gray-500 absolute bottom-0 w-full pointer-events-none" style={{ bottom: "-20px" }}>
            </div>
        </div>
    );
}

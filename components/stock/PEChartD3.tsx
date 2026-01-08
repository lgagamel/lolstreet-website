"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import type { PEBandModel, PEBandPoint } from "../../lib/charts/peBandModel";

type Props = {
    model: PEBandModel;
    height?: number;
    className?: string;
    onUpdateAssumedPE?: (vals: { low?: number; mid?: number; high?: number }) => void;
    xDomain?: [Date, Date];
    onXDomainChange?: (domain: [Date, Date]) => void;
};

export default function PEChartD3({ model, height = 340, className = "", onUpdateAssumedPE, xDomain, onXDomainChange }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const [yDomain, setYDomain] = useState<[number, number] | null>(null);
    const [tooltip, setTooltip] = useState<{
        visible: boolean;
        x: number;
        y: number;
        data?: PEBandPoint;
    }>({ visible: false, x: 0, y: 0 });

    const [hasInteracted, setHasInteracted] = useState(false);

    // Refs for Drag Handlers (initialized as null, populated in useEffect)
    const xDomainRef = useRef<[Date, Date] | null>(null);
    const yDomainRef = useRef<[number, number] | null>(null);
    const dragContextX = useRef<{ startX: number, domain: [Date, Date] } | null>(null);
    const dragContextY = useRef<{ startY: number, domain: [number, number] } | null>(null);

    const data = useMemo(() => model.points, [model]);

    // Removed useEffect that set yDomain to [model.yMin, model.yMax]
    // This allows the initial Y domain to be calculated based on visible data


    useEffect(() => {
        if (!data.length || !containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const h = height;
        // Margins for Scrollbars
        // Margins: Left Y-axis, No Scrollbars
        const margin = { top: 20, right: 50, left: 60, bottom: 80 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = h - margin.top - margin.bottom;

        if (!svgRef.current) {
            const svg = d3.select(container).append("svg").style("overflow", "visible").attr("class", "chart-svg");
            svgRef.current = svg;
            const defs = svg.append("defs");
            const gradientPE = defs.append("linearGradient").attr("id", "gradientPE").attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
            gradientPE.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0.4);
            gradientPE.append("stop").attr("offset", "100%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0);

            // Clip Path
            defs.append("clipPath").attr("id", "clip-pe").append("rect");

            // Filter
            const filter = defs.append("filter").attr("id", "dropShadow").attr("height", "130%");
            filter.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 1);
            filter.append("feOffset").attr("dx", 0).attr("dy", 1).attr("result", "offsetblur");
            filter.append("feComponentTransfer").append("feFuncA").attr("type", "linear").attr("slope", 0.3);
            const merge = filter.append("feMerge");
            merge.append("feMergeNode");
            merge.append("feMergeNode").attr("in", "SourceGraphic");

            const mainG = svg.append("g").attr("class", "main-g");
            mainG.append("rect").attr("class", "zoom-capture").attr("fill", "transparent");
            mainG.append("g").attr("class", "grid-lines opacity-10");
            mainG.append("g").attr("class", "bands-area").attr("clip-path", "url(#clip-pe)").style("pointer-events", "none");
            mainG.append("g").attr("class", "pe-line").attr("clip-path", "url(#clip-pe)").style("pointer-events", "none");

            // Axes
            const xAxisG = mainG.append("g").attr("class", "axis-x");
            const yAxisG = mainG.append("g").attr("class", "axis-y");


            mainG.append("g").attr("class", "drag-layer");
            mainG.append("g").attr("class", "legend-layer");
            mainG.append("g").attr("class", "scroll-layer");
        }

        const svg = svgRef.current!;
        svg.attr("width", width).attr("height", h).attr("viewBox", `0 0 ${width} ${h}`);
        svg.select("#clip-pe rect").attr("width", innerWidth).attr("height", innerHeight);
        const mainG = svg.select(".main-g").attr("transform", `translate(${margin.left},${margin.top})`);

        // Default X domain: ±3 months from today (6-month window)
        const calculateDefaultXDomain = () => {
            if (xDomain) return xDomain;

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

            const peRatios = visibleData.map(d => d.pe_ratio).filter(p => p !== null) as number[];

            // Include Assumed PE bounds in the range calculation
            const { low, high } = model.assumed;
            const values = [...peRatios];
            if (low !== null) values.push(low);
            if (high !== null) values.push(high);

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

        const xAxis = d3.axisBottom(xScale).tickSize(0).tickPadding(10);
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

        const yAxisGrid = d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => "").ticks(6);
        mainG.select<SVGGElement>(".grid-lines").call(yAxisGrid).style("stroke-dasharray", "4 4").selectAll("line").attr("stroke", "currentColor");
        mainG.select(".grid-lines").select(".domain").remove();

        // No change needed for removal as no HTML legend exists. Code for context.

        const lineGenerator = d3.line<PEBandPoint>().defined((d) => d.pe_ratio !== null).curve(d3.curveMonotoneX).x((d) => xScale(new Date(d.date))).y((d) => yScale(d.pe_ratio!));
        const areaGenerator = d3.area<PEBandPoint>().defined((d) => d.pe_ratio !== null).curve(d3.curveMonotoneX).x((d) => xScale(new Date(d.date))).y0(innerHeight).y1((d) => yScale(d.pe_ratio!));

        // Area generators for shading
        const { low, mid, high } = model.assumed;
        const areaMidHigh = d3.area<PEBandPoint>()
            .defined(d => high !== null && mid !== null)
            .x(d => xScale(new Date(d.date)))
            .y0(d => yScale(mid!))
            .y1(d => yScale(high!));

        const areaLowMid = d3.area<PEBandPoint>()
            .defined(d => low !== null && mid !== null)
            .x(d => xScale(new Date(d.date)))
            .y0(d => yScale(low!))
            .y1(d => yScale(mid!));

        // Filter data for bands (Last 1 year only)
        const today = new Date();
        const oneYearAgo = new Date(today);
        oneYearAgo.setFullYear(today.getFullYear() - 1);

        const bandsData = data.filter(d => {
            const date = new Date(d.date);
            return date >= oneYearAgo;
        });

        const bandsArea = mainG.select(".bands-area");
        bandsArea.selectAll("*").remove(); // Clear previous bands

        // Shaded Areas
        if (high !== null && mid !== null) {
            bandsArea.append("path").datum(bandsData).attr("fill", "#fbbf24").attr("opacity", 0.15).attr("d", areaMidHigh).attr("pointer-events", "none");
        }
        if (low !== null && mid !== null) {
            bandsArea.append("path").datum(bandsData).attr("fill", "#fbbf24").attr("opacity", 0.15).attr("d", areaLowMid).attr("pointer-events", "none");
        }

        // Dotted Lines for Mid/High/Low
        if (mid !== null) {
            const lineMid = d3.line<PEBandPoint>().x(d => xScale(new Date(d.date))).y(() => yScale(mid!));
            bandsArea.append("path").datum(bandsData).attr("fill", "none").attr("stroke", "#f59e0b").attr("stroke-width", 1.5).attr("stroke-dasharray", "4 4").attr("d", lineMid).attr("pointer-events", "none");
        }
        if (high !== null) {
            const lineHigh = d3.line<PEBandPoint>().x(d => xScale(new Date(d.date))).y(() => yScale(high!));
            bandsArea.append("path").datum(bandsData).attr("fill", "none").attr("stroke", "#9ca3af").attr("stroke-width", 1).attr("stroke-dasharray", "4 4").attr("d", lineHigh).attr("pointer-events", "none");
        }
        if (low !== null) {
            const lineLow = d3.line<PEBandPoint>().x(d => xScale(new Date(d.date))).y(() => yScale(low!));
            bandsArea.append("path").datum(bandsData).attr("fill", "none").attr("stroke", "#9ca3af").attr("stroke-width", 1).attr("stroke-dasharray", "4 4").attr("d", lineLow).attr("pointer-events", "none");
        }

        const peLineGroup = mainG.select(".pe-line");
        peLineGroup.selectAll("*").remove(); // Clear previous PE line
        // PE Line
        peLineGroup.append("path").datum(data).attr("class", "pe-line-path").attr("fill", "none").attr("stroke", "#3b82f6").attr("stroke-width", 2.5).attr("d", lineGenerator);

        // --- Clear Old Annotations ---
        mainG.selectAll(".current-pe-highlight, .y-axis-bounds-annotations").remove();

        // --- Current PE Highlight ---
        const latestPEPoint = [...data].reverse().find(d => d.pe_ratio !== null);
        if (latestPEPoint) {
            const px = xScale(new Date(latestPEPoint.date));
            const py = yScale(latestPEPoint.pe_ratio!);

            // Only render if visible within Y range
            if (py >= 0 && py <= innerHeight) {
                // Calculate 1-year median PE
                const lastDate = new Date(latestPEPoint.date);
                const oneYearAgo = new Date(lastDate);
                oneYearAgo.setFullYear(lastDate.getFullYear() - 1);

                const oneYearData = data.filter(d => {
                    const dDate = new Date(d.date);
                    return dDate >= oneYearAgo && dDate <= lastDate && d.pe_ratio !== null;
                });

                if (oneYearData.length > 0) {
                    const peValues = oneYearData.map(d => d.pe_ratio!).sort((a, b) => a - b);
                    const medianPE = peValues[Math.floor(peValues.length / 2)];
                    const diff = ((latestPEPoint.pe_ratio! - medianPE) / medianPE) * 100;
                    const isExpensive = diff > 0;

                    const currentPEG = mainG.append("g")
                        .attr("class", "current-pe-highlight")
                        .attr("transform", `translate(${px}, ${py})`);

                    // Animated Pulse Dot
                    currentPEG.append("circle")
                        .attr("r", 5)
                        .attr("fill", "#3b82f6")
                        .attr("stroke", "white")
                        .attr("stroke-width", 2);

                    const pulseCircle = currentPEG.append("circle")
                        .attr("r", 5)
                        .attr("fill", "none")
                        .attr("stroke", "#3b82f6")
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

                    // Label
                    const labelText = isExpensive ? `${diff.toFixed(1)}% More expensive than usual` : `${Math.abs(diff).toFixed(1)}% Cheaper than usual`;
                    const labelColor = isExpensive ? "#ef4444" : "#22c5e0"; // red-500 : green-500

                    currentPEG.append("text")
                        .attr("x", 10)
                        .attr("y", -10)
                        .attr("font-size", "12px")
                        .attr("font-weight", "bold")
                        .attr("fill", labelColor)
                        .style("filter", "drop-shadow(0 1px 1px rgb(0 0 0 / 0.1))")
                        .text(labelText);
                }
            }

        }

        // Professional Box Legend
        const legendG = mainG.select(".legend-layer");
        legendG.selectAll("*").remove();

        const legendItems = [
            { label: "PE Ratio", color: "#3b82f6" },
            { label: "Upper PE", color: "#9ca3af" },
            { label: "Mid PE", color: "#f59e0b" },
            { label: "Lower PE", color: "#9ca3af" }
        ];

        if (data.length > 0) {
            const legX = 16;
            const legY = 10;
            const itemHeight = 18;
            const padding = 10;
            const boxWidth = 90;
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

                if (item.label === "PE Ratio") {
                    // Solid Line with Dot
                    g.append("line").attr("x1", 0).attr("x2", 15).attr("y1", 0).attr("y2", 0).attr("stroke", item.color).attr("stroke-width", 2);
                    g.append("circle").attr("cx", 7.5).attr("cy", 0).attr("r", 3).attr("fill", item.color);
                } else if (item.label === "Mid PE") {
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
                    .attr("font-size", "11px")
                    .attr("font-weight", "500")
                    .attr("font-family", "monospace")
                    .attr("fill", "#374151") // gray-700
                    .text(item.label);
            });
        }

        // Draggable Lines (Lines Only)
        const dragLayer = mainG.select(".drag-layer");
        const dragItems = [
            { key: 'low', val: low, color: "#475569", dash: "4 4" }, // slate-600
            { key: 'mid', val: mid, color: "#d97706", dash: "4 4" }, // amber-600
            { key: 'high', val: high, color: "#475569", dash: "4 4" } // slate-600
        ].filter(d => d.val !== null) as { key: 'low' | 'mid' | 'high', val: number, color: string, dash: string }[];

        // CLEAR EXISTING DRAG ELEMENTS to prevent artifacts (nuclear option)
        dragLayer.selectAll("*").remove();

        const groups = dragLayer.selectAll<SVGGElement, typeof dragItems[0]>(".drag-group").data(dragItems, d => d.key);
        const groupsEnter = groups.enter().append("g").attr("class", "drag-group").style("cursor", "row-resize");
        groupsEnter.append("line").attr("stroke-width", 1.5);

        // Circle Handle Group
        const handleG = groupsEnter.append("g")
            .attr("class", "drag-handle-group");
        // REMOVED pointer-events: none to allow dragging via icon

        // Transparent Hit Area for Icon
        handleG.append("rect")
            .attr("width", 20)
            .attr("height", 20)
            .attr("x", -10)
            .attr("y", -10)
            .attr("fill", "transparent");

        // Vertical Arrow Icon (Double-headed Arrow) - Colored stroke set in update
        // Vertical Arrow Icon using External SVG Image
        handleG.append("image")
            .attr("class", "arrow-image")
            .attr("width", 18)  // Smaller size as requested
            .attr("height", 18)
            .attr("x", -9)      // Center horizontally (18/2)
            .attr("y", -9);     // Center vertically (18/2)

        groupsEnter.append("rect").attr("fill", "transparent").attr("height", 20).attr("y", -10);

        // Label Group
        const labelG = groupsEnter.append("g").attr("class", "label-group");

        const text = labelG.append("text")
            .attr("class", "bound-label")
            .attr("font-size", "11px")
            .attr("font-weight", "600")
            .attr("font-style", "italic") // Match Price Chart
            .style("user-select", "none")
            .style("filter", "drop-shadow(0 1px 1px rgb(0 0 0 / 0.1))")
            .attr("dy", "0.32em");

        // Background Rect (created but sized in update)
        labelG.insert("rect", "text")
            .attr("class", "label-bg")
            .attr("fill", "white")
            .attr("fill-opacity", 0.8)
            .attr("rx", 2);

        // Update Position & Attrs
        const groupsUpdate = groups.merge(groupsEnter);
        groupsUpdate
            .attr("transform", d => `translate(0, ${yScale(d.val)})`)
            .style("display", d => {
                const y = yScale(d.val);
                return (y >= 0 && y <= innerHeight) ? "block" : "none";
            });

        // Calculate visual start for lines (align with bands)
        const lineStartX = Math.max(0, xScale(oneYearAgo));

        groupsUpdate.select("line")
            .attr("x1", lineStartX)
            .attr("x2", innerWidth) // Full width
            .attr("stroke", d => d.color)
            .attr("stroke-dasharray", d => d.dash);

        // Update Text & Background
        groupsUpdate.each(function (d) {
            const g = d3.select(this);
            const txt = g.select(".bound-label");
            const label = d.key === 'mid' ? 'Fair PE' : d.key === 'high' ? 'Upper PE' : 'Lower PE';
            txt.text(`${label}: ${d.val.toFixed(2)}`)
                .attr("fill", d.color)
                .attr("x", innerWidth + 10)
                .attr("text-anchor", "start");

            const bbox = (txt.node() as SVGTextElement).getBBox();
            g.select(".label-bg")
                .attr("x", bbox.x - 2)
                .attr("y", bbox.y - 1)
                .attr("width", bbox.width + 4)
                .attr("height", bbox.height + 2);
        });

        // Update Handle Position & Style
        const handleGroup = groupsUpdate.select(".drag-handle-group");
        handleGroup.attr("transform", `translate(${innerWidth - 12}, 0)`); // Positioned near right edge

        // Update Icon Color (swapping source image)
        handleGroup.select(".arrow-image")
            .attr("href", d => d.key === 'mid' ? "/icons/vertical-drag-orange.svg" : "/icons/vertical-drag-gray.svg");

        groupsUpdate.select("rect").attr("width", innerWidth);

        // Events
        groupsUpdate.call((d3.drag<SVGGElement, typeof dragItems[0]>()
            .on("start", () => {
                if (!hasInteracted) setHasInteracted(true);
            })
            .on("drag", (event, d) => {
                const newY = Math.min(innerHeight, Math.max(0, event.y));
                const newVal = yScale.invert(newY);
                if (onUpdateAssumedPE) {
                    onUpdateAssumedPE({ [d.key]: newVal });
                }
            })
        ) as any);

        groups.exit().remove();

        // --- Interaction Hint ---
        mainG.select(".interaction-hint").remove();
        if (!hasInteracted && model.assumed.mid !== null) {
            const hintY = yScale(model.assumed.mid);
            // Relaxed check: show if it's remotely visible
            if (hintY >= 0 && hintY <= innerHeight) {
                // Place it further left to ensure it's not clipped and clearly visible
                // Fair PE label is at right, we place hint to the left of the handle
                const hintG = mainG.append("g")
                    .attr("class", "interaction-hint")
                    .attr("transform", `translate(${innerWidth - 50}, ${hintY})`);

                const hintText = hintG.append("text")
                    .attr("fill", "#4b5563") // gray-600 (darker for readability)
                    .attr("font-size", "13px") // Larger
                    .attr("font-weight", "700") // Bold
                    .attr("text-anchor", "end")
                    .attr("dy", "0.32em")
                    .style("filter", "drop-shadow(0 1px 2px rgb(255 255 255 / 0.9))")
                    .text("Drag to adjust");

                const arrowG = hintG.append("g")
                    .attr("transform", "translate(5, 0)");

                // Vertical arrow
                arrowG.append("path")
                    .attr("d", "M 0,-6 L 3,-3 M 0,-6 L -3,-3 M 0,-6 L 0,6 M 0,6 L 3,3 M 0,6 L -3,3")
                    .attr("stroke", "#d97706") // amber-600
                    .attr("stroke-width", 2)
                    .attr("fill", "none");

                // Pulsing Arrow Animation
                const animateArrow = (sel: d3.Selection<SVGGElement, unknown, null, undefined>) => {
                    sel.transition()
                        .duration(800)
                        .attr("transform", "translate(5, -4)")
                        .transition()
                        .duration(800)
                        .attr("transform", "translate(5, 4)")
                        .on("end", () => animateArrow(sel));
                };
                animateArrow(arrowG);

                // Blinking Text Animation
                const animateText = (sel: d3.Selection<SVGTextElement, unknown, null, undefined>) => {
                    sel.transition()
                        .duration(800)
                        .attr("opacity", 0.4)
                        .transition()
                        .duration(800)
                        .attr("opacity", 1)
                        .on("end", () => animateText(sel));
                };
                animateText(hintText);

                // Ensure it is on top
                hintG.raise();
            }
        }

        // Duplicate logic removed

        // --- Scrollbar Logic ---
        const scrollG = mainG.select<SVGGElement>(".scroll-layer");
        // Do NOT remove * here

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

        const xExt = d3.extent(model.points, d => new Date(d.date).getTime()) as [number, number];
        const maxDate = new Date(xExt[1]);
        maxDate.setMonth(maxDate.getMonth() + 1);
        const fullX: [number, number] = [xExt[0], maxDate.getTime()];
        const fullY: [number, number] = [0, model.yMax * 1.5];

        renderScrollbar(scrollG, "scrollbar-x", 0, innerHeight + 35, innerWidth, 16, 'horizontal', fullX, [currentXDomain[0].getTime(), currentXDomain[1].getTime()],
            (d) => onXDomainChange && onXDomainChange([new Date(d[0]), new Date(d[1])]));

        renderScrollbar(scrollG, "scrollbar-y", -margin.left - 20, 0, innerHeight, 16, 'vertical', [fullY[1], fullY[0]], [currentYDomain[1], currentYDomain[0]],
            (d) => setYDomain([d[1], d[0]]));

        // Disable Zoom (Keep Tooltip)
        const zoomRect = mainG.select<SVGRectElement>(".zoom-capture")
            .attr("width", innerWidth).attr("height", innerHeight).attr("pointer-events", "all")
            .style("cursor", "crosshair")
            .on(".zoom", null);

        const bisect = d3.bisector<PEBandPoint, Date>((d) => new Date(d.date)).center;
        zoomRect.on("mousemove", (event) => {
            const [mx] = d3.pointer(event);
            const date = xScale.invert(mx);
            const index = bisect(data, date);
            const d = data[index];

            // Interaction Visuals
            mainG.selectAll(".interaction-guide").remove();

            if (d) {
                // Determine Y value: PE Ratio
                const val = d.pe_ratio;
                if (val !== null) {
                    const px = xScale(new Date(d.date));
                    const py = yScale(val);

                    const guide = mainG.append("g").attr("class", "interaction-guide").style("pointer-events", "none");

                    // Connection Line
                    guide.append("line")
                        .attr("x1", px).attr("x2", px)
                        .attr("y1", innerHeight)
                        .attr("y2", py)
                        .attr("stroke", "#3b82f6")
                        .attr("stroke-width", 1.5)
                        .attr("stroke-dasharray", "3 3")
                        .attr("opacity", 0.6);

                    // Highlight Circle
                    guide.append("circle")
                        .attr("cx", px).attr("cy", py)
                        .attr("r", 5)
                        .attr("fill", "#fff")
                        .attr("stroke", "#3b82f6")
                        .attr("stroke-width", 2);
                }

                setTooltip({ visible: true, x: mx + margin.left, y: d3.pointer(event)[1] + margin.top, data: d });
            }
        }).on("mouseleave", () => {
            setTooltip(prev => ({ ...prev, visible: false }));
            mainG.selectAll(".interaction-guide").remove();
        });

        // --- Footnote ---
        mainG.append("text")
            .attr("x", innerWidth)
            .attr("y", height - margin.top - 5) // At the very bottom
            .attr("text-anchor", "end")
            .attr("font-size", "10px")
            .attr("fill", "#9ca3af") // gray-400
            .attr("font-style", "italic")
            .text("* Historical PE Ratio: 'usual' refers to the median PE ratio calculated over the most recent 1-year period.");

    }, [data, height, model, xDomain, yDomain, onXDomainChange, hasInteracted]);

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            {tooltip.visible && tooltip.data && (
                <div className="pointer-events-none absolute z-50 rounded-lg border border-gray-200 bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:border-gray-800 dark:bg-black/90 text-sm" style={{ top: 0, left: 0, transform: `translate(${Math.min(tooltip.x + 15, containerRef.current!.clientWidth - 150)}px, ${tooltip.y}px) translateY(-100%)` }}>
                    <div className="mb-1 font-mono text-gray-500">{tooltip.data.date}</div>
                    {tooltip.data.pe_ratio !== null && (
                        <div className="flex items-center gap-2">
                            <span className="text-blue-500 font-semibold">PE:</span>
                            <span className="font-mono font-bold">{tooltip.data.pe_ratio.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

"use client";

import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { ComparisonSeries } from "@/app/actions";

type Props = {
    series: ComparisonSeries[];
    isRacing?: boolean;
    onRaceEnd?: () => void;
};

// Colors for the racers
const COLORS = ["#8b5cf6", "#10b981", "#f97316", "#06b6d4", "#ec4899"];

export default function ComparisonChartD3({ series, isRacing, onRaceEnd }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);
    const [tooltip, setTooltip] = useState<{ visible: boolean; x: number; y: number; content: React.ReactNode } | null>(null);

    // Initial Setup
    useEffect(() => {
        if (!containerRef.current) return;

        // Clear previous
        d3.select(containerRef.current).select("svg").remove();

        const width = containerRef.current.clientWidth;
        const height = 500;
        const margin = { top: 40, right: 80, bottom: 40, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const svg = d3.select(containerRef.current)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("overflow", "visible");

        svgRef.current = svg.node();

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        // Define Gradients
        const defs = svg.append("defs");
        series.forEach((s, i) => {
            const color = COLORS[i % COLORS.length];
            const grad = defs.append("linearGradient")
                .attr("id", `grad-${s.ticker}`)
                .attr("x1", "0%").attr("y1", "0%").attr("x2", "100%").attr("y2", "0%");
            grad.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.4);
            grad.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 1);
        });

        g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${innerHeight})`);
        g.append("g").attr("class", "y-axis");
        g.append("g").attr("class", "grid-lines");
        g.append("g").attr("class", "lines-layer");
        g.append("g").attr("class", "markers-layer");
        g.append("line").attr("class", "zero-line").attr("x1", 0).attr("x2", innerWidth).attr("stroke", "#9ca3af").attr("stroke-dasharray", "4 4").attr("opacity", 0.5);

    }, []); // Run once on mount to create SVG structure

    // Update / Animation
    useEffect(() => {
        if (!svgRef.current || series.length === 0) return;

        const svg = d3.select(svgRef.current);
        const g = svg.select("g");

        const width = +svg.attr("width");
        const height = +svg.attr("height");
        const margin = { top: 40, right: 80, bottom: 40, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Flatten data for scales
        const allPoints = series.flatMap(s => s.normalized.map(p => ({ ...p, ticker: s.ticker })));
        if (allPoints.length === 0) return;

        const xExtent = d3.extent(allPoints, d => new Date(d.date)) as [Date, Date];
        const yExtent = d3.extent(allPoints, d => d.value) as [number, number];

        // Pad Y-Axis
        const yMin = Math.min(0, yExtent[0] || 0) - 5;
        const yMax = (yExtent[1] || 0) + 5;

        const xScale = d3.scaleTime().domain(xExtent).range([0, innerWidth]);
        const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);

        // Axes
        g.select<SVGGElement>(".x-axis")
            .transition().duration(750)
            .call(d3.axisBottom(xScale).ticks(5))
            .attr("font-family", "monospace").attr("color", "#6b7280");

        g.select<SVGGElement>(".y-axis")
            .transition().duration(750)
            .call(d3.axisLeft(yScale).tickFormat(d => `${d}%`))
            .attr("font-family", "monospace").attr("color", "#6b7280");

        // Zero Line
        g.select(".zero-line")
            .attr("y1", yScale(0)).attr("y2", yScale(0));

        // Draw Lines
        const lineGen = d3.line<{ date: string; value: number }>()
            .x(d => xScale(new Date(d.date)))
            .y(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        const linesLayer = g.select(".lines-layer");

        // Join
        const paths = linesLayer.selectAll<SVGPathElement, ComparisonSeries>(".line-path")
            .data(series, d => d.ticker);

        // Enter
        const pathsEnter = paths.enter().append("path")
            .attr("class", "line-path")
            .attr("fill", "none")
            .attr("stroke-width", 3)
            .attr("stroke-linecap", "round");

        // Update
        const pathsMerge = pathsEnter.merge(paths)
            .attr("stroke", (d, i) => COLORS[i % COLORS.length])
            .attr("d", d => lineGen(d.normalized) || "");

        // Exit
        paths.exit().remove();

        // Markers (Bubbles at End)
        const markersLayer = g.select(".markers-layer");
        const markers = markersLayer.selectAll<SVGGElement, ComparisonSeries>(".end-marker")
            .data(series, d => d.ticker);

        const markersEnter = markers.enter().append("g").attr("class", "end-marker");
        markersEnter.append("circle").attr("r", 6).attr("stroke", "white").attr("stroke-width", 2);
        markersEnter.append("text")
            .attr("x", 10)
            .attr("dy", "0.32em")
            .attr("font-family", "sans-serif")
            .attr("font-size", "12px")
            .attr("font-weight", "bold");

        const markersMerge = markersEnter.merge(markers);

        markersMerge.select("circle").attr("fill", (d, i) => COLORS[i % COLORS.length]);
        markersMerge.select("text")
            .text(d => `${d.ticker} ${d.returnPct.toFixed(1)}%`)
            .attr("fill", (d, i) => COLORS[i % COLORS.length]);

        // Position Markers at end
        markersMerge.attr("transform", d => {
            const last = d.normalized[d.normalized.length - 1];
            return `translate(${xScale(new Date(last.date))}, ${yScale(last.value)})`;
        });

        markers.exit().remove();

        // --- ANIMATION LOGIC ---
        if (isRacing) {
            // Animate Drawing
            pathsMerge.each(function () {
                const length = this.getTotalLength();
                d3.select(this)
                    .attr("stroke-dasharray", `${length} ${length}`)
                    .attr("stroke-dashoffset", length)
                    .transition()
                    .duration(2500) // 2.5s race
                    .ease(d3.easeLinear)
                    .attr("stroke-dashoffset", 0)
                    .on("end", () => {
                        // Could trigger something per line
                    });
            });

            // Animate Markers following the path
            markersMerge.attr("opacity", 0)
                .transition()
                .delay(2500)
                .duration(300)
                .attr("opacity", 1);

            if (onRaceEnd) setTimeout(onRaceEnd, 2800);
        } else {
            // Static display (full drawn)
            pathsMerge.attr("stroke-dasharray", null).attr("stroke-dashoffset", null);
            markersMerge.attr("opacity", 1);
        }

        // Hover Tooltip Interaction
        const bisect = d3.bisector<{ date: string }, Date>(d => new Date(d.date)).center;

        svg.on("mousemove", (event) => {
            const [mx] = d3.pointer(event, g.node());
            const date = xScale.invert(mx);

            // Find nearest points for all series
            const hits = series.map((s, i) => {
                const idx = bisect(s.normalized, date);
                // clamp index
                const validIdx = Math.max(0, Math.min(s.normalized.length - 1, idx));
                const point = s.normalized[validIdx];
                return {
                    ticker: s.ticker,
                    value: point.value,
                    price: s.data[validIdx].close,
                    color: COLORS[i % COLORS.length]
                };
            }).sort((a, b) => b.value - a.value); // Sort desc by return

            setTooltip({
                visible: true,
                x: mx + margin.left,
                y: d3.pointer(event)[1], // follows Y loosely or fixed? let's stick to mouse
                content: (
                    <div className="bg-white/90 dark:bg-gray-900/90 p-3 rounded-lg border border-gray-100 dark:border-gray-800 shadow-xl backdrop-blur">
                        <div className="text-xs text-gray-400 mb-2 font-mono">{date.toLocaleDateString()}</div>
                        <div className="space-y-1">
                            {hits.map(h => (
                                <div key={h.ticker} className="flex items-center gap-3 text-sm">
                                    <div className="w-2 h-2 rounded-full" style={{ backgroundColor: h.color }} />
                                    <span className="font-bold w-12">{h.ticker}</span>
                                    <span className={`font-mono ${h.value >= 0 ? 'text-green-500' : 'text-red-500'}`}>
                                        {h.value > 0 ? '+' : ''}{h.value.toFixed(1)}%
                                    </span>
                                    <span className="text-gray-400 text-xs ml-auto">${h.price?.toFixed(2)}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                )
            });

            // Draw vertical guide
            g.selectAll(".guide-line").remove();
            g.append("line").attr("class", "guide-line")
                .attr("x1", mx).attr("x2", mx)
                .attr("y1", 0).attr("y2", innerHeight)
                .attr("stroke", "#9ca3af")
                .attr("stroke-dasharray", "4 4")
                .attr("opacity", 0.5);

        }).on("mouseleave", () => {
            setTooltip(null);
            g.selectAll(".guide-line").remove();
        });

    }, [series, isRacing]); // re-run when series or race state changes

    return (
        <div ref={containerRef} className="relative w-full h-[500px]">
            {tooltip && tooltip.visible && (
                <div
                    className="absolute pointer-events-none z-50"
                    style={{
                        left: tooltip.x + 20,
                        top: 20 // Fixed top for stability? Or tooltip.y
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
}

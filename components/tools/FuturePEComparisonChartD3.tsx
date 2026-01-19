"use client";

import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { StockDailyRow } from "@/types";

export type ComparisonScenario = {
    id: string; // unique ID
    ticker: string;
    points: StockDailyRow[];
    color: string;
    markers: { date: Date; pe: number }[];
};

type Props = {
    scenarios: ComparisonScenario[];
    height?: number;
};

export default function FuturePEComparisonChartD3({ scenarios, height = 400 }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode; visible: boolean }>({
        x: 0,
        y: 0,
        content: null,
        visible: false
    });

    // Run Once - Structure
    useEffect(() => {
        if (!containerRef.current) return;
        const container = containerRef.current;
        d3.select(container).selectAll("svg").remove();

        const width = container.clientWidth;
        const margin = { top: 30, right: 80, bottom: 40, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const svg = d3.select(container)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("overflow", "visible");

        const g = svg.append("g")
            .attr("class", "chart-area")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${innerHeight})`);
        g.append("g").attr("class", "y-axis");
        g.append("g").attr("class", "grid");
        g.append("g").attr("class", "lines-layer");
        g.append("g").attr("class", "markers-layer");
        g.append("g").attr("class", "labels-layer");

        g.append("text").attr("class", "title")
            .attr("x", 0).attr("y", -10)
            .attr("font-size", "14px").attr("font-weight", "bold")
            .text("Projected PE Ratio Comparison");

        svgRef.current = svg;

        return () => { svg.remove(); };
    }, [height]);

    // Update Data
    useEffect(() => {
        if (!svgRef.current || !containerRef.current) return;
        if (scenarios.length === 0) {
            // Clear if empty
            svgRef.current.selectAll(".lines-layer path").remove();
            svgRef.current.selectAll(".markers-layer circle").remove();
            svgRef.current.selectAll(".labels-layer text").remove();
            return;
        }

        const width = containerRef.current.clientWidth;
        const margin = { top: 30, right: 80, bottom: 40, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const svg = svgRef.current;
        svg.attr("width", width); // Responsive width update

        const g = svg.select(".chart-area");

        // Flatten data for scales
        const allPoints = scenarios.flatMap(s => s.points);
        if (allPoints.length === 0) return;

        // Scales
        const xExtent = d3.extent(allPoints, d => new Date(d.date)) as [Date, Date];
        // Pad time slightly?
        const xScale = d3.scaleTime().domain(xExtent).range([0, innerWidth]);

        const yExtent = d3.extent(allPoints, d => d.pe_ratio || 0) as [number, number];
        const yMin = Math.max(0, (yExtent[0] || 0) * 0.9);
        const yMax = (yExtent[1] || 0) * 1.1; // Add headroom
        const yScale = d3.scaleLinear().domain([yMin, yMax]).range([innerHeight, 0]);

        // Generators
        const lineGen = d3.line<StockDailyRow>()
            .x(d => xScale(new Date(d.date)))
            .y(d => yScale(d.pe_ratio || 0))
            .curve(d3.curveMonotoneX);

        // TRANSITION
        const t = svg.transition().duration(750) as any;

        // Axes
        g.select<SVGGElement>(".x-axis")
            .transition(t)
            .attr("transform", `translate(0,${innerHeight})`)
            .call(d3.axisBottom(xScale).ticks(5).tickFormat(d => d3.timeFormat("%b %y")(d as Date)));

        g.select<SVGGElement>(".y-axis")
            .transition(t)
            .call(d3.axisLeft(yScale).ticks(5));

        // Grid
        g.select<SVGGElement>(".grid")
            .transition(t)
            .call(d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => ""))
            .attr("stroke-opacity", 0.1)
            .on("start", function () { d3.select(this).select(".domain").remove(); });

        // LINES
        const linesLayer = g.select(".lines-layer");
        const lines = linesLayer.selectAll(".scenario-line")
            .data(scenarios, (d: any) => d.id);

        lines.exit().transition(t).attr("opacity", 0).remove();

        // Enter
        const linesEnter = lines.enter().append("path")
            .attr("class", "scenario-line")
            .attr("fill", "none")
            .attr("stroke-width", 2)
            .attr("opacity", 0);

        // Update
        linesEnter.merge(lines as any)
            .transition(t)
            .attr("d", d => lineGen(d.points))
            .attr("stroke", d => d.color)
            .attr("opacity", 1);


        // MARKERS (Dots at assumption dates)
        const markersLayer = g.select(".markers-layer");
        const markerGroups = markersLayer.selectAll(".scenario-markers")
            .data(scenarios, (d: any) => d.id);

        markerGroups.exit().remove();

        const markerGroupsEnter = markerGroups.enter().append("g")
            .attr("class", "scenario-markers");

        // Merge groups
        const allMarkerGroups = markerGroupsEnter.merge(markerGroups as any);

        // Inside each group, render circles
        allMarkerGroups.each(function (d) {
            const group = d3.select(this);
            const dots = group.selectAll("circle")
                .data(d.markers);

            dots.exit().remove();

            dots.enter().append("circle")
                .attr("r", 4)
                .attr("fill", d.color)
                .attr("stroke", "white")
                .attr("stroke-width", 1.5)
                .merge(dots as any)
                .transition(t)
                .attr("cx", m => xScale(m.date))
                .attr("cy", m => yScale(m.pe));
        });


        // LABELS (End of line)
        const labelsLayer = g.select(".labels-layer");
        const labels = labelsLayer.selectAll(".scenario-label")
            .data(scenarios, (d: any) => d.id);

        labels.exit().remove();

        const labelsEnter = labels.enter().append("text")
            .attr("class", "scenario-label")
            .attr("font-size", "12px")
            .attr("font-weight", "bold")
            .attr("opacity", 0);

        labelsEnter.merge(labels as any)
            .transition(t)
            .attr("x", d => {
                const last = d.points[d.points.length - 1];
                return last ? xScale(new Date(last.date)) + 5 : 0;
            })
            .attr("y", d => {
                const last = d.points[d.points.length - 1];
                return last ? yScale(last.pe_ratio || 0) : 0;
            })
            .text(d => d.ticker)
            .attr("fill", d => d.color)
            .attr("opacity", 1);


        // INTERACTIONS (Hover)
        const bisect = d3.bisector<StockDailyRow, Date>(d => new Date(d.date)).left;

        svg
            .on("mousemove", (event) => {
                const [mx] = d3.pointer(event, g.node());
                const date = xScale.invert(mx);

                // Find values for all scenarios
                const hits = scenarios.map(s => {
                    const idx = bisect(s.points, date);
                    const validIdx = Math.max(0, Math.min(s.points.length - 1, idx));
                    const point = s.points[validIdx];
                    return {
                        ticker: s.ticker,
                        color: s.color,
                        pe: point?.pe_ratio || 0,
                        date: point?.date
                    };
                }).sort((a, b) => b.pe - a.pe);

                // Guide Line
                g.selectAll(".guide-line").remove();
                g.append("line")
                    .attr("class", "guide-line")
                    .attr("x1", mx).attr("x2", mx)
                    .attr("y1", 0).attr("y2", innerHeight)
                    .attr("stroke", "#9ca3af")
                    .attr("stroke-dasharray", "4 4");

                // Tooltip
                const containerRect = containerRef.current?.getBoundingClientRect();
                const [relX, relY] = d3.pointer(event, containerRef.current);

                setTooltip({
                    visible: true,
                    x: relX,
                    y: relY,
                    content: (
                        <div className="bg-white/95 dark:bg-gray-900/95 p-3 rounded-lg border border-gray-100 dark:border-gray-800 shadow-xl backdrop-blur min-w-[150px]">
                            <div className="text-xs text-gray-500 mb-2 font-mono border-b pb-1">
                                {date.toLocaleDateString(undefined, { month: 'short', year: 'numeric' })}
                            </div>
                            <div className="space-y-1">
                                {hits.map(h => (
                                    <div key={h.ticker} className="flex items-center justify-between gap-3 text-sm">
                                        <div className="flex items-center gap-2">
                                            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: h.color }} />
                                            <span className="font-bold">{h.ticker}</span>
                                        </div>
                                        <span className="font-mono font-medium">
                                            {h.pe.toFixed(2)}x
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )
                });
            })
            .on("mouseleave", () => {
                setTooltip(prev => ({ ...prev, visible: false }));
                g.selectAll(".guide-line").remove();
            });

    }, [scenarios, height]);

    return (
        <div ref={containerRef} className="relative w-full">
            {tooltip.visible && (
                <div
                    className="absolute pointer-events-none z-50 text-left"
                    style={{
                        left: tooltip.x + 20,
                        top: 20 // Fixed top usually works better for charts than following Y
                    }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
}

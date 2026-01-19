"use client";

import React, { useRef, useEffect, useState } from "react";
import * as d3 from "d3";
import { StockDailyRow } from "@/types";

type Props = {
    data: StockDailyRow[];
    assumptions: { date: Date; growthRate: number; effectiveGrowthRate?: number }[];
    height?: number;
    className?: string;
    onDragEnd?: (date: Date, newGrowthRate: number) => void;
};

export default function FuturePEChartD3({ data, assumptions, height = 400, className = "", onDragEnd }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);

    // Initialize Chart Structure Once
    useEffect(() => {
        if (!containerRef.current) return;

        const container = containerRef.current;
        // Clean up any existing SVG to be safe (hot reload support)
        d3.select(container).selectAll("svg").remove();

        const width = container.clientWidth;
        const margin = { top: 20, right: 60, bottom: 40, left: 60 };
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

        // Static Elements group structure
        g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${innerHeight})`);
        g.append("g").attr("class", "y-axis-pe");
        g.append("g").attr("class", "y-axis-growth").attr("transform", `translate(${innerWidth},0)`);
        g.append("g").attr("class", "grid");

        // Axis Labels
        g.append("text").attr("class", "label-pe")
            .attr("x", -margin.left + 10).attr("y", -10)
            .attr("fill", "#3b82f6").attr("font-size", "12px").attr("font-weight", "bold")
            .text("PE Ratio");

        g.append("text").attr("class", "label-growth")
            .attr("x", innerWidth + 10).attr("y", -10)
            .attr("fill", "#10b981").attr("font-size", "12px").attr("font-weight", "bold")
            .text("YoY Growth %");

        // Paths
        g.append("path").attr("class", "pe-line")
            .attr("fill", "none")
            .attr("stroke", "#3b82f6")
            .attr("stroke-width", 2);

        g.append("path").attr("class", "growth-line")
            .attr("fill", "none")
            .attr("stroke", "#10b981")
            .attr("stroke-width", 2)
            .style("stroke-dasharray", "4 4");

        g.append("g").attr("class", "growth-points");

        svgRef.current = svg;

        // Cleanup
        return () => {
            svg.remove();
        };
    }, []); // Run once on mount (technically we should re-run if resizing, but effectively once for structure)


    // Update Chart with Data & Transitions
    useEffect(() => {
        if (!svgRef.current || data.length === 0 || !containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const margin = { top: 20, right: 60, bottom: 40, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        const svg = svgRef.current;
        // Update dimensions if needed (responsive)
        svg.attr("width", width).attr("height", height).attr("viewBox", `0 0 ${width} ${height}`);
        const g = svg.select(".chart-area");

        // Scales
        const xExtent = d3.extent(data, d => new Date(d.date)) as [Date, Date];
        const xScale = d3.scaleTime().domain(xExtent).range([0, innerWidth]);

        const peExtent = d3.extent(data, d => d.pe_ratio || 0) as [number, number];
        const y1Scale = d3.scaleLinear()
            .domain([Math.max(0, peExtent[0] * 0.9), peExtent[1] * 1.1])
            .range([innerHeight, 0]);

        const gExtent = d3.extent(assumptions, d => d.effectiveGrowthRate ?? d.growthRate) as [number, number];
        const y2Min = Math.min(0, gExtent[0] || 0);
        const y2Max = Math.max(20, gExtent[1] || 0);
        const y2Scale = d3.scaleLinear()
            .domain([y2Min - 5, y2Max + 5])
            .range([innerHeight, 0]);

        // Generators
        const peLine = d3.line<StockDailyRow>()
            .x(d => xScale(new Date(d.date)))
            .y(d => y1Scale(d.pe_ratio || 0))
            .curve(d3.curveMonotoneX);

        const growthLine = d3.line<typeof assumptions[0]>()
            .x(d => xScale(d.date))
            .y(d => y2Scale(d.effectiveGrowthRate ?? d.growthRate))
            .curve(d3.curveMonotoneX);

        // TRANSITIONS
        const t = svg.transition().duration(750).ease(d3.easeCubicOut);

        // Axes
        const xAxis = d3.axisBottom(xScale).ticks(5).tickFormat(d => d3.timeFormat("%b %y")(d as Date));
        const y1Axis = d3.axisLeft(y1Scale).ticks(5);
        const y2Axis = d3.axisRight(y2Scale).ticks(5).tickFormat(d => `${d}%`);

        g.select<SVGGElement>(".x-axis")
            .attr("transform", `translate(0,${innerHeight})`)
            .call(xAxis)
            .attr("color", "#94a3b8");

        g.select<SVGGElement>(".y-axis-pe")
            .transition(t as any)
            .call(y1Axis)
            .attr("color", "#3b82f6")
            .on("start", function () {
                d3.select(this).select(".domain").remove();
            });

        g.select<SVGGElement>(".y-axis-growth")
            .attr("transform", `translate(${innerWidth},0)`)
            .transition(t as any)
            .call(y2Axis)
            .attr("color", "#10b981")
            .on("start", function () {
                d3.select(this).select(".domain").remove();
            });

        // Grid
        g.select<SVGGElement>(".grid")
            .transition(t as any)
            .call(d3.axisLeft(y1Scale).tickSize(-innerWidth).tickFormat(() => ""))
            .attr("stroke-opacity", 0.1)
            .on("start", function () {
                d3.select(this).select(".domain").remove();
            });

        // Paths
        g.select(".pe-line")
            .datum(data)
            .transition(t as any)
            .attr("d", peLine);

        g.select(".growth-line")
            .datum(assumptions)
            .transition(t as any)
            .attr("d", growthLine);

        // Interactive Points (Growth)
        // Join pattern
        const dragBehavior = d3.drag<SVGCircleElement, typeof assumptions[0]>()
            .on("start", function () {
                d3.select(this).style("cursor", "grabbing").attr("r", 8);
                // Pause transitions on this element if any?
            })
            .on("drag", function (event, d) {
                const newY = event.y;
                const clampedY = Math.max(0, Math.min(innerHeight, newY));

                // Immediate visual update (bypass transition)
                d3.select(this).attr("cy", clampedY);

                // Optional: Update tooltip
                const currentRate = y2Scale.invert(clampedY);
                d3.select(this).select("title").text(`Growth: ${currentRate.toFixed(1)}%`);
            })
            .on("end", function (event, d) {
                d3.select(this).style("cursor", "ns-resize").attr("r", 6);

                const newY = event.y;
                const clampedY = Math.max(0, Math.min(innerHeight, newY));
                const newRate = y2Scale.invert(clampedY);

                if (onDragEnd) {
                    onDragEnd(d.date, newRate);
                }
            });


        const points = g.select(".growth-points").selectAll(".growth-point")
            .data(assumptions, (d: any) => d.date.toISOString());

        points.exit()
            .transition(t as any)
            .attr("r", 0)
            .remove();

        const enterPoints = points.enter()
            .append("circle")
            .attr("class", "growth-point")
            .attr("r", 0) // Start small
            .attr("fill", "#10b981")
            .attr("stroke", "white")
            .attr("stroke-width", 2)
            .style("cursor", "ns-resize")
            .call(dragBehavior as any);

        enterPoints.append("title");

        // Merge and update
        const allPoints = enterPoints.merge(points as any);

        allPoints
            .call(dragBehavior as any) // Re-attach drag behavior to update listeners
            .select("title")
            .text(d => `Growth: ${(d.effectiveGrowthRate ?? d.growthRate).toFixed(1)}%`);

        allPoints.transition(t as any)
            .attr("cx", d => xScale(d.date))
            .attr("cy", d => y2Scale(d.effectiveGrowthRate ?? d.growthRate))
            .attr("r", 6);


        // -----------------------
        // PE Points (Solid Dots)
        // -----------------------
        // We want dots at the same dates as assumptions (Start + Future)
        // Since 'assumptions' covers the future. We need to find the corresponding PE for them.
        // We can look up in 'data' or derive if we knew price. 
        // Simple heuristic: Find the data point closest to the assumption date.

        // We also likely want the "Start" point (first point of data).
        const markerDates = data.length > 0 ? [data[0].date, ...assumptions.map(a => a.date.toISOString().split('T')[0])] : [];
        const markerPoints = data.filter(d => markerDates.includes(d.date));

        // Group
        let pePointsG = g.select<SVGGElement>(".pe-points");
        if (pePointsG.empty()) {
            pePointsG = g.append("g").attr("class", "pe-points");
        }

        const peDots = pePointsG.selectAll(".pe-dot")
            .data(markerPoints, (d: any) => d.date);

        peDots.exit()
            .transition(t as any)
            .attr("r", 0)
            .remove();

        const enterPeDots = peDots.enter()
            .append("circle")
            .attr("class", "pe-dot")
            .attr("r", 0)
            .attr("fill", "#3b82f6") // Blue
            .attr("stroke", "white")
            .attr("stroke-width", 2);

        enterPeDots.append("title");

        const allPeDots = enterPeDots.merge(peDots as any);

        allPeDots
            .on("mouseover", function (event, d) {
                const isFuture = new Date(d.date) > new Date();
                const peLabel = isFuture ? "Est. PE" : "PE";
                const dateStr = new Date(d.date).toLocaleDateString(undefined, { month: 'short', year: 'numeric' });

                // Get container bounds for relative positioning
                const [x, y] = d3.pointer(event, containerRef.current);

                setTooltip({
                    visible: true,
                    x: x,
                    y: y,
                    content: (
                        <div>
                            <div className="font-bold mb-1">{dateStr}</div>
                            <div className="text-blue-600 font-semibold">{peLabel}: {(d.pe_ratio || 0).toFixed(2)}x</div>
                            <div className="text-gray-500">Implied EPS: ${(d.trailing_eps_4q || 0).toFixed(2)}</div>
                        </div>
                    )
                });

                d3.select(this).attr("r", 7).attr("fill", "#2563eb");
            })
            .on("mouseout", function () {
                setTooltip(prev => ({ ...prev, visible: false }));
                d3.select(this).attr("r", 5).attr("fill", "#3b82f6");
            });

        allPeDots.transition(t as any)
            .attr("cx", d => xScale(new Date(d.date)))
            .attr("cy", d => y1Scale(d.pe_ratio || 0))
            .attr("r", 5);

    }, [data, assumptions, height, onDragEnd]);

    const [tooltip, setTooltip] = useState<{ x: number; y: number; content: React.ReactNode; visible: boolean }>({
        x: 0,
        y: 0,
        content: null,
        visible: false
    });

    return (
        <div ref={containerRef} className={`relative ${className}`}>
            {tooltip.visible && (
                <div
                    className="absolute bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg p-2 rounded text-xs pointer-events-none z-50 whitespace-pre-line"
                    style={{ left: tooltip.x + 10, top: tooltip.y - 10 }}
                >
                    {tooltip.content}
                </div>
            )}
        </div>
    );
}

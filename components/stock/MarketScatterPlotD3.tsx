"use client";

import React, { useEffect, useRef, useMemo, useState } from "react";
import * as d3 from "d3";
import { StockReturnSummaryRow } from "@/types";
import { useRouter } from "next/navigation";

interface MarketScatterPlotD3Props {
    data: StockReturnSummaryRow[];
}

export default function MarketScatterPlotD3({ data }: MarketScatterPlotD3Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const resetZoomRef = useRef<() => void>(() => { });
    const router = useRouter();
    const [tooltip, setTooltip] = useState<{
        visible: boolean;
        x: number;
        y: number;
        content: React.ReactNode;
    } | null>(null);

    // Filter data to ensure we have valid X and Y values
    const validData = useMemo(() => {
        return data.filter(d =>
            d.eps_yoy_growth_avg_last4q_pct !== null &&
            d.current_pe !== null &&
            Number.isFinite(d.eps_yoy_growth_avg_last4q_pct) &&
            Number.isFinite(d.current_pe) &&
            // Filter out extreme outliers for better visualization if needed, 
            // but let's keep them and let zoom handle it for now, 
            // maybe cap PE at some reasonable display mapping if it's crazy high? 
            // For now raw data.
            d.current_pe > 0 // Usually PE is positive for scatter, or we can allow negative. Let's filter > 0 for standard PE analysis often.
        );
    }, [data]);

    useEffect(() => {
        if (!containerRef.current || validData.length === 0) return;

        // cleanup
        d3.select(containerRef.current).selectAll("*").remove();

        const margin = { top: 40, right: 40, bottom: 60, left: 60 };
        const width = containerRef.current.clientWidth - margin.left - margin.right;
        const height = 500 - margin.top - margin.bottom;

        const svg = d3.select(containerRef.current)
            .append("svg")
            .attr("width", width + margin.left + margin.right)
            .attr("height", height + margin.top + margin.bottom)
            .append("g")
            .attr("transform", `translate(${margin.left},${margin.top})`);

        // --- Clip Path ---
        const clipId = "scatter-clip";
        svg.append("defs").append("clipPath")
            .attr("id", clipId)
            .append("rect")
            .attr("width", width)
            .attr("height", height);

        // Scales
        // X: EPS Growth
        const xExtent = d3.extent(validData, d => d.eps_yoy_growth_avg_last4q_pct as number) as [number, number];
        const xScale = d3.scaleLinear()
            .domain([Math.min(-50, xExtent[0]), Math.max(50, xExtent[1])])
            .range([0, width])
            .nice();

        // Y: Current PE
        const yExtent = d3.extent(validData, d => d.current_pe as number) as [number, number];
        const yScale = d3.scaleLinear()
            .domain([0, Math.max(50, yExtent[1])])
            .range([height, 0])
            .nice();

        // Helpers
        const isMobile = width < 500;
        const makeXGridlines = (scale: d3.ScaleLinear<number, number>) => d3.axisBottom(scale).ticks(isMobile ? 5 : 10);
        const makeYGridlines = (scale: d3.ScaleLinear<number, number>) => d3.axisLeft(scale).ticks(10);
        const makeXAxis = (scale: d3.ScaleLinear<number, number>) => d3.axisBottom(scale).ticks(isMobile ? 5 : 10).tickFormat(d => `${d}%`);
        const makeYAxis = (scale: d3.ScaleLinear<number, number>) => d3.axisLeft(scale).tickFormat(d => `${d}x`);

        // Gridlines
        const gXGrid = svg.append("g")
            .attr("class", "x-grid opacity-10 dark:opacity-20")
            .attr("transform", `translate(0,${height})`)
            .call(makeXGridlines(xScale)
                .tickSize(-height)
                .tickFormat(() => "")
            )
            .style("stroke-dasharray", "3,3");

        const gYGrid = svg.append("g")
            .attr("class", "y-grid opacity-10 dark:opacity-20")
            .call(makeYGridlines(yScale)
                .tickSize(-width)
                .tickFormat(() => "")
            )
            .style("stroke-dasharray", "3,3");

        // Axis
        const gXAxis = svg.append("g")
            .attr("class", "x-axis text-gray-500 dark:text-gray-400 font-mono text-xs")
            .attr("transform", `translate(0,${height})`)
            .call(makeXAxis(xScale));

        const gYAxis = svg.append("g")
            .attr("class", "y-axis text-gray-500 dark:text-gray-400 font-mono text-xs")
            .call(makeYAxis(yScale));

        // Labels
        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("x", width / 2)
            .attr("y", height + 40)
            .attr("class", "fill-gray-600 dark:fill-gray-300 text-sm font-semibold")
            .text("EPS Growth (1Y)");

        svg.append("text")
            .attr("text-anchor", "middle")
            .attr("transform", "rotate(-90)")
            .attr("y", -45)
            .attr("x", -height / 2)
            .attr("class", "fill-gray-600 dark:fill-gray-300 text-sm font-semibold")
            .text("Current PE Ratio");

        // Quadrant Label (Static)
        svg.append("text")
            .attr("x", width - 10)
            .attr("y", height - 10)
            .attr("text-anchor", "end")
            .attr("class", "fill-green-500/20 text-4xl font-black uppercase pointer-events-none select-none")
            .text("Value & Growth");

        // Scatter Points Group (Clipped)
        const pointsG = svg.append("g")
            .attr("clip-path", `url(#${clipId})`);

        const circles = pointsG.selectAll("circle")
            .data(validData)
            .enter()
            .append("circle")
            .attr("cx", d => xScale(d.eps_yoy_growth_avg_last4q_pct as number))
            .attr("cy", d => yScale(d.current_pe as number))
            .attr("r", 6)
            .attr("class", "cursor-pointer transition-colors duration-200") // Removed transition-all to allow smooth zoom
            .attr("fill", "#6366f1") // Indigo-500
            .attr("fill-opacity", 0.7)
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1.5);

        // Tooltip Interactions
        circles
            .on("mouseover", (event, d) => {
                d3.select(event.currentTarget).attr("r", 10).attr("fill-opacity", 1);
                const rect = containerRef.current?.getBoundingClientRect();
                if (rect) {
                    setTooltip({
                        visible: true,
                        x: event.clientX - rect.left,
                        y: event.clientY - rect.top,
                        content: (
                            <div className="flex flex-col gap-1">
                                <span className="font-bold text-lg">{d.ticker}</span>
                                <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-xs">
                                    <span className="text-gray-400">Price:</span>
                                    <span className="font-mono text-right">${d.current_close.toFixed(2)}</span>
                                    <span className="text-gray-400">PE Ratio:</span>
                                    <span className="font-mono text-right font-semibold text-indigo-400">{d.current_pe?.toFixed(1)}x</span>
                                    <span className="text-gray-400">EPS Growth:</span>
                                    <span className={`font-mono text-right font-semibold ${(d.eps_yoy_growth_avg_last4q_pct || 0) > 0 ? "text-green-400" : "text-red-400"}`}>
                                        {(d.eps_yoy_growth_avg_last4q_pct || 0) > 0 ? "+" : ""}{d.eps_yoy_growth_avg_last4q_pct?.toFixed(1)}%
                                    </span>
                                </div>
                            </div>
                        )
                    });
                }
            })
            .on("mouseout", (event) => {
                d3.select(event.currentTarget).attr("r", 6).attr("fill-opacity", 0.7);
                setTooltip(null);
            })
            .on("click", (event, d) => {
                router.push(`/stock/${d.ticker}`);
            });

        // Zoom Behavior
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 10])
            .extent([[0, 0], [width, height]])
            .on("zoom", (event) => {
                const newXScale = event.transform.rescaleX(xScale);
                const newYScale = event.transform.rescaleY(yScale);

                // Update Axes
                gXAxis.call(makeXAxis(newXScale));
                gYAxis.call(makeYAxis(newYScale));

                // Update Gridlines
                gXGrid.call(makeXGridlines(newXScale).tickSize(-height).tickFormat(() => ""));
                gYGrid.call(makeYGridlines(newYScale).tickSize(-width).tickFormat(() => ""));

                // Update Circles
                circles
                    .attr("cx", (d: any) => newXScale(d.eps_yoy_growth_avg_last4q_pct))
                    .attr("cy", (d: any) => newYScale(d.current_pe));
            });

        // Attach Zoom to a transparent rect catching events
        // (Better than attaching to SVG root because it handles margin offset better)
        const zoomRect = svg.append("rect")
            .attr("width", width)
            .attr("height", height)
            .style("fill", "none")
            .style("pointer-events", "all")
            .lower(); // Send to back so circles can still take mouseover?
        // Actually, if we want circles to be clickable, they need to be above interact rect.
        // But zoomRect captures drags on empty space.

        // Strategy: Attach zoom to the `svg` selection (root), but we are in a group `g` with margins.
        // It's often easiest to attach zoom to the parent SVG DOM node.
        const svgNode = d3.select(containerRef.current).select("svg");
        svgNode.call(zoom as any);

        // Expose Reset
        resetZoomRef.current = () => {
            svgNode.transition().duration(750).call(zoom.transform as any, d3.zoomIdentity);
        };

    }, [validData, router]);

    return (
        <div className="w-full bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 relative">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                    Market Valuation Map
                </h2>
                <div className="flex gap-4 items-center">
                    <button
                        onClick={() => resetZoomRef.current()}
                        className="text-xs px-3 py-1 bg-gray-100 hover:bg-gray-200 dark:bg-gray-800 dark:hover:bg-gray-700 rounded transition-colors"
                    >
                        Reset Zoom
                    </button>
                    <div className="text-xs text-gray-500 flex gap-4">
                        <div className="flex items-center gap-1">
                            <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                            <span>Individual Stock</span>
                        </div>
                    </div>
                </div>
            </div>

            <div ref={containerRef} className="w-full h-[500px] relative overflow-visible">
                {/* Tooltip Overlay */}
                {tooltip && tooltip.visible && (
                    <div
                        className="absolute bg-gray-900/95 backdrop-blur-sm border border-gray-700 text-white text-sm rounded-lg p-3 shadow-xl pointer-events-none z-[120]"
                        style={{
                            left: tooltip.x,
                            top: tooltip.y,
                            transform: "translate(-50%, -100%)",
                            marginTop: "-12px",
                            minWidth: "180px"
                        }}
                    >
                        {tooltip.content}
                        {/* Arrow */}
                        <div className="absolute top-full left-1/2 -translate-x-1/2 border-6 border-transparent border-t-gray-900/95"></div>
                    </div>
                )}
            </div>
            <p className="text-xs text-gray-400 mt-2 text-center">
                X-Axis: 1-Year EPS Growth • Y-Axis: Current PE Ratio • Size: 6px
            </p>
        </div>
    );
}

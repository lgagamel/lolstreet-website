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

        // Scales
        // X: EPS Growth
        const xExtent = d3.extent(validData, d => d.eps_yoy_growth_avg_last4q_pct as number) as [number, number];
        const xScale = d3.scaleLinear()
            .domain([Math.min(-50, xExtent[0]), Math.max(50, xExtent[1])]) // Ensure some baseline range
            .range([0, width])
            .nice();

        // Y: Current PE
        const yExtent = d3.extent(validData, d => d.current_pe as number) as [number, number];
        const yScale = d3.scaleLinear()
            .domain([0, Math.max(50, yExtent[1])]) // Ensure baseline
            .range([height, 0])
            .nice();

        // Gridlines
        const makeXGridlines = () => d3.axisBottom(xScale).ticks(10);
        const makeYGridlines = () => d3.axisLeft(yScale).ticks(10);

        svg.append("g")
            .attr("class", "grid opacity-10 dark:opacity-20")
            .attr("transform", `translate(0,${height})`)
            .call(makeXGridlines()
                .tickSize(-height)
                .tickFormat(() => "")
            )
            .style("stroke-dasharray", "3,3");

        svg.append("g")
            .attr("class", "grid opacity-10 dark:opacity-20")
            .call(makeYGridlines()
                .tickSize(-width)
                .tickFormat(() => "")
            )
            .style("stroke-dasharray", "3,3");

        // Axis
        const xAxis = d3.axisBottom(xScale)
            .tickFormat(d => `${d}%`);

        const yAxis = d3.axisLeft(yScale)
            .tickFormat(d => `${d}x`);

        svg.append("g")
            .attr("transform", `translate(0,${height})`)
            .attr("class", "text-gray-500 dark:text-gray-400 font-mono text-xs")
            .call(xAxis);

        svg.append("g")
            .attr("class", "text-gray-500 dark:text-gray-400 font-mono text-xs")
            .call(yAxis);

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

        // Quadrant Labels (Optional but helpful "Wow" factor)
        // High Growth, Low PE (Bottom Right) -> GARP / Undervalued?
        svg.append("text")
            .attr("x", width - 10)
            .attr("y", height - 10)
            .attr("text-anchor", "end")
            .attr("class", "fill-green-500/20 text-4xl font-black uppercase pointer-events-none select-none")
            .text("Value & Growth");

        // Scatter Points
        const circles = svg.selectAll("circle")
            .data(validData)
            .enter()
            .append("circle")
            .attr("cx", d => xScale(d.eps_yoy_growth_avg_last4q_pct as number))
            .attr("cy", d => yScale(d.current_pe as number))
            .attr("r", 6)
            .attr("class", "cursor-pointer transition-all duration-300 hover:r-8")
            .attr("fill", d => {
                const growth = d.eps_yoy_growth_avg_last4q_pct || 0;
                // Color scale based on growth? Or just a nice constant?
                // Let's use a dynamic color: High Growth + Low PE = Green, Low Growth + High PE = Red
                // Simple version: just use a nice brand color
                return "#6366f1"; // Indigo-500
            })
            .attr("fill-opacity", 0.7)
            .attr("stroke", "#ffffff")
            .attr("stroke-width", 1.5);

        // Interactions
        circles
            .on("mouseover", (event, d) => {
                d3.select(event.currentTarget)
                    .transition().duration(200)
                    .attr("r", 10)
                    .attr("fill-opacity", 1);

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
                                <span className="text-[10px] text-gray-500 mt-1 italic">Click for details</span>
                            </div>
                        )
                    });
                }
            })
            .on("mouseout", (event) => {
                d3.select(event.currentTarget)
                    .transition().duration(200)
                    .attr("r", 6)
                    .attr("fill-opacity", 0.7);
                setTooltip(null);
            })
            .on("click", (event, d) => {
                router.push(`/stock/${d.ticker}`);
            });

        // Zoom/Pan
        const zoom = d3.zoom<SVGSVGElement, unknown>()
            .scaleExtent([0.5, 5])
            .extent([[0, 0], [width, height]])
            .on("zoom", (event) => {
                const newXScale = event.transform.rescaleX(xScale);
                const newYScale = event.transform.rescaleY(yScale);

                // Update axes
                svg.select<SVGGElement>(".grid").call(makeXGridlines().scale(newXScale).tickSize(-height).tickFormat(() => "")); // Update X grid if needed, complex with selection. 
                // Simpler zoom for scatter: just update positions and axes

                (svg.select(".text-gray-500.dark\\:text-gray-400.font-mono.text-xs") as d3.Selection<SVGGElement, unknown, null, undefined>).call(xAxis.scale(newXScale));
                // Note: handling multiple selects properly for axes is key, I used broad selectors above, might need refinement.

                // Let's re-select axes by index or class more carefully if we want zoom.
                // For MVP scatter plot, often basic hover is enough. User didn't strictly ask for zoom, but "Wow" factor.
                // Let's implement standard transform zoom.

                svg.selectAll("circle")
                    .attr("cx", (d: any) => newXScale(d.eps_yoy_growth_avg_last4q_pct))
                    .attr("cy", (d: any) => newYScale(d.current_pe));

                // Update axes (need specific selection)
                // We'll skip complex axis updates for this iteration to avoid visual bugs without finding selectors.
                // Let's just stick to basic interactive plot.
            });

        // svg.call(zoom); // Disable zoom for now to keep it clean and stable unless requested.

    }, [validData, router]);

    return (
        <div className="w-full bg-white dark:bg-gray-900 rounded-xl shadow-sm border border-gray-100 dark:border-gray-800 p-6 relative">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2">
                    <span className="w-2 h-6 bg-indigo-500 rounded-full"></span>
                    Market Valuation Map
                </h2>
                <div className="text-xs text-gray-500 flex gap-4">
                    <div className="flex items-center gap-1">
                        <span className="w-2 h-2 rounded-full bg-indigo-500"></span>
                        <span>Individual Stock</span>
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

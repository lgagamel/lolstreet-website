"use client";

import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

export interface CompoundDataPoint {
    year: number;
    principal: number;
    interest: number;
    total: number;
}

type Props = {
    data: CompoundDataPoint[];
    principalColor?: string;
    interestColor?: string;
    initialItemEmoji?: string;
    initialItemPrice?: number;
    onAnimationUpdate?: (year: number, total: number, principal: number, interest: number) => void;
};

export default function CompoundInterestChartD3({
    data,
    principalColor = "#6366f1", // Indigo
    interestColor = "#22c55e",   // Green
    initialItemEmoji = "💰",
    initialItemPrice = 1,
    onAnimationUpdate
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);

    useEffect(() => {
        if (!containerRef.current) return;

        // Clear previous
        d3.select(containerRef.current).select("svg").remove();

        const width = containerRef.current.clientWidth;
        const height = 400;
        const margin = { top: 20, right: 20, bottom: 40, left: 60 };

        const svg = d3.select(containerRef.current)
            .append("svg")
            .attr("width", width)
            .attr("height", height)
            .attr("viewBox", `0 0 ${width} ${height}`)
            .style("overflow", "visible");

        svgRef.current = svg.node();

        const g = svg.append("g").attr("transform", `translate(${margin.left},${margin.top})`);

        g.append("g").attr("class", "x-axis").attr("transform", `translate(0,${height - margin.top - margin.bottom})`);
        g.append("g").attr("class", "y-axis");
        g.append("defs"); // For gradients
        g.append("g").attr("class", "chart-content");

    }, []);

    useEffect(() => {
        if (!svgRef.current || data.length === 0) return;

        const svg = d3.select(svgRef.current);
        const g = svg.select("g");

        const width = +svg.attr("width");
        const height = +svg.attr("height");
        const margin = { top: 20, right: 20, bottom: 40, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Scales
        const xExtent = d3.extent(data, d => d.year) as [number, number];
        const xScale = d3.scaleLinear().domain(xExtent).range([0, innerWidth]);

        const yMax = d3.max(data, d => d.total) || 0;
        const yScale = d3.scaleLinear().domain([0, yMax]).nice().range([innerHeight, 0]);

        const isMobile = width < 640;
        // Axes
        const xAxis = d3.axisBottom(xScale).ticks(isMobile ? 3 : 5).tickFormat(d => `Year ${d}`);
        const yAxis = d3.axisLeft(yScale).ticks(isMobile ? 4 : 6).tickFormat(d => `$${(d.valueOf() / 1000).toFixed(0)}k`);

        g.select<SVGGElement>(".x-axis").call(xAxis).attr("color", "#9ca3af");
        g.select<SVGGElement>(".y-axis").call(yAxis).attr("color", "#9ca3af");

        // Gradient for area
        const defs = g.select("defs");
        defs.selectAll("#area-gradient-principal").remove();
        defs.selectAll("#area-gradient-interest").remove();

        const gradientPrincipal = defs.append("linearGradient")
            .attr("id", "area-gradient-principal")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
        gradientPrincipal.append("stop").attr("offset", "0%").attr("stop-color", principalColor).attr("stop-opacity", 0.6);
        gradientPrincipal.append("stop").attr("offset", "100%").attr("stop-color", principalColor).attr("stop-opacity", 0.1);

        const gradientInterest = defs.append("linearGradient")
            .attr("id", "area-gradient-interest")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
        gradientInterest.append("stop").attr("offset", "0%").attr("stop-color", interestColor).attr("stop-opacity", 0.6);
        gradientInterest.append("stop").attr("offset", "100%").attr("stop-color", interestColor).attr("stop-opacity", 0.1);

        // Line generator for total value
        const lineTotal = d3.line<CompoundDataPoint>()
            .x(d => xScale(d.year))
            .y(d => yScale(d.total))
            .curve(d3.curveMonotoneX);

        // Area generators
        const areaPrincipal = d3.area<CompoundDataPoint>()
            .x(d => xScale(d.year))
            .y0(innerHeight)
            .y1(d => yScale(d.principal))
            .curve(d3.curveMonotoneX);

        const areaInterest = d3.area<CompoundDataPoint>()
            .x(d => xScale(d.year))
            .y0(d => yScale(d.principal))
            .y1(d => yScale(d.total))
            .curve(d3.curveMonotoneX);

        // Content Layer
        const content = g.select(".chart-content");
        content.selectAll("*").remove();

        // Draw areas (start invisible)
        const areaPrincipalPath = content.append("path")
            .datum(data)
            .attr("fill", "url(#area-gradient-principal)")
            .attr("d", areaPrincipal)
            .attr("opacity", 0);

        const areaInterestPath = content.append("path")
            .datum(data)
            .attr("fill", "url(#area-gradient-interest)")
            .attr("d", areaInterest)
            .attr("opacity", 0);

        // Draw the line
        const path = content.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", interestColor)
            .attr("stroke-width", 3)
            .attr("stroke-linecap", "round")
            .attr("d", lineTotal);

        // Marker group
        const markerGroup = content.append("g").attr("class", "marker-group").attr("opacity", 0);

        // Background circle for better visibility
        markerGroup.append("circle")
            .attr("r", 14)
            .attr("fill", "white")
            .attr("stroke", interestColor)
            .attr("stroke-width", 3);

        // Item emoji
        markerGroup.append("text")
            .attr("class", "marker-emoji")
            .text(initialItemEmoji)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .style("font-size", "18px");

        // Multiplier text (e.g., "5.2×")
        const multiplierText = markerGroup.append("text")
            .attr("class", "marker-multiplier")
            .attr("x", 20)
            .attr("dy", "0.35em")
            .attr("text-anchor", "start")
            .style("font-size", "12px")
            .style("font-weight", "bold")
            .style("fill", interestColor)
            .text("1.0×");

        // --- ANIMATION ---
        const totalLength = path.node()?.getTotalLength() || 0;

        path
            .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
            .attr("stroke-dashoffset", totalLength)
            .transition()
            .delay(500)
            .duration(5000)
            .ease(d3.easeCubicOut)
            .attr("stroke-dashoffset", 0)
            .tween("markerTween", function () {
                return function (t) {
                    const point = path.node()?.getPointAtLength(t * totalLength);
                    if (point) {
                        markerGroup.attr("transform", `translate(${point.x},${point.y})`);

                        // Calculate current position with smooth interpolation for daily updates
                        const exactPosition = t * (data.length - 1);
                        const lowerIndex = Math.floor(exactPosition);
                        const upperIndex = Math.min(lowerIndex + 1, data.length - 1);
                        const fraction = exactPosition - lowerIndex;

                        const lowerData = data[lowerIndex];
                        const upperData = data[upperIndex];

                        // Interpolate values between data points
                        const interpolatedTotal = lowerData.total + (upperData.total - lowerData.total) * fraction;
                        const interpolatedPrincipal = lowerData.principal + (upperData.principal - lowerData.principal) * fraction;
                        const interpolatedInterest = lowerData.interest + (upperData.interest - lowerData.interest) * fraction;

                        // Year with fractional part representing days (0.5 = ~182 days)
                        const yearWithDays = lowerData.year + fraction;

                        // Calculate multiplier
                        const currentMultiplier = interpolatedTotal / initialItemPrice;
                        multiplierText.text(`${currentMultiplier.toFixed(1)}×`);

                        if (onAnimationUpdate && lowerData) {
                            onAnimationUpdate(
                                yearWithDays,
                                interpolatedTotal,
                                interpolatedPrincipal,
                                interpolatedInterest
                            );
                        }
                    }
                    if (t > 0.05) markerGroup.attr("opacity", 1);
                };
            })
            .on("end", () => {
                // Fade in areas after line is done
                areaPrincipalPath.transition().duration(800).attr("opacity", 1);
                areaInterestPath.transition().duration(800).attr("opacity", 1);

                // Ensure final values are displayed
                if (onAnimationUpdate && data.length > 0) {
                    const finalData = data[data.length - 1];
                    onAnimationUpdate(
                        finalData.year,
                        finalData.total,
                        finalData.principal,
                        finalData.interest
                    );
                }
            });

    }, [data, principalColor, interestColor]);

    return <div ref={containerRef} className="relative w-full h-[400px]" />;
}

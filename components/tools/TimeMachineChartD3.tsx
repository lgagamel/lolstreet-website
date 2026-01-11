"use client";

import React, { useRef, useEffect } from "react";
import * as d3 from "d3";

interface DataPoint {
    date: string;
    value: number;
}

type Props = {
    data: DataPoint[];
    productName: string;
    productEmoji?: string;
    initialValue: number;
    currentValue: number;
    color?: string;
};

export default function TimeMachineChartD3({
    data,
    productName,
    productEmoji = "🚀",
    initialValue,
    currentValue,
    color = "#10b981"
}: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<SVGSVGElement | null>(null);

    // Initial SVG structure
    useEffect(() => {
        if (!containerRef.current) return;

        // Clear previous
        d3.select(containerRef.current).select("svg").remove();

        const width = containerRef.current.clientWidth;
        const height = 400;
        const margin = { top: 40, right: 30, bottom: 40, left: 60 };

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
        g.append("g").attr("class", "chart-content"); // Layer for lines

    }, []);

    // Draw & Animate
    useEffect(() => {
        console.log("TimeMachineChartD3: Draw effect triggered", {
            hasSvg: !!svgRef.current,
            dataLen: data.length,
            initialValue
        });

        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        const g = svg.select("g");

        // Handle empty data specifically
        if (data.length === 0) {
            console.warn("TimeMachineChartD3: Data is empty");
            g.selectAll("*").remove();
            g.append("text")
                .attr("x", 150)
                .attr("y", 150)
                .attr("text-anchor", "middle")
                .attr("fill", "#6b7280")
                .text("No chart data available");
            return;
        }

        const width = +svg.attr("width");
        const height = +svg.attr("height");
        const margin = { top: 40, right: 30, bottom: 40, left: 60 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = height - margin.top - margin.bottom;

        // Scales
        const xExtent = d3.extent(data, d => new Date(d.date)) as [Date, Date];
        const xScale = d3.scaleTime().domain(xExtent).range([0, innerWidth]);

        const yMax = d3.max(data, d => d.value) || initialValue;
        const yScale = d3.scaleLinear().domain([0, yMax * 1.1]).range([innerHeight, 0]);

        const isMobile = width < 640;
        // Axes
        const xAxis = d3.axisBottom(xScale).ticks(isMobile ? 3 : 5);
        const yAxis = d3.axisLeft(yScale).ticks(isMobile ? 4 : 8).tickFormat(d => `$${d.valueOf().toLocaleString()}`);

        g.select<SVGGElement>(".x-axis").call(xAxis).attr("color", "#9ca3af").attr("font-family", "monospace");
        g.select<SVGGElement>(".y-axis").call(yAxis).attr("color", "#9ca3af").attr("font-family", "monospace");

        // Gradient Definition (if not exists)
        const defs = g.select("defs");
        defs.selectAll("#area-gradient").remove();
        const gradient = defs.append("linearGradient")
            .attr("id", "area-gradient")
            .attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
        gradient.append("stop").attr("offset", "0%").attr("stop-color", color).attr("stop-opacity", 0.4);
        gradient.append("stop").attr("offset", "100%").attr("stop-color", color).attr("stop-opacity", 0.0);

        // Generators
        const lineVal = d3.line<DataPoint>()
            .x(d => xScale(new Date(d.date)))
            .y(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        const areaVal = d3.area<DataPoint>()
            .x(d => xScale(new Date(d.date)))
            .y0(innerHeight)
            .y1(d => yScale(d.value))
            .curve(d3.curveMonotoneX);

        // Content Layer
        const content = g.select(".chart-content");
        content.selectAll("*").remove(); // Clear for redraw

        // 1. Initial Investment Line (Dashed)
        content.append("line")
            .attr("x1", 0)
            .attr("x2", innerWidth)
            .attr("y1", yScale(initialValue))
            .attr("y2", yScale(initialValue))
            .attr("stroke", "#9ca3af")
            .attr("stroke-dasharray", "4 4")
            .attr("opacity", 0.6);

        content.append("text")
            .attr("x", 10)
            .attr("y", yScale(initialValue) - 5)
            .attr("fill", "#9ca3af")
            .attr("font-size", "12px")
            .text(`Product Cost: $${initialValue.toLocaleString()}`);

        // 2. The Path (Invisible at first for animation)
        const path = content.append("path")
            .datum(data)
            .attr("fill", "none")
            .attr("stroke", color)
            .attr("stroke-width", 4)
            .attr("stroke-linecap", "round")
            .attr("d", lineVal);

        // 3. The Area (Fade in later)
        const areaPath = content.append("path")
            .datum(data)
            .attr("fill", "url(#area-gradient)")
            .attr("d", areaVal)
            .attr("opacity", 0); // Start invisible

        // 4. The Marker (Emoji!)
        const markerGroup = content.append("g").attr("class", "marker-group").attr("opacity", 0);

        // White circle background for emoji legibility
        markerGroup.append("circle")
            .attr("r", 14)
            .attr("fill", "white")
            .attr("stroke", color)
            .attr("stroke-width", 2);

        markerGroup.append("text")
            .text(productEmoji)
            .attr("text-anchor", "middle")
            .attr("dy", "0.35em")
            .style("font-size", "18px");

        // --- ANIMATION ---
        const totalLength = path.node()?.getTotalLength() || 0;

        // Animate Line Drawing
        path
            .attr("stroke-dasharray", `${totalLength} ${totalLength}`)
            .attr("stroke-dashoffset", totalLength)
            .transition()
            .delay(800) // Wait a bit before starting
            .duration(5000) // Even slower animation (was 3500)
            .ease(d3.easeCubicOut)
            .attr("stroke-dashoffset", 0)
            // Animate Marker along the path
            .tween("markerTween", function () {
                return function (t) {
                    const point = path.node()?.getPointAtLength(t * totalLength);
                    if (point) {
                        markerGroup.attr("transform", `translate(${point.x},${point.y})`);
                    }
                    // Fade in marker at start
                    if (t > 0.05) markerGroup.attr("opacity", 1);
                };
            })
            .on("end", () => {
                // Fade in Area after line is done
                areaPath.transition().duration(800).attr("opacity", 1);
            });

    }, [data, productEmoji, initialValue, color]);

    return <div ref={containerRef} className="w-full h-[400px]" />;
}

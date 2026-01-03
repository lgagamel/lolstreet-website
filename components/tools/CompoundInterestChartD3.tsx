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
};

export default function CompoundInterestChartD3({
    data,
    principalColor = "#6366f1", // Indigo
    interestColor = "#22c55e"   // Green
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
        g.append("g").attr("class", "chart-content");

        // Tooltip
        const tooltip = d3.select(containerRef.current)
            .append("div")
            .style("position", "absolute")
            .style("visibility", "hidden")
            .style("background", "rgba(0, 0, 0, 0.8)")
            .style("color", "white")
            .style("padding", "8px")
            .style("border-radius", "4px")
            .style("font-size", "12px")
            .style("pointer-events", "none");

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

        // Stack Data
        const stack = d3.stack<CompoundDataPoint>()
            .keys(["principal", "interest"])
            .order(d3.stackOrderNone)
            .offset(d3.stackOffsetNone);

        const series = stack(data);

        // Colors
        const colorScale = d3.scaleOrdinal<string>()
            .domain(["principal", "interest"])
            .range([principalColor, interestColor]);

        // Area Generator
        const area = d3.area<d3.SeriesPoint<CompoundDataPoint>>()
            .x(d => xScale(d.data.year))
            .y0(d => yScale(d[0]))
            .y1(d => yScale(d[1]))
            .curve(d3.curveMonotoneX);

        // Draw Axes
        const xAxis = d3.axisBottom(xScale).tickFormat(d => `Year ${d}`);
        const yAxis = d3.axisLeft(yScale).tickFormat(d => `$${(d.valueOf() / 1000).toFixed(0)}k`);

        g.select<SVGGElement>(".x-axis").transition().duration(500).call(xAxis);
        g.select<SVGGElement>(".y-axis").transition().duration(500).call(yAxis);

        // Draw Areas
        const content = g.select(".chart-content");

        const layers = content.selectAll(".layer")
            .data(series, (d: any) => d.key);

        layers.enter().append("path")
            .attr("class", "layer")
            .merge(layers as any)
            .transition().duration(750)
            .attr("fill", d => colorScale(d.key))
            .attr("d", area)
            .attr("opacity", 0.8);

        layers.exit().remove();

        // Tooltip Interactivity (simple overlay)
        // ... (can add interaction later if needed, kept simple for now)

    }, [data, principalColor, interestColor]);

    return <div ref={containerRef} className="relative w-full h-[400px]" />;
}

"use client";

import React, { useEffect, useRef } from "react";
import * as d3 from "d3";

type Props = {
    current: number;
    low: number;  // 5th percentile
    mid: number;  // Median
    high: number; // 95th percentile
    width?: number;
    height?: number;
};

export default function PEGaugeD3({ current, low, mid, high, width = 400, height = 250 }: Props) {
    const svgRef = useRef<SVGSVGElement>(null);

    useEffect(() => {
        if (!svgRef.current) return;

        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const margin = { top: 30, right: 30, bottom: 20, left: 30 };
        const w = width - margin.left - margin.right;
        const h = height - margin.top - margin.bottom;

        // Gauge Geometry
        // Semi-circle from -PI/2 to PI/2
        const radius = Math.min(w / 2, h);
        const arcWidth = 40;
        const outerRadius = radius - 10;
        const innerRadius = outerRadius - arcWidth;

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left + w / 2}, ${margin.top + h - 30})`); // Lift up slightly to make room for footnote

        // --- Linear Scale ---
        // Range from Low (5th %ile) to High (95th %ile)
        // Median will be positioned proportionally (not necessarily centered).
        const scale = d3.scaleLinear()
            .domain([low, high])
            .range([-Math.PI / 2, Math.PI / 2])
            .clamp(true);

        // --- Gradient Definition ---
        const defs = svg.append("defs");
        const gradientId = "gauge-gradient";
        const linearGradient = defs.append("linearGradient")
            .attr("id", gradientId)
            .attr("x1", "0%")
            .attr("y1", "0%")
            .attr("x2", "100%")
            .attr("y2", "0%");

        // Colors: Green -> Yellow -> Red
        // Since it's symmetrical, Yellow is always at 50% (Top).
        linearGradient.append("stop").attr("offset", "0%").attr("stop-color", "#22c55e"); // Green
        linearGradient.append("stop").attr("offset", "50%").attr("stop-color", "#eab308"); // Yellow
        linearGradient.append("stop").attr("offset", "100%").attr("stop-color", "#ef4444"); // Red

        // --- Background Arc ---
        const arc = d3.arc()
            .innerRadius(innerRadius)
            .outerRadius(outerRadius)
            .startAngle(-Math.PI / 2)
            .endAngle(Math.PI / 2);

        g.append("path")
            .attr("d", arc as any)
            .attr("fill", `url(#${gradientId})`)
            .attr("stroke", "#e5e7eb")
            .attr("stroke-width", 1);

        // --- Ticks & Labels ---
        // We show ticks for Low, Mid, High
        const tickItems = [
            { val: low, label: "5th %ile", sub: "Low" },
            { val: mid, label: "Median", sub: "Mid" },
            { val: high, label: "95th %ile", sub: "High" }
        ];

        tickItems.forEach((item) => {
            const angle = scale(item.val);

            // Coords
            const tickStartR = outerRadius;
            const tickEndR = outerRadius + 8;
            const labelR = outerRadius + 22;

            const tickX1 = tickStartR * Math.sin(angle);
            const tickY1 = -tickStartR * Math.cos(angle);
            const tickX2 = tickEndR * Math.sin(angle);
            const tickY2 = -tickEndR * Math.cos(angle);

            const labelX = labelR * Math.sin(angle);
            const labelY = -labelR * Math.cos(angle);

            // Tick Line
            g.append("line")
                .attr("x1", tickX1).attr("y1", tickY1)
                .attr("x2", tickX2).attr("y2", tickY2)
                .attr("stroke", "#4b5563")
                .attr("stroke-width", 2);

            // Value Label
            g.append("text")
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("dy", "0em")
                .attr("text-anchor", "middle")
                .attr("fill", "#111827")
                .attr("font-size", "12px")
                .attr("font-weight", "600")
                .text(item.val.toFixed(2));

            // Context Label (Low, Mid, High)
            g.append("text")
                .attr("x", labelX)
                .attr("y", labelY + 12)
                .attr("dy", "0em")
                .attr("text-anchor", "middle")
                .attr("fill", "#6b7280")
                .attr("font-size", "10px")
                .text(item.label);
        });

        // --- Needle ---
        const needleAngle = scale(current);
        const needleLen = innerRadius - 10;
        const needleRadius = 5;

        const needleG = g.append("g")
            .attr("transform", `rotate(${needleAngle * 180 / Math.PI})`);

        needleG.append("path")
            .attr("d", `M 0 ${-needleLen} L ${-needleRadius} 0 L ${needleRadius} 0 Z`)
            .attr("fill", "#1f2937")
            .style("filter", "drop-shadow(0 1px 2px rgb(0 0 0 / 0.3))");

        // Pivot
        g.append("circle")
            .attr("r", 8)
            .attr("fill", "#1f2937")
            .attr("stroke", "white")
            .attr("stroke-width", 2);

        // --- Current Value Display ---
        g.append("text")
            .attr("x", 0)
            .attr("y", 25)
            .attr("text-anchor", "middle")
            .attr("font-size", "24px")
            .attr("font-weight", "bold")
            .attr("fill", "#1f2937")
            .text(current.toFixed(2));

        g.append("text")
            .attr("x", 0)
            .attr("y", 45)
            .attr("text-anchor", "middle")
            .attr("font-size", "12px")
            .attr("fill", "#6b7280")
            .text("Current PE");

        // --- Footnote ---
        g.append("text")
            .attr("x", 0)
            .attr("y", 75) // Lower down
            .attr("text-anchor", "middle")
            .attr("font-size", "10px")
            .attr("fill", "#9ca3af")
            .style("font-style", "italic")
            .text("PE range (Low/High) represents the 5th and 95th percentiles of the last 1 year PE ratio history.");

    }, [current, low, mid, high, width, height]);

    return (
        <svg
            ref={svgRef}
            width={width}
            height={height}
            className="overflow-visible"
        />
    );
}

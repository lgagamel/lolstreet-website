"use client";

import React, { useEffect, useRef, useState } from "react";
import * as d3 from "d3";

type Props = {
    current: number;
    low: number;  // 5th percentile
    mid: number;  // Median
    high: number; // 95th percentile
    width?: number;
    height?: number;
};

export default function PEGaugeD3({ current, low, mid, high, width: initialWidth = 400, height: initialHeight = 250 }: Props) {
    const svgRef = useRef<SVGSVGElement>(null);
    const containerRef = useRef<HTMLDivElement>(null);
    const [dimensions, setDimensions] = useState({ width: initialWidth, height: initialHeight });

    useEffect(() => {
        if (!containerRef.current) return;

        const observer = new ResizeObserver((entries) => {
            if (!entries[0]) return;
            const { width } = entries[0].contentRect;
            // Maintain a reasonable aspect ratio for a gauge
            const newHeight = Math.max(180, Math.min(initialHeight, width * 0.6));
            setDimensions({ width, height: newHeight });
        });

        observer.observe(containerRef.current);
        return () => observer.disconnect();
    }, [initialHeight]);

    useEffect(() => {
        if (!svgRef.current) return;

        const { width, height } = dimensions;
        const svg = d3.select(svgRef.current);
        svg.selectAll("*").remove();

        const margin = { top: 30, right: 30, bottom: 20, left: 30 };
        const w = width - margin.left - margin.right;
        const h = height - margin.top - margin.bottom;

        // Gauge Geometry
        // Semi-circle from -PI/2 to PI/2
        const radius = Math.min(w / 2, h);
        const arcWidth = Math.min(40, w * 0.1); // Scale arc width
        const outerRadius = radius - 10;
        const innerRadius = outerRadius - arcWidth;

        const g = svg.append("g")
            .attr("transform", `translate(${margin.left + w / 2}, ${margin.top + h - 30})`);

        // --- Linear Scale ---
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
        const tickItems = [
            { val: low, label: "5th %ile" },
            { val: mid, label: "Median" },
            { val: high, label: "95th %ile" }
        ];

        tickItems.forEach((item) => {
            const angle = scale(item.val);

            const tickStartR = outerRadius;
            const tickEndR = outerRadius + 8;
            const labelR = outerRadius + 22;

            const tickX1 = tickStartR * Math.sin(angle);
            const tickY1 = -tickStartR * Math.cos(angle);
            const tickX2 = tickEndR * Math.sin(angle);
            const tickY2 = -tickEndR * Math.cos(angle);

            const labelX = labelR * Math.sin(angle);
            const labelY = -labelR * Math.cos(angle);

            g.append("line")
                .attr("x1", tickX1).attr("y1", tickY1)
                .attr("x2", tickX2).attr("y2", tickY2)
                .attr("stroke", "#4b5563")
                .attr("stroke-width", 2);

            // Scale font size based on width
            const fontSize = Math.max(9, Math.min(12, w * 0.03));

            g.append("text")
                .attr("x", labelX)
                .attr("y", labelY)
                .attr("dy", "0em")
                .attr("text-anchor", "middle")
                .attr("fill", "#111827")
                .attr("font-size", `${fontSize}px`)
                .attr("font-weight", "600")
                .text(item.val.toFixed(2));

            g.append("text")
                .attr("x", labelX)
                .attr("y", labelY + fontSize)
                .attr("dy", "0em")
                .attr("text-anchor", "middle")
                .attr("fill", "#6b7280")
                .attr("font-size", `${fontSize - 2}px`)
                .text(item.label);
        });

        // --- Color Scale for Needle ---
        const colorScale = d3.scaleLinear<string>()
            .domain([low, mid, high])
            .range(["#22c55e", "#eab308", "#ef4444"])
            .interpolate(d3.interpolateRgb) // Force RGB interpolation
            .clamp(true);

        const needleColor = colorScale(current);

        // --- Needle ---
        const needleAngle = scale(current);
        const needleLen = innerRadius - 5;
        const needleRadius = Math.max(2, w * 0.01); // Narrower

        const needleG = g.append("g")
            .attr("transform", `rotate(${needleAngle * 180 / Math.PI})`);

        // Sleeker needle (narrow triangle)
        needleG.append("path")
            .attr("d", `M 0 ${-needleLen} L ${-needleRadius} 0 L ${needleRadius} 0 Z`)
            .attr("fill", needleColor)
            .attr("stroke", "#111827") // Add dark stroke for contrast
            .attr("stroke-width", 0.5)
            .style("filter", "drop-shadow(0 2px 3px rgb(0 0 0 / 0.4))");

        // Pivot
        g.append("circle")
            .attr("r", Math.max(5, w * 0.02)) // Larger polished pivot
            .attr("fill", needleColor)
            .attr("stroke", "#f9fafb")
            .attr("stroke-width", 2)
            .style("filter", "drop-shadow(0 1px 2px rgb(0 0 0 / 0.2))");

        // --- Current Value Display ---
        const centerFontSize = Math.max(14, Math.min(22, w * 0.05));
        g.append("text")
            .attr("x", 0)
            .attr("y", 25)
            .attr("text-anchor", "middle")
            .attr("font-size", `${centerFontSize}px`)
            .attr("font-weight", "bold")
            .attr("fill", needleColor)
            .text(current.toFixed(2));

        g.append("text")
            .attr("x", 0)
            .attr("y", 25 + centerFontSize * 0.8)
            .attr("text-anchor", "middle")
            .attr("font-size", `${centerFontSize * 0.5}px`)
            .attr("fill", "#6b7280")
            .text("Current PE");

        // --- Footnote ---
        if (w > 250) {
            g.append("text")
                .attr("x", 0)
                .attr("y", 75)
                .attr("text-anchor", "middle")
                .attr("font-size", `${Math.max(8, w * 0.025)}px`)
                .attr("fill", "#9ca3af")
                .style("font-style", "italic")
                .text("PE range represents the 5th and 95th percentiles of the last 1 year.");
        }

    }, [current, low, mid, high, dimensions]);

    return (
        <div ref={containerRef} className="w-full h-full min-h-[180px] flex justify-center items-center">
            <svg
                ref={svgRef}
                width={dimensions.width}
                height={dimensions.height}
                className="overflow-visible"
            />
        </div>
    );
}

"use client";

import React, { useRef, useEffect, useState, useMemo } from "react";
import * as d3 from "d3";
import type { PEBandModel, PEBandPoint } from "../../lib/charts/peBandModel";

type Props = {
    model: PEBandModel;
    height?: number;
    className?: string;
    onUpdateAssumedPE?: (vals: { low?: number; mid?: number; high?: number }) => void;
    xDomain?: [Date, Date];
    onXDomainChange?: (domain: [Date, Date]) => void;
};

export default function PEChartD3({ model, height = 340, className = "", onUpdateAssumedPE, xDomain, onXDomainChange }: Props) {
    const containerRef = useRef<HTMLDivElement>(null);
    const svgRef = useRef<d3.Selection<SVGSVGElement, unknown, null, undefined> | null>(null);
    const [yDomain, setYDomain] = useState<[number, number] | null>(null);
    const [tooltip, setTooltip] = useState<{
        visible: boolean;
        x: number;
        y: number;
        data?: PEBandPoint;
    }>({ visible: false, x: 0, y: 0 });

    const data = useMemo(() => model.points, [model]);

    useEffect(() => {
        setYDomain([model.yMin, model.yMax]);
    }, [model.yMin, model.yMax]);

    useEffect(() => {
        if (!data.length || !containerRef.current) return;

        const container = containerRef.current;
        const width = container.clientWidth;
        const h = height;
        // Margins for Scrollbars
        const margin = { top: 20, right: 80, left: 10, bottom: 50 };
        const innerWidth = width - margin.left - margin.right;
        const innerHeight = h - margin.top - margin.bottom;

        if (!svgRef.current) {
            const svg = d3.select(container).append("svg").style("overflow", "visible").attr("class", "chart-svg");
            svgRef.current = svg;
            const defs = svg.append("defs");
            const gradientPE = defs.append("linearGradient").attr("id", "gradientPE").attr("x1", "0%").attr("y1", "0%").attr("x2", "0%").attr("y2", "100%");
            gradientPE.append("stop").attr("offset", "0%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0.4);
            gradientPE.append("stop").attr("offset", "100%").attr("stop-color", "#3b82f6").attr("stop-opacity", 0);

            // Clip Path
            defs.append("clipPath").attr("id", "clip-pe").append("rect");

            // Filter
            const filter = defs.append("filter").attr("id", "dropShadow").attr("height", "130%");
            filter.append("feGaussianBlur").attr("in", "SourceAlpha").attr("stdDeviation", 1);
            filter.append("feOffset").attr("dx", 0).attr("dy", 1).attr("result", "offsetblur");
            filter.append("feComponentTransfer").append("feFuncA").attr("type", "linear").attr("slope", 0.3);
            const merge = filter.append("feMerge");
            merge.append("feMergeNode");
            merge.append("feMergeNode").attr("in", "SourceGraphic");

            const mainG = svg.append("g").attr("class", "main-g");
            mainG.append("rect").attr("class", "zoom-capture").attr("fill", "transparent");
            mainG.append("g").attr("class", "grid-lines opacity-10");
            mainG.append("g").attr("class", "data-layer").attr("pointer-events", "none").attr("clip-path", "url(#clip-pe)");
            mainG.append("g").attr("class", "drag-layer");
            mainG.append("g").attr("class", "axis-x");
            mainG.append("g").attr("class", "axis-y");
            mainG.append("g").attr("class", "scrollbars");
        }

        const svg = svgRef.current!;
        svg.attr("width", width).attr("height", h).attr("viewBox", `0 0 ${width} ${h}`);
        svg.select("#clip-pe rect").attr("width", innerWidth).attr("height", innerHeight);
        const mainG = svg.select(".main-g").attr("transform", `translate(${margin.left},${margin.top})`);

        const currentXDomain = xDomain || d3.extent(data, d => new Date(d.date)) as [Date, Date];
        const currentYDomain = yDomain || [model.yMin, model.yMax];

        const xScale = d3.scaleTime().domain(currentXDomain).range([0, innerWidth]);
        const yScale = d3.scaleLinear().domain(currentYDomain).range([innerHeight, 0]);

        const xAxis = d3.axisBottom(xScale).ticks(6).tickSize(0).tickPadding(10);
        const yAxis = d3.axisRight(yScale).ticks(6).tickSize(0).tickPadding(10);

        mainG.select<SVGGElement>(".axis-x").attr("transform", `translate(0,${innerHeight})`).call(xAxis).attr("class", "axis-x text-xs font-mono text-gray-500").select(".domain").remove();
        mainG.select<SVGGElement>(".axis-y").attr("transform", `translate(${innerWidth}, 0)`).call(yAxis).attr("class", "axis-y text-xs font-mono text-gray-500").select(".domain").remove();

        const yAxisGrid = d3.axisLeft(yScale).tickSize(-innerWidth).tickFormat(() => "").ticks(6);
        mainG.select<SVGGElement>(".grid-lines").call(yAxisGrid).style("stroke-dasharray", "4 4").selectAll("line").attr("stroke", "currentColor");
        mainG.select(".grid-lines").select(".domain").remove();

        // Footnote
        mainG.selectAll(".footnote").remove();
        mainG.append("text")
            .attr("class", "footnote")
            .attr("x", 0)
            .attr("y", innerHeight + 40) // Below x-axis
            .style("font-size", "10px")
            .style("fill", "#9ca3af") // gray-400
            .text("PE ratios based on price / interpolated trailing EPS.");

        const lineGenerator = d3.line<PEBandPoint>().defined((d) => d.pe_ratio !== null).curve(d3.curveMonotoneX).x((d) => xScale(new Date(d.date))).y((d) => yScale(d.pe_ratio!));
        const areaGenerator = d3.area<PEBandPoint>().defined((d) => d.pe_ratio !== null).curve(d3.curveMonotoneX).x((d) => xScale(new Date(d.date))).y0(innerHeight).y1((d) => yScale(d.pe_ratio!));

        const dataLayer = mainG.select(".data-layer");
        dataLayer.selectAll("*").remove();
        dataLayer.append("path").datum(data).attr("class", "pe-area").attr("fill", "url(#gradientPE)").attr("d", areaGenerator);
        dataLayer.append("path").datum(data).attr("class", "pe-line").attr("fill", "none").attr("stroke", "#3b82f6").attr("stroke-width", 2.5).attr("d", lineGenerator);

        // Draggable Lines
        const dragLayer = mainG.select(".drag-layer");
        const { low, mid, high } = model.assumed;
        const dragItems = [
            { key: 'low', val: low, color: "#9ca3af", dash: "4 4" },
            { key: 'mid', val: mid, color: "#f59e0b", dash: "" },
            { key: 'high', val: high, color: "#9ca3af", dash: "4 4" }
        ].filter(d => d.val !== null) as { key: 'low' | 'mid' | 'high', val: number, color: string, dash: string }[];

        const groups = dragLayer.selectAll<SVGGElement, typeof dragItems[0]>(".drag-group").data(dragItems, d => d.key);
        const groupsEnter = groups.enter().append("g").attr("class", "drag-group").style("cursor", "row-resize");
        groupsEnter.append("line").attr("stroke-width", 1.5);
        groupsEnter.append("rect").attr("fill", "transparent").attr("height", 20).attr("y", -10);
        const groupsUpdate = groups.merge(groupsEnter);
        groupsUpdate.attr("transform", d => `translate(0, ${yScale(d.val)})`);
        groupsUpdate.select("line").attr("x1", 0).attr("x2", innerWidth).attr("stroke", d => d.color).attr("stroke-dasharray", d => d.dash);
        groupsUpdate.select("rect").attr("width", innerWidth).attr("x", 0);

        groupsUpdate.call(d3.drag<SVGGElement, typeof dragItems[0]>().container(mainG.node() as any).on("start", function () { d3.select(this).style("cursor", "grabbing"); }).on("drag", function (event, d) {
            const newY = Math.max(0, Math.min(innerHeight, event.y));
            d3.select(this).attr("transform", `translate(0, ${newY})`);
            if (onUpdateAssumedPE) { const newVal = yScale.invert(newY); onUpdateAssumedPE({ [d.key]: newVal }); }
        }).on("end", function () { d3.select(this).style("cursor", "row-resize"); }));
        groups.exit().remove();

        // --- Scrollbar Logic ---
        const scrollG = mainG.select<SVGGElement>(".scrollbars");
        // Do NOT remove * here

        const renderScrollbar = (
            parent: d3.Selection<SVGGElement, unknown, null, undefined>,
            classSelector: string,
            x: number, y: number,
            length: number, thickness: number,
            orientation: 'horizontal' | 'vertical',
            fullDomain: [number, number],
            currentDomain: [number, number],
            onChange: (d: [number, number]) => void
        ) => {
            const isH = orientation === 'horizontal';

            // 1. Enter
            let g = parent.select<SVGGElement>(`.${classSelector}`);
            if (g.empty()) {
                g = parent.append("g").attr("class", classSelector);
                g.append("rect").attr("class", "track").attr("fill", "#f1f5f9");
                const thumbG = g.append("g").attr("class", "thumb-group");
                thumbG.append("rect").attr("class", "thumb").attr("fill", "#cbd5e1").style("cursor", "grab");
                thumbG.append("g").attr("class", "grips").attr("pointer-events", "none");
                thumbG.append("rect").attr("class", "handle-start").attr("fill", "transparent");
                thumbG.append("rect").attr("class", "handle-end").attr("fill", "transparent");
            }

            // 2. Logic
            const barScale = d3.scaleLinear().domain(fullDomain).range([0, length]);
            let startPos = barScale(currentDomain[0]);
            let endPos = barScale(currentDomain[1]);
            startPos = Math.max(0, Math.min(length, startPos));
            endPos = Math.max(0, Math.min(length, endPos));
            let thumbSize = Math.max(20, endPos - startPos);
            if (endPos - startPos < 20) {
                const center = (startPos + endPos) / 2;
                startPos = center - 10;
                if (startPos < 0) startPos = 0;
                if (startPos + 20 > length) startPos = length - 20;
            }

            // 3. Update Attributes
            g.attr("transform", `translate(${x},${y})`);

            g.select(".track")
                .attr("width", isH ? length : thickness)
                .attr("height", isH ? thickness : length)
                .attr("rx", thickness / 2);

            const thumbG = g.select(".thumb-group")
                .attr("transform", isH
                    ? `translate(${startPos}, 0)`
                    : `translate(0, ${startPos})`
                );

            const thumb = thumbG.select(".thumb")
                .attr("width", isH ? thumbSize : thickness)
                .attr("height", isH ? thickness : thumbSize)
                .attr("rx", thickness / 2);

            const gripG = thumbG.select(".grips").html("");
            if (thumbSize > 30) {
                const gripPath = isH
                    ? `M 6,3 L 6,${thickness - 3} M 9,3 L 9,${thickness - 3} M ${thumbSize - 9},3 L ${thumbSize - 9},${thickness - 3} M ${thumbSize - 6},3 L ${thumbSize - 6},${thickness - 3}`
                    : `M 3,6 L ${thickness - 3},6 M 3,9 L ${thickness - 3},9 M 3,${thumbSize - 9} L ${thickness - 3},${thumbSize - 9} M 3,${thumbSize - 6} L ${thickness - 3},${thumbSize - 6}`;
                gripG.append("path").attr("d", gripPath).attr("stroke", "white").attr("stroke-width", 1.5).attr("opacity", 0.8);
            }

            // 4. Update Interaction
            thumb.call((d3.drag<SVGRectElement, unknown>()
                .container(g.node() as any)
                .on("start", function (event) {
                    const p = isH ? event.x : event.y;
                    // @ts-ignore
                    this.__dragOffset = p - startPos;
                    d3.select(this).style("cursor", "grabbing");
                })
                .on("drag", function (event) {
                    const p = isH ? event.x : event.y;
                    // @ts-ignore
                    const offset = this.__dragOffset || 0;
                    let newStart = p - offset;

                    // Pixel Clamping
                    newStart = Math.max(0, Math.min(length - thumbSize, newStart));

                    // Invert
                    let newValStart = barScale.invert(newStart);
                    let newValEnd = barScale.invert(newStart + thumbSize);

                    onChange([newValStart, newValEnd]);
                })
                .on("end", function () { d3.select(this).style("cursor", "grab"); })
            ) as any);

            const handleThickness = 12;
            const updateHandle = (type: 'start' | 'end') => {
                const sel = thumbG.select(type === 'start' ? ".handle-start" : ".handle-end");
                const xLoc = isH
                    ? (type === 'start' ? 0 : thumbSize - handleThickness)
                    : 0;
                const yLoc = isH
                    ? 0
                    : (type === 'start' ? 0 : thumbSize - handleThickness);
                const w = isH ? handleThickness : thickness;
                const h = isH ? thickness : handleThickness;

                sel.attr("x", xLoc).attr("y", yLoc).attr("width", w).attr("height", h)
                    .style("cursor", isH ? "ew-resize" : "ns-resize")
                    .call((d3.drag<SVGRectElement, unknown>()
                        .container(g.node() as any)
                        .on("start", function (event) {
                            const p = isH ? event.x : event.y;
                            const edgePos = type === 'start' ? startPos : endPos;
                            // @ts-ignore
                            this.__dragOffset = p - edgePos;
                        })
                        .on("drag", function (event) {
                            const p = isH ? event.x : event.y;
                            // @ts-ignore
                            const offset = this.__dragOffset || 0;
                            let newEdgePos = p - offset;

                            const minPxGap = 20;

                            if (type === 'start') {
                                newEdgePos = Math.max(0, Math.min(endPos - minPxGap, newEdgePos));
                                const val = barScale.invert(newEdgePos);
                                onChange([val, currentDomain[1]]);
                            } else {
                                newEdgePos = Math.max(startPos + minPxGap, Math.min(length, newEdgePos));
                                const val = barScale.invert(newEdgePos);
                                onChange([currentDomain[0], val]);
                            }
                        })
                    ) as any);
            };
            updateHandle('start');
            updateHandle('end');
        };

        const xExt = d3.extent(data, d => new Date(d.date).getTime()) as [number, number];
        const twoYearsFromNow = new Date().setFullYear(new Date().getFullYear() + 2);
        const fullX: [number, number] = [xExt[0], Math.max(xExt[1], twoYearsFromNow)];
        const fullY: [number, number] = [0, model.yMax * 1.5];

        renderScrollbar(scrollG, "scrollbar-x", 0, innerHeight + 35, innerWidth, 16, 'horizontal', fullX, [currentXDomain[0].getTime(), currentXDomain[1].getTime()],
            (d) => onXDomainChange && onXDomainChange([new Date(d[0]), new Date(d[1])]));

        renderScrollbar(scrollG, "scrollbar-y", innerWidth + 64, 0, innerHeight, 16, 'vertical', [fullY[1], fullY[0]], [currentYDomain[1], currentYDomain[0]],
            (d) => setYDomain([d[1], d[0]]));

        // Disable Zoom (Keep Tooltip)
        const zoomRect = mainG.select<SVGRectElement>(".zoom-capture")
            .attr("width", innerWidth).attr("height", innerHeight).attr("pointer-events", "all")
            .style("cursor", "crosshair")
            .on(".zoom", null);

        const bisect = d3.bisector<PEBandPoint, Date>((d) => new Date(d.date)).center;
        zoomRect.on("mousemove", (event) => {
            const [mx] = d3.pointer(event);
            const date = xScale.invert(mx);
            const index = bisect(data, date);
            const d = data[index];
            if (d) setTooltip({ visible: true, x: mx + margin.left, y: d3.pointer(event)[1] + margin.top, data: d });
        }).on("mouseleave", () => setTooltip(prev => ({ ...prev, visible: false })));

    }, [data, height, model, xDomain, yDomain, onXDomainChange]);

    return (
        <div className={`relative w-full ${className}`} ref={containerRef}>
            {tooltip.visible && tooltip.data && (
                <div className="pointer-events-none absolute z-50 rounded-lg border border-gray-200 bg-white/90 p-3 shadow-lg backdrop-blur-sm dark:border-gray-800 dark:bg-black/90 text-sm" style={{ top: 0, left: 0, transform: `translate(${Math.min(tooltip.x + 15, containerRef.current!.clientWidth - 150)}px, ${tooltip.y}px)` }}>
                    <div className="mb-1 font-mono text-gray-500">{tooltip.data.date}</div>
                    {tooltip.data.pe_ratio !== null && (
                        <div className="flex items-center gap-2">
                            <span className="text-blue-500 font-semibold">PE:</span>
                            <span className="font-mono font-bold">{tooltip.data.pe_ratio.toFixed(2)}</span>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}

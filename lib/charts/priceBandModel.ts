// lib/charts/priceBandModel.ts
import type { StockDailyRow } from "../../types";

export interface PriceBandPoint {
    date: string;
    close: number | null;
    low: number | null;
    mid: number | null;
    high: number | null;
    pe_ratio: number | null;
}

export interface PriceBandModel {
    points: PriceBandPoint[];
    yMin: number; // computed from available values
    yMax: number;
    lastClose: { date: string; close: number } | null;

    // NEW: last date with actual close (used to mark "Today" and shade forecast region)
    splitDate: string | null;
}

function finiteOrNull(v: number | null): number | null {
    if (v === null) return null;
    return Number.isFinite(v) ? v : null;
}

export function buildPriceBandModel(rows: StockDailyRow[]): PriceBandModel {
    const points: PriceBandPoint[] = rows
        .map((r) => ({
            date: r.date,
            close: finiteOrNull(r.close),
            low: finiteOrNull(r.price_est_low),
            mid: finiteOrNull(r.price_est_mid),
            high: finiteOrNull(r.price_est_high),
            pe_ratio: finiteOrNull(r.pe_ratio),
        }))
        .filter((p) => p.date)
        .sort((a, b) => a.date.localeCompare(b.date));

    // y-range from all non-null series values
    const ys: number[] = [];
    for (const p of points) {
        for (const v of [p.close, p.low, p.mid, p.high]) {
            if (v !== null) ys.push(v);
        }
    }

    let yMin = ys.length ? Math.min(...ys) : 0;
    let yMax = ys.length ? Math.max(...ys) : 1;

    // add a little padding so lines aren't glued to edges
    if (yMax > yMin) {
        const pad = (yMax - yMin) * 0.05;
        yMin -= pad;
        yMax += pad;
    } else {
        yMin -= 1;
        yMax += 1;
    }

    // last non-null close
    let lastClose: { date: string; close: number } | null = null;
    for (let i = points.length - 1; i >= 0; i--) {
        const c = points[i].close;
        if (c !== null) {
            lastClose = { date: points[i].date, close: c };
            break;
        }
    }

    // NEW: splitDate = last date with actual close (from sorted points)
    let splitDate: string | null = null;
    for (let i = points.length - 1; i >= 0; i--) {
        const c = points[i].close;
        if (c !== null) {
            splitDate = points[i].date;
            break;
        }
    }

    return { points, yMin, yMax, lastClose, splitDate };
}

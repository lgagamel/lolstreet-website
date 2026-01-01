// lib/charts/peBandModel.ts
import type { StockDailyRow } from "../../types";

export interface PEBandPoint {
    date: string;
    pe_ratio: number | null;
}

export interface PEBandModel {
    points: PEBandPoint[];
    yMin: number;
    yMax: number;
    assumed: {
        low: number | null;
        mid: number | null;
        high: number | null;
    };
}

function finiteOrNull(v: number | null): number | null {
    if (v === null) return null;
    return Number.isFinite(v) ? v : null;
}

export function buildPEBandModel(rows: StockDailyRow[]): PEBandModel {
    const points: PEBandPoint[] = rows
        .map((r) => ({
            date: r.date,
            pe_ratio: finiteOrNull(r.pe_ratio),
        }))
        .filter((p) => p.date);

    // assumed lines: take last non-null value in the file (they are constant)
    const lastNonNull = <K extends keyof StockDailyRow>(key: K): number | null => {
        for (let i = rows.length - 1; i >= 0; i--) {
            const v = rows[i][key] as unknown as number | null;
            const nn = finiteOrNull(v);
            if (nn !== null) return nn;
        }
        return null;
    };

    const assumedLow = lastNonNull("pe_assumed_low");
    const assumedMid = lastNonNull("pe_assumed_mid");
    const assumedHigh = lastNonNull("pe_assumed_high");

    // y-range from actual PE + assumed lines
    const ys: number[] = [];
    for (const p of points) {
        if (p.pe_ratio !== null) ys.push(p.pe_ratio);
    }
    for (const v of [assumedLow, assumedMid, assumedHigh]) {
        if (v !== null) ys.push(v);
    }

    let yMin = ys.length ? Math.min(...ys) : 0;
    let yMax = ys.length ? Math.max(...ys) : 1;

    if (yMax > yMin) {
        const pad = (yMax - yMin) * 0.08; // a bit more padding than price
        yMin = Math.max(0, yMin - pad);   // PE shouldn't go negative
        yMax = yMax + pad;
    } else {
        yMin = Math.max(0, yMin - 1);
        yMax = yMax + 1;
    }

    return {
        points,
        yMin,
        yMax,
        assumed: {
            low: assumedLow,
            mid: assumedMid,
            high: assumedHigh,
        },
    };
}

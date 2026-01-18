"use client";

import { ReactNode } from "react";

interface InfoTooltipProps {
    label: ReactNode;
    children: ReactNode;
    className?: string; // For the outer wrapper if needed
}

export default function InfoTooltip({ label, children, className = "" }: InfoTooltipProps) {
    return (
        <span className={`group relative inline-flex items-center cursor-help ${className}`}>
            {/* Trigger (The Label) */}
            <span className="decoration-dotted underline underline-offset-4 decoration-gray-400/50 hover:decoration-indigo-500 hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">
                {label}
            </span>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-sm rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[100] border-2 border-indigo-400 font-normal">
                <div className="leading-relaxed">
                    {children}
                </div>
                {/* Arrow */}
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-indigo-600"></div>
            </div>
        </span>
    );
}

"use client";

import { ReactNode } from "react";

interface InfoTooltipProps {
    children: ReactNode;
    className?: string;
}

export default function InfoTooltip({ children, className = "" }: InfoTooltipProps) {
    return (
        <div className={`group relative inline-flex items-center ${className}`}>
            <span className="inline-flex items-center justify-center w-4 h-4 text-[10px] text-gray-400 hover:text-indigo-500 transition-colors cursor-help ml-1 flex-shrink-0">
                ❓
            </span>

            {/* Tooltip */}
            <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-3 w-72 p-4 bg-gradient-to-br from-indigo-600 to-purple-600 text-white text-sm rounded-xl shadow-2xl opacity-0 group-hover:opacity-100 transition-all duration-200 pointer-events-none z-[100] border-2 border-indigo-400">
                <div className="leading-relaxed">
                    {children}
                </div>
                <div className="absolute top-full left-1/2 -translate-x-1/2 border-8 border-transparent border-t-indigo-600"></div>
            </div>
        </div>
    );
}

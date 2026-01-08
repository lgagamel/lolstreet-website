import Link from "next/link";

export default function BackToStockList() {
    return (
        <div className="mb-6">
            <Link className="text-sm text-gray-500 hover:text-gray-800 transition-colors" href="/">
                ← Back to list
            </Link>
        </div>
    );
}

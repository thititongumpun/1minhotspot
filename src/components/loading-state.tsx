"use client";

import { Loader2 } from "lucide-react";

export default function LoadingState() {
  return (
    <div
      className="flex items-center justify-center py-12"
      role="status"
      aria-label="Loading news"
    >
      <div className="flex items-center gap-3 text-slate-600">
        <Loader2 className="w-6 h-6 animate-spin" />
        <span className="text-lg">Loading news...</span>
      </div>
    </div>
  );
}

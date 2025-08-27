"use client";

import { Button } from "@/components/ui/button";
import { Tv } from "lucide-react";

interface EmptyStateProps {
  onViewAll: () => void;
}

export default function EmptyState({ onViewAll }: EmptyStateProps) {
  return (
    <div className="text-center py-12">
      <div className="mb-4">
        <Tv className="w-16 h-16 text-slate-400 mx-auto" />
      </div>
      <h3 className="text-xl font-semibold text-slate-700 mb-2">
        No news found
      </h3>
      <p className="text-slate-600 mb-4">
        No news articles available for the selected category
      </p>
      <Button onClick={onViewAll} variant="outline">
        View All News
      </Button>
    </div>
  );
}

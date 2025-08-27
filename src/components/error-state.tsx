"use client";

import { Button } from "@/components/ui/button";
import { AlertCircle } from "lucide-react";

interface ErrorStateProps {
  error: string;
  onRetry: () => void;
}

export default function ErrorState({ error, onRetry }: ErrorStateProps) {
  return (
    <div className="text-center py-12" role="alert">
      <div className="mb-4">
        <AlertCircle className="w-16 h-16 text-red-500 mx-auto" />
      </div>
      <h3 className="text-xl font-semibold text-slate-700 mb-2">
        Oops! Something went wrong
      </h3>
      <p className="text-slate-600 mb-4">{error}</p>
      <Button onClick={onRetry} className="bg-slate-900 hover:bg-slate-800">
        Try Again
      </Button>
    </div>
  );
}

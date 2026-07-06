"use client";

import { Button } from "@/components/ui/button";

export default function StudentError({ reset }: { reset: () => void }) {
  return (
    <div className="flex min-h-[50vh] flex-col items-center justify-center gap-4 px-6 text-center">
      <h2 className="text-xl font-semibold">Could not load this student</h2>
      <p className="text-muted-foreground">
        Please check your connection and try again.
      </p>
      <Button onClick={reset} variant="outline">
        Try again
      </Button>
    </div>
  );
}

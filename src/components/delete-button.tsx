"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";

import { Button } from "@/components/ui/button";

interface DeleteResult {
  status: "idle" | "success" | "error";
  message?: string;
}

/**
 * Small confirm-then-delete button for list rows and detail pages.
 * Pass a pre-bound server action; navigates to `redirectTo` on success.
 */
export function DeleteButton({
  action,
  confirmText,
  redirectTo,
  label = "Delete",
  size = "sm",
}: {
  action: () => Promise<DeleteResult>;
  confirmText: string;
  redirectTo?: string;
  label?: string;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onClick() {
    if (!window.confirm(confirmText)) return;
    startTransition(async () => {
      const result = await action();
      if (result.status === "error") {
        setError(result.message ?? "Failed.");
      } else if (redirectTo) {
        router.push(redirectTo);
      } else {
        router.refresh();
      }
    });
  }

  return (
    <span className="inline-flex items-center gap-2">
      {error && <span className="text-destructive text-xs">{error}</span>}
      <Button
        type="button"
        variant="ghost"
        size={size}
        className="text-destructive hover:text-destructive"
        disabled={pending}
        onClick={onClick}
      >
        {pending ? "Deleting…" : label}
      </Button>
    </span>
  );
}

"use client";

import { useFormStatus } from "react-dom";

// Submit button that disables itself while its form is submitting — prevents
// double-taps creating duplicate rows (e.g. progress photo submissions).
export function SubmitButton({
  children,
  className,
  pendingText,
}: {
  children: React.ReactNode;
  className?: string;
  pendingText?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className={className}>
      {pending && pendingText ? pendingText : children}
    </button>
  );
}

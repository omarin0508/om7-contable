"use client";

import { useFormStatus } from "react-dom";

type GmailSubmitButtonProps = {
  children: string;
  className: string;
  disabled?: boolean;
  pendingLabel?: string;
};

export function GmailSubmitButton({
  children,
  className,
  disabled = false,
  pendingLabel = "Procesando...",
}: GmailSubmitButtonProps) {
  const { pending } = useFormStatus();

  return (
    <button
      aria-disabled={disabled || pending}
      className={className}
      disabled={disabled || pending}
      type="submit"
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

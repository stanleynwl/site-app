"use client";

import { useState } from "react";

// Textarea that grows with its content — an Excel-style cell where Enter
// starts another line inside the same field. Used for claim line descriptions.
export function AutoTextarea({
  name,
  defaultValue = "",
  placeholder,
  className,
}: {
  name: string;
  defaultValue?: string;
  placeholder?: string;
  className?: string;
}) {
  const [value, setValue] = useState(defaultValue);
  return (
    <textarea
      name={name}
      value={value}
      onChange={(e) => setValue(e.target.value)}
      rows={Math.max(1, value.split("\n").length)}
      placeholder={placeholder}
      className={className}
    />
  );
}

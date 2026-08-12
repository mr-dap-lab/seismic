"use client";

import { useId } from "react";

export default function ParameterTooltip({ description }: { description: string }) {
  const tooltipId = useId();

  return (
    <span className="parameter-tooltip" tabIndex={0} aria-describedby={tooltipId}>
      <span aria-hidden="true">?</span>
      <span className="parameter-tooltip-bubble" id={tooltipId} role="tooltip">{description}</span>
    </span>
  );
}

export function ParameterLabel({
  label,
  description,
  symbol,
}: {
  label: string;
  description: string;
  symbol?: string;
}) {
  return (
    <span className="parameter-label">
      <span>{label} {symbol && <i>{symbol}</i>}</span>
      <ParameterTooltip description={description} />
    </span>
  );
}

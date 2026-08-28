"use client";

/**
 * Miniatura do formato de um gráfico.
 *
 * O seletor de tipo mostra o desenho do resultado, não uma lista de nomes
 * técnicos (CLAUDE.md, 11.3) — para quem nunca usou uma ferramenta de BI, ver
 * a forma é mais informativo do que ler "gráfico de área empilhada".
 */

import type { ChartType } from "@/lib/dashboard/types";

interface ChartThumbnailProps {
  type: ChartType;
  color: string;
  className?: string;
}

const VIEW = { width: 40, height: 28 };

export function ChartThumbnail({ type, color, className }: ChartThumbnailProps) {
  return (
    <svg
      viewBox={`0 0 ${VIEW.width} ${VIEW.height}`}
      className={className}
      aria-hidden="true"
      focusable="false"
    >
      <Shape type={type} color={color} />
    </svg>
  );
}

function Shape({ type, color }: { type: ChartType; color: string }) {
  const trilho = "#e1e0d9";

  switch (type) {
    case "bar":
      return (
        <>
          <line x1="4" y1="24" x2="36" y2="24" stroke={trilho} strokeWidth="1.5" />
          <rect x="6" y="10" width="7" height="14" rx="2" fill={color} />
          <rect x="16.5" y="5" width="7" height="19" rx="2" fill={color} />
          <rect x="27" y="14" width="7" height="10" rx="2" fill={color} />
        </>
      );
    case "line":
      return (
        <>
          <line x1="4" y1="24" x2="36" y2="24" stroke={trilho} strokeWidth="1.5" />
          <polyline
            points="6,19 14,12 22,15 30,6 34,9"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case "area":
      return (
        <>
          <line x1="4" y1="24" x2="36" y2="24" stroke={trilho} strokeWidth="1.5" />
          <path d="M6 19 L14 12 L22 15 L30 6 L34 9 L34 24 L6 24 Z" fill={color} opacity="0.2" />
          <polyline
            points="6,19 14,12 22,15 30,6 34,9"
            fill="none"
            stroke={color}
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      );
    case "pie":
      return (
        <>
          <circle cx="20" cy="14" r="9" fill="none" stroke={trilho} strokeWidth="6" />
          {/* Arco parcial: sugere participação no total sem precisar de fatias. */}
          <circle
            cx="20"
            cy="14"
            r="9"
            fill="none"
            stroke={color}
            strokeWidth="6"
            strokeDasharray="34 57"
            transform="rotate(-90 20 14)"
          />
        </>
      );
    case "kpi":
      return (
        <>
          <rect x="7" y="7" width="20" height="7" rx="2" fill={color} />
          <rect x="7" y="17" width="26" height="3" rx="1.5" fill={trilho} />
        </>
      );
    case "table":
      return (
        <>
          <rect x="5" y="6" width="30" height="4" rx="1" fill={color} opacity="0.5" />
          <rect x="5" y="12" width="30" height="3" rx="1" fill={trilho} />
          <rect x="5" y="17" width="30" height="3" rx="1" fill={trilho} />
          <rect x="5" y="22" width="30" height="3" rx="1" fill={trilho} />
        </>
      );
  }
}

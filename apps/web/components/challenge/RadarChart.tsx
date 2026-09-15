"use client"

import { cn } from "@/lib/utils"

interface RadarChartProps {
  data: Array<{ skillId: string; skillName: string; score: number }>
  className?: string
}

export function RadarChart({ data, className }: RadarChartProps) {
  if (!data.length) return null

  const maxScore = 100
  const center = 120
  const radius = 100

  const getPoint = (angle: number, value: number) => {
    const r = (value / maxScore) * radius
    return {
      x: center + r * Math.cos(angle - Math.PI / 2),
      y: center + r * Math.sin(angle - Math.PI / 2)
    }
  }

  const angles = data.map((_, i) => (i / data.length) * 2 * Math.PI)
  const points = data.map((d, i) => getPoint(angles[i], d.score))
  const gridPoints = [0.25, 0.5, 0.75, 1].map(ratio => 
    data.map((_, i) => getPoint(angles[i], maxScore * ratio))
  )

  const polygonPath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`).join(' ') + ' Z'

  return (
    <div className={cn("relative w-64 h-64 mx-auto", className)}>
      <svg viewBox="0 0 240 240" className="w-full h-full">
        {/* Grid polygons */}
        {gridPoints.map((levelPoints, levelIndex) => (
          <polygon
            key={levelIndex}
            points={levelPoints.map(p => `${p.x} ${p.y}`).join(' ')}
            fill="none"
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />
        ))}

        {/* Axis lines */}
        {angles.map((angle, i) => (
          <line
            key={i}
            x1={center}
            y1={center}
            x2={getPoint(angle, maxScore).x}
            y2={getPoint(angle, maxScore).y}
            stroke="hsl(var(--border))"
            strokeWidth="1"
          />
        ))}

        {/* Data polygon */}
        <polygon
          points={points.map(p => `${p.x} ${p.y}`).join(' ')}
          fill="hsl(var(--primary) / 0.1)"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
        />

        {/* Data points */}
        {points.map((point, i) => (
          <circle
            key={i}
            cx={point.x}
            cy={point.y}
            r="4"
            fill="hsl(var(--primary))"
            stroke="hsl(var(--background))"
            strokeWidth="2"
          />
        ))}

        {/* Labels */}
        {data.map((d, i) => {
          const labelPoint = getPoint(angles[i], radius + 20)
          return (
            <text
              key={i}
              x={labelPoint.x}
              y={labelPoint.y}
              textAnchor="middle"
              dominantBaseline="middle"
              className="text-xs font-medium"
            >
              {d.skillName}
            </text>
          )
        })}
      </svg>

      {/* Legend */}
      <div className="mt-4 space-y-1">
        {data.map((d) => (
          <div key={d.skillId} className="flex items-center gap-2 text-sm">
            <div
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: 'hsl(var(--primary))' }}
            />
            <span className="text-muted-foreground">{d.skillName}</span>
            <span className="font-medium ml-auto">{d.score.toFixed(0)}</span>
          </div>
        ))}
      </div>
    </div>
  )
}
"use client"

import type { SkillScore } from "@/lib/api-client"

/**
 * The role's skill radar: one axis per skill of the candidate's role track,
 * the filled shape showing how consistently the candidate's calls were the
 * strongest ones. Hand-rolled inline SVG — no chart dependency — reading the
 * same deterministic rates the API computed. Skills with no observed
 * decisions sit at the center rather than pretending to be zero.
 */

const CENTER = 120
const RADIUS = 78
const RINGS = [0.25, 0.5, 0.75, 1]
const LABEL_RADIUS = RADIUS + 20

function axisPoint(count: number, index: number, radius: number) {
  // First skill at the top, then clockwise.
  const angle = (Math.PI * 2 * index) / count - Math.PI / 2
  return {
    x: CENTER + radius * Math.cos(angle),
    y: CENTER + radius * Math.sin(angle)
  }
}

function polygonPoints(count: number, radiusOf: (index: number) => number): string {
  return Array.from({ length: count }, (_, index) => {
    const point = axisPoint(count, index, radiusOf(index))
    return `${point.x.toFixed(1)},${point.y.toFixed(1)}`
  }).join(" ")
}

export function SkillRadar({ skills }: { skills: SkillScore[] }) {
  const count = skills.length
  if (count < 3) return null

  const valueRadius = (skill: SkillScore) => (skill.count === 0 ? 0 : skill.rate) * RADIUS
  const ringPoints = polygonPoints(count, () => RADIUS)
  const valuePoints = polygonPoints(count, index => valueRadius(skills[index]))

  return (
    <svg
      viewBox="-44 0 328 244"
      className="mx-auto block w-full max-w-md"
      role="img"
      aria-label="Radar chart of the role's skills"
    >
      {RINGS.map(ring => (
        <polygon
          key={ring}
          points={polygonPoints(count, () => RADIUS * ring)}
          className="fill-none stroke-border"
          strokeWidth={1}
        />
      ))}
      {skills.map((skill, index) => {
        const outer = axisPoint(count, index, RADIUS)
        return (
          <line
            key={skill.id}
            x1={CENTER}
            y1={CENTER}
            x2={outer.x}
            y2={outer.y}
            className="stroke-border"
            strokeWidth={1}
          />
        )
      })}
      <polygon
        points={valuePoints}
        className="fill-primary/20 stroke-primary"
        strokeWidth={2}
        strokeLinejoin="round"
      />
      {skills.map((skill, index) => {
        const point = axisPoint(count, index, valueRadius(skill))
        return <circle key={skill.id} cx={point.x} cy={point.y} r={3} className="fill-primary" />
      })}
      {skills.map((skill, index) => {
        const angle = (Math.PI * 2 * index) / count - Math.PI / 2
        const cos = Math.cos(angle)
        const sin = Math.sin(angle)
        const point = axisPoint(count, index, LABEL_RADIUS)
        const anchor = cos > 0.35 ? "start" : cos < -0.35 ? "end" : "middle"
        const baseline = sin < -0.35 ? -4 : sin > 0.35 ? 8 : 4
        return (
          <text
            key={skill.id}
            x={point.x}
            y={point.y + baseline}
            textAnchor={anchor}
            fontSize={11}
            className={skill.count === 0 ? "fill-muted-foreground/60" : "fill-muted-foreground"}
          >
            {skill.shortName}
          </text>
        )
      })}
    </svg>
  )
}
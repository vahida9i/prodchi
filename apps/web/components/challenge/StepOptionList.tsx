"use client"

import { useEffect, useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTranslations } from "@/lib/i18n"
import { Check } from "lucide-react"

interface StepOptionListProps {
  question: {
    text: string
    choices: Array<{ index: number; text: string }>
  }
  onAnswer: (choiceIndex: number) => void
  disabled?: boolean
}

/**
 * Candidate-facing question + choices. The payload arrives already sanitized
 * by the API (index + text only): stage labels, reveals, next pointers and the
 * answer key never reach this component. Selecting is separate from
 * submitting — a stray click cannot commit an irreversible choice.
 */
export function StepOptionList({ question, onAnswer, disabled }: StepOptionListProps) {
  const t = getTranslations()
  const [selected, setSelected] = useState<number | null>(null)

  // New question, clean slate — the previous selection must not carry over.
  useEffect(() => {
    setSelected(null)
  }, [question])

  return (
    <div className="space-y-4">
      <p className="text-base leading-relaxed">{question.text}</p>
      <RadioGroup
        value={selected === null ? undefined : String(selected)}
        onValueChange={(value) => setSelected(Number(value))}
        disabled={disabled}
        className="space-y-2"
      >
        {question.choices.map((choice) => (
          <Label
            key={choice.index}
            htmlFor={`choice-${choice.index}`}
            className={cn(
              "touch-target flex items-start gap-3 rounded-2xl border bg-card p-4 text-right transition-colors hover:bg-muted/50",
              selected === choice.index && "border-primary bg-primary/10 ring-2 ring-primary/15",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            <RadioGroupItem value={String(choice.index)} id={`choice-${choice.index}`} className="sr-only" />
            <span className={cn("mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border text-xs font-bold", selected === choice.index ? "border-primary bg-primary text-primary-foreground" : "border-border bg-background text-muted-foreground")}>
              {selected === choice.index ? <Check size={14} strokeWidth={3} aria-hidden /> : choice.index + 1}
            </span>
            <span className="text-sm leading-7">{choice.text}</span>
          </Label>
        ))}
      </RadioGroup>
      <Button
        className="w-full"
        disabled={disabled || selected === null}
        onClick={() => {
          if (selected !== null) onAnswer(selected)
        }}
      >
        {disabled ? t.session.submitting : t.session.confirmChoice}
      </Button>
    </div>
  )
}

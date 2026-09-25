"use client"

import { useEffect, useState } from "react"
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { getTranslations } from "@/lib/i18n"

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
              "flex items-start gap-3 rounded-lg border p-4 cursor-pointer hover:bg-muted/50 transition-colors",
              selected === choice.index && "border-primary bg-primary/5",
              disabled && "opacity-60 cursor-not-allowed"
            )}
          >
            <RadioGroupItem value={String(choice.index)} id={`choice-${choice.index}`} className="mt-0.5" />
            <span className="text-sm leading-relaxed">{choice.text}</span>
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
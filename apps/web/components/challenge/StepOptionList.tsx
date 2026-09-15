"use client"

import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface StepOptionListProps {
  step: {
    stepIndex: number
    stage: string
    inputType: 'options' | 'freeText'
    context: string
    contextBlocks?: Array<{ type: 'table' | 'screenshot'; data: any }>
    question: string
    options?: Array<{ id: string; text: string }>
  }
  onAnswer: (optionId: string) => void
  onFreeText: (text: string) => void
  disabled?: boolean
}

export function StepOptionList({ step, onAnswer, onFreeText, disabled }: StepOptionListProps) {
  if (step.inputType === 'freeText') {
    return (
      <div className="space-y-4">
        <div className="prose max-w-none">
          <p>{step.context}</p>
        </div>
        {step.contextBlocks && step.contextBlocks.length > 0 && (
          <div className="space-y-4">
            {step.contextBlocks.map((block, index) => (
              <div key={index} className="rounded-lg border bg-muted p-4">
                {block.type === 'table' && (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b">
                          {Object.keys(block.data.columns || {}).map((col, i) => (
                            <th key={i} className="text-left p-2 font-medium">{col}</th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {(block.data.rows || []).map((row: any, ri: number) => (
                          <tr key={ri} className="border-b">
                            {Object.values(row).map((cell, ci: number) => (
                              <td key={ci} className="p-2">{String(cell)}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {block.type === 'screenshot' && (
                  <div className="aspect-video bg-muted flex items-center justify-center">
                    <span className="text-muted-foreground">Screenshot placeholder</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
        <Label htmlFor="free-text-response" className="block font-medium">
          {step.question}
        </Label>
        <textarea
          id="free-text-response"
          className="min-h-[120px] w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
          placeholder="Type your response here..."
          onChange={(e) => onFreeText(e.target.value)}
          disabled={disabled}
        />
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="prose max-w-none">
        <p>{step.context}</p>
      </div>
      {step.contextBlocks && step.contextBlocks.length > 0 && (
        <div className="space-y-4">
          {step.contextBlocks.map((block, index) => (
            <div key={index} className="rounded-lg border bg-muted p-4">
              {block.type === 'table' && (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b">
                        {Object.keys(block.data.columns || {}).map((col, i) => (
                          <th key={i} className="text-left p-2 font-medium">{col}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {(block.data.rows || []).map((row: any, ri: number) => (
                        <tr key={ri} className="border-b">
                          {Object.values(row).map((cell, ci: number) => (
                            <td key={ci} className="p-2">{String(cell)}</td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {block.type === 'screenshot' && (
                <div className="aspect-video bg-muted flex items-center justify-center">
                  <span className="text-muted-foreground">Screenshot placeholder</span>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
      <Label className="block font-medium">{step.question}</Label>
      <RadioGroup onValueChange={onAnswer} disabled={disabled}>
        {step.options?.map((option) => (
          <div key={option.id} className="flex items-start space-x-3">
            <RadioGroupItem value={option.id} id={option.id} className="mt-1" />
            <div className="flex-1 space-y-1">
              <Label htmlFor={option.id} className="font-medium cursor-pointer">
                {option.id}. {option.text}
              </Label>
            </div>
          </div>
        ))}
      </RadioGroup>
    </div>
  )
}
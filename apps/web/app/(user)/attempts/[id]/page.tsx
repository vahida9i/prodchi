"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { StageProgressBar } from "@/components/challenge/StageProgressBar"
import { StepOptionList } from "@/components/challenge/StepOptionList"
import { api } from "@/lib/api-client"
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from "@/components/ui/alert-dialog"

const STAGES = ['FRAME', 'INVESTIGATE', 'DEFINE', 'EXPLORE', 'DECIDE', 'DESIGN', 'VALIDATE']

export default function AttemptPage() {
  const params = useParams()
  const router = useRouter()
  const attemptId = params.id as string
  const [attempt, setAttempt] = useState<any>(null)
  const [currentStep, setCurrentStep] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [answering, setAnswering] = useState(false)
  const [showCompleteDialog, setShowCompleteDialog] = useState(false)
  const [freeText, setFreeText] = useState('')
  const [showResults, setShowResults] = useState(false)
  const [results, setResults] = useState<any>(null)

  useEffect(() => {
    const fetchAttempt = async () => {
      try {
        const data = await api.getAttempt(attemptId)
        setAttempt(data)
        if (data.path && data.path.length > 0) {
          const lastStep = data.path[data.path.length - 1]
        } else if (data.challenge) {
          const steps = data.challenge.applicantSteps
          if (steps.length > 0) {
            setCurrentStep(steps[0])
          }
        }
      } catch (err) {
        console.error('Failed to load attempt:', err)
      } finally {
        setLoading(false)
      }
    }
    fetchAttempt()
  }, [attemptId])

  const handleAnswer = async (optionId: string) => {
    if (!currentStep || answering) return
    setAnswering(true)
    setFreeText('')

    try {
      const response = await api.answerAttempt(attemptId, currentStep.stepIndex, optionId)
      if (response.nextStep) {
        setCurrentStep(response.nextStep)
        setAttempt(prev => prev ? { ...prev, path: [...(prev.path || []), { stepIndex: currentStep.stepIndex, optionChosen: optionId }] } : null)
      } else {
        setShowCompleteDialog(true)
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit answer')
    } finally {
      setAnswering(false)
    }
  }

  const handleFreeTextAnswer = async () => {
    if (!currentStep || answering) return
    setAnswering(true)

    try {
      const response = await api.answerAttempt(attemptId, currentStep.stepIndex, undefined, freeText)
      if (response.nextStep) {
        setCurrentStep(response.nextStep)
        setAttempt(prev => prev ? { ...prev, path: [...(prev.path || []), { stepIndex: currentStep.stepIndex, freeTextResponse: freeText }] } : null)
        setFreeText('')
      } else {
        setShowCompleteDialog(true)
      }
    } catch (err: any) {
      alert(err.message || 'Failed to submit answer')
    } finally {
      setAnswering(false)
    }
  }

  const handleComplete = async () => {
    setAnswering(true)
    try {
      const result = await api.completeAttempt(attemptId)
      setResults(result)
      setShowResults(true)
      setShowCompleteDialog(false)
    } catch (err: any) {
      alert(err.message || 'Failed to complete attempt')
    } finally {
      setAnswering(false)
    }
  }

  const getCompletedStages = (path: any[]) => {
    const stages = new Set<string>()
    path.forEach(p => {
      const step = attempt?.challenge?.applicantSteps?.find((s: any) => s.stepIndex === p.stepIndex)
      if (step) stages.add(step.stage)
    })
    return Array.from(stages)
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    )
  }

  if (!attempt || !currentStep) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Card>
          <CardContent className="py-12 text-center">
            <h2 className="text-xl font-semibold mb-2">Loading attempt...</h2>
          </CardContent>
        </Card>
      </div>
    )
  }

  const path = attempt.path || []
  const currentStage = currentStep.stage
  const completedStages = getCompletedStages(path)

  if (showResults) {
    return (
      <div className="min-h-screen bg-background">
        <header className="border-b">
          <div className="container mx-auto px-4 py-4">
            <h1 className="text-2xl font-bold">Baaten</h1>
          </div>
        </header>

        <main className="container mx-auto px-4 py-8 max-w-3xl">
          <Card>
            <CardHeader>
              <CardTitle>Assessment Complete!</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              {results.leveledUp && (
                <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                  <h3 className="font-semibold text-green-800 mb-2">🎉 Level Up!</h3>
                  <p className="text-green-700">You've reached a new level!</p>
                </div>
              )}

              {results.newBadges && results.newBadges.length > 0 && (
                <div className="space-y-4">
                  <h3 className="font-semibold">New Badges Earned</h3>
                  <div className="flex flex-wrap gap-2">
                    {results.newBadges.map((badge: any) => (
                      <span key={badge.id} className="inline-flex items-center gap-1 bg-primary/10 text-primary px-3 py-1 rounded-full text-sm">
                        {badge.iconRef} {badge.name}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="space-y-4">
                <h3 className="font-semibold">Assessment Feedback</h3>
                {results.assessment?.feedbackText?.positives && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-green-700">Positives</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {results.assessment.feedbackText.positives.map((p: string, i: number) => (
                        <li key={i} className="text-green-800">{p}</li>
                      ))}
                    </ul>
                  </div>
                )}
                {results.assessment?.feedbackText?.negatives && (
                  <div className="space-y-2">
                    <h4 className="text-sm font-medium text-red-700">Areas for Improvement</h4>
                    <ul className="list-disc list-inside space-y-1 text-sm">
                      {results.assessment.feedbackText.negatives.map((n: string, i: number) => (
                        <li key={i} className="text-red-800">{n}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>

              <div className="flex gap-4">
                <Button onClick={() => router.push('/progress')}>View Progress</Button>
                <Button variant="outline" onClick={() => router.push('/home')}>Back to Home</Button>
              </div>
            </CardContent>
          </Card>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b">
        <div className="container mx-auto px-4 py-4">
          <h1 className="text-2xl font-bold">Baaten</h1>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-3xl">
        {/* Progress Bar */}
        <StageProgressBar
          currentStage={currentStage}
          completedStages={completedStages}
          className="mb-6"
        />

        {/* Step Content */}
        <Card>
          <CardHeader>
            <CardTitle>{currentStep.question}</CardTitle>
          </CardHeader>
          <CardContent>
            <StepOptionList
              step={currentStep}
              onAnswer={handleAnswer}
              onFreeText={setFreeText}
              disabled={answering}
            />
            {currentStep.inputType === 'freeText' && (
              <Button onClick={handleFreeTextAnswer} disabled={answering || !freeText.trim()} className="w-full mt-4">
                {answering ? 'Submitting...' : 'Submit Response'}
              </Button>
            )}
          </CardContent>
        </Card>

        {showCompleteDialog && (
          <AlertDialog open={showCompleteDialog} onOpenChange={setShowCompleteDialog}>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Complete Challenge?</AlertDialogTitle>
                <AlertDialogDescription>
                  You've reached the end of this challenge. Submit for AI assessment to receive feedback and skill scores.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel onClick={() => setShowCompleteDialog(false)}>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={handleComplete} disabled={answering}>
                  {answering ? 'Assessing...' : 'Complete & Get Assessment'}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </main>
    </div>
  )
}
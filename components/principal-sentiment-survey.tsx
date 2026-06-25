"use client"

import { useMemo, useState } from "react"
import { ClipboardList, GraduationCap, Wrench, ListOrdered, Sparkles } from "lucide-react"
import { Card } from "@/components/ui/card"
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion"
import {
  PRINCIPAL_SENTIMENT,
  TONE_BADGE,
  TONE_BORDER,
  TONE_CHIP,
  TONE_FILL,
  TONE_MUTED_BG,
  TONE_STROKE,
  averageScore,
  scoreTone,
  type RatedQuestion,
  type ScoreTone,
} from "@/lib/principal-sentiment"
import type { School } from "@/lib/dashboard-data"

interface PrincipalSentimentSurveyProps {
  school: School
}

type Panel = "educational" | "facility" | "priorities"

export function PrincipalSentimentSurvey({ school }: PrincipalSentimentSurveyProps) {
  const [panel, setPanel] = useState<Panel>("educational")
  const survey = PRINCIPAL_SENTIMENT

  const esAvg = useMemo(() => averageScore(survey.educational), [survey.educational])
  const fcAvg = useMemo(() => averageScore(survey.facility), [survey.facility])
  const lowest = useMemo(
    () =>
      [...survey.educational, ...survey.facility].reduce<RatedQuestion | null>((min, q) => {
        const ratio = q.score / q.maxScore
        if (!min || ratio < min.score / min.maxScore) return q
        return min
      }, null),
    [survey.educational, survey.facility],
  )
  const lowestTone = lowest ? scoreTone(lowest.score, lowest.maxScore) : "fair"

  return (
    <Card className="gap-6 overflow-hidden p-0">
      <div className="border-b border-border bg-gradient-to-br from-primary/8 via-card to-status-info/5 px-5 py-6 sm:px-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <ClipboardList className="size-5" aria-hidden="true" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-foreground">Principal Sentiment Survey</h2>
              <p className="mt-0.5 text-sm text-muted-foreground">
                {school.name} &mdash; principal-reported suitability and facility perceptions
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <SummaryGauge label="Educational" value={esAvg} max={5} icon={GraduationCap} />
            <SummaryGauge label="Facility" value={fcAvg} max={5} icon={Wrench} />
          </div>
        </div>

        {lowest && lowest.score < lowest.maxScore && (
          <div
            className={`mt-4 flex items-start gap-2 rounded-lg border px-3 py-2.5 ${TONE_CHIP[lowestTone]}`}
          >
            <Sparkles className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <p className="text-xs leading-relaxed text-foreground">
              <span className="font-semibold">{lowest.category}</span> scored lowest at {lowest.score}/
              {lowest.maxScore} &mdash; a natural focus area for capital planning conversations.
            </p>
          </div>
        )}
      </div>

      <div className="flex flex-col gap-5 px-5 pb-6 sm:px-6">
        <div className="flex flex-wrap gap-2">
          <PanelButton
            active={panel === "educational"}
            onClick={() => setPanel("educational")}
            icon={GraduationCap}
            label="Educational Suitability"
            count={survey.educational.length}
          />
          <PanelButton
            active={panel === "facility"}
            onClick={() => setPanel("facility")}
            icon={Wrench}
            label="Facility Condition"
            count={survey.facility.length}
          />
          <PanelButton
            active={panel === "priorities"}
            onClick={() => setPanel("priorities")}
            icon={ListOrdered}
            label="Improvement Priorities"
            count={survey.priorityRanking.length}
          />
        </div>

        {panel === "educational" && (
          <div className="flex flex-col gap-5">
            <ScoreMosaic questions={survey.educational} />
            {survey.notes.map((note) => (
              <div
                key={note.id}
                className="flex items-start gap-3 rounded-lg border border-dashed border-border bg-muted/30 p-4"
              >
                <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted-foreground/25 text-[10px] font-bold text-foreground">
                  Q{note.number}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-foreground">{note.category}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{note.prompt}</p>
                  <p className="mt-2 text-sm italic text-muted-foreground">{note.response}</p>
                </div>
              </div>
            ))}
          </div>
        )}

        {panel === "facility" && <ScoreMosaic questions={survey.facility} />}

        {panel === "priorities" && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-muted-foreground">
              If improvement resources were limited, the principal would prioritize these categories from highest to
              lowest.
            </p>
            <PriorityLadder ranking={survey.priorityRanking} questions={survey.educational} />
          </div>
        )}
      </div>
    </Card>
  )
}

function SummaryGauge({
  label,
  value,
  max,
  icon: Icon,
}: {
  label: string
  value: number
  max: number
  icon: typeof GraduationCap
}) {
  const pct = value / max
  const tone = scoreTone(value, max)
  const radius = 15.5
  const circumference = 2 * Math.PI * radius
  const dash = pct * circumference

  return (
    <div className={`flex min-w-[9.5rem] items-center gap-3 rounded-xl border bg-card/80 px-3 py-2.5 shadow-sm ${TONE_BORDER[tone]}`}>
      <div className="relative size-12 shrink-0">
        <svg viewBox="0 0 36 36" className="size-12 -rotate-90">
          <circle cx="18" cy="18" r="15.5" fill="none" className="stroke-status-track" strokeWidth="3" />
          <circle
            cx="18"
            cy="18"
            r="15.5"
            fill="none"
            className={TONE_STROKE[tone]}
            strokeWidth="3"
            strokeDasharray={`${dash} ${circumference}`}
            strokeLinecap="round"
          />
        </svg>
        <span className="absolute inset-0 flex items-center justify-center text-xs font-bold tabular-nums text-foreground">
          {value}
        </span>
      </div>
      <div>
        <div className="flex items-center gap-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
          <Icon className="size-3" aria-hidden="true" />
          {label}
        </div>
        <p className="text-sm font-semibold text-foreground">
          {value} / {max}
        </p>
      </div>
    </div>
  )
}

function PanelButton({
  active,
  onClick,
  icon: Icon,
  label,
  count,
}: {
  active: boolean
  onClick: () => void
  icon: typeof GraduationCap
  label: string
  count: number
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium transition-colors ${
        active
          ? "border-primary bg-primary/10 text-primary"
          : "border-border bg-card text-muted-foreground hover:border-primary/40 hover:text-foreground"
      }`}
    >
      <Icon className="size-4" aria-hidden="true" />
      {label}
      <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-semibold tabular-nums">{count}</span>
    </button>
  )
}

function ScoreMosaic({ questions }: { questions: RatedQuestion[] }) {
  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-3">
      {questions.map((q) => (
        <QuestionTile key={q.id} question={q} />
      ))}
    </div>
  )
}

function QuestionTile({ question }: { question: RatedQuestion }) {
  const tone = scoreTone(question.score, question.maxScore)
  const fillPct = (question.score / question.maxScore) * 100

  return (
    <Accordion type="single" collapsible>
      <AccordionItem
        value={question.id}
        className={`overflow-hidden rounded-xl border bg-card ${TONE_BORDER[tone]}`}
      >
        <AccordionTrigger className="px-4 py-3 hover:no-underline [&>svg]:ml-2">
          <div className="flex w-full min-w-0 items-start gap-3 text-left">
            <span
              className={`flex size-8 shrink-0 items-center justify-center rounded-full text-[10px] font-bold ${TONE_BADGE[tone]}`}
            >
              Q{question.number}
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-sm font-medium text-foreground">{question.category}</p>
              <div className="mt-2 flex items-center gap-2">
                <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-status-track">
                  <div className={`h-full rounded-full ${TONE_FILL[tone]}`} style={{ width: `${fillPct}%` }} />
                </div>
                <span className={`shrink-0 rounded-md border px-2 py-0.5 text-xs font-bold tabular-nums ${TONE_CHIP[tone]}`}>
                  {question.score}/{question.maxScore}
                </span>
              </div>
            </div>
          </div>
        </AccordionTrigger>
        <AccordionContent className={`border-t px-4 pb-4 pt-3 ${TONE_MUTED_BG[tone]} ${TONE_BORDER[tone]}`}>
          <p className="text-xs leading-relaxed text-muted-foreground">{question.prompt}</p>
          <ScoreDots score={question.score} max={question.maxScore} tone={tone} className="mt-3" />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

function ScoreDots({
  score,
  max,
  tone,
  className,
}: {
  score: number
  max: number
  tone: ScoreTone
  className?: string
}) {
  return (
    <div className={`flex items-center gap-1.5 ${className ?? ""}`} aria-label={`${score} out of ${max}`}>
      {Array.from({ length: max }, (_, i) => (
        <span
          key={i}
          className={`size-2.5 rounded-full ${i < score ? TONE_FILL[tone] : "bg-status-track"}`}
        />
      ))}
    </div>
  )
}

function PriorityLadder({
  ranking,
  questions,
}: {
  ranking: string[]
  questions: RatedQuestion[]
}) {
  const byCategory = useMemo(
    () => Object.fromEntries(questions.map((q) => [q.category, q])),
    [questions],
  )

  return (
    <div className="flex flex-col gap-2">
      {ranking.map((category, index) => {
        const rank = index + 1
        const widthPct = 100 - (index / ranking.length) * 55
        const q = byCategory[category]
        const tone = q ? scoreTone(q.score, q.maxScore) : "fair"

        return (
          <div key={category} className="group flex items-center gap-3">
            <span
              className={`flex size-7 shrink-0 items-center justify-center rounded-full text-xs font-bold tabular-nums ${
                rank <= 3 ? TONE_BADGE[tone] : "bg-muted text-muted-foreground"
              }`}
            >
              {rank}
            </span>
            <div className="min-w-0 flex-1">
              <div
                className={`relative overflow-hidden rounded-lg border px-3 py-2 transition-colors ${TONE_BORDER[tone]} group-hover:opacity-90`}
                style={{ width: `${widthPct}%`, minWidth: "12rem" }}
              >
                <div className={`absolute inset-y-0 left-0 w-full ${TONE_MUTED_BG[tone]}`} />
                <div className="relative flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium text-foreground">{category}</span>
                  {q && (
                    <span className={`rounded px-1.5 py-0.5 text-[11px] font-semibold tabular-nums ${TONE_CHIP[tone]}`}>
                      {q.score}/{q.maxScore}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

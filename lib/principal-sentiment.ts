export type SentimentSection = "educational" | "facility"

export type ScoreTone = "good" | "fair" | "poor"

export interface RatedQuestion {
  id: string
  number: number
  category: string
  prompt: string
  score: number
  maxScore: number
  section: SentimentSection
}

export interface TextQuestion {
  id: string
  number: number
  category: string
  prompt: string
  response: string
  section: SentimentSection
}

export interface PrincipalSentimentSurvey {
  educational: RatedQuestion[]
  facility: RatedQuestion[]
  priorityRanking: string[]
  notes: TextQuestion[]
}

/** Sample principal survey — scores are illustrative, not uniform. */
export const PRINCIPAL_SENTIMENT: PrincipalSentimentSurvey = {
  educational: [
    {
      id: "q1",
      number: 1,
      category: "Learning Environment",
      prompt:
        "The studios and instructional spaces effectively support the teaching methods and learning experiences expected for today's students.",
      score: 4,
      maxScore: 5,
      section: "educational",
    },
    {
      id: "q2",
      number: 2,
      category: "Educational Program Alignment",
      prompt:
        "The facility adequately supports the educational programs offered at this school, including specialty programs (e.g., STEM, dual language) and services (e.g., SPED, OT/PT).",
      score: 5,
      maxScore: 5,
      section: "educational",
    },
    {
      id: "q3",
      number: 3,
      category: "Flexibility of Spaces",
      prompt:
        "The school's learning spaces can be easily adapted to accommodate different teaching approaches, group sizes, and learning activities.",
      score: 3,
      maxScore: 5,
      section: "educational",
    },
    {
      id: "q4",
      number: 4,
      category: "Collaboration Opportunities",
      prompt:
        "The facility provides sufficient spaces for student collaboration, project-based learning, and small group instruction.",
      score: 4,
      maxScore: 5,
      section: "educational",
    },
    {
      id: "q5",
      number: 5,
      category: "Student Support Services",
      prompt:
        "The facility provides appropriate spaces for special education, intervention services, counseling, and other student support functions.",
      score: 4,
      maxScore: 5,
      section: "educational",
    },
    {
      id: "q6",
      number: 6,
      category: "Safety and Supervision",
      prompt:
        "The layout and organization of the facility allow staff to effectively supervise students and maintain a safe learning environment.",
      score: 5,
      maxScore: 5,
      section: "educational",
    },
    {
      id: "q7",
      number: 7,
      category: "Common Areas and Shared Spaces",
      prompt:
        "Spaces such as the library, cafeteria, gymnasium, and multipurpose areas adequately support student and school needs.",
      score: 2,
      maxScore: 5,
      section: "educational",
    },
    {
      id: "q8",
      number: 8,
      category: "Outdoor Spaces",
      prompt:
        "The school's outdoor spaces, such as play, athletics, and outdoor learning areas adequately support the school's programming and student needs.",
      score: 3,
      maxScore: 5,
      section: "educational",
    },
    {
      id: "q9",
      number: 9,
      category: "Technology Readiness",
      prompt:
        "The facility effectively supports current instructional technology, including connectivity, power access, and digital learning tools.",
      score: 2,
      maxScore: 5,
      section: "educational",
    },
    {
      id: "q10",
      number: 10,
      category: "Staff Workspace and Collaboration",
      prompt:
        "The facility provides adequate workspace and collaboration areas for teachers, administrators, and support staff.",
      score: 3,
      maxScore: 5,
      section: "educational",
    },
    {
      id: "q11",
      number: 11,
      category: "Community / After-Hours Use",
      prompt:
        "The facility adequately supports community programming, after-hours activities, or extended-day use.",
      score: 4,
      maxScore: 5,
      section: "educational",
    },
    {
      id: "q12",
      number: 12,
      category: "Pick up / Drop off",
      prompt: "The arrival, pick up and drop off process works well for our school community.",
      score: 2,
      maxScore: 5,
      section: "educational",
    },
    {
      id: "q13",
      number: 13,
      category: "Overall Educational Suitability",
      prompt:
        "Overall, the facility effectively supports the school's educational vision, instructional goals, and student success.",
      score: 3,
      maxScore: 5,
      section: "educational",
    },
  ],
  facility: [
    {
      id: "q16",
      number: 16,
      category: "HVAC Systems",
      prompt:
        "The heating, ventilation, and air conditioning (HVAC) systems provide reliable operation and maintain comfortable temperatures and air quality throughout the school.",
      score: 2,
      maxScore: 5,
      section: "facility",
    },
    {
      id: "q17",
      number: 17,
      category: "Roofing Systems",
      prompt:
        "The roof and related building envelope components effectively protect the building from water intrusion and weather-related issues.",
      score: 4,
      maxScore: 5,
      section: "facility",
    },
    {
      id: "q18",
      number: 18,
      category: "Plumbing Systems",
      prompt:
        "The plumbing systems, including restrooms, drinking fountains, kitchen facilities, and water infrastructure, operate reliably and meet the needs of students and staff.",
      score: 3,
      maxScore: 5,
      section: "facility",
    },
    {
      id: "q19",
      number: 19,
      category: "Interior Building Condition",
      prompt:
        "The condition of classrooms, corridors, restrooms, and other interior spaces supports a safe, functional, and well-maintained learning environment.",
      score: 3,
      maxScore: 5,
      section: "facility",
    },
    {
      id: "q20",
      number: 20,
      category: "Site and Exterior Condition",
      prompt:
        "The condition of the building exterior, parking areas, sidewalks, playgrounds, athletic facilities, and other site features adequately supports school operations.",
      score: 4,
      maxScore: 5,
      section: "facility",
    },
    {
      id: "q21",
      number: 21,
      category: "Overall Facility Condition",
      prompt:
        "The overall physical condition of the school building effectively supports educational programs and would not require significant capital investment in the near future.",
      score: 3,
      maxScore: 5,
      section: "facility",
    },
  ],
  priorityRanking: [
    "Technology Readiness",
    "Pick up / Drop off",
    "Common Areas and Shared Spaces",
    "Flexibility of Spaces",
    "Outdoor Spaces",
    "Staff Workspace and Collaboration",
    "Overall Educational Suitability",
    "Learning Environment",
    "Collaboration Opportunities",
    "Student Support Services",
    "Community / After-Hours Use",
    "Educational Program Alignment",
    "Safety and Supervision",
  ],
  notes: [
    {
      id: "q14",
      number: 14,
      category: "Program Space Locations",
      prompt: "Identify the location of your key program spaces by assigning each one to a room on the floor plan.",
      response: "No program spaces were assigned to rooms.",
      section: "educational",
    },
  ],
}

export function averageScore(questions: RatedQuestion[]): number {
  if (!questions.length) return 0
  const sum = questions.reduce((s, q) => s + q.score / q.maxScore, 0)
  return Math.round((sum / questions.length) * 50) / 10
}

export function scoreTone(score: number, maxScore: number): ScoreTone {
  const pct = score / maxScore
  if (pct >= 0.8) return "good"
  if (pct >= 0.6) return "fair"
  return "poor"
}

export const TONE_BADGE: Record<ScoreTone, string> = {
  good: "bg-status-good text-white",
  fair: "bg-status-warning text-white",
  poor: "bg-status-critical text-white",
}

export const TONE_BORDER: Record<ScoreTone, string> = {
  good: "border-status-good/30",
  fair: "border-status-warning/30",
  poor: "border-status-critical/30",
}

export const TONE_CHIP: Record<ScoreTone, string> = {
  good: "bg-status-good/15 text-status-good border-status-good/30",
  fair: "bg-status-warning/15 text-status-warning border-status-warning/30",
  poor: "bg-status-critical/15 text-status-critical border-status-critical/30",
}

export const TONE_FILL: Record<ScoreTone, string> = {
  good: "bg-status-good",
  fair: "bg-status-warning",
  poor: "bg-status-critical",
}

export const TONE_STROKE: Record<ScoreTone, string> = {
  good: "stroke-status-good",
  fair: "stroke-status-warning",
  poor: "stroke-status-critical",
}

export const TONE_MUTED_BG: Record<ScoreTone, string> = {
  good: "bg-status-good/10",
  fair: "bg-status-warning/10",
  poor: "bg-status-critical/10",
}

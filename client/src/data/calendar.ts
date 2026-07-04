// Game calendar — maps round numbers to WW2 dates so the UI and AI narratives
// speak in months and years, not "round N". The war opens September 1939 and
// each round advances four months (a campaigning season).
const MONTHS_SHORT = ['JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN', 'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC']
const MONTHS_LONG = ['January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December']

const START_YEAR = 1939
const START_MONTH_INDEX = 8 // September (0-based)
const MONTHS_PER_ROUND = 4

export type GameDate = {
  year: number
  monthIndex: number
  short: string   // "SEP 1939"
  long: string    // "September 1939"
}

export function roundToDate(round: number): GameDate {
  const total = START_MONTH_INDEX + (Math.max(1, round) - 1) * MONTHS_PER_ROUND
  const year = START_YEAR + Math.floor(total / 12)
  const monthIndex = ((total % 12) + 12) % 12
  return {
    year,
    monthIndex,
    short: `${MONTHS_SHORT[monthIndex]} ${year}`,
    long: `${MONTHS_LONG[monthIndex]} ${year}`,
  }
}

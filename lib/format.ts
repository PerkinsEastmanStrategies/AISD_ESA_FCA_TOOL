/** Formats a number of millions of dollars into a compact currency string. */
export function formatMillions(value: number): string {
  if (value >= 1) {
    return `$${value.toFixed(2)}M`
  }
  const thousands = Math.round(value * 1000)
  return `$${thousands}K`
}

/** Formats a range of millions into "$X – $Y". */
export function formatRange(low: number, high: number): string {
  return `${formatMillions(low)} - ${formatMillions(high)}`
}

export function formatNumber(value: number): string {
  return value.toLocaleString("en-US")
}

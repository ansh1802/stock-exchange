export function formatCash(value: number): string {
  if (Number.isInteger(value)) return `$${value}`
  return `$${value.toFixed(1)}`
}

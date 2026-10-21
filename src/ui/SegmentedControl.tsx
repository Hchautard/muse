interface SegmentedControlProps<T extends string | number> {
  label: string
  options: { value: T; label: string }[]
  value: T | undefined
  onChange: (value: T) => void
}

/** A row of mutually exclusive buttons (a course, a goal…). */
export function SegmentedControl<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: SegmentedControlProps<T>) {
  return (
    <div
      role="group"
      aria-label={label}
      className="grid auto-cols-fr grid-flow-col gap-1 rounded-full bg-surface p-1 ring-1 ring-line"
    >
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          aria-pressed={option.value === value}
          onClick={() => onChange(option.value)}
          className="min-h-11 rounded-full px-3 text-sm font-medium text-muted transition-colors aria-pressed:bg-line aria-pressed:text-ink"
        >
          {option.label}
        </button>
      ))}
    </div>
  )
}

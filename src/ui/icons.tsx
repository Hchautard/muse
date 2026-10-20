import type { SVGProps } from 'react'

type IconProps = SVGProps<SVGSVGElement>

function Icon({ children, ...props }: IconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  )
}

export function CloseIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M6 6l12 12M18 6L6 18" />
    </Icon>
  )
}

export function CheckIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M5 12.5l4.5 4.5L19 7.5" />
    </Icon>
  )
}

export function CrossIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M7 7l10 10M17 7L7 17" />
    </Icon>
  )
}

export function ExpandIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M15 4h5v5M9 20H4v-5M20 4l-6 6M4 20l6-6" />
    </Icon>
  )
}

export function FlameIcon(props: IconProps) {
  return (
    <Icon {...props}>
      <path d="M12 21c3.9 0 6.5-2.6 6.5-6.2 0-3.4-2.3-5.6-4-8.3-.4 2.1-1.5 3.3-2.7 3.9C11.9 7.6 10.6 5 8.6 3c.2 3.2-3.1 6-3.1 10.8C5.5 18.4 8.1 21 12 21z" />
    </Icon>
  )
}

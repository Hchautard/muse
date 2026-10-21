import type { ReactNode } from 'react'
import { AsyncBoundary } from '../../app/AsyncBoundary'
import { useSettings } from '../../db/hooks'
import { DAILY_GOALS, saveSetting, setDailyGoal } from '../../db/settings'
import { SegmentedControl } from '../../ui/SegmentedControl'
import { OfflineSection } from './OfflineSection'
import { ProgressSection } from './ProgressSection'

export function SettingsPage() {
  const settings = useSettings()

  return (
    <main className="flex flex-1 flex-col gap-8 px-safe pt-safe pb-6">
      <h1 className="pt-2 text-[2rem] leading-none tracking-tight">Réglages</h1>

      <Section
        title="Objectif du jour"
        hint="Nombre de sessions par jour pour faire avancer la série."
      >
        <SegmentedControl
          label="Sessions par jour"
          options={DAILY_GOALS.map((goal) => ({ value: goal, label: String(goal) }))}
          value={settings?.dailyGoal}
          onChange={(goal) => void setDailyGoal(goal)}
        />
      </Section>

      <Section title="Son">
        <Switch
          label="Effets sonores"
          hint="Un son discret après chaque réponse. Les extraits musicaux ne sont pas concernés."
          checked={settings?.sound ?? true}
          onChange={(sound) => void saveSetting('sound', sound)}
        />
      </Section>

      <Section
        title="Hors ligne"
        hint="Téléchargez un parcours pour l’utiliser sans réseau, en avion ou dans le métro."
      >
        <AsyncBoundary fallback={<div className="h-28 animate-pulse rounded-2xl bg-line" />}>
          <OfflineSection />
        </AsyncBoundary>
      </Section>

      <Section
        title="Progression"
        hint="Toute votre progression reste sur cet appareil. Exportez-la pour la sauvegarder ou la transférer."
      >
        <ProgressSection />
      </Section>
    </main>
  )
}

interface SectionProps {
  title: string
  hint?: string
  children: ReactNode
}

export function Section({ title, hint, children }: SectionProps) {
  return (
    <section className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h2 className="text-xl">{title}</h2>
        {hint && <p className="text-sm text-muted">{hint}</p>}
      </div>
      {children}
    </section>
  )
}

interface SwitchProps {
  label: string
  hint: string
  checked: boolean
  onChange: (checked: boolean) => void
}

function Switch({ label, hint, checked, onChange }: SwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className="flex min-h-14 items-center gap-4 rounded-2xl border border-line bg-surface px-4 py-3 text-left"
    >
      <span className="flex flex-1 flex-col">
        <span className="font-medium">{label}</span>
        <span className="text-sm text-muted">{hint}</span>
      </span>
      <span
        aria-hidden="true"
        data-on={checked}
        className="relative h-7 w-12 shrink-0 rounded-full bg-line transition-colors data-[on=true]:bg-success"
      >
        <span
          data-on={checked}
          className="absolute top-0.5 left-0.5 size-6 rounded-full bg-surface shadow transition-transform data-[on=true]:translate-x-5"
        />
      </span>
    </button>
  )
}

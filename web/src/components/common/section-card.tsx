import type { PropsWithChildren } from 'react'

type SectionCardProps = PropsWithChildren<{
  title: string
  description: string
}>

export function SectionCard({
  title,
  description,
  children,
}: SectionCardProps) {
  return (
    <section className="section-card flex flex-col gap-4 p-5 md:p-6">
      <header className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-[color:var(--text)]">
          {title}
        </h2>
        <p className="text-sm leading-6 muted-copy">{description}</p>
      </header>
      {children}
    </section>
  )
}

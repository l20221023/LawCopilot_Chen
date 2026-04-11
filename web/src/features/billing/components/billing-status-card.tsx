import type { BillingOverview } from '../billing-types'

const toneClassNames: Record<BillingOverview['tone'], string> = {
  expired: 'border-[color:var(--warning)] bg-[rgba(201,124,34,0.08)]',
  free: 'border-[color:var(--border)] bg-white',
  limited: 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]',
  unlimited: 'border-emerald-300 bg-emerald-50',
}

export function BillingStatusCard({
  overview,
  title = '额度状态',
}: {
  overview: BillingOverview
  title?: string
}) {
  return (
    <section
      className={[
        'section-card flex flex-col gap-5 border p-5 md:p-6',
        toneClassNames[overview.tone],
      ].join(' ')}
    >
      <header className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2">
          <div className="eyebrow">{title}</div>
          <div>
            <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--text)]">
              {overview.planLabel}
            </h2>
            <p className="mt-2 text-sm leading-6 muted-copy">{overview.statusLabel}</p>
          </div>
        </div>

        <div className="rounded-full border border-[color:var(--border-strong)] bg-white/80 px-4 py-2 text-sm font-medium text-[color:var(--text)]">
          {overview.canSend ? '当前可发送' : '当前会被拦截'}
        </div>
      </header>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-[18px] bg-white/80 p-4">
          <div className="mono-label text-[color:var(--accent)]">额度 / 到期</div>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">
            {overview.detailLabel}
          </p>
        </div>
        <div className="rounded-[18px] bg-white/80 p-4">
          <div className="mono-label text-[color:var(--accent)]">扣费规则</div>
          <p className="mt-2 text-sm leading-6 text-[color:var(--text)]">
            {overview.nextActionLabel}
          </p>
        </div>
      </div>
    </section>
  )
}

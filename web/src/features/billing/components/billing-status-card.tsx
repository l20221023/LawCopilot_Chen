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
  compact = false,
}: {
  overview: BillingOverview
  title?: string
  compact?: boolean
}) {
  return (
    <section
      className={[
        'section-card flex flex-col border',
        compact ? 'gap-4 p-4 md:gap-4 md:p-5' : 'gap-5 p-5 md:p-6',
        toneClassNames[overview.tone],
      ].join(' ')}
    >
      <header
        className={[
          'flex flex-col md:flex-row md:items-start md:justify-between',
          compact ? 'gap-2.5 md:gap-3' : 'gap-3',
        ].join(' ')}
      >
        <div className="space-y-2">
          <div className="eyebrow">{title}</div>
          <div>
            <h2
              className={[
                'font-semibold tracking-tight text-[color:var(--text)]',
                compact ? 'text-xl md:text-[1.35rem]' : 'text-2xl',
              ].join(' ')}
            >
              {overview.planLabel}
            </h2>
            <p
              className={[
                'mt-2 text-sm muted-copy',
                compact ? 'leading-5' : 'leading-6',
              ].join(' ')}
            >
              {overview.statusLabel}
            </p>
          </div>
        </div>

        <div
          className={[
            'rounded-full border border-[color:var(--border-strong)] bg-white/80 text-sm font-medium text-[color:var(--text)]',
            compact ? 'px-3.5 py-1.5' : 'px-4 py-2',
          ].join(' ')}
        >
          {overview.canSend ? '当前可发送' : '当前会被拦截'}
        </div>
      </header>

      <div className={['grid md:grid-cols-2', compact ? 'gap-2.5' : 'gap-3'].join(' ')}>
        <div className={['rounded-[18px] bg-white/80', compact ? 'p-3.5' : 'p-4'].join(' ')}>
          <div className="mono-label text-[color:var(--accent)]">额度 / 到期</div>
          <p
            className={[
              'mt-2 text-sm text-[color:var(--text)]',
              compact ? 'leading-5' : 'leading-6',
            ].join(' ')}
          >
            {overview.detailLabel}
          </p>
        </div>
        <div className={['rounded-[18px] bg-white/80', compact ? 'p-3.5' : 'p-4'].join(' ')}>
          <div className="mono-label text-[color:var(--accent)]">扣费规则</div>
          <p
            className={[
              'mt-2 text-sm text-[color:var(--text)]',
              compact ? 'leading-5' : 'leading-6',
            ].join(' ')}
          >
            {overview.nextActionLabel}
          </p>
        </div>
      </div>
    </section>
  )
}

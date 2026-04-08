import type { PricingPlan } from '../billing-types'

export function PricingPlanCard({
  currentPlanLabel,
  isBusy,
  isCurrentFamily,
  onPurchase,
  onSelectOption,
  plan,
  selectedOptionId,
}: {
  currentPlanLabel: string
  isBusy: boolean
  isCurrentFamily: boolean
  onPurchase: () => void
  onSelectOption: (optionId: string) => void
  plan: PricingPlan
  selectedOptionId: string
}) {
  return (
    <section className="section-card flex h-full flex-col gap-5 p-5 md:p-6">
      <header className="space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="eyebrow">{plan.title}</span>
          {isCurrentFamily ? (
            <span className="rounded-full bg-[color:var(--accent-soft)] px-3 py-1 text-xs font-medium text-[color:var(--accent-strong)]">
              当前方案
            </span>
          ) : null}
        </div>
        <div className="space-y-2">
          <h2 className="text-2xl font-semibold tracking-tight text-[color:var(--text)]">
            {plan.headline}
          </h2>
          <p className="text-sm leading-6 muted-copy">{plan.description}</p>
        </div>
      </header>

      <div className="grid gap-2">
        {plan.options.map((option) => {
          const isSelected = selectedOptionId === option.id

          return (
            <button
              key={option.id}
              type="button"
              onClick={() => onSelectOption(option.id)}
              className={[
                'rounded-[18px] border px-4 py-3 text-left transition',
                isSelected
                  ? 'border-[color:var(--accent)] bg-[color:var(--accent-soft)]'
                  : 'border-[color:var(--border-strong)] bg-white/70 hover:border-[color:var(--accent)]',
              ].join(' ')}
            >
              <div className="flex items-center justify-between gap-3">
                <div className="font-medium text-[color:var(--text)]">{option.label}</div>
                <div className="text-sm font-medium text-[color:var(--accent-strong)]">
                  {option.priceLabel}
                </div>
              </div>
            </button>
          )
        })}
      </div>

      <ul className="space-y-2 text-sm leading-6 muted-copy">
        {plan.benefits.map((benefit) => (
          <li key={benefit}>• {benefit}</li>
        ))}
      </ul>

      <div className="mt-auto space-y-3">
        <div className="rounded-[18px] border border-dashed border-[color:var(--border-strong)] bg-white/70 p-4 text-sm leading-6 muted-copy">
          当前档位：{currentPlanLabel}
        </div>
        <button
          type="button"
          onClick={onPurchase}
          disabled={isBusy}
          className="inline-flex w-full items-center justify-center rounded-full bg-[color:var(--text)] px-5 py-3 text-sm font-medium text-white transition hover:bg-[color:var(--accent-strong)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isBusy ? '处理中...' : '模拟购买'}
        </button>
      </div>
    </section>
  )
}

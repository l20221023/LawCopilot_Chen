import {
  createCostStrategyConfig,
  type BillingStrategy,
  type CostDecisionThresholdConfig,
  type CostStrategyConfig,
  type FixedCallPriceConfig,
  type TokenPriceConfig,
} from './cost-config'

export type EstimatedTokenUsage = {
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedSystemPromptTokens?: number
  systemPromptCached?: boolean
}

export type CostStrategyEngineInput = EstimatedTokenUsage & {
  tokenPriceConfig?: Partial<TokenPriceConfig>
  fixedCallPriceConfig?: Partial<FixedCallPriceConfig>
  thresholds?: Partial<CostDecisionThresholdConfig>
  preferredStrategyOnTie?: BillingStrategy
  customStrategies?: CostStrategyCalculator[]
}

export type CostStrategyCandidate = {
  strategy: BillingStrategy
  estimatedCost: number
  explanation?: string
}

export type CostStrategyCalculatorContext = {
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedTotalTokens: number
  estimatedSystemPromptTokens: number
  estimatedBillableInputTokens: number
  systemPromptCached: boolean
  tokenPrice: TokenPriceConfig
  fixedPrice: FixedCallPriceConfig
}

export type CostStrategyCalculator = {
  strategy: BillingStrategy
  estimateCost: (context: CostStrategyCalculatorContext) => CostStrategyCandidate
}

export type CostStrategyDecision = {
  strategy: BillingStrategy
  estimatedInputTokens: number
  estimatedOutputTokens: number
  estimatedTotalTokens: number
  estimatedSystemPromptTokens: number
  estimatedBillableInputTokens: number
  estimatedTokenCost: number
  estimatedFixedCost: number
  breakEvenTotalTokens: number | null
  systemPromptCached: boolean
  reason?: string
  explanation?: string
  comparedStrategies: CostStrategyCandidate[]
}

function clampTokenCount(value: number | null | undefined) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, Math.round(Number(value)))
}

function clampCost(value: number) {
  if (!Number.isFinite(value)) {
    return 0
  }

  return Math.max(0, value)
}

function formatCost(value: number) {
  return value.toFixed(6)
}

function getPreferredCandidate(
  candidates: CostStrategyCandidate[],
  preferredStrategy: BillingStrategy,
) {
  return (
    candidates.find((candidate) => candidate.strategy === preferredStrategy) ??
    candidates[0]
  )
}

function createTokenCostCalculator(): CostStrategyCalculator {
  return {
    strategy: 'token',
    estimateCost(context) {
      const estimatedNonSystemInputTokens = Math.max(
        0,
        context.estimatedInputTokens - context.estimatedSystemPromptTokens,
      )
      const estimatedSystemPromptCost =
        (context.estimatedSystemPromptTokens / 1000) *
        (context.systemPromptCached
          ? context.tokenPrice.cachedInputCostPer1KTokens
          : context.tokenPrice.inputCostPer1KTokens)
      const estimatedNonSystemInputCost =
        (estimatedNonSystemInputTokens / 1000) *
        context.tokenPrice.inputCostPer1KTokens

      const estimatedCost =
        estimatedSystemPromptCost +
        estimatedNonSystemInputCost +
        (context.estimatedOutputTokens / 1000) *
          context.tokenPrice.outputCostPer1KTokens

      return {
        strategy: 'token',
        estimatedCost: clampCost(estimatedCost),
        explanation: context.systemPromptCached
          ? 'System prompt cache is applied to token pricing.'
          : 'All estimated input and output tokens are billed by token.',
      }
    },
  }
}

function createFixedCostCalculator(): CostStrategyCalculator {
  return {
    strategy: 'fixed',
    estimateCost(context) {
      return {
        strategy: 'fixed',
        estimatedCost: clampCost(context.fixedPrice.pricePerCall),
        explanation: 'The request is charged by fixed call price.',
      }
    },
  }
}

function compareCandidates(
  left: CostStrategyCandidate,
  right: CostStrategyCandidate,
  preferredStrategy: BillingStrategy,
) {
  if (left.estimatedCost === right.estimatedCost) {
    if (left.strategy === preferredStrategy) {
      return -1
    }

    if (right.strategy === preferredStrategy) {
      return 1
    }
  }

  return left.estimatedCost - right.estimatedCost
}

function resolveBaseCandidate(params: {
  candidates: CostStrategyCandidate[]
  preferredStrategy: BillingStrategy
}) {
  const { candidates, preferredStrategy } = params

  return [...candidates].sort((left, right) =>
    compareCandidates(left, right, preferredStrategy),
  )[0]
}

function calculateBreakEvenTotalTokens(params: {
  estimatedBillableInputTokens: number
  estimatedOutputTokens: number
  estimatedTokenCost: number
  estimatedFixedCost: number
}) {
  const {
    estimatedBillableInputTokens,
    estimatedOutputTokens,
    estimatedTokenCost,
    estimatedFixedCost,
  } = params
  const totalTokens = estimatedBillableInputTokens + estimatedOutputTokens

  if (totalTokens <= 0 || estimatedTokenCost <= 0) {
    return null
  }

  const effectiveCostPerToken = estimatedTokenCost / totalTokens

  if (effectiveCostPerToken <= 0) {
    return null
  }

  return Math.ceil(estimatedFixedCost / effectiveCostPerToken)
}

function pickThresholdCandidate(params: {
  candidates: CostStrategyCandidate[]
  thresholds: CostDecisionThresholdConfig
  preferredStrategy: BillingStrategy
  estimatedTotalTokens: number
}) {
  const { candidates, thresholds, preferredStrategy, estimatedTotalTokens } = params
  const tokenCandidate = candidates.find((candidate) => candidate.strategy === 'token')
  const fixedCandidate = candidates.find((candidate) => candidate.strategy === 'fixed')

  if (!tokenCandidate || !fixedCandidate) {
    return null
  }

  if (
    thresholds.preferTokenWhenTotalTokensAtOrBelow !== null &&
    estimatedTotalTokens <= thresholds.preferTokenWhenTotalTokensAtOrBelow &&
    tokenCandidate.estimatedCost <=
      fixedCandidate.estimatedCost + thresholds.minimumCostSavings
  ) {
    return {
      candidate: tokenCandidate,
      reason:
        'Selected token because total tokens stay below the token-preferred threshold.',
      explanation: `Token estimate ${estimatedTotalTokens} is within the configured low-volume range.`,
    }
  }

  if (
    thresholds.preferFixedWhenTotalTokensAtOrAbove !== null &&
    estimatedTotalTokens >= thresholds.preferFixedWhenTotalTokensAtOrAbove &&
    fixedCandidate.estimatedCost <=
      tokenCandidate.estimatedCost + thresholds.minimumCostSavings
  ) {
    return {
      candidate: fixedCandidate,
      reason:
        'Selected fixed because total tokens exceed the fixed-preferred threshold.',
      explanation: `Token estimate ${estimatedTotalTokens} is within the configured high-volume range.`,
    }
  }

  const costGap = Math.abs(tokenCandidate.estimatedCost - fixedCandidate.estimatedCost)

  if (costGap <= thresholds.minimumCostSavings) {
    const candidate = getPreferredCandidate(candidates, preferredStrategy)

    return {
      candidate,
      reason: `Selected ${candidate.strategy} because the cost difference is below the minimum savings threshold.`,
      explanation: `Estimated cost gap ${formatCost(costGap)} does not justify switching strategies.`,
    }
  }

  return null
}

export class CostStrategyEngine {
  private readonly customStrategies: CostStrategyCalculator[]
  private readonly config: CostStrategyConfig

  constructor(
    configOverrides: Partial<CostStrategyConfig> = {},
    customStrategies: CostStrategyCalculator[] = [],
  ) {
    this.config = createCostStrategyConfig(configOverrides)
    this.customStrategies = customStrategies
  }

  decide(input: CostStrategyEngineInput): CostStrategyDecision {
    const estimatedInputTokens = clampTokenCount(input.estimatedInputTokens)
    const estimatedOutputTokens = clampTokenCount(input.estimatedOutputTokens)
    const estimatedSystemPromptTokens = Math.min(
      estimatedInputTokens,
      clampTokenCount(input.estimatedSystemPromptTokens),
    )
    const systemPromptCached = Boolean(input.systemPromptCached)
    const estimatedTotalTokens = estimatedInputTokens + estimatedOutputTokens
    const estimatedBillableInputTokens = Math.max(
      0,
      estimatedInputTokens -
        (systemPromptCached ? estimatedSystemPromptTokens : 0),
    )

    const config = createCostStrategyConfig({
      tokenPrice: {
        ...this.config.tokenPrice,
        ...input.tokenPriceConfig,
        strategy: 'token',
      },
      fixedPrice: {
        ...this.config.fixedPrice,
        ...input.fixedCallPriceConfig,
        strategy: 'fixed',
      },
      thresholds: {
        ...this.config.thresholds,
        ...input.thresholds,
      },
      preferredStrategyOnTie:
        input.preferredStrategyOnTie ?? this.config.preferredStrategyOnTie,
    })

    const context: CostStrategyCalculatorContext = {
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens,
      estimatedSystemPromptTokens,
      estimatedBillableInputTokens,
      systemPromptCached,
      tokenPrice: config.tokenPrice,
      fixedPrice: config.fixedPrice,
    }

    const calculators = [
      createTokenCostCalculator(),
      createFixedCostCalculator(),
      ...this.customStrategies,
      ...(input.customStrategies ?? []),
    ]
    const comparedStrategies = calculators.map((calculator) =>
      calculator.estimateCost(context),
    )
    const baseCandidate = resolveBaseCandidate({
      candidates: comparedStrategies,
      preferredStrategy: config.preferredStrategyOnTie,
    })
    const thresholdCandidate = pickThresholdCandidate({
      candidates: comparedStrategies,
      thresholds: config.thresholds,
      preferredStrategy: config.preferredStrategyOnTie,
      estimatedTotalTokens,
    })
    const selectedCandidate =
      thresholdCandidate &&
      thresholdCandidate.candidate.estimatedCost <=
        baseCandidate.estimatedCost + config.thresholds.minimumCostSavings
        ? thresholdCandidate.candidate
        : baseCandidate
    const tokenCandidate =
      comparedStrategies.find((candidate) => candidate.strategy === 'token') ??
      createTokenCostCalculator().estimateCost(context)
    const fixedCandidate =
      comparedStrategies.find((candidate) => candidate.strategy === 'fixed') ??
      createFixedCostCalculator().estimateCost(context)
    const defaultReason =
      selectedCandidate.strategy === tokenCandidate.strategy
        ? 'Selected token because it is currently the lowest estimated cost.'
        : selectedCandidate.strategy === fixedCandidate.strategy
          ? 'Selected fixed because it is currently the lowest estimated cost.'
          : `Selected ${selectedCandidate.strategy} because it is currently the lowest estimated cost.`
    const defaultExplanation =
      selectedCandidate.strategy === tokenCandidate.strategy
        ? `Token cost ${formatCost(tokenCandidate.estimatedCost)} is lower than fixed cost ${formatCost(fixedCandidate.estimatedCost)}.`
        : selectedCandidate.strategy === fixedCandidate.strategy
          ? `Fixed cost ${formatCost(fixedCandidate.estimatedCost)} is lower than token cost ${formatCost(tokenCandidate.estimatedCost)}.`
          : selectedCandidate.explanation ??
            `Selected ${selectedCandidate.strategy} as the cheapest compared strategy.`

    return {
      strategy: selectedCandidate.strategy,
      estimatedInputTokens,
      estimatedOutputTokens,
      estimatedTotalTokens,
      estimatedSystemPromptTokens,
      estimatedBillableInputTokens,
      estimatedTokenCost: tokenCandidate.estimatedCost,
      estimatedFixedCost: fixedCandidate.estimatedCost,
      breakEvenTotalTokens: calculateBreakEvenTotalTokens({
        estimatedBillableInputTokens,
        estimatedOutputTokens,
        estimatedTokenCost: tokenCandidate.estimatedCost,
        estimatedFixedCost: fixedCandidate.estimatedCost,
      }),
      systemPromptCached,
      reason: thresholdCandidate?.reason ?? defaultReason,
      explanation:
        thresholdCandidate?.explanation ??
        selectedCandidate.explanation ??
        defaultExplanation,
      comparedStrategies,
    }
  }
}

export function decideCostStrategy(
  input: CostStrategyEngineInput,
): CostStrategyDecision {
  const engine = new CostStrategyEngine()

  return engine.decide(input)
}

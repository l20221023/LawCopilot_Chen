export type BuiltInBillingStrategy = 'token' | 'fixed'

export type BillingStrategy = BuiltInBillingStrategy | (string & {})

export type TokenPriceConfig = {
  strategy: 'token'
  inputCostPer1KTokens: number
  outputCostPer1KTokens: number
  cachedInputCostPer1KTokens: number
}

export type FixedCallPriceConfig = {
  strategy: 'fixed'
  pricePerCall: number
}

export type CostDecisionThresholdConfig = {
  preferTokenWhenTotalTokensAtOrBelow: number | null
  preferFixedWhenTotalTokensAtOrAbove: number | null
  minimumCostSavings: number
}

export type CostStrategyConfig = {
  tokenPrice: TokenPriceConfig
  fixedPrice: FixedCallPriceConfig
  thresholds: CostDecisionThresholdConfig
  preferredStrategyOnTie: BillingStrategy
}

// These defaults are fallback placeholders for local calculation only.
// Session D should override them at integration time with real provider pricing.
export const DEFAULT_TOKEN_PRICE_CONFIG: TokenPriceConfig = Object.freeze({
  strategy: 'token',
  inputCostPer1KTokens: 0.0008,
  outputCostPer1KTokens: 0.0032,
  cachedInputCostPer1KTokens: 0.0002,
})

export const DEFAULT_FIXED_CALL_PRICE_CONFIG: FixedCallPriceConfig = Object.freeze({
  strategy: 'fixed',
  pricePerCall: 0.01,
})

export const DEFAULT_ESTIMATED_OUTPUT_TOKENS = 1024

export const DEFAULT_COST_DECISION_THRESHOLDS: CostDecisionThresholdConfig =
  Object.freeze({
    preferTokenWhenTotalTokensAtOrBelow: 4000,
    preferFixedWhenTotalTokensAtOrAbove: 12000,
    minimumCostSavings: 0.0005,
  })

export const DEFAULT_COST_STRATEGY_CONFIG: CostStrategyConfig = Object.freeze({
  tokenPrice: DEFAULT_TOKEN_PRICE_CONFIG,
  fixedPrice: DEFAULT_FIXED_CALL_PRICE_CONFIG,
  thresholds: DEFAULT_COST_DECISION_THRESHOLDS,
  preferredStrategyOnTie: 'token',
})

function normalizeNonNegativeNumber(value: number | null | undefined, fallback: number) {
  if (!Number.isFinite(value) || (value ?? fallback) < 0) {
    return fallback
  }

  return Number(value)
}

function normalizeNullableThreshold(
  value: number | null | undefined,
  fallback: number | null,
) {
  if (value === null) {
    return null
  }

  return Math.round(normalizeNonNegativeNumber(value, fallback ?? 0))
}

export function createCostStrategyConfig(
  overrides: Partial<CostStrategyConfig> = {},
): CostStrategyConfig {
  return {
    tokenPrice: {
      strategy: 'token',
      inputCostPer1KTokens: normalizeNonNegativeNumber(
        overrides.tokenPrice?.inputCostPer1KTokens,
        DEFAULT_TOKEN_PRICE_CONFIG.inputCostPer1KTokens,
      ),
      outputCostPer1KTokens: normalizeNonNegativeNumber(
        overrides.tokenPrice?.outputCostPer1KTokens,
        DEFAULT_TOKEN_PRICE_CONFIG.outputCostPer1KTokens,
      ),
      cachedInputCostPer1KTokens: normalizeNonNegativeNumber(
        overrides.tokenPrice?.cachedInputCostPer1KTokens,
        DEFAULT_TOKEN_PRICE_CONFIG.cachedInputCostPer1KTokens,
      ),
    },
    fixedPrice: {
      strategy: 'fixed',
      pricePerCall: normalizeNonNegativeNumber(
        overrides.fixedPrice?.pricePerCall,
        DEFAULT_FIXED_CALL_PRICE_CONFIG.pricePerCall,
      ),
    },
    thresholds: {
      preferTokenWhenTotalTokensAtOrBelow: normalizeNullableThreshold(
        overrides.thresholds?.preferTokenWhenTotalTokensAtOrBelow,
        DEFAULT_COST_DECISION_THRESHOLDS.preferTokenWhenTotalTokensAtOrBelow,
      ),
      preferFixedWhenTotalTokensAtOrAbove: normalizeNullableThreshold(
        overrides.thresholds?.preferFixedWhenTotalTokensAtOrAbove,
        DEFAULT_COST_DECISION_THRESHOLDS.preferFixedWhenTotalTokensAtOrAbove,
      ),
      minimumCostSavings: normalizeNonNegativeNumber(
        overrides.thresholds?.minimumCostSavings,
        DEFAULT_COST_DECISION_THRESHOLDS.minimumCostSavings,
      ),
    },
    preferredStrategyOnTie:
      overrides.preferredStrategyOnTie ??
      DEFAULT_COST_STRATEGY_CONFIG.preferredStrategyOnTie,
  }
}

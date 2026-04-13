const SYSTEM_PROMPT_HASH_PREFIX = 'spc_v1'
const FNV1A_OFFSET_BASIS = 0x811c9dc5
const FNV1A_PRIME = 0x01000193

export type PromptCacheMetadata = {
  systemPromptHash: string
  previousSystemPromptHash: string | null
}

export type ResolvePromptCacheInput = {
  currentHash: string
  previousHash?: string | null
}

export type ResolveSystemPromptCacheInput = {
  systemPrompt: string
  previousHash?: string | null
}

export type PromptCacheResolution = PromptCacheMetadata & {
  cachedSystemPrompt: boolean
}

export function normalizeSystemPrompt(systemPrompt: string) {
  return systemPrompt.replace(/\r\n?/g, '\n').trim()
}

export function computeSystemPromptHash(systemPrompt: string) {
  const normalizedPrompt = normalizeSystemPrompt(systemPrompt)
  let hash = FNV1A_OFFSET_BASIS

  for (let index = 0; index < normalizedPrompt.length; index += 1) {
    hash ^= normalizedPrompt.charCodeAt(index)
    hash = Math.imul(hash, FNV1A_PRIME) >>> 0
  }

  return `${SYSTEM_PROMPT_HASH_PREFIX}_${hash.toString(16).padStart(8, '0')}`
}

export function resolvePromptCache({
  currentHash,
  previousHash = null,
}: ResolvePromptCacheInput): PromptCacheResolution {
  const normalizedCurrentHash = currentHash.trim()
  const normalizedPreviousHash = previousHash?.trim() || null

  return {
    systemPromptHash: normalizedCurrentHash,
    previousSystemPromptHash: normalizedPreviousHash,
    cachedSystemPrompt:
      normalizedCurrentHash.length > 0 &&
      normalizedPreviousHash !== null &&
      normalizedCurrentHash === normalizedPreviousHash,
  }
}

export function resolveSystemPromptCache({
  systemPrompt,
  previousHash = null,
}: ResolveSystemPromptCacheInput): PromptCacheResolution {
  const currentHash = computeSystemPromptHash(systemPrompt)

  return resolvePromptCache({
    currentHash,
    previousHash,
  })
}

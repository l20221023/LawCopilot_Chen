import type { LucideIcon } from 'lucide-react'
import {
  BookOpenText,
  BookSearch,
  Building2,
  Copyright,
  FilePenLine,
  FileSearch,
  Handshake,
  Languages,
  MessagesSquare,
  Route,
  Scale,
  ShieldCheck,
} from 'lucide-react'

import type { ScenarioIconKey } from '../../features/scenarios'

const scenarioIconMap: Record<ScenarioIconKey, LucideIcon> = {
  'file-search': FileSearch,
  'book-search': BookSearch,
  scale: Scale,
  'file-pen-line': FilePenLine,
  'building-2': Building2,
  'shield-check': ShieldCheck,
  'messages-square': MessagesSquare,
  'book-open-text': BookOpenText,
  handshake: Handshake,
  languages: Languages,
  copyright: Copyright,
  route: Route,
}

type ScenarioIconProps = {
  icon: ScenarioIconKey
  className?: string
}

export function ScenarioIcon({ icon, className }: ScenarioIconProps) {
  const Icon = scenarioIconMap[icon]

  return <Icon className={className} aria-hidden="true" />
}

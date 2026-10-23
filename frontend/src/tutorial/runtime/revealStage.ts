import type { Stage } from '../../components/game/CardRevealOverlay'
import type { RevealCompanyData } from '../../types/game'

/** Stable name for a closing-bell stage, used by the tutorial to hold on it. */
export function stageKey(stage: Stage, revealData: RevealCompanyData[]): string {
  switch (stage.type) {
    case 'company_intro':
    case 'final_value':
    case 'chairman_director':
      return `${stage.type}:${revealData[stage.companyIdx]?.company_name}`
    case 'revealing_cards':
      return `revealing_cards:${revealData[stage.companyIdx]?.company_name}:${stage.cardIdx}`
    case 'currency_settlement':
      return `currency_settlement:${stage.visibleIdx}`
    case 'complete':
      return 'complete'
  }
}

import { describe, it, expect } from 'vitest'
import { stageKey } from './revealStage'
import type { RevealCompanyData } from '../../types/game'

const data: RevealCompanyData[] = [
  { company_name: 'Vodafone', cards: [], delta: 0, old_value: 10, new_value: 10 },
  { company_name: 'TCS', cards: [], delta: 0, old_value: 20, new_value: 20 },
]

describe('stageKey', () => {
  it('company_intro', () => {
    expect(stageKey({ type: 'company_intro', companyIdx: 0 }, data)).toBe('company_intro:Vodafone')
  })
  it('revealing_cards', () => {
    expect(stageKey({ type: 'revealing_cards', companyIdx: 1, cardIdx: 2 }, data)).toBe('revealing_cards:TCS:2')
  })
  it('final_value', () => {
    expect(stageKey({ type: 'final_value', companyIdx: 1 }, data)).toBe('final_value:TCS')
  })
  it('chairman_director', () => {
    expect(stageKey({ type: 'chairman_director', companyIdx: 0 }, data)).toBe('chairman_director:Vodafone')
  })
  it('currency_settlement', () => {
    expect(stageKey({ type: 'currency_settlement', visibleIdx: -1 }, data)).toBe('currency_settlement:-1')
    expect(stageKey({ type: 'currency_settlement', visibleIdx: 3 }, data)).toBe('currency_settlement:3')
  })
  it('complete', () => {
    expect(stageKey({ type: 'complete' }, data)).toBe('complete')
  })
})

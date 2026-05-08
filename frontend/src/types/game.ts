export interface Card {
  company: string
  value: number
  positive: boolean
  is_power: boolean
}

export interface Company {
  name: string
  ticker: string
  value: number
  is_open: boolean
  prev_value: number
  // Today's pre-card-reveal value. ShareSuspend swaps current value with this.
  pre_fluct_value: number
}

export interface Player {
  id: number
  name: string
  cash: number
  stocks: Record<string, number>
  is_you: boolean
  connected?: boolean
}

export type GamePhase =
  | 'dealing'
  | 'player_turn'
  | 'rights_issue'
  | 'card_reveal'
  | 'share_suspend'
  | 'day_end'
  | 'game_over'

export interface RevealCard {
  player_id: number
  player_name: string
  value: number
  positive: boolean
}

export interface RevealCompanyData {
  company_name: string
  cards: RevealCard[]
  delta: number
  old_value: number
  new_value: number
}

export interface CurrencyEffect {
  player_id: number
  before: number
  after: number
  type: '+' | '-'
}

export interface GameState {
  room_code: string
  phase: GamePhase
  day: number
  round: number
  current_turn: number
  num_players: number
  current_player_name: string
  companies: Company[]
  available_shares: number[]
  players: Player[]
  your_hand: Card[]
  game_log: string[]
  // Sub-phase data
  rights_issue_company: number | null
  rights_issue_queue: number[]
  suspend_queue: number[]
  // Chairman / Director data
  chairman: Record<string, number | null>
  directors: Record<string, number[]>
  chairman_director_queue: [number, string, string][]
  // Card reveal animation data
  reveal_data: RevealCompanyData[]
  all_hands: Record<number, Card[]> | null
  currency_effects: CurrencyEffect[]
  price_history: number[][]
  // Turn timer — null deadline outside player_turn
  turn_timer_deadline: number | null
  turn_timer_duration: number
}

export interface Ranking {
  player_id: number
  name: string
  cash: number
  net_worth: number
  stocks: Record<string, number>
}

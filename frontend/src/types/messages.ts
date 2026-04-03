import type { GameState, Ranking } from './game'

// Server → Client
export type ServerMessage =
  | { type: 'lobby'; room_code: string; players: string[]; is_host: boolean; reconnected: boolean }
  | { type: 'player_joined'; player_name: string; players: string[] }
  | { type: 'player_left'; player_name: string; players: string[] }
  | { type: 'game_started'; num_players: number }
  | { type: 'game_state'; state: GameState }
  | { type: 'action_result'; success: boolean; message: string }
  | { type: 'phase_change'; phase: string; message: string }
  | { type: 'game_over'; rankings: Ranking[] }
  | { type: 'error'; message: string }

// Client → Server
export type ClientMessage =
  | { type: 'start_game'; preset?: string }
  | { type: 'buy'; company_num: number; quantity: number }
  | { type: 'sell'; company_num: number; quantity: number }
  | { type: 'pass' }
  | { type: 'loan_stock' }
  | { type: 'debenture'; company_num: number }
  | { type: 'rights_issue'; company_num: number }
  | { type: 'rights_issue_buy'; quantity: number }
  | { type: 'share_suspend'; company_num: number }
  | { type: 'chairman_director'; discard_own_idx: number | number[]; discard_other_player_id?: number | null; discard_other_idx?: number | null }
  | { type: 'reveal_complete' }
  | { type: 'complete_currency_settlement' }

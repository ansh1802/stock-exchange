import type { GameState, Ranking, LobbyPlayer, AutoreadyState } from './game'

export interface ChatMessage {
  name: string
  text: string
  ts: number
}

// Server → Client
export type ServerMessage =
  | { type: 'lobby_state'; room_code: string; is_public: boolean; players: LobbyPlayer[]; autoready: AutoreadyState | null }
  | { type: 'kicked'; message: string }
  | { type: 'room_closed'; message: string }
  | { type: 'game_started'; num_players: number }
  | { type: 'game_state'; state: GameState }
  | { type: 'action_result'; success: boolean; message: string }
  | { type: 'phase_change'; phase: string; message: string }
  | { type: 'game_over'; rankings: Ranking[] }
  | { type: 'error'; message: string; error_code?: string; retry_after?: number }
  | { type: 'ping' }
  | { type: 'chat_message'; name: string; text: string; ts: number }
  | { type: 'chat_history'; messages: ChatMessage[] }

// Client → Server
export type ClientMessage =
  | { type: 'start_game'; preset?: string; turn_timer_seconds?: number }
  | { type: 'ready'; ready: boolean }
  | { type: 'leave_room' }
  | { type: 'kick'; player_id: number }
  | { type: 'close_room' }
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
  | { type: 'pong' }
  | { type: 'chat'; text: string }

import type { GameState, Ranking } from './game'

export interface LobbyPlayer {
  name: string
  ready: boolean
  is_host: boolean
  connected: boolean
}

export interface PublicRoom {
  code: string
  host: string
  players: number
  ready: number
  max_players: number
}

export interface ChatMessage {
  name: string
  text: string
  ts: number
}

// Server → Client
export type ServerMessage =
  | { type: 'lobby'; room_code: string; players: string[]; is_host: boolean; reconnected: boolean }
  | { type: 'lobby_update'; players: LobbyPlayer[]; is_host: boolean; is_public: boolean }
  | { type: 'join_refused'; code: string; message: string }
  | { type: 'left_room'; reason: 'left' | 'kicked' }
  | { type: 'player_joined'; player_name: string; players: string[] }
  | { type: 'player_left'; player_name: string; players: string[] }
  | { type: 'game_started'; num_players: number }
  | { type: 'game_state'; state: GameState }
  | { type: 'action_result'; success: boolean; message: string }
  | { type: 'phase_change'; phase: string; message: string }
  | { type: 'game_over'; rankings: Ranking[] }
  | { type: 'error'; message: string }
  | { type: 'ping' }
  | { type: 'chat_message'; name: string; text: string; ts: number }
  | { type: 'chat_history'; messages: ChatMessage[] }

// Client → Server
export type ClientMessage =
  | { type: 'start_game'; preset?: string; turn_timer_seconds?: number }
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
  | { type: 'day_start_ready' }
  | { type: 'pong' }
  | { type: 'chat'; text: string }
  | { type: 'set_ready'; ready: boolean }
  | { type: 'set_public'; is_public: boolean }
  | { type: 'kick_player'; player_name: string }
  | { type: 'leave_room' }

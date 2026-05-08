import { Routes, Route } from 'react-router-dom'
import LobbyPage from './pages/LobbyPage'
import GamePage from './pages/GamePage'
import TutorialPage from './pages/TutorialPage'
import RulebookPage from './pages/RulebookPage'

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<LobbyPage />} />
      <Route path="/game/:roomCode" element={<GamePage />} />
      <Route path="/tutorial" element={<TutorialPage />} />
      <Route path="/rulebook" element={<RulebookPage />} />
      <Route path="/rulebook/:chapterId" element={<RulebookPage />} />
    </Routes>
  )
}

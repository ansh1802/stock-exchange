import { Suspense, lazy } from 'react'
import { Routes, Route } from 'react-router-dom'
import LobbyPage from './pages/LobbyPage'

// Code-split everything past the landing page. GamePage alone pulls in the
// entire game UI (all overlays/modals + framer-motion), and Tutorial/Rulebook
// carry their own chapter content — none of that should block the initial
// landing-page bundle, which is what every visitor loads first.
const GamePage = lazy(() => import('./pages/GamePage'))
const TutorialPage = lazy(() => import('./pages/TutorialPage'))
const RulebookPage = lazy(() => import('./pages/RulebookPage'))

function RouteFallback() {
  return <div className="min-h-screen" style={{ background: 'var(--color-felt, #0a0a0a)' }} />
}

export default function App() {
  return (
    <Suspense fallback={<RouteFallback />}>
      <Routes>
        <Route path="/" element={<LobbyPage />} />
        <Route path="/game/:roomCode" element={<GamePage />} />
        <Route path="/tutorial" element={<TutorialPage />} />
        <Route path="/rulebook" element={<RulebookPage />} />
        <Route path="/rulebook/:chapterId" element={<RulebookPage />} />
      </Routes>
    </Suspense>
  )
}

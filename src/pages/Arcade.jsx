import React, { useState, useEffect } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import PageWrapper from '../components/UI/PageWrapper'
import { QuickDraw, MemoryMatch, Scramble } from './ArcadeGames'
import RottenPinball from '../components/Arcade/RottenPinball'
import PosterBlaster from '../components/Arcade/PosterBlaster'
import RottenOrFresh from '../components/Arcade/RottenOrFresh'
import PosterStorm from '../components/Arcade/PosterStorm'
import CineBreakout from '../components/Arcade/CineBreakout'
import BoxOfficeSnake from '../components/Arcade/BoxOfficeSnake'
import PosterFlip from '../components/Arcade/PosterFlip'
import { useStore } from '../store/useStore'
import { PLAYER_COLORS } from '../lib/movies'
import { sbFetch } from '../lib/supabase'

const GAMES = [
  { id: 'quickdraw',    icon: '🎯', title: 'Quick Draw',       desc: 'Posters flash on screen — tap them before they vanish. Miss 3 and it\'s game over.', component: QuickDraw },
  { id: 'memory',       icon: '🎭', title: 'Memory Match',     desc: 'Flip cards to find matching poster pairs. 6 pairs, 30 seconds.', component: MemoryMatch },
  { id: 'scramble',     icon: '🔤', title: 'Scrambled Title',  desc: 'Unscramble the movie title before time runs out. 10 rounds.', component: Scramble },
  { id: 'pinball',      icon: '🎰', title: 'Rotten Pinball',   desc: 'Hit movie poster bumpers with your pinball. Don\'t let the ball drain!', component: RottenPinball },
  { id: 'blaster',      icon: '🚀', title: 'Poster Blaster',   desc: 'Rotate your ship and blast incoming movie posters. Don\'t get hit!', component: PosterBlaster },
  { id: 'rottenorfresh',icon: '🍅', title: 'Rotten or Fresh?', desc: 'Catch the 🍿 popcorn, dodge the 🍅 tomatoes. Move your basket.', component: RottenOrFresh },
  { id: 'snake',        icon: '🐍', title: 'Box Office Snake',  desc: 'Eat movie posters in order. Arrow keys or swipe to steer.', component: BoxOfficeSnake },
  { id: 'posterflip',   icon: '🧩', title: 'Poster Flip',        desc: 'Slide tiles to reconstruct the movie poster. Fewer moves = more points.', component: PosterFlip },
  { id: 'storm',        icon: '🌩️', title: 'Poster Storm',       desc: 'Tap top-ranked posters as they fall. Avoid the bad ones!', component: PosterStorm },
  { id: 'breakout',     icon: '🧱', title: 'Cine Breakout',      desc: 'Smash through movie poster bricks. Classic arcade action.', component: CineBreakout },
]

function GameOverlay({ game, onClose }) {
  const [state, setState] = useState('playing')
  const [finalScore, setFinalScore] = useState(0)
  const { player } = useStore()
  const GameComponent = game.component

  async function handleEnd(score) {
    setFinalScore(score)
    setState('result')
    if (player) {
      try {
        await sbFetch('/rest/v1/arcade_scores', {
          method: 'POST', prefer: 'resolution=merge-duplicates',
          body: JSON.stringify({ id: `${player}_${game.id}`, player, game: game.id, score, played_at: new Date().toISOString() })
        })
      } catch(e) {}
    }
  }

  return (
    <motion.div initial={{ opacity:0,y:30 }} animate={{ opacity:1,y:0 }} exit={{ opacity:0,y:30 }}
      className="fixed inset-0 bg-base z-50 flex flex-col overflow-hidden">
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border flex-shrink-0">
        <button onClick={onClose} className="text-ink-muted hover:text-ink-primary transition-colors text-sm font-semibold">← Back</button>
        <span className="text-sm font-bold text-ink-primary flex-1">{game.icon} {game.title}</span>
        {state === 'result' && <span className="text-gold font-bold font-mono">{finalScore} pts</span>}
      </div>
      <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
        <AnimatePresence mode="wait">
          {state === 'playing' ? (
            <motion.div key="game" initial={{ opacity:0 }} animate={{ opacity:1 }} className="flex-1 min-h-0 relative">
              <GameComponent onEnd={handleEnd} />
            </motion.div>
          ) : (
            <motion.div key="result" initial={{ opacity:0,scale:0.95 }} animate={{ opacity:1,scale:1 }}
              className="text-center py-12 space-y-4 overflow-y-auto">
              <div className="text-5xl">🏆</div>
              <h2 className="text-xl font-black text-ink-primary">Well played!</h2>
              <div className="inline-block bg-surface border border-border rounded-2xl px-8 py-5">
                <div className="text-4xl font-black text-gold font-mono">{finalScore}</div>
                <div className="text-xs text-ink-muted mt-1">points</div>
              </div>
              <div className="flex gap-3 justify-center pt-2">
                <button onClick={() => setState('playing')} className="px-6 py-3 bg-gold text-black font-bold rounded-xl text-sm">Play Again</button>
                <button onClick={onClose} className="px-6 py-3 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">Back</button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  )
}

export default function Arcade() {
  const [activeGame, setActiveGame] = useState(null)
  const [scores, setScores] = useState({})

  useEffect(() => {
    sbFetch('/rest/v1/arcade_scores?select=player,game,score&order=score.desc&limit=200')
      .then(rows => {
        const s = {}
        if (rows) rows.forEach(r => { if (!s[r.game]) s[r.game] = []; s[r.game].push(r) })
        setScores(s)
      }).catch(() => {})
  }, [activeGame]) // refresh after each game

  return (
    <>
      <PageWrapper>
        <div className="p-4 space-y-2.5">
          <p className="text-[10px] font-bold text-ink-muted tracking-widest uppercase mb-3">Pick a game</p>
          {GAMES.map((game, i) => {
            const top3 = (scores[game.id] || []).slice(0, 3)
            return (
              <motion.button key={game.id} initial={{ opacity:0,y:8 }} animate={{ opacity:1,y:0 }}
                transition={{ delay: i * 0.05 }} onClick={() => setActiveGame(game)}
                className="w-full text-left bg-surface border border-border rounded-2xl p-4 hover:border-gold/40 active:scale-[0.98] transition-all">
                <div className="flex items-start gap-3">
                  <span className="text-2xl flex-shrink-0">{game.icon}</span>
                  <div className="flex-1 min-w-0">
                    <p className="font-bold text-sm text-ink-primary">{game.title}</p>
                    <p className="text-[11px] text-ink-muted mt-0.5 leading-relaxed">{game.desc}</p>
                    {top3.length > 0 && (
                      <div className="flex gap-1.5 mt-2 flex-wrap">
                        {top3.map((s, j) => (
                          <span key={j} className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
                            style={{ color:PLAYER_COLORS[s.player]||'#888', borderColor:(PLAYER_COLORS[s.player]||'#888')+'44', background:(PLAYER_COLORS[s.player]||'#888')+'11' }}>
                            {['🥇','🥈','🥉'][j]} {s.player}: {s.score}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <span className="text-ink-muted flex-shrink-0 mt-0.5">›</span>
                </div>
              </motion.button>
            )
          })}
        </div>
      </PageWrapper>
      <AnimatePresence>
        {activeGame && <GameOverlay key={activeGame.id} game={activeGame} onClose={() => setActiveGame(null)} />}
      </AnimatePresence>
    </>
  )
}

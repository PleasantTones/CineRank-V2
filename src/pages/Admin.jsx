import React, { useState, useEffect, useCallback } from 'react'
import { useNavigate } from 'react-router-dom'
import { sbFetch } from '../lib/supabase'
import { MOVIES } from '../lib/movies'

const TMDB_BASE = 'https://api.themoviedb.org/3'
const TMDB_IMG  = 'https://image.tmdb.org/t/p/w185'

const SEASON_DATES = {
  '2025-winter': { start: '2025-01-01', end: '2025-04-30' },
  '2025-summer': { start: '2025-05-01', end: '2025-08-31' },
  '2025-fall':   { start: '2025-09-01', end: '2025-12-31' },
  '2026-winter': { start: '2026-01-01', end: '2026-04-30' },
  '2026-summer': { start: '2026-05-01', end: '2026-08-31' },
  '2026-fall':   { start: '2026-09-01', end: '2026-12-31' },
}

const SEASONS = [
  { id: '2025-winter', label: '2025 Winter (Jan–Apr)' },
  { id: '2025-summer', label: '2025 Summer (May–Aug)' },
  { id: '2025-fall',   label: '2025 Fall (Sep–Dec)' },
  { id: '2026-winter', label: '2026 Winter (Jan–Apr)' },
  { id: '2026-summer', label: '2026 Summer (May–Aug)' },
  { id: '2026-fall',   label: '2026 Fall (Sep–Dec)' },
]

// Infer season from a movie's release date automatically
function inferSeason(releaseDate) {
  if (!releaseDate) return null
  const [year, month] = releaseDate.split('-').map(Number)
  if (month >= 1 && month <= 4)  return `${year}-winter`
  if (month >= 5 && month <= 8)  return `${year}-summer`
  if (month >= 9 && month <= 12) return `${year}-fall`
  return null
}

// Generate next unique ID given all already-used IDs
function nextId(usedIds) {
  const nums = usedIds
    .map(id => parseInt((id || '').replace('M', ''), 10))
    .filter(n => !isNaN(n))
  return `M${String(Math.max(...nums, 0) + 1).padStart(4, '0')}`
}

// Insert a movie row, trying with poster_path first then without
async function insertMovie(row) {
  try {
    await sbFetch('/rest/v1/season_movies', {
      method: 'POST', prefer: 'resolution=merge-duplicates',
      body: JSON.stringify(row),
    })
  } catch(e) {
    // poster_path column might not exist — retry without it
    if (e.message?.includes('poster_path') || e.message?.includes('column')) {
      const { poster_path, ...rowNoPoster } = row
      await sbFetch('/rest/v1/season_movies', {
        method: 'POST', prefer: 'resolution=merge-duplicates',
        body: JSON.stringify(rowNoPoster),
      })
    } else {
      throw e
    }
  }
}

export default function Admin() {
  const navigate = useNavigate()
  const [apiKey, setApiKey]       = useState(localStorage.getItem('tmdb_key') || '')
  const [keyInput, setKeyInput]   = useState(localStorage.getItem('tmdb_key') || '')
  const [season, setSeason]       = useState('2026-winter')
  const [tmdbMovies, setTmdbMovies] = useState([])
  const [seasonMovies, setSeasonMovies] = useState([])
  const [loading, setLoading]     = useState(false)
  const [adding, setAdding]       = useState(null)
  const [error, setError]         = useState('')
  const [page, setPage]           = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [searchQuery, setSearchQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [bulkLoading, setBulkLoading] = useState(false)
  const [bulkProgress, setBulkProgress] = useState('')

  const loadSeasonMovies = useCallback(async () => {
    try {
      const rows = await sbFetch('/rest/v1/season_movies?select=*&order=added_at.asc&limit=500')
      setSeasonMovies(rows || [])
    } catch(e) {
      setError('Could not load season movies. Make sure the table exists in Supabase.')
    }
  }, [])

  useEffect(() => { loadSeasonMovies() }, [loadSeasonMovies])

  const getImdbId = async (tmdbId) => {
    try {
      const res = await fetch(`${TMDB_BASE}/movie/${tmdbId}/external_ids?api_key=${apiKey}`)
      const data = await res.json()
      return data.imdb_id || null
    } catch { return null }
  }

  const fetchUpcoming = useCallback(async (p = 1) => {
    if (!apiKey) return
    setLoading(true); setError('')
    try {
      const today = new Date().toISOString().split('T')[0]
      const thisYear = new Date().getFullYear()
      const res = await fetch(
        `${TMDB_BASE}/discover/movie?api_key=${apiKey}&language=en-US&region=US` +
        `&with_release_type=3&primary_release_year=${thisYear}` +
        `&release_date.gte=${today}&sort_by=release_date.asc&page=${p}`
      )
      const data = await res.json()
      if (data.status_message) { setError(`TMDB: ${data.status_message}`); return }
      setTmdbMovies(data.results || [])
      setTotalPages(Math.min(data.total_pages || 1, 20))
      setPage(p)
    } catch(e) { setError('Failed to fetch. Check your API key.') }
    setLoading(false)
  }, [apiKey])

  const searchTmdb = useCallback(async () => {
    if (!apiKey || !searchQuery.trim()) return
    setSearching(true); setError('')
    try {
      const res = await fetch(`${TMDB_BASE}/search/movie?api_key=${apiKey}&query=${encodeURIComponent(searchQuery)}&language=en-US&region=US`)
      const data = await res.json()
      if (data.status_message) { setError(`TMDB: ${data.status_message}`); return }
      setTmdbMovies(data.results || [])
      setTotalPages(1)
    } catch(e) { setError('Search failed.') }
    setSearching(false)
  }, [apiKey, searchQuery])

  // ── Bulk load ──────────────────────────────────────────────────────────────
  const bulkLoadSeason = useCallback(async () => {
    if (!apiKey) { setError('Save your TMDB API key first.'); return }
    const dates = SEASON_DATES[season]
    if (!dates) return
    setBulkLoading(true); setBulkProgress('Fetching movies from TMDB…'); setError('')

    try {
      // Fetch all pages
      let allMovies = [], pg = 1, totalPg = 1
      while (pg <= totalPg && pg <= 10) {
        setBulkProgress(`Fetching page ${pg}${totalPg > 1 ? ` of ${totalPg}` : ''}…`)
        const seasonYear = dates.start.slice(0, 4)
        const res = await fetch(
          `${TMDB_BASE}/discover/movie?api_key=${apiKey}&language=en-US&region=US` +
          `&with_release_type=3` +
          `&primary_release_year=${seasonYear}` +   // blocks ALL re-releases
          `&release_date.gte=${dates.start}&release_date.lte=${dates.end}` +  // US-specific window
          `&sort_by=release_date.asc&page=${pg}`
        )
        const data = await res.json()
        if (data.status_message) throw new Error(data.status_message)
        allMovies = [...allMovies, ...(data.results || [])]
        totalPg = Math.min(data.total_pages || 1, 10)
        pg++
      }

      // Strict date + year filter
      const seasonYear = dates.start.slice(0, 4)
      const inRange = allMovies.filter(m =>
        m.release_date &&
        m.release_date >= dates.start &&
        m.release_date <= dates.end &&
        m.release_date.slice(0, 4) === seasonYear
      )

      // Skip already-added movies (by tmdb_id)
      const addedTmdbIds = new Set(seasonMovies.map(m => m.tmdb_id))
      const toAdd = inRange.filter(m => !addedTmdbIds.has(String(m.id)))

      if (toAdd.length === 0) {
        setBulkProgress(`✅ All ${inRange.length} movies already added!`)
        setBulkLoading(false)
        return
      }

      setBulkProgress(`Found ${inRange.length} movies. Adding ${toAdd.length} new…`)

      // Track ALL used IDs to avoid collisions
      const usedIds = [
        ...MOVIES.map(m => m.id),
        ...seasonMovies.map(m => m.id),
      ]

      let added = 0
      for (const m of toAdd) {
        added++
        setBulkProgress(`Adding ${added}/${toAdd.length}: ${m.title}`)
        const imdbId = await getImdbId(m.id)
        const newId = nextId(usedIds)
        usedIds.push(newId)  // track so next iteration gets a different ID

        await insertMovie({
          id: newId,
          title: m.title,
          imdb_id: imdbId,
          tmdb_id: String(m.id),
          release_date: m.release_date || null,
          poster_path: m.poster_path || null,
          season,
          active: true,
        })
        await new Promise(r => setTimeout(r, 100))
      }

      setBulkProgress(`✅ Added ${toAdd.length} movies for ${season}!`)
      await loadSeasonMovies()
    } catch(e) {
      setError('Bulk load failed: ' + e.message)
      setBulkProgress('')
    }
    setBulkLoading(false)
  }, [apiKey, season, seasonMovies, loadSeasonMovies])

  // ── Single add ─────────────────────────────────────────────────────────────
  const addMovie = async (tmdbMovie) => {
    setAdding(tmdbMovie.id)
    try {
      const imdbId = await getImdbId(tmdbMovie.id)
      const usedIds = [...MOVIES.map(m => m.id), ...seasonMovies.map(m => m.id)]
      const newId = nextId(usedIds)
      await insertMovie({
        id: newId, title: tmdbMovie.title,
        imdb_id: imdbId, tmdb_id: String(tmdbMovie.id),
        release_date: tmdbMovie.release_date || null,
        poster_path: tmdbMovie.poster_path || null,
        season: inferSeason(tmdbMovie.release_date) || season,
        active: true,
      })
      await loadSeasonMovies()
    } catch(e) { setError('Failed to add: ' + e.message) }
    setAdding(null)
  }

  const removeMovie = async (id) => {
    try {
      await sbFetch(`/rest/v1/season_movies?id=eq.${id}`, { method: 'DELETE' })
      setSeasonMovies(prev => prev.filter(m => m.id !== id))
    } catch(e) { setError('Failed to remove.') }
  }

  const clearSeason = async (targetSeason) => {
    const label = targetSeason === 'ALL' ? 'ALL seasons' : targetSeason
    const toRemove = targetSeason === 'ALL' ? seasonMovies : seasonMovies.filter(m => m.season === targetSeason)
    if (!toRemove.length) return
    if (!window.confirm(`Remove all ${toRemove.length} movies from ${label}? This cannot be undone.`)) return
    for (const m of toRemove) {
      await sbFetch(`/rest/v1/season_movies?id=eq.${m.id}`, { method: 'DELETE' }).catch(() => {})
    }
    await loadSeasonMovies()
  }

  const saveKey = () => { localStorage.setItem('tmdb_key', keyInput); setApiKey(keyInput); setError('') }
  const isAdded = (tmdbId) => seasonMovies.some(m => m.tmdb_id === String(tmdbId))

  return (
    <div className="h-full overflow-y-auto overscroll-contain bg-base text-ink-primary">
      <div className="p-4 pb-20 max-w-2xl mx-auto space-y-4">

        {/* Header */}
        <div className="flex items-center gap-3 pt-2">
          <button onClick={() => navigate('/leaderboard')} className="text-ink-muted text-sm hover:text-ink-primary py-2 pr-3">← Back</button>
          <h1 className="text-xl font-black">🎬 Season Manager</h1>
        </div>

        {error && (
          <div className="bg-red-900/30 border border-red-500/40 rounded-xl p-3 text-xs text-red-300 break-all">{error}</div>
        )}

        {/* Setup instructions */}
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-2">First-time setup</p>
          <p className="text-xs text-ink-muted mb-2">1. Run this SQL in your <a href="https://app.supabase.com" target="_blank" className="text-gold underline">Supabase</a> SQL Editor:</p>
          <pre className="text-[10px] bg-raised rounded-lg p-2 text-ink-secondary overflow-x-auto whitespace-pre mb-3">{`CREATE TABLE IF NOT EXISTS season_movies (
  id TEXT PRIMARY KEY, title TEXT NOT NULL,
  imdb_id TEXT, tmdb_id TEXT, poster_path TEXT,
  release_date DATE, season TEXT,
  active BOOLEAN DEFAULT TRUE,
  added_at TIMESTAMPTZ DEFAULT NOW()
);
ALTER TABLE season_movies ENABLE ROW LEVEL SECURITY;
CREATE POLICY "r" ON season_movies FOR SELECT USING (true);
CREATE POLICY "w" ON season_movies FOR INSERT WITH CHECK (true);
CREATE POLICY "d" ON season_movies FOR DELETE USING (true);

-- If table already exists, add poster_path column:
ALTER TABLE season_movies ADD COLUMN IF NOT EXISTS poster_path TEXT;`}</pre>
          <p className="text-xs text-ink-muted">2. Get a free TMDB key at <a href="https://www.themoviedb.org/settings/api" target="_blank" className="text-gold underline">themoviedb.org/settings/api</a></p>
        </div>

        {/* API Key */}
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-2">TMDB API Key</p>
          <div className="flex gap-2">
            <input value={keyInput} onChange={e => setKeyInput(e.target.value)}
              placeholder="Paste your TMDB API key"
              className="flex-1 bg-raised border border-border rounded-xl px-3 py-2 text-sm font-mono text-ink-secondary focus:outline-none focus:border-gold" />
            <button onClick={saveKey} className="px-4 py-2 bg-gold text-black font-bold rounded-xl text-sm">Save</button>
          </div>
          {apiKey && <p className="text-[10px] text-win mt-1">✓ Key saved</p>}
        </div>

        {/* Season selector */}
        <div className="bg-surface border border-border rounded-2xl p-4">
          <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-2">Season</p>
          <select value={season} onChange={e => setSeason(e.target.value)}
            className="w-full bg-raised border border-border rounded-xl px-3 py-2 text-sm text-ink-primary focus:outline-none focus:border-gold">
            {SEASONS.map(s => <option key={s.id} value={s.id}>{s.label}</option>)}
          </select>
        </div>

        {/* Bulk Load */}
        {apiKey && (
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-1">Auto-Load Season</p>
            <p className="text-[11px] text-ink-muted mb-3">Pulls all wide US theatrical releases for the selected season and adds them automatically.</p>
            <button onClick={bulkLoadSeason} disabled={bulkLoading}
              className="w-full py-3 bg-gold text-black font-black rounded-xl text-sm disabled:opacity-50">
              {bulkLoading ? '⏳ Loading…' : '⚡ Auto-Load All Season Movies'}
            </button>
            {bulkProgress && (
              <p className={`text-[11px] mt-2 text-center font-medium ${bulkProgress.startsWith('✅') ? 'text-win' : 'text-gold'}`}>
                {bulkProgress}
              </p>
            )}
          </div>
        )}

        {/* Clear data */}
        <div className="bg-surface border border-red-900/30 rounded-2xl p-4">
          <p className="text-xs font-bold text-red-400 uppercase tracking-widest mb-3">Clear Season Data</p>
          <div className="flex gap-2">
            <button onClick={() => clearSeason(season)} disabled={!seasonMovies.filter(m => m.season === season).length}
              className="flex-1 py-2.5 bg-red-900/20 border border-red-500/30 text-red-400 font-bold rounded-xl text-xs hover:bg-red-900/40 disabled:opacity-30">
              🗑 Clear {season}<br/>
              <span className="text-[10px] font-normal">({seasonMovies.filter(m => m.season === season).length} movies)</span>
            </button>
            <button onClick={() => clearSeason('ALL')} disabled={!seasonMovies.length}
              className="flex-1 py-2.5 bg-red-900/20 border border-red-500/30 text-red-400 font-bold rounded-xl text-xs hover:bg-red-900/40 disabled:opacity-30">
              🗑 Clear ALL Seasons<br/>
              <span className="text-[10px] font-normal">({seasonMovies.length} total)</span>
            </button>
          </div>
        </div>

        {/* Search */}
        {apiKey && (
          <div className="bg-surface border border-border rounded-2xl p-4">
            <p className="text-xs font-bold text-ink-muted uppercase tracking-widest mb-2">Search TMDB</p>
            <div className="flex gap-2 mb-3">
              <input value={searchQuery} onChange={e => setSearchQuery(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && searchTmdb()}
                placeholder="Search for a specific movie…"
                className="flex-1 bg-raised border border-border rounded-xl px-3 py-2 text-sm text-ink-secondary focus:outline-none focus:border-gold" />
              <button onClick={searchTmdb} disabled={searching}
                className="px-4 py-2 bg-surface border border-border rounded-xl text-sm font-semibold text-ink-secondary">
                {searching ? '…' : 'Search'}
              </button>
            </div>
            <button onClick={() => { setSearchQuery(''); fetchUpcoming(1) }}
              className="w-full py-2 bg-gold/10 border border-gold/30 rounded-xl text-xs font-bold text-gold hover:bg-gold/20">
              📅 Browse Upcoming US Releases
            </button>
          </div>
        )}

        {/* TMDB Results */}
        {apiKey && tmdbMovies.length > 0 && (
          <div className="bg-surface border border-border rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-xs font-bold text-ink-muted uppercase tracking-widest">
                {searchQuery ? `Results for "${searchQuery}"` : 'Upcoming Releases'}
              </p>
              {!searchQuery && (
                <div className="flex gap-1">
                  <button onClick={() => fetchUpcoming(Math.max(1,page-1))} disabled={page<=1||loading} className="px-2 py-1 bg-raised rounded text-xs disabled:opacity-30">←</button>
                  <span className="px-2 py-1 text-xs text-ink-muted">{page}/{totalPages}</span>
                  <button onClick={() => fetchUpcoming(Math.min(totalPages,page+1))} disabled={page>=totalPages||loading} className="px-2 py-1 bg-raised rounded text-xs disabled:opacity-30">→</button>
                </div>
              )}
            </div>
            <div className="space-y-2 max-h-96 overflow-y-auto">
              {loading ? <div className="text-center py-8 text-ink-muted text-sm">Loading…</div> : (
                tmdbMovies.map(m => {
                  const added = isAdded(m.id)
                  return (
                    <div key={m.id} className="flex items-center gap-3 p-2 bg-raised rounded-xl">
                      {m.poster_path
                        ? <img src={`${TMDB_IMG}${m.poster_path}`} alt={m.title} className="w-10 h-14 object-cover rounded-lg flex-shrink-0" />
                        : <div className="w-10 h-14 bg-base rounded-lg flex-shrink-0 flex items-center justify-center text-lg">🎬</div>
                      }
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-semibold text-ink-primary truncate">{m.title}</p>
                        <p className="text-[11px] text-ink-muted">{m.release_date || 'TBD'}</p>
                      </div>
                      <button onClick={() => !added && addMovie(m)} disabled={added || adding === m.id}
                        className={`flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-bold transition-all ${
                          added ? 'bg-win/20 text-win border border-win/30' :
                          adding === m.id ? 'bg-gold/20 text-gold border border-gold/30 animate-pulse' :
                          'bg-gold text-black hover:bg-gold/80'
                        }`}>
                        {added ? '✓ Added' : adding === m.id ? 'Adding…' : '+ Add'}
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          </div>
        )}

        {/* Current movies in DB */}
        <div className="bg-surface border border-border rounded-2xl p-4">
          <div className="flex items-center justify-between mb-3">
            <p className="text-xs font-bold text-ink-muted uppercase tracking-widest">Season Movies ({seasonMovies.length})</p>
            <button onClick={loadSeasonMovies} className="text-[11px] text-ink-muted hover:text-ink-primary">Refresh</button>
          </div>
          {seasonMovies.length === 0 ? (
            <p className="text-xs text-ink-muted text-center py-4">No movies added yet.</p>
          ) : (
            <div className="space-y-2">
              {seasonMovies.map(m => (
                <div key={m.id} className="flex items-center gap-3 p-2 bg-raised rounded-xl">
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-ink-primary truncate">{m.title}</p>
                    <p className="text-[11px] text-ink-muted">{m.id} · {m.release_date || 'TBD'} · {m.season || '—'}</p>
                  </div>
                  <button onClick={() => removeMovie(m.id)}
                    className="flex-shrink-0 px-2 py-1 rounded-lg text-xs text-red-400 hover:bg-red-900/20 border border-red-900/30">
                    ✕
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <p className="text-center text-[10px] text-ink-muted">Movies added here appear in voting, leaderboard, and Fantasy on next reload.</p>
      </div>
    </div>
  )
}

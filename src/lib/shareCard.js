import { PLAYER_COLORS } from './movies'

export async function generateShareCard(playerName, ratings, globalRatings, movies) {
  const canvas = document.createElement('canvas')
  canvas.width = 800; canvas.height = 420
  const ctx = canvas.getContext('2d')

  // Background
  const bg = ctx.createLinearGradient(0, 0, 800, 420)
  bg.addColorStop(0, '#09080A'); bg.addColorStop(1, '#141416')
  ctx.fillStyle = bg; ctx.fillRect(0, 0, 800, 420)

  // Gold border
  ctx.strokeStyle = '#C8A040'; ctx.lineWidth = 2
  ctx.strokeRect(1, 1, 798, 418)

  // Header
  ctx.fillStyle = 'rgba(200,160,64,0.08)'; ctx.fillRect(0, 0, 800, 80)
  ctx.fillStyle = '#C8A040'; ctx.font = 'bold 11px Inter, sans-serif'
  ctx.textAlign = 'left'; ctx.fillText('FANTASY BOX OFFICE PRESENTS', 32, 28)
  ctx.fillStyle = '#F0F0F0'; ctx.font = 'bold 36px Inter, sans-serif'
  ctx.fillText('CineRank', 32, 62)
  ctx.fillStyle = PLAYER_COLORS[playerName] || '#C8A040'
  ctx.font = 'bold 28px Inter, sans-serif'; ctx.textAlign = 'right'
  ctx.fillText(playerName, 768, 54)

  // Top movies
  const ranked = [...movies]
    .filter(m => ratings[m.id]?.matches > 0)
    .sort((a, b) => ratings[b.id].elo - ratings[a.id].elo)
    .slice(0, 5)

  ctx.textAlign = 'left'
  ctx.fillStyle = 'rgba(200,160,64,0.5)'; ctx.font = 'bold 10px Inter, sans-serif'
  ctx.fillText('MY TOP 5', 32, 108)

  const medals = ['🥇','🥈','🥉','  4.','  5.']
  const posterPromises = ranked.slice(0, 5).map(m => new Promise(resolve => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve({ img, movie: m })
    img.onerror = () => resolve({ img: null, movie: m })
    img.src = m.img
  }))

  const loaded = await Promise.all(posterPromises)
  loaded.forEach(({ img, movie }, i) => {
    const x = 32 + i * 148, y = 120
    if (img) {
      ctx.drawImage(img, x, y, 100, 150)
    } else {
      ctx.fillStyle = '#2A2A2E'; ctx.fillRect(x, y, 100, 150)
    }
    // Medal
    ctx.font = '18px serif'; ctx.textAlign = 'center'
    ctx.fillText(i < 3 ? medals[i] : '', x + 50, y + 20)
    // Title
    ctx.fillStyle = '#F0F0F0'; ctx.font = 'bold 10px Inter, sans-serif'
    ctx.textAlign = 'center'
    const title = movie.title.length > 14 ? movie.title.slice(0, 13) + '…' : movie.title
    ctx.fillText(title, x + 50, y + 168)
    const r = ratings[movie.id]
    ctx.fillStyle = '#C8A040'; ctx.font = '10px Inter, sans-serif'
    ctx.fillText(`${r.elo} ELO`, x + 50, y + 182)
  })

  // Stats
  const totalM = Object.values(ratings).reduce((s, r) => s + (r.matches || 0), 0)
  const totalW = Object.values(ratings).reduce((s, r) => s + (r.wins || 0), 0)
  const seen = movies.filter(m => !ratings[m.id]?.unseen).length
  const stats = [
    { label: 'Matchups voted', value: Math.floor(totalM / 2) },
    { label: 'Movies seen', value: seen },
    { label: 'Best ELO', value: ranked[0] ? ratings[ranked[0].id].elo : '—' },
  ]
  stats.forEach((s, i) => {
    const x = 32 + i * 256
    ctx.fillStyle = '#2A2A2E'; ctx.fillRect(x, 320, 240, 64)
    ctx.fillStyle = '#C8A040'; ctx.font = 'bold 24px Inter, sans-serif'; ctx.textAlign = 'center'
    ctx.fillText(s.value, x + 120, 354)
    ctx.fillStyle = '#606060'; ctx.font = '10px Inter, sans-serif'
    ctx.fillText(s.label.toUpperCase(), x + 120, 372)
  })

  // Footer
  ctx.fillStyle = 'rgba(200,160,64,0.3)'; ctx.font = '10px Inter, sans-serif'; ctx.textAlign = 'center'
  ctx.fillText('cinerank.vercel.app', 400, 408)

  return new Promise(resolve => canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url; a.download = `cinerank-${playerName}.png`; a.click()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    resolve()
  }, 'image/png'))
}

const K = 32

export function applyElo(ratings, winnerId, loserId) {
  const wR = ratings[winnerId] || { elo: 1000, wins: 0, losses: 0, matches: 0 }
  const lR = ratings[loserId]  || { elo: 1000, wins: 0, losses: 0, matches: 0 }
  const expected = 1 / (1 + Math.pow(10, (lR.elo - wR.elo) / 400))
  return {
    [winnerId]: { ...wR, elo: Math.round(wR.elo + K * (1 - expected)), wins: wR.wins + 1, matches: wR.matches + 1 },
    [loserId]:  { ...lR, elo: Math.round(lR.elo - K * expected),       losses: lR.losses + 1, matches: lR.matches + 1 },
  }
}

export function pairKey(a, b) {
  return [a, b].sort().join('__')
}

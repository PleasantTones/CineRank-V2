let ctx = null

function getCtx() {
  if (!ctx) ctx = new (window.AudioContext || window.webkitAudioContext)()
  return ctx
}

export function playPop(muted) {
  if (muted) return
  try {
    const c = getCtx()
    const buf = c.createBuffer(1, Math.floor(c.sampleRate * 0.06), c.sampleRate)
    const d = buf.getChannelData(0)
    for (let i = 0; i < d.length; i++) {
      d[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / d.length, 3)
    }
    const src = c.createBufferSource()
    const gain = c.createGain()
    src.buffer = buf
    src.connect(gain)
    gain.connect(c.destination)
    gain.gain.setValueAtTime(0.18, c.currentTime)
    src.start()
  } catch(e) {}
}

export function playSuccess(muted) {
  if (muted) return
  try {
    const c = getCtx()
    ;[523, 659, 784].forEach((freq, i) => {
      const osc = c.createOscillator()
      const gain = c.createGain()
      osc.connect(gain); gain.connect(c.destination)
      osc.frequency.value = freq
      osc.type = 'sine'
      gain.gain.setValueAtTime(0, c.currentTime + i * 0.08)
      gain.gain.linearRampToValueAtTime(0.12, c.currentTime + i * 0.08 + 0.02)
      gain.gain.linearRampToValueAtTime(0, c.currentTime + i * 0.08 + 0.15)
      osc.start(c.currentTime + i * 0.08)
      osc.stop(c.currentTime + i * 0.08 + 0.15)
    })
  } catch(e) {}
}

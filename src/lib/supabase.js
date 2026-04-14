import { createClient } from '@supabase/supabase-js'

export const supabase = createClient(
  'https://xazujgbxeyzbcfzaainz.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhenVqZ2J4ZXl6YmNmemFhaW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwOTY1OTcsImV4cCI6MjA5MDY3MjU5N30.NmLZMziDB-ydM4I39lj7rCsV-wnWqCy2L8BEp0b6NrQ'
)

export async function sbFetch(path, opts = {}) {
  const url = 'https://xazujgbxeyzbcfzaainz.supabase.co' + path
  const headers = {
    'apikey': 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhenVqZ2J4ZXl6YmNmemFhaW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwOTY1OTcsImV4cCI6MjA5MDY3MjU5N30.NmLZMziDB-ydM4I39lj7rCsV-wnWqCy2L8BEp0b6NrQ',
    'Authorization': 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InhhenVqZ2J4ZXl6YmNmemFhaW56Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzUwOTY1OTcsImV4cCI6MjA5MDY3MjU5N30.NmLZMziDB-ydM4I39lj7rCsV-wnWqCy2L8BEp0b6NrQ',
    'Content-Type': 'application/json',
    ...(opts.prefer ? { 'Prefer': opts.prefer } : {}),
  }
  const res = await fetch(url, { ...opts, headers })
  if (!res.ok) throw new Error(await res.text())
  if (res.status === 204 || res.headers.get('content-length') === '0') return null
  const text = await res.text()
  return text ? JSON.parse(text) : null
}

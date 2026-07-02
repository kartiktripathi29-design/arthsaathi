// Reads `eslint . --format json` from stdin; reports problem counts grouped by non-src file.
let d = ''
process.stdin.on('data', c => (d += c)).on('end', () => {
  const r = JSON.parse(d)
  const rows = r.filter(f => f.messages.length).map(f => {
    const p = f.filePath.replace(/\\/g, '/').split('/arthsaathi/').pop()
    return { f: p, n: f.messages.length }
  })
  const nonsrc = rows.filter(x => !x.f.startsWith('src/')).sort((a, b) => b.n - a.n)
  console.log('NON-SRC problem files (top 15):')
  nonsrc.slice(0, 15).forEach(x => console.log(String(x.n).padStart(8), x.f))
  console.log('non-src total:', nonsrc.reduce((s, x) => s + x.n, 0), 'across', nonsrc.length, 'files')
})

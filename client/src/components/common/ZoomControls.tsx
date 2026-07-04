// Explicit + / − / reset zoom buttons — essential on touch devices where there
// is no scroll wheel. Sits over a react-zoom-pan-pinch map.
export function ZoomControls({ zoomIn, zoomOut, reset, size = 'md' }: {
  zoomIn: () => void; zoomOut: () => void; reset: () => void; size?: 'md' | 'lg'
}) {
  const dim = size === 'lg' ? 44 : 34
  const btn: React.CSSProperties = {
    width: dim, height: dim, borderRadius: 8, border: '1px solid #3a4655',
    background: 'rgba(14,18,24,0.9)', color: '#e6ead0', fontSize: size === 'lg' ? 24 : 19,
    fontWeight: 'bold', cursor: 'pointer', display: 'flex', alignItems: 'center',
    justifyContent: 'center', lineHeight: 1, userSelect: 'none', boxShadow: '0 2px 8px rgba(0,0,0,0.4)',
  }
  return (
    <div style={{ position: 'absolute', right: 10, bottom: 10, display: 'flex', flexDirection: 'column', gap: 6, zIndex: 50 }}>
      <button aria-label="Zoom in" onClick={zoomIn} style={btn}>+</button>
      <button aria-label="Zoom out" onClick={zoomOut} style={btn}>−</button>
      <button aria-label="Reset zoom" onClick={reset} style={{ ...btn, fontSize: size === 'lg' ? 18 : 14 }}>⟲</button>
    </div>
  )
}

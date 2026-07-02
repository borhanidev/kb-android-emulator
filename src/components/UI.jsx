import { useState, useEffect, useRef, useCallback } from 'react'

export function useToast() {
  const [toasts, setToasts] = useState([])
  const add = useCallback((msg, type = 'info') => {
    const id = Date.now()
    setToasts(t => [...t, { id, msg, type }])
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 3500)
  }, [])
  return { toasts, toast: add }
}

export function ToastContainer({ toasts }) {
  if (!toasts.length) return null
  const icons = { success: '✅', error: '❌', info: 'ℹ️', warn: '⚠️' }
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{icons[t.type] || 'ℹ️'}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  )
}

export function ProgressBar({ value = 0 }) {
  return (
    <div className="progress-wrap">
      <div className="progress-bar" style={{ width: `${Math.min(100, value)}%` }} />
    </div>
  )
}

export function Spinner({ size = 18 }) {
  return <div className="spinner" style={{ width: size, height: size }} />
}

export function ConsoleLog({ lines = [] }) {
  const ref = useRef(null)
  useEffect(() => {
    if (ref.current) ref.current.scrollTop = ref.current.scrollHeight
  }, [lines])

  const classify = (line) => {
    if (/✅|success|installed|done/i.test(line)) return 'success'
    if (/❌|error|fail|exception/i.test(line)) return 'error'
    if (/warn|warning/i.test(line)) return 'warn'
    if (/📥|📦|🚀|▶|info/i.test(line)) return 'info'
    return ''
  }

  return (
    <div className="console-wrap" ref={ref}>
      {lines.length === 0 && (
        <div className="console-line text-muted">// Console output will appear here...</div>
      )}
      {lines.map((line, i) => (
        <div key={i} className={`console-line ${classify(line)}`}>
          <span className="text-muted font-mono" style={{ userSelect: 'none', marginRight: 8 }}>
            {String(i + 1).padStart(3, '0')}
          </span>
          {line}
        </div>
      ))}
    </div>
  )
}

export function Toggle({ value, onChange, label }) {
  return (
    <label className="toggle-wrap" onClick={() => onChange(!value)} style={{ cursor: 'pointer' }}>
      <div className={`toggle ${value ? 'on' : ''}`} />
      {label && <span className="toggle-label">{label}</span>}
    </label>
  )
}

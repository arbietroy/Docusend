import { useCallback, useEffect, useRef, useState } from 'react'

// Runs an async loader and tracks loading/error. `reload()` re-runs it.
export function useAsync(loader, deps = []) {
  const [state, setState] = useState({ data: null, error: null, loading: true })
  const latest = useRef(0)

  const run = useCallback(async () => {
    const id = ++latest.current
    setState(s => ({ ...s, loading: true, error: null }))
    try {
      const data = await loader()
      if (id === latest.current) setState({ data, error: null, loading: false })
    } catch (error) {
      if (id === latest.current) setState(s => ({ ...s, error, loading: false }))
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)

  useEffect(() => { run() }, [run])
  return { ...state, reload: run }
}

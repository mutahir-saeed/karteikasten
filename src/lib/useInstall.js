import { useEffect, useState } from 'react'

// Manages the "Add to Home Screen" install experience.
// - On Chromium (Android/desktop) we capture `beforeinstallprompt` and can
//   trigger the native install dialog directly.
// - On iOS Safari there is no such event, so we surface manual instructions.
export function useInstall() {
  const [deferred, setDeferred] = useState(null)
  const [installed, setInstalled] = useState(false)

  const isStandalone =
    typeof window !== 'undefined' &&
    (window.matchMedia?.('(display-mode: standalone)').matches ||
      window.navigator.standalone === true)

  const isIOS =
    typeof navigator !== 'undefined' &&
    /iphone|ipad|ipod/i.test(navigator.userAgent) &&
    !/crios|fxios/i.test(navigator.userAgent)

  useEffect(() => {
    function onPrompt(e) {
      e.preventDefault()
      setDeferred(e)
    }
    function onInstalled() {
      setInstalled(true)
      setDeferred(null)
    }
    window.addEventListener('beforeinstallprompt', onPrompt)
    window.addEventListener('appinstalled', onInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onPrompt)
      window.removeEventListener('appinstalled', onInstalled)
    }
  }, [])

  async function promptInstall() {
    if (deferred) {
      deferred.prompt()
      const { outcome } = await deferred.userChoice
      if (outcome === 'accepted') setInstalled(true)
      setDeferred(null)
      return outcome
    }
    return 'unavailable'
  }

  // Whether to show an install affordance at all.
  const canShow = !isStandalone && !installed && (deferred || isIOS)

  return { canShow, canPrompt: !!deferred, isIOS, isStandalone, promptInstall }
}

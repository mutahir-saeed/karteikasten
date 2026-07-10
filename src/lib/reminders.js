// Daily study reminders via the Notification Triggers API (TimestampTrigger).
//
// This lets an installed PWA fire a local notification at a set time even when
// the app is closed — no server needed. Support is currently Chromium/Android
// for installed PWAs; we feature-detect and degrade gracefully elsewhere.

const STORE_KEY = 'karteikasten:reminder'
const DAYS_AHEAD = 7 // schedule a rolling week so it keeps firing between opens

export function triggersSupported() {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'Notification' in window &&
    'TimestampTrigger' in window
  )
}

export function notificationsSupported() {
  return typeof window !== 'undefined' && 'Notification' in window && 'serviceWorker' in navigator
}

export function getPermission() {
  return notificationsSupported() ? Notification.permission : 'denied'
}

export async function requestPermission() {
  if (!notificationsSupported()) return 'denied'
  return Notification.requestPermission()
}

// Persisted reminder preference.
export function loadReminder() {
  try {
    return JSON.parse(localStorage.getItem(STORE_KEY)) || { enabled: false, time: '19:00' }
  } catch {
    return { enabled: false, time: '19:00' }
  }
}

export function saveReminder(pref) {
  localStorage.setItem(STORE_KEY, JSON.stringify(pref))
}

function nextOccurrences(hour, minute, days) {
  const out = []
  const now = Date.now()
  for (let i = 0; i < days + 1 && out.length < days; i++) {
    const d = new Date()
    d.setDate(d.getDate() + i)
    d.setHours(hour, minute, 0, 0)
    if (d.getTime() > now) out.push(d.getTime())
  }
  return out
}

async function clearScheduled(reg) {
  try {
    const pending = await reg.getNotifications({ includeTriggered: false })
    pending.filter((n) => n.tag?.startsWith('daily-reminder')).forEach((n) => n.close())
  } catch {
    /* getNotifications may reject on some browsers; ignore */
  }
}

// Schedule (or reschedule) the rolling week of daily reminders.
export async function scheduleDaily(time) {
  if (!triggersSupported()) return false
  if (getPermission() !== 'granted') return false
  const reg = await navigator.serviceWorker.ready
  await clearScheduled(reg)
  const [h, m] = time.split(':').map(Number)
  const times = nextOccurrences(h, m, DAYS_AHEAD)
  for (let i = 0; i < times.length; i++) {
    await reg.showNotification('Karteikasten — time to review 🗃️', {
      tag: `daily-reminder-${i}`,
      body: 'Your due cards are waiting. A few swipes keeps them in memory.',
      icon: '/icons/icon-192.png',
      badge: '/icons/icon-192.png',
      requireInteraction: false,
      showTrigger: new window.TimestampTrigger(times[i]),
      data: { url: '/' },
    })
  }
  return true
}

export async function cancelDaily() {
  if (!('serviceWorker' in navigator)) return
  const reg = await navigator.serviceWorker.ready
  await clearScheduled(reg)
}

// Called on app start: keep the rolling schedule fresh if reminders are on.
export async function syncReminders() {
  const pref = loadReminder()
  if (pref.enabled && triggersSupported() && getPermission() === 'granted') {
    await scheduleDaily(pref.time)
  }
}

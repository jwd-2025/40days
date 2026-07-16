/** "2 hours ago", "3 days ago", "Just now", or "Never" for a null timestamp. */
export function formatLastSeen(iso: string | null | undefined): string {
  if (!iso) return 'Never'

  const then = new Date(iso).getTime()
  const diffSeconds = Math.floor((Date.now() - then) / 1000)
  if (diffSeconds < 60) return 'Just now'

  const diffMinutes = Math.floor(diffSeconds / 60)
  if (diffMinutes < 60) return `${diffMinutes} minute${diffMinutes === 1 ? '' : 's'} ago`

  const diffHours = Math.floor(diffMinutes / 60)
  if (diffHours < 24) return `${diffHours} hour${diffHours === 1 ? '' : 's'} ago`

  const diffDays = Math.floor(diffHours / 24)
  if (diffDays < 30) return `${diffDays} day${diffDays === 1 ? '' : 's'} ago`

  return new Date(iso).toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

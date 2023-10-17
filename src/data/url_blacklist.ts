export const blacklistUrls = [
    'gstatic',
    'cdn',
    'about:',
]

export function isUrlBlacklisted(url: string) {
    return blacklistUrls.some(blacklistUrl => url.includes(blacklistUrl))
}
/**
 * Attachment helpers shared by the capture input and the edit modal.
 */

interface NominatimResponse {
    display_name?: string
}

/**
 * Resolve the device position to a short human-readable address via
 * Nominatim, falling back to raw coordinates, then to an error label.
 * Always resolves to a displayable string.
 */
export async function resolveCurrentLocation(): Promise<string> {
    if (!navigator.geolocation) return 'Location not supported'
    try {
        const position = await new Promise<GeolocationPosition>((resolve, reject) => {
            navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 10000 })
        })
        const { latitude, longitude } = position.coords
        const coordinates = `${latitude.toFixed(4)}, ${longitude.toFixed(4)}`
        try {
            const response = await fetch(
                `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}`,
            )
            if (!response.ok) return coordinates
            const data = await response.json() as NominatimResponse
            return data.display_name?.split(',').slice(0, 3).join(',') || coordinates
        } catch {
            return coordinates
        }
    } catch {
        return 'Unable to get location'
    }
}

/** Append location and image attachment lines to entry content. */
export function appendAttachmentLines(
    content: string,
    { location, imageUrl }: { location?: string | null; imageUrl?: string | null },
): string {
    let result = content.trim()
    if (location) result += `\n📍 ${location}`
    if (imageUrl) result += `\n🖼️ ${imageUrl}`
    return result
}

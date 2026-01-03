import type { RequestHandler } from './$types'

export const GET: RequestHandler = async ({ url, locals }) => {
    if (!import.meta.env.DEV) {
        return new Response('Not Found', { status: 404 })
    }

    const emailParam = (url.searchParams.get('email') || '')
    const trimmed = emailParam.trim()
    const normalized = trimmed.toLowerCase()

    const { data, error } = await locals.supabase
        .from('users')
        .select('id, email')
        .limit(100)

    if (error) {
        return new Response(JSON.stringify({ error: error.message }), {
            status: 500,
            headers: { 'Content-Type': 'application/json' },
        })
    }

    const rows = (data || []) as Array<{ id: string; email: string }>

    const exactMatch = rows.find(r => (r.email || '').trim() === trimmed)
    const normalizedMatch = rows.find(r => (r.email || '').trim().toLowerCase() === normalized)

    return new Response(
        JSON.stringify({
            queriedEmail: emailParam,
            trimmed,
            normalized,
            exactMatch: exactMatch || null,
            normalizedMatch: normalizedMatch || null,
            sample: rows.slice(0, 20),
        }),
        { headers: { 'Content-Type': 'application/json' } }
    )
}

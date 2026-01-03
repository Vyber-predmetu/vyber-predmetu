import type { RequestHandler } from './$types'

export const POST: RequestHandler = async ({ locals: { supabase } }) => {
  console.debug('logout endpoint called')
  const { error } = await supabase.auth.signOut()

  if (error) {
    console.error('logout failed', error)
    return new Response(JSON.stringify({ success: false, error: (error.message || error) }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    })
  }

  console.debug('logout successful')
  return new Response(JSON.stringify({ success: true }), {
    status: 200,
    headers: { 'Content-Type': 'application/json' },
  })
}
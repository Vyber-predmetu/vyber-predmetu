import { redirect } from '@sveltejs/kit'
import type { PageServerLoad } from './$types'

export const load: PageServerLoad = async ({ parent }) => {
  const { session, user } = await parent()

  if (!session) {
    throw redirect(303, '/auth/login')
  }

  return {
    user,
  }
}
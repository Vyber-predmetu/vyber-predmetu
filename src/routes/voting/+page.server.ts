import { redirect } from '@sveltejs/kit';
import { getServiceClient } from '$lib/supabase-service.server';
import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async ({ parent }) => {
  const { session, user } = await parent();

  if (!session) {
    throw redirect(303, '/auth/login');
  }

  const supabase = getServiceClient();

  if (!user || !user.email) {
    return { user: null };
  }

  const { data: dbUser, error: dbUserError } = await supabase
    .from('users')
    .select('id, email')
    .eq('email', user.email)
    .single();

  if (!dbUser || dbUserError) {
    return { user: null };
  }

  return {
    user: { ...user, id: user.id, db_id: dbUser.id }
  };
};

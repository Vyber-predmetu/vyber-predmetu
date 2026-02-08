import { redirect } from '@sveltejs/kit'
import { getServiceClient } from '$lib/supabase-service.server'
import type { ServerLoad } from '@sveltejs/kit'

export const load: ServerLoad = async ({ parent }) => {
	const { session, user } = await parent()

	if (!session) {
		throw redirect(303, '/auth/login')
	}

	const supabase = getServiceClient();
	const { data: dbUser } = await supabase
		.from('users')
		.select('id')
		.ilike('email', user.email)
		.single();

	if (!dbUser) {
		throw redirect(303, '/auth/login')
	}

	const { data: userRoles } = await supabase
		.from('user_roles')
		.select('role_id, roles(role_name)')
		.eq('user_id', dbUser.id);

	const hasTeacherRole = userRoles?.some((ur) => (ur.roles as any)?.role_name === 'teacher');

	if (!hasTeacherRole) {
		throw redirect(303, '/auth/login')
	}

	return {
		user
	}
}

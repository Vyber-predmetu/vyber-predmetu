import { redirect } from '@sveltejs/kit';
import { getServiceClient } from '$lib/supabase-service.server';
import type { ServerLoad } from '@sveltejs/kit';

export const load: ServerLoad = async ({ parent }) => {
	const { session, user } = await parent();

	if (!session) {
		throw redirect(303, '/auth/login');
	}

	const supabase = getServiceClient();
	const { data: dbUser } = await supabase
		.from('users')
		.select('id')
		.ilike('email', user.email)
		.single();

	if (!dbUser) {
		throw redirect(303, '/auth/login');
	}

	const { data: userRoles } = await supabase
		.from('user_roles')
		.select('role_id, roles(role_name)')
		.eq('user_id', dbUser.id);

	const hasAdminRole = userRoles?.some((ur) => (ur.roles as any)?.role_name === 'admin');

	if (!hasAdminRole) {
		throw redirect(303, '/auth/login');
	}

	const { data: submissionWindow } = await supabase
		.from('submission_window')
		.select('id, start, end')
		.order('id', { ascending: false })
		.limit(1)
		.single();

	return {
		user,
		submissionWindow
	};
};

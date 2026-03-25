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

	const { data: subjects } = await supabase
		.from('subjects')
		.select('id, name, description, subject_type, target_grade, state, created_at, teacher_id')
		.order('state', { ascending: true })
		.order('created_at', { ascending: false });

	const teacherIds = [...new Set((subjects ?? []).map((s) => s.teacher_id))];
	let teacherEmails: Record<string, string> = {};
	if (teacherIds.length > 0) {
		const { data: teachers } = await supabase
			.from('users')
			.select('id, email')
			.in('id', teacherIds);
		if (teachers) {
			for (const t of teachers) {
				teacherEmails[t.id] = t.email;
			}
		}
	}

	return {
		user,
		subjects: subjects ?? [],
		teacherEmails
	};
};

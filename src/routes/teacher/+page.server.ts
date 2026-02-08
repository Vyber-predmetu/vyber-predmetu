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


		const { data: submissionWindow } = await supabase
			.from('submission_window')
			.select('submissions_start, submissions_end')
			.order('id', { ascending: false })
			.limit(1)
			.single();

		const { data: subjects } = await supabase
			.from('subjects')
			.select('*')
			.eq('teacher_id', dbUser.id)
			.order('created_at', { ascending: false });

		return {
			user,
			submissionWindow,
			subjects
		}
}

import { fail } from '@sveltejs/kit';
export const actions = {
	addSubject: async ({ request, locals }) => {
		const { session, user } = await locals.safeGetSession();
		if (!session) {
			throw redirect(303, '/auth/login');
		}
		const form = await request.formData();
		const name = (form.get('name') || '').toString().trim();
		const description = (form.get('description') || '').toString().trim();
		const target_grade = form.get('target_grade');
		const type_of_subject = form.get('type_of_subject');

		if (!name || !description || !target_grade || !type_of_subject) {
			return fail(400, { error: 'Všechna pole jsou povinná.' });
		}
		if (type_of_subject === 'MVOP' && target_grade !== '3') {
			return fail(400, { error: 'MVOP předmět může být pouze pro 3. ročník.' });
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

		const { data: existing } = await supabase
			.from('subjects')
			.select('id')
			.eq('name', name)
			.eq('target_grade', target_grade)
			.maybeSingle();
		if (existing) {
			return fail(400, { error: 'Předmět s tímto názvem pro tento ročník již existuje.' });
		}

		const { data: inserted, error } = await supabase
			.from('subjects')
			.insert({
				teacher_id: dbUser.id,
				target_grade,
				name,
				description,
				type_of_subject
			})
			.select()
			.single();
		if (error) {
			let msg = error.message;
			if (msg.includes('duplicate key value') || msg.includes('already exists')) {
				msg = 'Předmět s tímto názvem již existuje.';
			}
			return fail(400, { error: msg });
		}
		return { success: true, subject: inserted };
	}
};

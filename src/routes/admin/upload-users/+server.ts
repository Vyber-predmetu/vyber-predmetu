import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';
import { getServiceClient } from '$lib/supabase-service.server';
import * as XLSX from 'xlsx';

interface UserRow {
	email: string;
	first_name: string;
	last_name: string;
	role: 'student' | 'teacher' | 'admin';
	class_letter?: string;
	graduation_year?: number;
}

export const POST: RequestHandler = async ({ request, locals }) => {
	try {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user?.email) {
			return json({ error: 'Nejste přihlášen' }, { status: 401 });
		}

		const supabase = getServiceClient();

		const { data: dbUser } = await supabase
			.from('users')
			.select('id')
			.eq('email', user.email)
			.single();

		if (!dbUser) {
			return json({ error: 'Uživatel nenalezen' }, { status: 403 });
		}

		const { data: userRoles } = await supabase
			.from('user_roles')
			.select('role_id, roles(role_name)')
			.eq('user_id', dbUser.id);

		const isAdmin = userRoles?.some((ur) => (ur.roles as any)?.role_name === 'admin');

		if (!isAdmin) {
			return json({ error: 'Nemáte oprávnění nahrávat uživatele' }, { status: 403 });
		}

		const formData = await request.formData();
		const file = formData.get('file') as File;

		if (!file) {
			return json({ error: 'Žádný soubor nebyl nahrán' }, { status: 400 });
		}

		const arrayBuffer = await file.arrayBuffer();
		const buffer = Buffer.from(arrayBuffer);
		
		const workbook = XLSX.read(buffer, { 
			type: 'buffer',
			codepage: 65001, 
			raw: false
		});
		const sheetName = workbook.SheetNames[0];
		const worksheet = workbook.Sheets[sheetName];
		
		let data = XLSX.utils.sheet_to_json<any>(worksheet, { 
			raw: false,
			defval: ''
		});

		const firstRow = data[0] as any;
		if (firstRow && Object.values(firstRow).some(val => 
			typeof val === 'string' && ['email', 'first_name', 'last_name', 'role'].includes(val.toLowerCase())
		)) {
			const range = XLSX.utils.decode_range(worksheet['!ref'] || 'A1');
			range.s.r = 1; 
			worksheet['!ref'] = XLSX.utils.encode_range(range);
			data = XLSX.utils.sheet_to_json<any>(worksheet);
		}

		if (data.length === 0) {
			return json({ error: 'Soubor je prázdný' }, { status: 400 });
		}

		if (data.length > 0) {
			console.log('První řádek dat:', data[0]);
			console.log('Klíče:', Object.keys(data[0]));
		}

		const errors: string[] = [];
		let successCount = 0;

		const { data: rolesData, error: rolesError } = await supabase
			.from('roles')
			.select('id, role_name');

		if (rolesError) {
			return json({ error: 'Chyba při načítání rolí: ' + rolesError.message }, { status: 500 });
		}

		const rolesMap = new Map<string, string>();
		rolesData?.forEach((role) => {
			rolesMap.set(role.role_name, role.id);
		});

		for (let i = 0; i < data.length; i++) {
			const row = data[i];
			const rowNum = i + 2; 

			try {
				const normalizedRow: any = {};
				Object.keys(row).forEach(key => {
					const normalizedKey = key.trim().toLowerCase().replace(/\s+/g, '_');
					normalizedRow[normalizedKey] = row[key];
				});

				if (!normalizedRow.email || !normalizedRow.first_name || !normalizedRow.last_name || !normalizedRow.role) {
					errors.push(`Řádek ${rowNum}: Chybí povinné pole (dostupné klíče: ${Object.keys(normalizedRow).join(', ')})`);
					continue;
				}

				const email = normalizedRow.email;
				const first_name = normalizedRow.first_name;
				const last_name = normalizedRow.last_name;
				const role = normalizedRow.role;
				const class_letter = normalizedRow.class_letter;
				const graduation_year = normalizedRow.graduation_year;

				if (!['student', 'teacher', 'admin'].includes(role)) {
					errors.push(`Řádek ${rowNum}: Neplatná role "${role}"`);
					continue;
				}

				const roleId = rolesMap.get(role);
				if (!roleId) {
					errors.push(`Řádek ${rowNum}: Role "${role}" nebyla nalezena v databázi`);
					continue;
				}

				const userId = crypto.randomUUID();

				const userData: any = {
					id: userId,
					email: email,
					first_name: first_name,
					last_name: last_name
				};

				if (role === 'student') {
					if (class_letter) {
						userData.class_letter = class_letter;
					}
					if (graduation_year) {
						userData.graduation_year = graduation_year;
					}
				}

				const { error: userError } = await supabase
					.from('users')
					.insert(userData);

				if (userError) {
					errors.push(`Řádek ${rowNum}: Chyba při vytváření uživatele - ${userError.message}`);
					continue;
				}

				const userRoleId = crypto.randomUUID();

				const { error: userRoleError } = await supabase
					.from('user_roles')
					.insert({
						id: userRoleId,
						user_id: userId,
						role_id: roleId
					});

				if (userRoleError) {
					await supabase.from('users').delete().eq('id', userId);
					errors.push(`Řádek ${rowNum}: Chyba při vytváření vazby role - ${userRoleError.message}`);
					continue;
				}

				successCount++;
			} catch (e) {
				errors.push(`Řádek ${rowNum}: ${e instanceof Error ? e.message : 'Neznámá chyba'}`);
			}
		}

		return json({
			success: successCount,
			errors: errors
		});
	} catch (e) {
		console.error('Upload error:', e);
		return json(
			{ error: e instanceof Error ? e.message : 'Neznámá chyba při zpracování souboru' },
			{ status: 500 }
		);
	}
};

export const GET: RequestHandler = async ({ locals, url }) => {
	try {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user?.email) {
			return json({ error: 'Nejste přihlášen' }, { status: 401 });
		}

		console.log('GET /admin/upload-users - user email:', user.email);
		console.log('Auth user id:', user.id);

		const supabase = getServiceClient();

		const { data: allUsers } = await supabase
			.from('users')
			.select('id, email');
		
		console.log('All users in DB:', allUsers);

		const { data: dbUser, error: userError } = await supabase
			.from('users')
			.select('id')
			.eq('email', user.email)
			.single();

		console.log('DB user:', dbUser, 'error:', userError);

		if (!dbUser) {
			const { data: userRoles } = await supabase
				.from('user_roles')
				.select('role_id, roles(role_name)')
				.eq('user_id', user.id);

			console.log('User roles by auth ID:', userRoles);

			const isAdmin = userRoles?.some((ur) => (ur.roles as any)?.role_name === 'admin');

			if (!isAdmin) {
				return json({ error: 'Nemáte oprávnění - nejste v users tabulce ani nemáte admin roli přes auth ID' }, { status: 403 });
			}
		} else {
			const { data: userRoles, error: rolesError } = await supabase
				.from('user_roles')
				.select('role_id, roles(role_name)')
				.eq('user_id', dbUser.id);

			console.log('User roles:', userRoles, 'error:', rolesError);

			const isAdmin = userRoles?.some((ur) => (ur.roles as any)?.role_name === 'admin');

			console.log('Is admin:', isAdmin);

			if (!isAdmin) {
				return json({ error: 'Nemáte oprávnění' }, { status: 403 });
			}
		}

		const { data: users, error } = await supabase
			.from('users')
			.select(`
				id,
				email,
				first_name,
				last_name,
				class_letter,
				graduation_year,
				user_roles(
					roles(role_name)
				)
			`)
			.order('email');

		if (error) {
			return json({ error: error.message }, { status: 500 });
		}

		const formattedUsers = users?.map(u => ({
			id: u.id,
			email: u.email,
			first_name: u.first_name,
			last_name: u.last_name,
			class_letter: u.class_letter || '',
			graduation_year: u.graduation_year || '',
			role_name: (u.user_roles[0]?.roles as any)?.role_name || ''
		})) || [];

		return json({ users: formattedUsers });
	} catch (e) {
		console.error('Load error:', e);
		return json(
			{ error: e instanceof Error ? e.message : 'Neznámá chyba' },
			{ status: 500 }
		);
	}
};

export const PATCH: RequestHandler = async ({ request, locals }) => {
	try {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user?.id) {
			return json({ error: 'Nejste přihlášen' }, { status: 401 });
		}

		const supabase = getServiceClient();

		const { data: userRoles } = await supabase
			.from('user_roles')
			.select('role_id, roles(role_name)')
			.eq('user_id', user.id);

		const isAdmin = userRoles?.some((ur) => (ur.roles as any)?.role_name === 'admin');

		if (!isAdmin) {
			return json({ error: 'Nemáte oprávnění' }, { status: 403 });
		}

		const { users } = await request.json();
		
		if (!Array.isArray(users)) {
			return json({ error: 'Neplatná data' }, { status: 400 });
		}

		const errors: string[] = [];
		let updated = 0;

		const { data: rolesData } = await supabase
			.from('roles')
			.select('id, role_name');

		const roleMap = new Map(rolesData?.map(r => [r.role_name, r.id]) || []);

		for (const userData of users) {
			try {
				const { error: updateError } = await supabase
					.from('users')
					.update({
						email: userData.email,
						first_name: userData.first_name,
						last_name: userData.last_name,
						class_letter: userData.class_letter || null,
						graduation_year: userData.graduation_year ? parseInt(userData.graduation_year) : null
					})
					.eq('id', userData.id);

				if (updateError) {
					errors.push(`${userData.email}: ${updateError.message}`);
					continue;
				}

				if (userData.role_name) {
					const roleId = roleMap.get(userData.role_name);
					if (roleId) {
						await supabase
							.from('user_roles')
							.delete()
							.eq('user_id', userData.id);

						await supabase
							.from('user_roles')
							.insert({
								id: crypto.randomUUID(),
								user_id: userData.id,
								role_id: roleId
							});
					}
				}

				updated++;
			} catch (e) {
				errors.push(`${userData.email}: ${e instanceof Error ? e.message : 'Chyba'}`);
			}
		}

		return json({
			updated,
			errors
		});
	} catch (e) {
		console.error('Update error:', e);
		return json(
			{ error: e instanceof Error ? e.message : 'Neznámá chyba' },
			{ status: 500 }
		);
	}
};

export const DELETE: RequestHandler = async ({ request, locals }) => {
	try {
		const { session, user } = await locals.safeGetSession();
		if (!session || !user?.email) {
			return json({ error: 'Nejste přihlášen' }, { status: 401 });
		}

		const supabase = getServiceClient();

		const { data: dbUser } = await supabase
			.from('users')
			.select('id')
			.eq('email', user.email)
			.single();

		if (!dbUser) {
			return json({ error: 'Uživatel nenalezen v databázi' }, { status: 403 });
		}

		const { data: userRoles } = await supabase
			.from('user_roles')
			.select('role_id, roles(role_name)')
			.eq('user_id', dbUser.id);

		const isAdmin = userRoles?.some((ur) => (ur.roles as any)?.role_name === 'admin');

		if (!isAdmin) {
			return json({ error: 'Nemáte oprávnění' }, { status: 403 });
		}

		const { userIds } = await request.json();
		
		if (!Array.isArray(userIds) || userIds.length === 0) {
			return json({ error: 'Neplatná data' }, { status: 400 });
		}

		const errors: string[] = [];
		let deleted = 0;

		for (const userId of userIds) {
			try {
				const { error: deleteError } = await supabase
					.from('users')
					.delete()
					.eq('id', userId);

				if (deleteError) {
					errors.push(`Uživatel ${userId}: ${deleteError.message}`);
					continue;
				}

				deleted++;
			} catch (e) {
				errors.push(`Uživatel ${userId}: ${e instanceof Error ? e.message : 'Chyba'}`);
			}
		}

		return json({
			deleted,
			errors
		});
	} catch (e) {
		console.error('Delete error:', e);
		return json(
			{ error: e instanceof Error ? e.message : 'Neznámá chyba' },
			{ status: 500 }
		);
	}
};

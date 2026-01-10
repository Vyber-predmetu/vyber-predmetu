<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		data: {
			roles: Array<{ id: string; name: string }>;
		};
	}

	let { data }: Props = $props();

	function getRoleName(role: string) {
		switch (role) {
			case 'student':
				return 'Student';
			case 'teacher':
				return 'Učitel';
			case 'admin':
				return 'Administrátor';
			default:
				return role;
		}
	}

	function getRoleDashboard(role: string) {
		switch (role) {
			case 'student':
				return '/student';
			case 'teacher':
				return '/teacher';
			case 'admin':
				return '/admin';
			default:
				return '/student';
		}
	}

	function selectRole(role: string) {
		const dashboard = getRoleDashboard(role);
		goto(dashboard);
	}
</script>

<div class="flex min-h-screen items-center justify-center bg-gray-100">
	<div class="w-full max-w-md rounded-lg bg-white p-8 shadow-lg">
		<h1 class="mb-6 text-center text-2xl font-bold text-gray-900">Vyberte svou roli</h1>
		<p class="mb-8 text-center text-gray-600">
			Máte přiřazeno více rolí. Vyberte, jako kdo se chcete přihlásit:
		</p>

		<div class="space-y-4">
			{#each data.roles as role}
				<button
					onclick={() => selectRole(role.name)}
					class="w-full rounded-lg border-2 border-gray-300 bg-white px-6 py-4 text-lg font-semibold text-gray-900 transition-all hover:border-blue-500 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
				>
					Chci být {getRoleName(role.name)}
				</button>
			{/each}
		</div>
	</div>
</div>

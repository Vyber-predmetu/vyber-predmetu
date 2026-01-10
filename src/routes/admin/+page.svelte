<script lang="ts">
	import { goto } from '$app/navigation';

	interface Props {
		data: {
			user: any;
		};
	}

	let { data }: Props = $props();
</script>

<div style="max-width: 1200px; margin: 0 auto; padding: 2rem;">
	<h1 style="margin-bottom: 0.5rem;">Admin Dashboard</h1>
	<p style="color: #666; margin-bottom: 2rem;">Vítejte, {data.user?.email}</p>

	<div style="display: grid; gap: 1.5rem; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));">
		<div style="border: 1px solid #ddd; padding: 1.5rem; border-radius: 8px;">
			<h2 style="margin-bottom: 0.5rem;">Nahrát uživatele</h2>
			<p style="margin-bottom: 1rem; color: #666;">Hromadné nahrání uživatelů z CSV nebo Excel souboru.</p>
			<button onclick={() => goto('/admin/upload-users')} style="padding: 0.5rem 1rem; cursor: pointer;">
				Přejít na nahrávání
			</button>
		</div>

		<div style="border: 1px solid #ddd; padding: 1.5rem; border-radius: 8px;">
			<h2 style="margin-bottom: 0.5rem;">Správa uživatelů</h2>
			<p style="margin-bottom: 1rem; color: #666;">Zobrazit a upravit všechny uživatele v databázi.</p>
			<button onclick={() => goto('/admin/manage-users')} style="padding: 0.5rem 1rem; cursor: pointer;">
				Upravit uživatele
			</button>
		</div>

		<div style="border: 1px solid #ddd; padding: 1.5rem; border-radius: 8px; opacity: 0.6;">
			<h2 style="margin-bottom: 0.5rem;">Správa předmětů</h2>
			<p style="color: #666;">Funkce v přípravě</p>
		</div>
	</div>
</div>

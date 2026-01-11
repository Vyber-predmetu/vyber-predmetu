<script lang="ts">
	interface Props {
		data: {
			user: any;
		};
	}

	let { data }: Props = $props();
</script>

<div>
	<h1>Učitelský Dashboard</h1>
	<p>Vítejte, {data.user?.email}</p>

	<div>
		<h2>Funkce v přípravě</h2>
		<p>Učitelský dashboard bude brzy k dispozici.</p>
	</div>
</div>

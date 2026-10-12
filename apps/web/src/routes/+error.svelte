<script lang="ts">
  import {page} from '$app/state';
</script>
<svelte:head><title>{page.status} — Frontlane</title></svelte:head>
<section class="wrap empty-page"><span class="section-label">{page.status}</span><h1>{page.status === 404 ? 'This page has moved on.' : 'We couldn’t load this page.'}</h1><p>{page.status === 404 ? 'Find your way back to the latest opportunities.' : 'Please try again in a moment.'}</p><a class="button" href="/jobs">Browse jobs</a></section>

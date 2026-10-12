<script lang="ts">
  import {onMount} from 'svelte';
  import {Eye, Users} from '@lucide/svelte';
  import {viewerHeartbeat} from '$lib/viewer-heartbeat';

  let counts = $state<{total: number; current: number} | null>(null);
  let unavailable = $state(false);

  onMount(() => {
    const controller = new AbortController();
    let pending = false;
    async function refresh() {
      if (document.visibilityState !== 'visible' || pending) return;
      pending = true;
      try {
        const response = await viewerHeartbeat(controller.signal);
        if (!response.ok) throw Error('Unavailable');
        const next = await response.json();
        if (!Number.isSafeInteger(next.total) || !Number.isSafeInteger(next.current) || next.current < 0 || next.total < next.current) throw Error('Invalid counts');
        if (!controller.signal.aborted) { counts = next; unavailable = false; }
      } catch {
        if (!controller.signal.aborted) { counts = null; unavailable = true; }
      } finally { pending = false; }
    }
    void refresh();
    const interval = setInterval(refresh, 30000);
    document.addEventListener('visibilitychange', refresh);
    return () => { controller.abort(); clearInterval(interval); document.removeEventListener('visibilitychange', refresh); };
  });
</script>

<div class="viewer-counts" aria-label="App viewers" aria-busy={!counts && !unavailable}>
  <span title="Unique browsers since viewer tracking began"><Users size={14} /><strong>{counts?.total.toLocaleString('en-IN') ?? '—'}</strong> total viewers</span>
  <span title="Browsers active within the last 90 seconds"><Eye size={14} /><strong>{counts?.current.toLocaleString('en-IN') ?? '—'}</strong> viewing now</span>
  {#if unavailable}<small>Viewer counts unavailable</small>{/if}
</div>

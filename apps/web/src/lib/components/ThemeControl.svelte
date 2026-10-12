<script lang="ts">
  import {onMount} from 'svelte';
  import {Moon, Sun, Monitor} from '@lucide/svelte';

  let theme = $state('system');
  let ready = $state(false);

  function apply() {
    document.documentElement.classList.toggle('dark', theme === 'dark' || (theme === 'system' && matchMedia('(prefers-color-scheme: dark)').matches));
    try { localStorage.setItem('frontlanejobs-theme', theme); } catch {}
  }

  onMount(() => {
    try { theme = localStorage.getItem('frontlanejobs-theme') || 'system'; } catch {}
    if (!['light', 'dark', 'system'].includes(theme)) theme = 'system';
    ready = true;
    apply();
    const media = matchMedia('(prefers-color-scheme: dark)');
    const update = () => apply();
    media.addEventListener('change', update);
    return () => media.removeEventListener('change', update);
  });
</script>

<label class="theme-control" title="Color theme">
  {#if theme === 'dark'}<Moon size={17} />{:else if theme === 'light'}<Sun size={17} />{:else}<Monitor size={17} />{/if}
  <select aria-label="Color theme" bind:value={theme} onchange={apply} disabled={!ready}>
    <option value="system">System</option><option value="light">Light</option><option value="dark">Dark</option>
  </select>
</label>

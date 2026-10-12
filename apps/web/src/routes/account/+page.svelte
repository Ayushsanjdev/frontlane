<script lang="ts">
  import {untrack} from 'svelte';
  import {Check, Copy, ShieldCheck, UserRound} from '@lucide/svelte';
  import type {PageProps} from './$types';
  let {data}: PageProps = $props();
  let profile = $state<Record<string, string>>(untrack(() => ({name: data.user?.displayName || '', ...data.profile})));
  let busy = $state(false);
  let message = $state('');
  let failed = $state(false);
  const fields = [
    {key: 'name', label: 'Name'}, {key: 'location', label: 'Location'},
    {key: 'experience', label: 'Experience, including contract work'}, {key: 'skills', label: 'Skills'},
    {key: 'salary', label: 'Expected compensation'}, {key: 'availability', label: 'Availability'},
    {key: 'portfolio', label: 'Portfolio URL'}, {key: 'resumeUrl', label: 'Resume link'}, {key: 'preference', label: 'Working preference'}
  ];
  async function save(event: SubmitEvent) {
    event.preventDefault(); busy = true; failed = false;
    try {
      const response = await fetch('/api/profile', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(profile)});
      if (!response.ok) { const body = await response.json(); throw Error(body.error || 'Could not save your profile.'); }
      message = 'Profile saved.';
    } catch (error) { failed = true; message = error instanceof Error ? error.message : 'Could not save your profile.'; }
    finally { busy = false; }
  }
  async function copy() {
    try { await navigator.clipboard.writeText(fields.map(({key, label}) => `${label}: ${profile[key] || ''}`).join('\n')); message = 'Profile copied.'; failed = false; }
    catch { message = 'Clipboard unavailable. Select and copy the fields manually.'; failed = true; }
  }
</script>
<svelte:head><title>Your profile — frontlanejobs</title></svelte:head>
<section class="wrap profile-page"><div class="page-heading"><div><span class="section-label"><ShieldCheck size={15} />Your private profile</span><h1>Ready when you are.</h1><p>Keep your details handy for your next application.</p></div></div>
  {#if data.loadError}<div class="empty-state"><p role="alert">{data.loadError}</p><a class="button secondary" href="/account" data-sveltekit-reload>Try again</a></div>
  {:else}<form class="profile-card editor-form" onsubmit={save}><div class="profile-card-heading"><span class="feature-symbol"><UserRound size={25} /></span><div><h2>Application essentials</h2><p>Only you can access these details.</p></div></div><fieldset disabled={busy}><div class="form-grid">{#each fields as field}<label>{field.label}<input type={['portfolio', 'resumeUrl'].includes(field.key) ? 'url' : 'text'} maxlength={1000} bind:value={profile[field.key]} /></label>{/each}</div><p class="field-help">Use a resume link you control. frontlanejobs does not upload your resume or automatically submit applications.</p>{#if message}<p class:form-error={failed} class:notice={!failed} role="status">{message}</p>{/if}<div class="button-row"><button class="button" type="submit"><Check size={17} />{busy ? 'Saving…' : 'Save profile'}</button><button class="button secondary" type="button" onclick={copy}><Copy size={17} />Copy details</button></div></fieldset></form>{/if}
</section>

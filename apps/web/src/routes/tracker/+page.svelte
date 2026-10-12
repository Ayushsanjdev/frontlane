<script lang="ts">
  import {untrack} from 'svelte';
  import {ArrowUpRight, Bookmark, CalendarDays, ChevronRight, Download, Layers, Plus, Search, ShieldCheck, Trash2} from '@lucide/svelte';
  import Modal from '$lib/components/Modal.svelte';
  import {stages, type Application, type Stage} from '$lib/types';
  import {trackerCsv} from '$lib/tracker-csv';
  import type {PageProps} from './$types';

  let {data}: PageProps = $props();
  let items = $state<Application[]>(untrack(() => data.items));
  let filter = $state('All');
  let query = $state('');
  let edit = $state<Application | null>(null);
  let remove = $state<Application | null>(null);
  let editOpen = $state(false);
  let removeOpen = $state(false);
  let busy = $state(false);
  let error = $state('');
  let message = $state('');
  const filtered = $derived(items.filter(item => (filter === 'All' || item.stage === filter) && `${item.job.title} ${item.job.company}`.toLowerCase().includes(query.toLowerCase())));
  const overview: {stage: Stage; label: string}[] = [
    {stage: 'Saved', label: 'Worth a closer look'}, {stage: 'Applied', label: 'Your work is out there'},
    {stage: 'Interview', label: 'Conversations in progress'}, {stage: 'Offer', label: 'The next chapter awaits'}
  ];
  $effect(() => { items = data.items; });

  function startEdit(item: Application) {
    edit = JSON.parse(JSON.stringify(item));
    error = ''; editOpen = true;
  }
  function add() {
    const id = 'custom:' + crypto.randomUUID();
    startEdit({id: '', jobId: id, stage: 'Saved', notes: '', answers: '', appliedAt: '', followUp: '', evidence: '', updatedAt: '',
      job: {id, title: '', company: '', url: '', location: '', salary: '', tags: [], mode: 'Remote', type: 'Full-time', experience: '', summary: '', caveat: '', source: 'Added by you', discovered: new Date().toISOString().slice(0, 10), checked: '', posted: null, eligibility: 'Check with employer', degree: 'Not specified'}});
  }
  async function save(event: SubmitEvent) {
    event.preventDefault();
    if (!edit || busy) return;
    busy = true; error = '';
    try {
      const response = await fetch('/api/tracker', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify(edit)});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Could not save your application.');
      items = [result, ...items.filter(item => item.jobId !== result.jobId)];
      editOpen = false; message = 'Application saved.';
    } catch (reason) { error = reason instanceof Error ? reason.message : 'Could not save your application.'; }
    finally { busy = false; }
  }
  async function destroy() {
    if (!remove || busy) return;
    busy = true; error = '';
    try {
      const response = await fetch('/api/tracker', {method: 'DELETE', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({id: remove.id})});
      if (!response.ok) throw Error('Could not remove this application. Please try again.');
      items = items.filter(item => item.id !== remove?.id); removeOpen = false; message = 'Application removed.';
    } catch (reason) { error = reason instanceof Error ? reason.message : 'Could not remove this application.'; }
    finally { busy = false; }
  }
  function exportCsv() {
    const url = URL.createObjectURL(new Blob([trackerCsv(items)], {type: 'text/csv;charset=utf-8;'}));
    const link = document.createElement('a'); link.href = url; link.download = 'Frontlane-Application-Tracker.csv'; link.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
</script>

<svelte:head><title>Your application tracker — Frontlane</title></svelte:head>
<section class="wrap tracker-page">
  <div class="page-heading"><div><span class="section-label"><ShieldCheck size={15} />Your private workspace</span><h1>A little more organised.</h1><p>Hey {data.user?.displayName.split(' ')[0] || 'there'}, keep your next steps together.</p></div><div class="button-row"><button class="button secondary" disabled={!items.length} onclick={exportCsv}><Download size={17} />Export CSV</button><button class="button" disabled={!!data.loadError} onclick={add}><Plus size={18} />Add a job</button></div></div>
  {#if data.loadError}<div class="empty-state"><h2>Your tracker is temporarily unavailable.</h2><p role="alert">{data.loadError}</p><a class="button secondary" href="/tracker" data-sveltekit-reload>Try again</a></div>
  {:else}
    <div class="stat-grid">{#each overview as stat}<button class="stat-card" class:selected={filter === stat.stage} onclick={() => { filter = filter === stat.stage ? 'All' : stat.stage; }} aria-pressed={filter === stat.stage}><span>{stat.stage}<ArrowUpRight size={17} /></span><strong>{items.filter(item => item.stage === stat.stage).length}</strong><small>{stat.label}</small></button>{/each}</div>
    <div class="tracker-tools"><div class="tabs" aria-label="Application stage">{#each ['All', ...stages] as stage}<button class:active={filter === stage} aria-pressed={filter === stage} onclick={() => { filter = stage; }}>{stage}</button>{/each}</div><label class="compact-search"><Search size={17} /><input aria-label="Search applications" placeholder="Find an application" bind:value={query} /></label></div>
    {#if message}<p class="notice" role="status">{message}</p>{/if}
    {#if !filtered.length}<div class="empty-state"><span class="empty-icon"><Bookmark size={28} /></span><h2>{items.length ? 'No applications in this view.' : 'Every next chapter starts somewhere.'}</h2><p>{items.length ? 'Try another stage or a different search.' : 'Save a role from the board, or add an opportunity you found elsewhere.'}</p><a class="button" href="/jobs">Explore opportunities <ArrowUpRight size={17} /></a></div>
    {:else}<div class="tracker-table"><div class="tracker-table-head"><span>Opportunity</span><span>Stage</span><span>Next follow-up</span><span>Updated</span><span></span></div>{#each filtered as item (item.id)}<div class="tracker-table-row"><button class="tracker-job" onclick={() => startEdit(item)}><span class="company-mark">{item.job.company[0]}</span><span><strong>{item.job.title}</strong><small>{item.job.company}</small></span></button><button class={'stage-badge stage-' + item.stage.toLowerCase()} onclick={() => startEdit(item)}>{item.stage}</button><span class="follow-up" class:overdue={!!item.followUp && item.followUp < new Date().toISOString().slice(0, 10)}>{item.followUp || 'Not set'}</span><span class="updated muted">{new Date(item.updatedAt).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'})}</span><button class="icon-button" aria-label={'Edit ' + item.job.title} onclick={() => startEdit(item)}><ChevronRight size={19} /></button></div>{/each}</div>{/if}
    <div class="workspace-tip"><CalendarDays size={20} /><p>A useful next step beats a forgotten tab. Add a follow-up date and a short note to each application.</p></div>
  {/if}
</section>

<Modal bind:open={editOpen} title={edit?.id ? 'Update application' : 'Add an opportunity'} description="Your notes and application details are visible only to you." wide>
  {#if edit}<form class="editor-form" onsubmit={save}><fieldset disabled={busy}>
    <div class="form-grid"><label>Role<input required maxlength={160} bind:value={edit.job.title} /></label><label>Company<input required maxlength={120} bind:value={edit.job.company} /></label></div>
    <label>Application link<input type="url" required maxlength={2000} bind:value={edit.job.url} placeholder="https://" /></label>
    <div class="form-grid"><label>Stage<select bind:value={edit.stage}>{#each stages as stage}<option value={stage}>{stage}</option>{/each}</select></label><label>Follow-up date<input type="date" bind:value={edit.followUp} /></label></div>
    <label>Application date<input type="date" bind:value={edit.appliedAt} required={['Applied', 'Interview', 'Offer'].includes(edit.stage)} /></label>
    <label>Receipt or your confirmation<input maxlength={1000} bind:value={edit.evidence} required={['Applied', 'Interview', 'Offer'].includes(edit.stage)} placeholder="For example, I submitted and received a confirmation email" /></label>
    <p class="field-help">Required for Applied, Interview and Offer. This records your confirmation, not automatic employer verification.</p>
    <label>Notes<textarea rows="3" maxlength={6000} bind:value={edit.notes} placeholder="Contacts, questions, interview notes…"></textarea></label>
    <label>Answers used<textarea rows="3" maxlength={6000} bind:value={edit.answers} placeholder="Keep the answers you submitted for future reference."></textarea></label>
    {#if error}<p class="form-error" role="alert">{error}</p>{/if}
    <div class="button-row"><button class="button" type="submit">{busy ? 'Saving…' : 'Save changes'}</button>{#if edit.job.url}<a class="button secondary" href={edit.job.url} target="_blank" rel="noopener noreferrer">Open application<ArrowUpRight size={16} /></a>{/if}{#if edit.id}<button class="icon-button danger-button" type="button" aria-label="Remove application" onclick={() => { remove = edit; editOpen = false; removeOpen = true; error = ''; }}><Trash2 size={19} /></button>{/if}</div>
  </fieldset></form>{/if}
</Modal>
<Modal bind:open={removeOpen} title="Remove this application?" description={'This removes your notes and answers for ' + (remove?.job.company || 'this opportunity') + '. It does not withdraw an employer application.'}>
  {#if error}<p class="form-error" role="alert">{error}</p>{/if}<div class="button-row"><button class="button secondary" disabled={busy} onclick={() => { removeOpen = false; }}>Keep it</button><button class="button danger" disabled={busy} onclick={destroy}>{busy ? 'Removing…' : 'Remove application'}</button></div>
</Modal>

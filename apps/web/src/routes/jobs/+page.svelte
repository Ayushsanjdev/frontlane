<script lang="ts">
  import {onMount, untrack} from 'svelte';
  import {goto, replaceState} from '$app/navigation';
  import {page as currentPage} from '$app/state';
  import {ArrowUpRight, Bookmark, ChevronLeft, ChevronRight, MapPin, Search, SlidersHorizontal, X, ShieldCheck} from '@lucide/svelte';
  import JobDetail from '$lib/components/JobDetail.svelte';
  import Modal from '$lib/components/Modal.svelte';
  import type {Job, JobCollection} from '$lib/types';
  import type {PageProps} from './$types';

  let {data}: PageProps = $props();
  let jobs = $state<Job[]>(untrack(() => data.collection.jobs));
  let total = $state(untrack(() => data.collection.total));
  let warning = $state(untrack(() => data.collection.warning || ''));
  let lastSync = $state(untrack(() => data.collection.lastSync));
  let query = $state(untrack(() => data.filters.q));
  let type = $state(untrack(() => data.filters.type));
  let mode = $state(untrack(() => data.filters.mode));
  let stack = $state(untrack(() => data.filters.stack));
  let sort = $state(untrack(() => data.filters.sort));
  let page = $state(untrack(() => data.collection.page));
  let selected = $state<Job | null>(null);
  let detailOpen = $state(false);
  let saved = $state<string[]>([]);
  let notice = $state('');
  let loading = $state(false);
  let busy = $state(false);
  let signInOpen = $state(false);
  let filtersOpen = $state(false);
  let ready = $state(false);
  let lastRequest = '';
  const types = ['All', 'Full-time', 'Freelance', 'Part-time', 'Contract'];
  const stacks = ['All', 'React', 'Next.js', 'TypeScript', 'Svelte', 'React Native', 'Tailwind', 'JavaScript'];

  // SvelteKit can reuse this page when navigating between the jobs and freelance links.
  $effect(() => {
    const next = data;
    untrack(() => {
      query = next.filters.q; type = next.filters.type; mode = next.filters.mode;
      stack = next.filters.stack; sort = next.filters.sort; page = next.collection.page;
      jobs = next.collection.jobs; total = next.collection.total;
      warning = next.collection.warning || ''; lastSync = next.collection.lastSync;
      lastRequest = new URLSearchParams({q: query, type, mode, stack, sort, page: String(page), limit: '12'}).toString();
    });
  });

  $effect(() => {
    if (!ready) return;
    const params = new URLSearchParams({q: query, type, mode, stack, sort, page: String(page), limit: '12'});
    if (params.toString() === lastRequest) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      loading = true;
      try {
        const response = await fetch('/api/jobs?' + params, {signal: controller.signal});
        if (!response.ok) throw Error('Job feed unavailable. Please try again.');
        const result: JobCollection = await response.json();
        if (controller.signal.aborted) return;
        jobs = result.jobs; total = result.total; warning = result.warning || ''; lastSync = result.lastSync;
        lastRequest = params.toString();
        const url = new URL(location.href);
        for (const [key, value] of params) {
          if (key === 'limit') continue;
          if (!value || value === 'All' || (key === 'page' && value === '1') || (key === 'sort' && value === 'recommended')) url.searchParams.delete(key);
          else url.searchParams.set(key, value);
        }
        replaceState(url, {});
        notice = '';
      } catch (error) {
        if (!controller.signal.aborted) notice = error instanceof Error ? error.message : 'Could not load jobs.';
      } finally { if (!controller.signal.aborted) loading = false; }
    }, 200);
    return () => { controller.abort(); clearTimeout(timer); loading = false; };
  });

  $effect(() => {
    const id = currentPage.url.searchParams.get('job');
    if (!ready || !id) return;
    const controller = new AbortController();
    fetch('/api/jobs?id=' + encodeURIComponent(id), {signal: controller.signal})
      .then(async response => {
        if (response.status === 404) { notice = 'This opportunity is no longer available.'; return; }
        if (!response.ok) throw Error('Could not load this opportunity. Please try again.');
        const result = await response.json();
        if (!controller.signal.aborted) { selected = result.job; detailOpen = true; }
      }).catch(error => { if (!controller.signal.aborted) notice = error.message; });
    return () => controller.abort();
  });

  onMount(() => { ready = true; });
  $effect(() => {
    if (!data.user) { saved = []; return; }
    const controller = new AbortController();
    fetch('/api/tracker', {signal: controller.signal}).then(response => response.ok ? response.json() : [])
      .then((items: {jobId: string}[]) => { if (!controller.signal.aborted) saved = items.map(item => item.jobId); }).catch(() => {});
    return () => controller.abort();
  });

  function reset() { query = ''; type = 'All'; mode = 'All'; stack = 'All'; sort = 'recommended'; page = 1; }
  function showJob(job: Job) { selected = job; detailOpen = true; }
  async function save(job: Job) {
    if (!data.user) { detailOpen = false; signInOpen = true; return; }
    if (saved.includes(job.id)) { await goto('/tracker'); return; }
    busy = true;
    try {
      const response = await fetch('/api/tracker', {method: 'POST', headers: {'Content-Type': 'application/json'}, body: JSON.stringify({job, jobId: job.id, stage: 'Saved'})});
      const result = await response.json();
      if (!response.ok) throw Error(result.error || 'Could not save this role.');
      saved = [...saved, job.id]; notice = 'Saved to your private tracker.';
    } catch (error) { notice = error instanceof Error ? error.message : 'Could not save this role.'; }
    finally { busy = false; }
  }
</script>

<svelte:head><title>Frontend jobs for India — frontlanejobs</title></svelte:head>
<section class="wrap board-page">
  <div class="page-heading"><div><span class="section-label">Find your next move</span><h1>Good work starts here.</h1><p>Frontend opportunities for India, with the details that matter.</p></div><span class="heading-note"><ShieldCheck size={16} />Direct application links</span></div>
  <div class="board-search"><Search size={21} /><input aria-label="Search jobs" type="search" bind:value={query} oninput={() => { page = 1; }} placeholder="Role, company, technology or city" /><span>Make room for your next role</span></div>
  <button class="button secondary mobile-filters" onclick={() => { filtersOpen = !filtersOpen; }} aria-expanded={filtersOpen}><SlidersHorizontal size={17} />Filters</button>
  <div class="board-layout">
    <aside class:filters-open={filtersOpen} class="filters">
      <div class="filter-heading"><h2><SlidersHorizontal size={17} />Refine your search</h2><button class="text-button" onclick={reset}>Reset</button></div>
      <fieldset><legend>Work arrangement</legend>{#each ['All', 'Remote', 'Hybrid', 'Onsite'] as option}<label><input type="radio" name="mode" value={option} bind:group={mode} onchange={() => { page = 1; }} />{option === 'All' ? 'Any arrangement' : option}</label>{/each}</fieldset>
      <fieldset><legend>Your stack</legend>{#each stacks as option}<label><input type="radio" name="stack" value={option} bind:group={stack} onchange={() => { page = 1; }} />{option === 'All' ? 'Any technology' : option}</label>{/each}</fieldset>
      <div class="filter-info"><MapPin size={21} /><h3>India, by design.</h3><p>Country eligibility is listed on every role. Check individual restrictions before applying.</p><a href="/updates">Source status <ArrowUpRight size={15} /></a></div>
    </aside>
    <div class="board-results">
      <div class="tabs" aria-label="Employment type">{#each types as option}<button class:active={type === option} aria-pressed={type === option} onclick={() => { type = option; page = 1; }}>{option === 'All' ? 'All opportunities' : option}</button>{/each}</div>
      <div class="results-toolbar"><p aria-live="polite"><strong>{total}</strong> opportunities {#if loading}<span class="loading-label">Updating…</span>{/if}</p><select aria-label="Sort jobs" bind:value={sort} onchange={() => { page = 1; }}><option value="recommended">Recommended</option><option value="newest">Recently discovered</option><option value="remote">Remote first</option></select></div>
      {#if notice}<div class="notice" role="status"><p>{notice}</p><button class="icon-button" aria-label="Dismiss message" onclick={() => { notice = ''; }}><X size={16} /></button></div>{/if}
      {#if warning}<p class="feed-warning">{warning}</p>{/if}
      <div class="job-list" aria-busy={loading}>
        {#each jobs as job (job.id)}
          <article class="job-card"><div class="job-card-top"><span class="company-mark">{job.company[0]}</span><div><span class="company-name">{job.company}</span><h2><button onclick={() => showJob(job)}>{job.title}</button></h2></div><button class="icon-button bookmark" class:is-saved={saved.includes(job.id)} aria-label={saved.includes(job.id) ? 'Open saved job' : 'Save ' + job.title} disabled={busy} onclick={() => save(job)}><Bookmark size={20} fill={saved.includes(job.id) ? 'currentColor' : 'none'} /></button></div>
            <div class="job-meta"><span><MapPin size={14} />{job.location}</span><span>{job.type}</span><span>{job.experience}</span></div>
            <div class="tags"><span class="mode-tag">{job.mode}</span>{#each job.tags as tag}<span>{tag}</span>{/each}</div>
            <div class="job-card-bottom"><strong>{job.salary}</strong><span class="checked">Checked {new Date(job.checked).toLocaleDateString('en-IN', {day: 'numeric', month: 'short', timeZone: 'Asia/Kolkata'})}</span><button class="text-link" onclick={() => showJob(job)}>View role <ArrowUpRight size={17} /></button></div>
          </article>
        {:else}<div class="empty-state"><Search size={32} /><h2>No matches yet.</h2><p>Try fewer filters or a different technology.</p><button class="button secondary" onclick={reset}>Clear filters</button></div>{/each}
      </div>
      {#if total > 12}<div class="pagination"><button class="button secondary" disabled={page === 1 || loading} onclick={() => { page -= 1; }}><ChevronLeft size={16} />Previous</button><span>Page {page} of {Math.ceil(total / 12)}</span><button class="button secondary" disabled={page * 12 >= total || loading} onclick={() => { page += 1; }}>Next<ChevronRight size={16} /></button></div>{/if}
      <p class="fine-print feed-note">{lastSync ? 'Employer feeds last checked ' + new Date(lastSync).toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'}) + ' IST.' : 'See each listing for its last checked date.'} Discovery dates are not employer posting dates.</p>
    </div>
  </div>
</section>

<JobDetail bind:open={detailOpen} job={selected} saved={!!selected && saved.includes(selected.id)} {busy} onsave={save} />
<Modal bind:open={signInOpen} title="Keep the possibilities together." description="Sign in to save roles and keep your private tracker across devices.">
  <a class="button" href="/signin?returnTo=%2Fjobs">Continue with Google <ArrowUpRight size={17} /></a><p class="fine-print">Browsing is always open. Your saved jobs and notes are private.</p>
</Modal>

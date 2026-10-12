<script lang="ts">
  import {ArrowUpRight, Bookmark, Info, MapPin} from '@lucide/svelte';
  import Modal from './Modal.svelte';
  import type {Job} from '$lib/types';
  let {open = $bindable(false), job, saved = false, busy = false, onsave}: {
    open: boolean; job: Job | null; saved?: boolean; busy?: boolean; onsave: (job: Job) => void;
  } = $props();
</script>

<Modal bind:open title={job?.title || 'Job details'} description={job ? `${job.company} · ${job.type}` : ''} wide>
  {#if job}
    <div class="detail-location"><MapPin size={16} />{job.location}<span>{job.mode}</span></div>
    <p class="detail-pay">{job.salary}</p>
    <div class="tags">{#each job.tags as tag}<span>{tag}</span>{/each}</div>
    <section class="detail-section"><h3>The opportunity</h3><p>{job.summary}</p></section>
    <dl class="detail-facts"><div><dt>Experience</dt><dd>{job.experience}</dd></div><div><dt>Eligibility</dt><dd>{job.eligibility}</dd></div><div><dt>Education</dt><dd>{job.degree}</dd></div></dl>
    {#if job.caveat}<div class="notice caution"><Info size={18} /><p>{job.caveat}</p></div>{/if}
    <dl class="date-facts"><div><dt>Discovered</dt><dd>{job.discovered}</dd></div><div><dt>Last checked</dt><dd>{job.checked.slice(0, 10) || 'Not verified'}</dd></div><div><dt>Employer posted</dt><dd>{job.posted?.slice(0, 10) || 'Not verified'}</dd></div></dl>
    <div class="button-row"><a class="button" href={job.url} target="_blank" rel="noopener noreferrer">Apply at source <ArrowUpRight size={17} /></a><button class="button secondary" disabled={busy} onclick={() => job && onsave(job)}><Bookmark size={17} />{saved ? 'Open in tracker' : busy ? 'Saving…' : 'Save to tracker'}</button></div>
    <p class="fine-print">Source: {job.source}. Opening an application does not mark it submitted.</p>
  {/if}
</Modal>

<script lang="ts">
  import {Clock3, Database, ArrowUpRight} from '@lucide/svelte';
  import type {PageProps} from './$types';
  let {data}: PageProps = $props();
</script>
<svelte:head><title>Source status — frontlanejobs</title></svelte:head>
<article class="wrap prose-page"><span class="section-label">Behind the board</span><h1>Freshness you can see.</h1><p class="lead">Real sources. Actual check times. A clearer picture of where each opportunity comes from.</p>
  <div class="source-summary"><span><Clock3 size={22} /><span><strong>Daily, at 8 AM IST</strong>When the production scheduler is enabled</span></span><span><Database size={22} /><span><strong>Employer feeds</strong>Greenhouse, Lever & SmartRecruiters</span></span></div>
  <h2>Latest source checks</h2>
  {#if data.unavailable}<div class="notice" role="status">Source status is temporarily unavailable. Please check again later.</div>{:else if data.sources.length}<div class="source-table"><table><thead><tr><th>Source</th><th>Result</th><th>Last checked</th></tr></thead><tbody>{#each data.sources as source}<tr><td>{source.source}</td><td><span class="pill" class:warning-pill={source.status !== 'ok'}>{source.status === 'ok' ? source.matched + ' selected roles' : 'Unavailable'}</span></td><td>{new Date(source.checked_at).toLocaleString('en-IN', {timeZone: 'Asia/Kolkata'})} IST</td></tr>{/each}</tbody></table></div>{:else}<p>No completed source checks yet. Listings will appear after the first refresh or starter-data import.</p>{/if}
  <h2>What updates automatically</h2><p>The daily refresh targets 50 frontend roles across employers and working arrangements. If fewer eligible roles are available, it publishes fewer. Failed sources retain their previous listings. Contract, part-time and freelance roles appear when supplied by employers or a fresh verified research batch.</p>
  <h2>Dates mean different things</h2><p>Discovery dates record when a job entered frontlanejobs. Employer posting dates appear only when supplied by the source. A source failure preserves its previous listings and is reported here.</p><a class="text-link" href="/jobs">Explore opportunities <ArrowUpRight size={17} /></a>
</article>

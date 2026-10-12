<script lang="ts">
  import {ArrowRight, ArrowUpRight, Bookmark, Check, CodeXml, Layers, MapPin, ShieldCheck} from '@lucide/svelte';
  import type {PageProps} from './$types';
  let {data}: PageProps = $props();
  const featured = $derived(data.collection.jobs[0]);
</script>

<section class="hero wrap">
  <div class="hero-copy">
    <div class="hero-context"><span class="location-dot"></span>Frontend careers, India first</div>
    <h1>Good work.<br />Your next move.</h1>
    <p>A focused space for frontend opportunities.<br class="desktop-break" /> Find a role you care about. Keep your next steps together.</p>
    <div class="hero-actions"><a class="button large" href="/jobs">Explore opportunities <ArrowUpRight size={19} /></a><a class="text-link" href="/tracker">Meet your tracker <ArrowRight size={17} /></a></div>
    <div class="hero-note"><ShieldCheck size={17} />Free to browse. Direct to the source.</div>
  </div>
  <div class="workspace-preview">
    <div class="preview-bar"><span><span class="preview-dot"></span>Your next chapter</span><span class="preview-caption">A little more organised</span></div>
    <div class="preview-content"><div class="preview-section-title"><span>On your radar</span><Bookmark size={16} /></div>
      <div class="preview-job"><span class="company-mark">{featured?.company[0] || 'F'}</span><div><span class="company-name">{featured?.company || 'Your next team'}</span><h2>{featured?.title || 'A role worth exploring'}</h2></div></div>
      <p class="preview-location"><MapPin size={15} />{featured?.location || 'India'}<span>{featured?.mode || 'Remote'}</span></p>
      <div class="tags">{#each (featured?.tags || ['Frontend', 'TypeScript']).slice(0, 3) as tag}<span>{tag}</span>{/each}</div>
      <div class="preview-job-bottom"><strong>{featured?.salary || 'Find your next opportunity'}</strong><a href={featured ? '/jobs?job=' + featured.id : '/jobs'} aria-label="View featured opportunity"><ArrowUpRight size={21} /></a></div>
      {#if data.collection.warning}<p class="preview-source">Curated preview · live feed unavailable</p>{/if}
    </div>
    <div class="preview-progress"><span class="preview-section-title">A place for every next step</span><div class="progress-track"><span><i><Bookmark size={14} /></i>Shortlist</span><b></b><span><i><CodeXml size={14} /></i>Prepare</span><b></b><span><i><Check size={14} /></i>Interview</span></div><p>Illustrative tracker. Your workspace starts empty.</p></div>
    <div class="preview-foot"><ShieldCheck size={14} />Your applications. Your private workspace.</div>
  </div>
</section>

<div class="stack-strip"><div class="wrap"><span>Built around your craft</span><div><strong>React</strong><strong>Next.js</strong><strong>TypeScript</strong><strong>Svelte</strong><strong>React Native</strong></div></div></div>

<section class="wrap opportunities-section">
  <div class="section-heading"><div><span class="section-label">A few places to start</span><h2>Find something worth building.</h2></div><a class="text-link" href="/jobs">All opportunities <ArrowRight size={17} /></a></div>
  {#if data.collection.warning}<p class="feed-warning"><span class="location-dot"></span>{data.collection.warning}</p>{/if}
  <div class="featured-list">{#each data.collection.jobs as job}<a href={'/jobs?job=' + job.id} class="featured-row"><span class="company-mark">{job.company[0]}</span><div class="featured-role"><span class="company-name">{job.company}</span><h3>{job.title}</h3><p>{job.location}</p></div><div class="featured-meta"><span class="pill">{job.mode}</span><span>{job.type}</span></div><strong>{job.salary}</strong><ArrowUpRight size={20} /></a>{:else}<div class="empty-state"><h3>No live opportunities yet</h3><p>Check back after the next source update.</p></div>{/each}</div>
</section>

<section class="wrap product-section">
  <div class="product-intro"><span class="section-label">Less searching. More direction.</span><h2>A job search<br />with room to think.</h2><p>Full-time ambition or a project on the side. Keep the possibilities and the practical details in one place.</p></div>
  <div class="product-features"><a href="/jobs"><span class="feature-symbol"><CodeXml size={23} /></span><div><h3>Your craft, front and centre.</h3><p>Filter by your technology, location and working style.</p></div><ArrowUpRight size={19} /></a><a href="/jobs?type=Freelance"><span class="feature-symbol"><Layers size={23} /></span><div><h3>A project. A fresh possibility.</h3><p>Explore freelance, contract and part-time work.</p></div><ArrowUpRight size={19} /></a><a href="/tracker"><span class="feature-symbol"><Bookmark size={23} /></span><div><h3>Goodbye, forgotten tabs.</h3><p>Save roles, keep your notes and plan the next step.</p></div><ArrowUpRight size={19} /></a></div>
</section>

<section class="wrap"><div class="closing-banner"><div><h2>You build the web.<br />Make your next move count.</h2><p>No sign-in needed to explore.</p></div><a class="button light large" href="/jobs">Find your next role <ArrowUpRight size={19} /></a><span class="banner-lanes" aria-hidden="true"><i></i><i></i><i></i></span></div></section>

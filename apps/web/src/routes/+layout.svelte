<script lang="ts">
  import '@fontsource-variable/manrope';
  import '../app.css';
  import {page} from '$app/state';
  import {ArrowUpRight, ArrowRight} from '@lucide/svelte';
  import ThemeControl from '$lib/components/ThemeControl.svelte';
  import ViewerCounts from '$lib/components/ViewerCounts.svelte';
  import type {LayoutProps} from './$types';
  let {data, children}: LayoutProps = $props();
</script>

<svelte:head>
  <title>frontlanejobs — Your next frontend move</title>
  <meta name="description" content="Frontend jobs for India. Discover a role, find freelance work, and organise your applications in a private workspace." />
  <meta name="theme-color" content="#2457d6" />
</svelte:head>

<a class="skip-link" href="#main">Skip to content</a>
<header class="site-header">
  <div class="nav-inner">
    <a class="brand" href="/" aria-label="frontlanejobs home"><span class="brand-symbol" aria-hidden="true"><i></i><i></i><i></i></span>frontlanejobs<span class="brand-period">.</span></a>
    <nav aria-label="Main navigation">
      <a class:active={page.url.pathname === '/jobs' && page.url.searchParams.get('type') !== 'Freelance'} href="/jobs">Find jobs</a>
      <a class:active={page.url.pathname === '/jobs' && page.url.searchParams.get('type') === 'Freelance'} href="/jobs?type=Freelance">Freelance</a>
      <a class:active={page.url.pathname === '/tracker'} href="/tracker">My tracker</a>
    </nav>
    <div class="nav-actions">
      <ThemeControl />
      {#if data.user}
        <a href="/account" class="avatar" aria-label="Your profile">{data.user.displayName.slice(0, 1).toUpperCase()}</a>
        <form method="POST" action="/signout"><input type="hidden" name="redirectTo" value="/" /><button class="text-button signout" type="submit">Sign out</button></form>
      {:else}
        <a href="/signin?returnTo=%2Ftracker" class="nav-signin">Sign in <ArrowUpRight size={16} /></a>
      {/if}
    </div>
  </div>
</header>
<main id="main">{@render children()}</main>
<footer class="site-footer">
  <div class="footer-top"><div><a class="brand" href="/">frontlanejobs<span class="brand-period">.</span></a><p>A clearer path to your next frontend role.</p></div><div class="footer-links"><a href="/about">How it works & privacy</a><a href="/updates">Source status <ArrowRight size={14} /></a></div></div>
  <div class="footer-bottom"><ViewerCounts /><p>Independent job discovery. Apply directly to employers.</p></div>
</footer>

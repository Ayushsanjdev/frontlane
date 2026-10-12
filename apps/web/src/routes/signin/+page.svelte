<script lang="ts">
  import {ArrowRight, Bookmark, ShieldCheck} from '@lucide/svelte';
  import type {PageProps} from './$types';
  let {data, form}: PageProps = $props();
</script>
<svelte:head><title>Sign in — Frontlane</title></svelte:head>
<section class="wrap auth-page"><div class="auth-panel"><span class="auth-symbol"><Bookmark size={30} /></span><h1>Your next chapter,<br />all in one place.</h1><p>Save the roles that catch your eye.<br />Keep your notes and next steps together.</p>
  {#if data.configured}<form method="POST"><input type="hidden" name="providerId" value="google" /><input type="hidden" name="redirectTo" value={data.returnTo} /><button class="button large" type="submit"><svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="currentColor"><path d="M21.6 12.2c0-.7-.1-1.4-.2-2.1H12v4h5.4a4.6 4.6 0 0 1-2 3v2.5h3.3c1.9-1.8 2.9-4.3 2.9-7.4ZM12 22c2.7 0 5-.9 6.7-2.4l-3.3-2.5c-.9.6-2 1-3.4 1-2.6 0-4.8-1.8-5.6-4.2H3v2.6A10 10 0 0 0 12 22ZM6.4 13.9a6 6 0 0 1 0-3.8V7.5H3a10 10 0 0 0 0 9l3.4-2.6ZM12 5.9c1.5 0 2.8.5 3.8 1.5l2.9-2.9A9.6 9.6 0 0 0 12 2a10 10 0 0 0-9 5.5l3.4 2.6A5.9 5.9 0 0 1 12 5.9Z" /></svg>Continue with Google</button></form>{:else}<div class="notice" role="status">Sign-in is being configured. You can browse all opportunities meanwhile.</div>{/if}
  {#if form?.error}<p class="form-error" role="alert">{form.error}</p>{/if}
  <span class="auth-privacy"><ShieldCheck size={16} />Your workspace is private to your account.</span><a class="text-link" href="/jobs">Keep exploring opportunities <ArrowRight size={16} /></a>
</div></section>

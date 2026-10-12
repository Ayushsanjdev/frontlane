<script lang="ts">
  import type {Snippet} from 'svelte';
  import {X} from '@lucide/svelte';

  let {open = $bindable(false), title, description = '', children, wide = false}: {
    open: boolean; title: string; description?: string; children: Snippet; wide?: boolean;
  } = $props();
  const id = $props.id();
  let dialog: HTMLDialogElement;

  $effect(() => {
    if (!dialog) return;
    if (open && !dialog.open) {
      const previous = document.activeElement as HTMLElement | null;
      dialog.showModal();
      const overflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        dialog.close();
        document.body.style.overflow = overflow;
        previous?.focus();
      };
    }
  });
</script>

<dialog bind:this={dialog} class:wide aria-labelledby={id + '-title'} aria-describedby={description ? id + '-description' : undefined}
  oncancel={() => { open = false; }} onclose={() => { open = false; }}>
  <div class="dialog-header">
    <div><h2 id={id + '-title'}>{title}</h2>{#if description}<p id={id + '-description'}>{description}</p>{/if}</div>
    <button class="icon-button" aria-label="Close dialog" onclick={() => { open = false; }}><X size={21} /></button>
  </div>
  <div class="dialog-body">{@render children()}</div>
</dialog>

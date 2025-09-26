<script>
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';
  import { registerSW } from 'virtual:pwa-register';

  // Toast state
  let showUpdate = false;
  let showOfflineReady = false;
  let updating = false;

  // Install prompt state
  let showInstall = false;
  let deferredPrompt = null;

  // Register the Service Worker & wire update hooks
  let updateSW;
  if (browser) {
    updateSW = registerSW({
      immediate: true,           // register as soon as possible
      onNeedRefresh() {          // a new SW is waiting to activate
        showUpdate = true;
      },
      onOfflineReady() {         // cached for offline (first install)
        showOfflineReady = true;
        setTimeout(() => (showOfflineReady = false), 2500);
      }
    });
  }

  // Listen for the install prompt (Chrome/Edge on Android/desktop)
  onMount(() => {
    if (!browser) return;
    const handler = (e) => {
      e.preventDefault();       // don’t show the default mini-infobar
      deferredPrompt = e;
      showInstall = true;
    };
    window.addEventListener('beforeinstallprompt', handler);
    // If already installed, hide button
    window.addEventListener('appinstalled', () => { showInstall = false; deferredPrompt = null; });
    return () => window.removeEventListener('beforeinstallprompt', handler);
  });

  async function doInstall() {
    if (!deferredPrompt) return;
    showInstall = false;
    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice.catch(() => ({ outcome: 'dismissed' }));
    deferredPrompt = null;
    // optionally: console.log('install outcome:', outcome);
  }

  async function applyUpdate() {
    if (!updateSW) return;
    updating = true;
    // Tells the SW to skip waiting and take control, then reload
    await updateSW(true);
    // Safety: reload if controllerchange didn’t trigger
    setTimeout(() => (location.reload()), 800);
  }
</script>

{#if browser}
  <!-- Install button (floats bottom-left) -->
  {#if showInstall}
    <div class="pwa-fab install">
      <button on:click={doInstall} title="Install app">📲 Install</button>
    </div>
  {/if}

  <!-- Update toast (bottom-right) -->
  {#if showUpdate}
    <div class="pwa-toast">
      <div>🔄 A new version is available.</div>
      <div class="actions">
        <button on:click={() => (showUpdate = false)}>Later</button>
        <button class="primary" disabled={updating} on:click={applyUpdate}>
          {updating ? 'Updating…' : 'Update & reload'}
        </button>
      </div>
    </div>
  {/if}

  <!-- Tiny “offline ready” tick -->
  {#if showOfflineReady}
    <div class="pwa-toast ok">✅ Ready to use offline</div>
  {/if}
{/if}

<style>
  .pwa-fab.install {
    position: fixed; left: 1rem; bottom: 1rem; z-index: 60;
  }
  .pwa-fab.install button {
    border: 1px solid hsl(0 0% 80%);
    background: white; border-radius: 999px;
    padding: 0.5rem 0.9rem; cursor: pointer; font-size: 0.95rem;
    box-shadow: 0 6px 18px rgba(0,0,0,0.08);
  }

  .pwa-toast {
    position: fixed; right: 1rem; bottom: 1rem; z-index: 60;
    background: white; color: #111; border: 1px solid hsl(0 0% 85%);
    border-radius: 12px; padding: 0.75rem 0.9rem; min-width: 260px;
    box-shadow: 0 6px 18px rgba(0,0,0,0.12);
    display: grid; gap: 0.5rem;
  }
  .pwa-toast.ok { right: auto; left: 1rem; }
  .actions { display: flex; gap: 0.5rem; justify-content: flex-end; }
  .actions button {
    border: 1px solid hsl(0 0% 80%); background: white;
    border-radius: 10px; padding: 0.4rem 0.8rem; cursor: pointer;
  }
  .actions .primary {
    background: #10b981; color: white; border-color: transparent;
  }
  .actions button:disabled { opacity: 0.7; cursor: default; }
</style>

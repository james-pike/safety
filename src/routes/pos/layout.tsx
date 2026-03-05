import { component$, Slot, createContextId, useContextProvider, useStore } from "@builder.io/qwik";
import { routeLoader$, useLocation } from "@builder.io/qwik-city";

export interface PosConfig {
  backendUrl: string;
}

export const PosConfigContext = createContextId<PosConfig>("pos-config");

export const usePosConfig = routeLoader$(async ({ env }) => {
  return {
    backendUrl: env.get("MEDUSA_BACKEND_URL") || "http://localhost:9000",
  };
});

export default component$(() => {
  const config = usePosConfig();
  const posConfig = useStore<PosConfig>({
    backendUrl: config.value.backendUrl,
  });
  useContextProvider(PosConfigContext, posConfig);
  const loc = useLocation();
  const path = loc.url.pathname;

  const isActive = (href: string) => {
    if (href === "/pos/") return path === "/pos/" || path === "/pos";
    return path.startsWith(href);
  };

  return (
    <div class="fixed inset-0 bg-gray-900 text-white flex flex-col overflow-hidden max-w-[100vw]">
      {/* Content area */}
      <div class="flex-1 overflow-hidden">
        <Slot />
      </div>

      {/* Bottom tab bar — with center gap for floating scan button */}
      <nav class="bg-gray-800 border-t border-gray-700 flex shrink-0 relative">
        <a
          href="/pos"
          class={`flex-1 flex flex-col items-center justify-center py-3 gap-1 ${
            isActive("/pos/") ? "text-blue-400" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {/* Shopping bag icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M6 2L3 6v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2V6l-3-4z" />
            <line x1="3" y1="6" x2="21" y2="6" />
            <path d="M16 10a4 4 0 0 1-8 0" />
          </svg>
          <span class="text-xs font-medium">Sale</span>
        </a>
        {/* Spacer for floating scan button */}
        <div class="w-28 shrink-0" />
        <a
          href="/pos/receive"
          class={`flex-1 flex flex-col items-center justify-center py-3 gap-1 ${
            isActive("/pos/receive") ? "text-yellow-400" : "text-gray-400 hover:text-gray-200"
          }`}
        >
          {/* Package/box icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z" />
            <polyline points="3.27 6.96 12 12.01 20.73 6.96" />
            <line x1="12" y1="22.08" x2="12" y2="12" />
          </svg>
          <span class="text-xs font-medium">Receive</span>
        </a>
        <a
          href="/"
          class={`flex-1 flex flex-col items-center justify-center py-3 gap-1 text-gray-400 hover:text-gray-200`}
        >
          {/* Store/grid icon */}
          <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="7" height="7" />
          </svg>
          <span class="text-xs font-medium">Store</span>
        </a>
      </nav>
    </div>
  );
});

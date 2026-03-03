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

  const linkClass = (href: string) => {
    const active =
      href === "/pos/"
        ? path === "/pos/" || path === "/pos"
        : path.startsWith(href);
    return `text-sm ${active ? "text-yellow-400 hover:text-yellow-300" : "text-gray-300 hover:text-white"}`;
  };

  return (
    <div class="fixed inset-0 bg-gray-900 text-white flex flex-col overflow-hidden">
      <header class="bg-gray-800 px-4 py-2 flex items-center justify-between shrink-0">
        <span class="font-bold text-lg">M1 POS Terminal</span>
        <div class="flex items-center gap-4">
          <a href="/pos" class={linkClass("/pos/")}>
            Sale
          </a>
          <a href="/pos/receive" class={linkClass("/pos/receive")}>
            Receive
          </a>
          <a href="/pos/session" class={linkClass("/pos/session")}>
            Session
          </a>
          <a href="/" class="text-sm text-gray-400 hover:text-white">
            Exit POS
          </a>
        </div>
      </header>
      <div class="flex-1 overflow-hidden">
        <Slot />
      </div>
    </div>
  );
});

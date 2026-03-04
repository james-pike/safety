import { component$, useSignal, useStore, useVisibleTask$, $ } from "@builder.io/qwik";
import { useContext } from "@builder.io/qwik";
import { PosConfigContext } from "../layout";
import BarcodeInput from "~/components/pos/barcode-input";

interface ReceivedItem {
  product_title: string;
  variant_title: string;
  sku: string;
  barcode: string;
  quantity_added: number;
  new_stock: number;
}

export default component$(() => {
  const posConfig = useContext(PosConfigContext);
  const token = useSignal("");

  // Auto-load auth token and fetch store defaults
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(async () => {
    const savedToken = localStorage.getItem("pos_token");
    if (savedToken) token.value = savedToken;

    // Fetch store defaults for location_id and sales_channel_id
    try {
      const headers: Record<string, string> = { "Content-Type": "application/json" };
      if (savedToken) headers["Authorization"] = `Bearer ${savedToken}`;
      const res = await fetch(`${posConfig.backendUrl}/admin/stores`, { headers, credentials: "include" });
      if (res.ok) {
        const data = await res.json();
        const store = data.stores?.[0] || data.store;
        if (store?.default_location_id) locationId.value = store.default_location_id;
        if (store?.default_sales_channel_id) salesChannelId.value = store.default_sales_channel_id;
      }
    } catch { /* use defaults */ }
  });
  const loading = useSignal(false);
  const error = useSignal("");
  const message = useSignal("");
  const locationId = useSignal("");
  const salesChannelId = useSignal("");

  // Scanned product state
  const scannedVariant = useSignal<any>(null);
  const receiveQty = useSignal(1);

  // New product form
  const showNewForm = useSignal(false);
  const newTitle = useSignal("");
  const newPrice = useSignal("");
  const newBarcode = useSignal("");
  const newQty = useSignal(1);

  // History of received items this session
  const received = useStore<ReceivedItem[]>([]);
  const showLog = useSignal(false);

  const handleScan = $((variant: any) => {
    scannedVariant.value = variant;
    receiveQty.value = 1;
    showNewForm.value = false;
    error.value = "";
    message.value = "";
  });

  const handleNotFound = $((code: string) => {
    scannedVariant.value = null;
    showNewForm.value = true;
    newBarcode.value = code;
    newTitle.value = "";
    newPrice.value = "";
    newQty.value = 1;
    error.value = "";
    message.value = `"${code}" not found — add as new product below`;
  });

  const handleError = $((msg: string) => {
    error.value = msg;
  });

  const receiveStock = $(async () => {
    if (!scannedVariant.value || receiveQty.value <= 0) return;
    loading.value = true;
    error.value = "";

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token.value) headers["Authorization"] = `Bearer ${token.value}`;

      const res = await fetch(`${posConfig.backendUrl}/admin/pos/receive`, {
        method: "POST",
        headers,
        credentials: "include",
        body: JSON.stringify({
          variant_id: scannedVariant.value.id,
          quantity: receiveQty.value,
          location_id: locationId.value,
        }),
      });

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      received.unshift({
        product_title: data.variant.product_title || "",
        variant_title: data.variant.title || "",
        sku: data.variant.sku || "",
        barcode: data.variant.barcode || "",
        quantity_added: data.quantity_added,
        new_stock: data.inventory_level?.stocked_quantity || 0,
      });

      message.value = `+${data.quantity_added} received for ${data.variant.product_title} — now ${data.inventory_level?.stocked_quantity} in stock`;
      scannedVariant.value = null;
    } catch (err: any) {
      error.value = err.message;
    }
    loading.value = false;
  });

  const createNewProduct = $(async () => {
    if (!newTitle.value || !newPrice.value) {
      error.value = "Title and price are required";
      return;
    }
    loading.value = true;
    error.value = "";

    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token.value) headers["Authorization"] = `Bearer ${token.value}`;

      const res = await fetch(
        `${posConfig.backendUrl}/admin/pos/receive/new-product`,
        {
          method: "POST",
          headers,
          credentials: "include",
          body: JSON.stringify({
            title: newTitle.value,
            barcode: newBarcode.value || undefined,
            price: Math.round(parseFloat(newPrice.value) * 100),
            currency_code: "cad",
            quantity: newQty.value,
            location_id: locationId.value,
            sales_channel_id: salesChannelId.value || undefined,
          }),
        }
      );

      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();

      received.unshift({
        product_title: data.product.title,
        variant_title: "Default",
        sku: data.product.sku,
        barcode: data.product.barcode || "",
        quantity_added: data.quantity_stocked,
        new_stock: data.quantity_stocked,
      });

      message.value = `NEW PRODUCT created: ${data.product.title} — ${data.quantity_stocked} in stock`;
      showNewForm.value = false;
      newTitle.value = "";
      newPrice.value = "";
      newBarcode.value = "";
    } catch (err: any) {
      error.value = err.message;
    }
    loading.value = false;
  });

  return (
    <div class="flex h-full relative overflow-hidden max-w-[100vw]">
      {/* Left: Scanner + action */}
      <div class="flex-1 min-w-0 p-4 md:p-6 overflow-y-auto overflow-x-hidden">
        <div class="flex items-center justify-between mb-6">
          <h1 class="text-2xl font-bold">Receive Inventory</h1>
          <button
            class="lg:hidden bg-gray-700 hover:bg-gray-600 text-white px-3 py-1.5 rounded text-sm"
            onClick$={() => (showLog.value = !showLog.value)}
          >
            Log ({received.length})
          </button>
        </div>

        {!token.value && (
          <p class="text-yellow-400 text-sm mb-4">
            Not logged in — <a href="/pos/session" class="underline">open a session</a> first
          </p>
        )}

        {/* Barcode scanner — shared component with live camera preview */}
        <div class="mb-6">
          <BarcodeInput
            token={token.value}
            backendUrl={posConfig.backendUrl}
            onScan$={handleScan}
            onNotFound$={handleNotFound}
            onError$={handleError}
          />
        </div>

        {/* Found product — receive stock */}
        {scannedVariant.value && (
          <div class="bg-gray-800 rounded-xl p-5 mb-4 border border-gray-700">
            <div class="flex items-center justify-between mb-3">
              <div>
                <h2 class="text-lg font-bold">
                  {scannedVariant.value.product?.title}
                </h2>
                <p class="text-sm text-gray-400">
                  {scannedVariant.value.title} — SKU:{" "}
                  {scannedVariant.value.sku || "—"}
                </p>
                {scannedVariant.value.inventory_items?.[0]?.inventory
                  ?.location_levels?.[0] && (
                  <p class="text-sm text-gray-500 mt-1">
                    Current stock:{" "}
                    {
                      scannedVariant.value.inventory_items[0].inventory
                        .location_levels[0].stocked_quantity
                    }
                  </p>
                )}
              </div>
              {scannedVariant.value.prices?.[0] && (
                <p class="text-xl font-bold">
                  $
                  {(scannedVariant.value.prices[0].amount / 100).toFixed(2)}{" "}
                  CAD
                </p>
              )}
            </div>

            <div class="flex flex-wrap items-end gap-3">
              <div>
                <label class="block text-xs text-gray-400 mb-1">
                  Quantity to receive
                </label>
                <input
                  type="number"
                  class="w-28 bg-gray-700 text-white px-3 py-2 rounded text-lg text-center"
                  min={1}
                  value={receiveQty.value}
                  onInput$={(e) =>
                    (receiveQty.value =
                      parseInt((e.target as HTMLInputElement).value) || 1)
                  }
                />
              </div>
              <div class="flex flex-wrap gap-2">
                {[1, 5, 10, 25, 50].map((n) => (
                  <button
                    key={n}
                    class="bg-gray-700 hover:bg-gray-600 text-white px-3 py-2 rounded text-sm"
                    onClick$={() => (receiveQty.value = n)}
                  >
                    {n}
                  </button>
                ))}
              </div>
              <button
                class="w-full sm:w-auto bg-yellow-600 hover:bg-yellow-700 text-white px-6 py-2 rounded-lg font-bold text-lg disabled:opacity-50 sm:ml-auto"
                disabled={loading.value}
                onClick$={receiveStock}
              >
                Receive +{receiveQty.value}
              </button>
            </div>
          </div>
        )}

        {/* New product form */}
        {showNewForm.value && (
          <div class="bg-gray-800 rounded-xl p-5 mb-4 border border-yellow-600">
            <h2 class="text-lg font-bold mb-3 text-yellow-400">
              New Product
            </h2>
            <p class="text-sm text-gray-400 mb-4">
              Barcode <span class="text-white font-mono">{newBarcode.value}</span> not found. Create it:
            </p>
            <div class="space-y-3">
              <div>
                <label class="block text-xs text-gray-400 mb-1">
                  Product Name *
                </label>
                <input
                  type="text"
                  class="w-full bg-gray-700 text-white px-3 py-2 rounded"
                  placeholder="e.g. Blue T-Shirt Large"
                  value={newTitle.value}
                  onInput$={(e) =>
                    (newTitle.value = (e.target as HTMLInputElement).value)
                  }
                />
              </div>
              <div class="flex gap-3">
                <div class="flex-1">
                  <label class="block text-xs text-gray-400 mb-1">
                    Price (CAD) *
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    class="w-full bg-gray-700 text-white px-3 py-2 rounded"
                    placeholder="29.99"
                    value={newPrice.value}
                    onInput$={(e) =>
                      (newPrice.value = (e.target as HTMLInputElement).value)
                    }
                  />
                </div>
                <div class="flex-1">
                  <label class="block text-xs text-gray-400 mb-1">
                    Quantity
                  </label>
                  <input
                    type="number"
                    class="w-full bg-gray-700 text-white px-3 py-2 rounded"
                    min={0}
                    value={newQty.value}
                    onInput$={(e) =>
                      (newQty.value =
                        parseInt((e.target as HTMLInputElement).value) || 0)
                    }
                  />
                </div>
              </div>
              <div>
                <label class="block text-xs text-gray-400 mb-1">
                  Barcode / UPC
                </label>
                <input
                  type="text"
                  class="w-full bg-gray-700 text-white px-3 py-2 rounded font-mono"
                  value={newBarcode.value}
                  onInput$={(e) =>
                    (newBarcode.value = (e.target as HTMLInputElement).value)
                  }
                />
              </div>
              <div class="flex gap-3 pt-2">
                <button
                  class="flex-1 bg-yellow-600 hover:bg-yellow-700 text-white py-3 rounded-lg font-bold disabled:opacity-50"
                  disabled={loading.value}
                  onClick$={createNewProduct}
                >
                  {loading.value ? "Creating..." : "Create & Receive"}
                </button>
                <button
                  class="bg-gray-700 hover:bg-gray-600 text-white px-4 py-3 rounded-lg"
                  onClick$={() => {
                    showNewForm.value = false;
                    message.value = "";
                  }}
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Messages */}
        {error.value && (
          <p class="text-red-400 text-sm mb-3">{error.value}</p>
        )}
        {message.value && (
          <p class="text-yellow-300 text-sm mb-3">{message.value}</p>
        )}
      </div>

      {/* Right: Receive log — hidden on mobile, toggleable */}
      <div class={`${showLog.value ? "fixed inset-0 z-40" : "hidden"} lg:relative lg:block lg:z-auto w-full lg:w-[380px] lg:shrink-0 bg-gray-800 border-l border-gray-700 flex flex-col overflow-hidden`}>
        <div class="p-4 border-b border-gray-700 flex items-center justify-between">
          <h2 class="font-bold text-sm uppercase tracking-wide text-gray-400">
            Received This Session ({received.length})
          </h2>
          <button
            class="lg:hidden text-gray-400 hover:text-white text-sm"
            onClick$={() => (showLog.value = false)}
          >
            Close
          </button>
        </div>
        <div class="flex-1 overflow-auto p-4">
          {received.length === 0 ? (
            <p class="text-gray-500 text-sm text-center py-8">
              Scan products to receive inventory
            </p>
          ) : (
            <div class="space-y-2">
              {received.map((item, i) => (
                <div
                  key={i}
                  class="bg-gray-700 rounded-lg p-3"
                >
                  <div class="flex justify-between items-start">
                    <div class="min-w-0 flex-1">
                      <p class="text-sm font-medium truncate">
                        {item.product_title}
                      </p>
                      <p class="text-xs text-gray-400">
                        {item.sku}
                        {item.barcode ? ` | ${item.barcode}` : ""}
                      </p>
                    </div>
                    <div class="text-right ml-3">
                      <p class="text-green-400 font-bold text-sm">
                        +{item.quantity_added}
                      </p>
                      <p class="text-xs text-gray-400">
                        Stock: {item.new_stock}
                      </p>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
        <div class="p-4 border-t border-gray-700">
          <p class="text-sm text-gray-400">
            Total received:{" "}
            <span class="text-white font-bold">
              {received.reduce((s, i) => s + i.quantity_added, 0)} units
            </span>
          </p>
        </div>
      </div>
    </div>
  );
});

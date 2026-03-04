import { component$, useSignal, type QRL, $, useVisibleTask$ } from "@builder.io/qwik";

interface Props {
  token: string;
  backendUrl: string;
  onScan$: QRL<(variant: any) => void>;
  onError$: QRL<(msg: string) => void>;
  /** If true, show "not found" as an event instead of error */
  onNotFound$?: QRL<(code: string) => void>;
}

export default component$<Props>(({ token, backendUrl, onScan$, onError$, onNotFound$ }) => {
  const inputValue = useSignal("");
  const loading = useSignal(false);
  const cameraActive = useSignal(false);
  const videoRef = useSignal<HTMLVideoElement | undefined>();
  const streamRef = useSignal<MediaStream | undefined>();

  // Clean up camera on unmount
  // eslint-disable-next-line qwik/no-use-visible-task
  useVisibleTask$(({ cleanup }) => {
    cleanup(() => {
      if (streamRef.value) {
        streamRef.value.getTracks().forEach((t) => t.stop());
      }
    });
  });

  const lookup = $(async (code: string) => {
    if (!code.trim()) return;
    loading.value = true;
    try {
      const headers: Record<string, string> = {
        "Content-Type": "application/json",
      };
      if (token) {
        headers["Authorization"] = `Bearer ${token}`;
      }
      const res = await fetch(
        `${backendUrl}/admin/pos/products/barcode/${encodeURIComponent(code.trim())}`,
        { headers, credentials: "include" }
      );
      if (res.status === 404) {
        if (onNotFound$) {
          onNotFound$(code.trim());
        } else {
          onError$(`Product not found: ${code}`);
        }
        inputValue.value = "";
        loading.value = false;
        return;
      }
      if (!res.ok) {
        onError$(`Lookup failed (${res.status})`);
        inputValue.value = "";
        loading.value = false;
        return;
      }
      const data = await res.json();
      onScan$(data.variant);
      inputValue.value = "";
    } catch (err: any) {
      onError$(err.message);
    }
    loading.value = false;
  });

  const stopCamera = $(() => {
    if (streamRef.value) {
      streamRef.value.getTracks().forEach((t) => t.stop());
      streamRef.value = undefined;
    }
    cameraActive.value = false;
  });

  const startCameraScan = $(async () => {
    const win = window as any;
    if (!("BarcodeDetector" in window)) {
      onError$(
        "BarcodeDetector not supported in this browser. Use Chrome on Android, or type/scan with a USB scanner."
      );
      return;
    }

    try {
      cameraActive.value = true;
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "environment",
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      });
      streamRef.value = stream;

      // Wait a tick for the video element to render
      await new Promise((r) => setTimeout(r, 50));

      const video = videoRef.value;
      if (!video) {
        stopCamera();
        return;
      }
      video.srcObject = stream;
      video.setAttribute("playsinline", "true");
      await video.play();

      const detector = new win.BarcodeDetector({
        formats: [
          "ean_13",
          "ean_8",
          "upc_a",
          "upc_e",
          "code_128",
          "code_39",
          "qr_code",
        ],
      });

      let found = false;
      const scanLoop = async () => {
        if (!cameraActive.value || found) return;
        try {
          const barcodes = await detector.detect(video);
          if (barcodes.length > 0) {
            found = true;
            const code = barcodes[0].rawValue;
            stopCamera();
            inputValue.value = code;
            await lookup(code);
            return;
          }
        } catch {
          // ignore frame detection errors
        }
        if (!found && cameraActive.value) {
          requestAnimationFrame(scanLoop);
        }
      };
      scanLoop();

      // Auto-stop after 30 seconds
      setTimeout(() => {
        if (!found && cameraActive.value) {
          stopCamera();
        }
      }, 30000);
    } catch {
      stopCamera();
      onError$("Camera not available. Type barcode manually.");
    }
  });

  return (
    <div class="flex-1 min-w-0">
      <label class="block text-sm text-gray-400 mb-1">
        Scan Barcode / Enter UPC
      </label>
      <div class="flex gap-2">
        <input
          type="text"
          class="flex-1 bg-gray-700 text-white px-3 py-2 rounded-lg text-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          placeholder="Scan or type barcode..."
          value={inputValue.value}
          autoFocus
          onInput$={(e) =>
            (inputValue.value = (e.target as HTMLInputElement).value)
          }
          onKeyDown$={async (e) => {
            if (e.key !== "Enter" || !inputValue.value.trim()) return;
            await lookup(inputValue.value.trim());
          }}
        />
        <button
          class={`${cameraActive.value ? "bg-red-600 hover:bg-red-700" : "bg-blue-600 hover:bg-blue-700"} text-white px-3 py-2 rounded-lg shrink-0 flex items-center gap-1.5`}
          onClick$={cameraActive.value ? stopCamera : startCameraScan}
          title={cameraActive.value ? "Stop camera" : "Scan with camera"}
        >
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="22"
            height="22"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
          >
            <rect x="3" y="3" width="7" height="7" />
            <rect x="14" y="3" width="7" height="7" />
            <rect x="3" y="14" width="7" height="7" />
            <rect x="14" y="14" width="3" height="3" />
            <line x1="20" y1="14" x2="20" y2="14.01" />
            <line x1="14" y1="20" x2="14" y2="20.01" />
            <line x1="20" y1="20" x2="20" y2="20.01" />
            <line x1="20" y1="17" x2="20" y2="17.01" />
            <line x1="17" y1="20" x2="17" y2="20.01" />
          </svg>
          <span class="hidden sm:inline text-sm">
            {cameraActive.value ? "Stop" : "Scan"}
          </span>
        </button>
      </div>

      {/* Live camera preview */}
      {cameraActive.value && (
        <div class="mt-3 relative rounded-lg overflow-hidden bg-black">
          <video
            ref={videoRef}
            class="w-full max-h-[300px] object-cover"
            muted
            playsInline
          />
          {/* Scanning overlay with crosshair */}
          <div class="absolute inset-0 flex items-center justify-center pointer-events-none">
            <div class="w-3/4 h-1/3 border-2 border-blue-400 rounded-lg opacity-70" />
          </div>
          <p class="absolute bottom-2 left-0 right-0 text-center text-xs text-blue-300 animate-pulse">
            Point at barcode...
          </p>
        </div>
      )}

      {loading.value && (
        <p class="text-xs text-gray-400 mt-1">Looking up...</p>
      )}
    </div>
  );
});

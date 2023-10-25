import isURL, { IsURLOptions } from "validator/lib/isURL";
import { Action, ServerMessage, SINGLE_SIGN_ON_TARGET } from "./SingleSignOn.shared";

const IFRAME_ID = SINGLE_SIGN_ON_TARGET;

let initState: "not-initialized" | "initializing" | "initialized" | "initialized-local" = "not-initialized";

export async function init(
  src: string,
  options?: {
    useLocalDirectly?: boolean;
    isUrlOptions?: IsURLOptions;
  }
) {
  if (initState !== "not-initialized") {
    return;
  }

  initState = "initializing";

  try {
    if (options?.useLocalDirectly) {
      throw new Error("Using local directly");
    }

    if (!isURL(src, { protocols: ["https"], require_valid_protocol: true, ...(options?.isUrlOptions ?? {}) })) {
      throw new Error(`Invalid url: ${src}`);
    }

    if (document.getElementById(IFRAME_ID)) {
      throw new Error("SSO Element was not created by this client");
    }

    const promise = new Promise<void>((resolve, reject) => {
      const handler = (event: MessageEvent<ServerMessage>) => {
        if (event.data.target !== SINGLE_SIGN_ON_TARGET || event.data.action !== Action.INIT) {
          return;
        }

        window.removeEventListener("message", handler);

        if (!event.data.ok) {
          reject(new Error(event.data.payload as string));
        }

        resolve();
      };

      window.addEventListener("message", handler);
    });

    const iframe = document.createElement("iframe");
    iframe.id = IFRAME_ID;
    iframe.src = src;
    iframe.style.width = "0";
    iframe.style.height = "0";
    iframe.style.border = "none";
    iframe.style.position = "absolute";

    document.body.appendChild(iframe);

    await Promise.race([
      promise,
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error("Initialization timeout")), 2000)),
    ]);

    initState = "initialized";
  } catch (e) {
    initState = "initialized-local";
  }
}

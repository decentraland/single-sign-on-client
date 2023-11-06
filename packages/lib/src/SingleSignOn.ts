import isURL, { IsURLOptions } from "validator/lib/isURL";
import { AuthIdentity } from "@dcl/crypto";
import {
  Action,
  ClientMessage,
  ConnectionData,
  IdentityPayload,
  LocalStorageUtils,
  ServerMessage,
  SINGLE_SIGN_ON_TARGET,
} from "./SingleSignOn.shared";

const IFRAME_ID = SINGLE_SIGN_ON_TARGET;

type InitArgs = {
  src?: string;
  isUrlOptions?: IsURLOptions;
  timeout?: number;
};

enum InitState {
  NOT_INITIALIZED,
  INITIALIZING,
  INITIALIZED,
}

export class SingleSignOn {
  private static instance: SingleSignOn | null = null;

  static getInstance(): SingleSignOn {
    if (!this.instance) {
      this.instance = new SingleSignOn();
    }

    return this.instance;
  }

  private initState = InitState.NOT_INITIALIZED;
  private isLocal = false;
  private src: string | null = null;
  private idCounter = 1;

  /**
   * Initializes the SSO client.
   * - Should only be called once.
   * - If not being used locally, creates an iframe of the identity webapp.
   * - The iframe should not be created by any other means rather than the init function.
   *
   * If SSO is initialized locally, instead of communicating with the iframe it will work with the implementing app's local storage.
   * This is to prevent the application from blocking the user in case the iframe webapp cannot be loaded.
   * @param args.src The url of the identity webapp.
   * @param args.isUrlOptions Options for the url validation. By default it has to be an https url.
   * @param args.timeout The timeout for the initialization. By default it is 2 seconds.
   */
  async init({ src: _src, isUrlOptions, timeout }: InitArgs = {}): Promise<void> {
    if (this.initState !== InitState.NOT_INITIALIZED) {
      console.log("SSO cannot be initialized more than once");

      return;
    }

    this.initState = InitState.INITIALIZING;

    try {
      if (!_src) {
        throw new Error("Using local by configuration");
      }

      if (!isURL(_src, { protocols: ["https"], require_valid_protocol: true, ...(isUrlOptions ?? {}) })) {
        throw new Error(`Invalid url: ${_src}`);
      }

      if (document.getElementById(IFRAME_ID)) {
        throw new Error("SSO Element was not created by this client");
      }

      const iframe = document.createElement("iframe");
      iframe.id = IFRAME_ID;
      iframe.src = _src;
      iframe.style.width = "0";
      iframe.style.height = "0";
      iframe.style.border = "none";
      iframe.style.position = "absolute";

      document.body.appendChild(iframe);

      await Promise.race([
        this.waitForInitMessage(),
        new Promise((_resolve, reject) =>
          setTimeout(() => reject(new Error("Initialization timeout")), timeout ?? 2000)
        ),
      ]);

      console.log("SSO initialized");
    } catch (e) {
      this.isLocal = true;

      console.log("SSO initialized locally, reason: " + (e as Error).message);
    }

    this.initState = InitState.INITIALIZED;
    this.src = _src ?? null;
  }

  async setConnectionData(data: ConnectionData | null): Promise<void> {
    await this.handle(Action.SET_CONNECTION_DATA, data);
  }

  async getConnectionData(): Promise<ConnectionData | null> {
    return (await this.handle(Action.GET_CONNECTION_DATA)) as ConnectionData | null;
  }

  async setIdentity(address: string, identity: AuthIdentity | null): Promise<void> {
    await this.handle(Action.SET_IDENTITY, { address, identity });
  }

  async getIdentity(address: string): Promise<AuthIdentity | null> {
    return (await this.handle(Action.GET_IDENTITY, address)) as AuthIdentity | null;
  }

  private async handle(action: Action, payload?: ClientMessage["payload"]) {
    if (this.initState !== InitState.INITIALIZED) {
      throw new Error("SSO is not initialized");
    }

    if (this.isLocal) {
      switch (action) {
        case Action.SET_CONNECTION_DATA:
          return LocalStorageUtils.setConnectionData(payload as ConnectionData | null);
        case Action.GET_CONNECTION_DATA:
          return LocalStorageUtils.getConnectionData();
        case Action.SET_IDENTITY:
          const { address, identity } = payload as IdentityPayload;
          return LocalStorageUtils.setIdentity(address, identity);
        case Action.GET_IDENTITY:
          return LocalStorageUtils.getIdentity(payload as string);
        default:
          throw new Error("Unsupported action");
      }
    } else {
      const iframeWindow = this.getIframeWindow();
      const id = this.idCounter++;

      const promise = this.waitForActionResponse(id, action);

      iframeWindow.postMessage({ target: SINGLE_SIGN_ON_TARGET, id, action, payload } as ClientMessage, this.src!);

      return promise;
    }
  }

  private getIframeWindow(): Window {
    const element = document.getElementById(IFRAME_ID);

    if (!element) {
      throw new Error("Unable to obtain the SSO iframe element");
    }

    if (element.tagName !== "IFRAME") {
      throw new Error("The SSO element is not an iframe");
    }

    const iframe = element as HTMLIFrameElement;

    if (new URL(iframe.src).origin !== new URL(this.src!).origin) {
      throw new Error("The SSO iframe src has been modified");
    }

    const iframeWindow = iframe.contentWindow;

    if (!iframeWindow) {
      throw new Error("Unable to obtain the SSO iframe window");
    }

    return iframeWindow;
  }

  private waitForInitMessage(): Promise<void> {
    return new Promise<void>((resolve, reject) => {
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
  }

  private waitForActionResponse(id: number, action: Action) {
    return new Promise<ServerMessage["payload"]>((resolve, reject) => {
      const handler = ({ data }: MessageEvent<ServerMessage>) => {
        if (data.target !== SINGLE_SIGN_ON_TARGET || data.id !== id || data.action !== action) {
          return;
        }

        window.removeEventListener("message", handler);

        !data.ok ? reject(data.payload as string) : resolve(data.payload);
      };

      window.addEventListener("message", handler);
    });
  }
}

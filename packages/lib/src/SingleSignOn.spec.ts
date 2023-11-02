import { ProviderType } from "@dcl/schemas";
import { SingleSignOn } from "./SingleSignOn";
import { Action, ClientMessage, ConnectionData, LocalStorageUtils, SINGLE_SIGN_ON_TARGET } from "./SingleSignOn.shared";

let ogDocument: typeof document;
let mockGetElementById: jest.Mock;
let mockCreateElement: jest.Mock;
let mockAppendChild: jest.Mock;
let ogConsole: typeof console;
let sso: SingleSignOn;
let spyWaitForActionResponse: jest.SpyInstance;

beforeEach(() => {
  ogDocument = global.document;
  ogConsole = global.console;

  mockGetElementById = jest.fn();
  mockCreateElement = jest.fn();
  mockAppendChild = jest.fn();

  global.document = {
    getElementById: mockGetElementById,
    createElement: mockCreateElement,
    body: {
      appendChild: mockAppendChild,
    },
  } as unknown as typeof document;

  global.console = {
    log: jest.fn(),
  } as unknown as typeof console;

  sso = new SingleSignOn();

  spyWaitForActionResponse = jest.spyOn(sso as any, "waitForActionResponse");
});

afterEach(() => {
  global.document = ogDocument;
  global.console = ogConsole;

  jest.clearAllMocks();
});

describe("when initializing the client", () => {
  describe("when init state is different from not initialized", () => {
    it("should log a message that the client cannot be initialized more than once", async () => {
      await sso.init();

      expect(console.log).toHaveBeenCalledWith("SSO initialized locally, reason: Using local by configuration");

      await sso.init();

      expect(console.log).toHaveBeenCalledWith("SSO cannot be initialized more than once");
    });
  });

  describe("when the src argument is not provided", () => {
    it("should log that the client was initialized locally by configuration", async () => {
      await sso.init();

      expect(console.log).toHaveBeenCalledWith("SSO initialized locally, reason: Using local by configuration");
    });
  });

  describe("when the src argument is provided", () => {
    let src: string;

    describe("when the src argument is an invalid url", () => {
      beforeEach(() => {
        src = "invalid";
      });

      it("should log that the client was initialized locally because the url is invalid", async () => {
        await sso.init({ src });

        expect(console.log).toHaveBeenCalledWith("SSO initialized locally, reason: Invalid url: invalid");
      });
    });

    describe("when the src argument is a valid url", () => {
      beforeEach(() => {
        src = "https://someurl.com";
      });

      describe("when an sso iframe is found while initializing", () => {
        beforeEach(() => {
          mockGetElementById.mockReturnValueOnce({});
        });

        it("should log that the client was initialized locally because another element with the sso id already exists", async () => {
          await sso.init({ src });

          expect(console.log).toHaveBeenCalledWith(
            "SSO initialized locally, reason: SSO Element was not created by this client"
          );
        });
      });

      describe("when an sso element is not found", () => {
        const timeout = 100;

        beforeEach(() => {
          mockGetElementById.mockReturnValueOnce(null);
          mockCreateElement.mockReturnValueOnce({ style: {} });
        });

        it("should call document.body append child function with the sso iframe", async () => {
          await sso.init({ src, timeout });

          expect(mockAppendChild).toHaveBeenCalledWith({
            id: SINGLE_SIGN_ON_TARGET,
            src,
            style: {
              border: "none",
              height: "0",
              position: "absolute",
              width: "0",
            },
          });
        });

        describe("when the init message is not received before the determined timeout time", () => {
          beforeEach(() => {
            jest
              .spyOn(sso as any, "waitForInitMessage")
              .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({}), timeout + 100)));
          });

          it("should log that the client was initialized locally because the initialization timed out", async () => {
            await sso.init({ src, timeout });

            expect(console.log).toHaveBeenCalledWith("SSO initialized locally, reason: Initialization timeout");
          });
        });

        describe("when the init message is received before the determined timeout time", () => {
          beforeEach(() => {
            jest
              .spyOn(sso as any, "waitForInitMessage")
              .mockImplementationOnce(() => new Promise((resolve) => setTimeout(() => resolve({}), timeout - 50)));
          });

          it("should log that the client was initialized", async () => {
            await sso.init({ src, timeout });

            expect(console.log).toHaveBeenCalledWith("SSO initialized");
          });
        });
      });
    });
  });
});

describe("when setting the connection data", () => {
  describe("when the client is not initialized", () => {
    it("should throw an error saying that the client is not initialized", async () => {
      await expect(sso.setConnectionData(null)).rejects.toThrow("SSO is not initialized");
    });
  });

  describe("when the client is initialized locally", () => {
    beforeEach(() => {
      sso.init();
    });

    it("should call the local storage utils set connection data function with the provided connection data", () => {
      const setConnectionDataSpy = jest.spyOn(LocalStorageUtils, "setConnectionData");
      setConnectionDataSpy.mockImplementation(() => {});

      const connectionData: ConnectionData | null = null;

      sso.setConnectionData(connectionData);
      expect(setConnectionDataSpy).toHaveBeenCalledWith(connectionData);

      sso.setConnectionData({ address: "0x123", provider: ProviderType.INJECTED });
      expect(setConnectionDataSpy).toHaveBeenCalledWith(connectionData);
    });
  });

  describe("when the client is initialized", () => {
    const src = "https://someurl.com";

    beforeEach(async () => {
      mockGetElementById.mockReturnValueOnce(null);
      mockCreateElement.mockReturnValueOnce({ style: {} });
      jest.spyOn(sso as any, "waitForInitMessage").mockResolvedValueOnce(undefined);
      await sso.init({ src, timeout: 0 });
    });

    describe("when the iframe element cannot be found", () => {
      beforeEach(() => {
        mockGetElementById.mockReturnValueOnce(null);
      });

      it("should throw an error saying that the element cannot be found", async () => {
        await expect(sso.setConnectionData(null)).rejects.toThrow("Unable to obtain the SSO iframe element");
      });
    });

    describe("when the element is not an iframe", () => {
      beforeEach(() => {
        mockGetElementById.mockReturnValueOnce({ tagName: "FOO" });
      });

      it("should throw an error saying that the element is not an iframe", async () => {
        await expect(sso.setConnectionData(null)).rejects.toThrow("The SSO element is not an iframe");
      });
    });

    describe("when the iframe src is different to the initialized one", () => {
      beforeEach(() => {
        mockGetElementById.mockReturnValueOnce({ tagName: "IFRAME", src: "https://someotherurl.com" });
      });

      it("should throw an error saying that the iframe src is different to the initialized one", async () => {
        await expect(sso.setConnectionData(null)).rejects.toThrow("The SSO iframe src has been modified");
      });
    });

    describe("when the iframe does not have a content window", () => {
      beforeEach(() => {
        mockGetElementById.mockReturnValueOnce({ tagName: "IFRAME", src, contentWindow: undefined });
      });

      it("should throw an error saying that the iframe window could not be obtained", async () => {
        await expect(sso.setConnectionData(null)).rejects.toThrow("Unable to obtain the SSO iframe window");
      });
    });

    describe("when validations pass", () => {
      let mockPostMessage: jest.Mock;

      beforeEach(() => {
        mockPostMessage = jest.fn();

        mockGetElementById.mockReturnValue({
          tagName: "IFRAME",
          src,
          contentWindow: { postMessage: mockPostMessage },
        });
      });

      describe("when the connection data is null", () => {
        beforeEach(() => {
          spyWaitForActionResponse.mockResolvedValue(null);
        });

        it("should call the iframe window post message function with the set connection data client message", async () => {
          await sso.setConnectionData(null);

          expect(mockPostMessage).toHaveBeenCalledWith(
            {
              action: Action.SET_CONNECTION_DATA,
              id: 1,
              payload: null,
              target: SINGLE_SIGN_ON_TARGET,
            },
            src
          );
        });
      });

      describe("when the connection data is not null", () => {
        let connectionData: ConnectionData;

        beforeEach(() => {
          connectionData = {
            address: "0x123",
            provider: ProviderType.INJECTED,
          };

          spyWaitForActionResponse.mockResolvedValue(connectionData);
        });

        it("should call the iframe window post message function with the set connection data client message", async () => {
          await sso.setConnectionData(connectionData);

          expect(mockPostMessage).toHaveBeenCalledWith(
            {
              action: Action.SET_CONNECTION_DATA,
              id: 1,
              payload: connectionData,
              target: SINGLE_SIGN_ON_TARGET,
            },
            src
          );
        });
      });
    });
  });
});

describe("when getting the connection data", () => {
  describe("when the client is not initialized", () => {
    it("should throw an error saying that the client is not initialized", async () => {
      await expect(sso.getConnectionData()).rejects.toThrow("SSO is not initialized");
    });
  });

  describe("when the client is initialized locally", () => {
    beforeEach(() => {
      sso.init();
    });

    it("should call the local storage utils get connection data function and return its value", () => {
      const connectionData: ConnectionData = {
        address: "0x123",
        provider: ProviderType.INJECTED,
      };

      const getConnectionDataSpy = jest.spyOn(LocalStorageUtils, "getConnectionData");
      getConnectionDataSpy.mockImplementation(() => connectionData);

      expect(sso.getConnectionData()).resolves.toEqual(connectionData);
    });
  });

  describe("when the client is initialized", () => {
    const src = "https://someurl.com";

    beforeEach(async () => {
      mockGetElementById.mockReturnValueOnce(null);
      mockCreateElement.mockReturnValueOnce({ style: {} });
      jest.spyOn(sso as any, "waitForInitMessage").mockResolvedValueOnce(undefined);
      await sso.init({ src, timeout: 0 });
    });

    describe("when the iframe element cannot be found", () => {
      beforeEach(() => {
        mockGetElementById.mockReturnValueOnce(null);
      });

      it("should throw an error saying that the element cannot be found", async () => {
        await expect(sso.getConnectionData()).rejects.toThrow("Unable to obtain the SSO iframe element");
      });
    });

    describe("when the element is not an iframe", () => {
      beforeEach(() => {
        mockGetElementById.mockReturnValueOnce({ tagName: "FOO" });
      });

      it("should throw an error saying that the element is not an iframe", async () => {
        await expect(sso.getConnectionData()).rejects.toThrow("The SSO element is not an iframe");
      });
    });

    describe("when the iframe src is different to the initialized one", () => {
      beforeEach(() => {
        mockGetElementById.mockReturnValueOnce({ tagName: "IFRAME", src: "https://someotherurl.com" });
      });

      it("should throw an error saying that the iframe src is different to the initialized one", async () => {
        await expect(sso.getConnectionData()).rejects.toThrow("The SSO iframe src has been modified");
      });
    });

    describe("when the iframe does not have a content window", () => {
      beforeEach(() => {
        mockGetElementById.mockReturnValueOnce({ tagName: "IFRAME", src, contentWindow: undefined });
      });

      it("should throw an error saying that the iframe window could not be obtained", async () => {
        await expect(sso.getConnectionData()).rejects.toThrow("Unable to obtain the SSO iframe window");
      });
    });

    describe("when validations pass", () => {
      let mockPostMessage: jest.Mock;

      beforeEach(() => {
        mockPostMessage = jest.fn();

        mockGetElementById.mockReturnValue({
          tagName: "IFRAME",
          src,
          contentWindow: { postMessage: mockPostMessage },
        });
      });

      describe("when the connection data returned by the iframe is null", () => {
        beforeEach(() => {
          spyWaitForActionResponse.mockResolvedValue(null);
        });

        it("should call the iframe window post message function and return null", async () => {
          const connectionData = await sso.getConnectionData();

          expect(mockPostMessage).toHaveBeenCalledWith(
            {
              action: Action.GET_CONNECTION_DATA,
              id: 1,
              target: SINGLE_SIGN_ON_TARGET,
            } as ClientMessage,
            src
          );

          expect(connectionData).toBeNull();
        });
      });

      describe("when the connection data returned by the iframe is not null", () => {
        let connectionData: ConnectionData;

        beforeEach(() => {
          connectionData = {
            address: "0x123",
            provider: ProviderType.INJECTED,
          };

          spyWaitForActionResponse.mockResolvedValue(connectionData);
        });

        it("should call the iframe window post message function with the get connection data client message and return the connection data", async () => {
          const connectionData = await sso.getConnectionData();

          expect(mockPostMessage).toHaveBeenCalledWith(
            {
              action: Action.GET_CONNECTION_DATA,
              id: 1,
              target: SINGLE_SIGN_ON_TARGET,
            } as ClientMessage,
            src
          );

          expect(connectionData).toEqual(connectionData);
        });
      });
    });
  });
});

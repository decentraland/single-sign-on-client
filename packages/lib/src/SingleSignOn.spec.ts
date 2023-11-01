import { SingleSignOn } from "./SingleSignOn";
import { SINGLE_SIGN_ON_TARGET } from "./SingleSignOn.shared";

let ogDocument: typeof document;
let mockGetElementById: jest.Mock;
let mockCreateElement: jest.Mock;
let mockAppendChild: jest.Mock;
let ogConsole: typeof console;
let sso: SingleSignOn;

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
            jest.spyOn(sso as any, "waitForInitMessage").mockImplementationOnce(() => {
              return new Promise((resolve) => setTimeout(() => resolve({}), timeout + 100));
            });
          });

          it("should log that the client was initialized locally because the initialization timed out", async () => {
            await sso.init({ src, timeout });

            expect(console.log).toHaveBeenCalledWith("SSO initialized locally, reason: Initialization timeout");
          });
        });

        describe("when the init message is received before the determined timeout time", () => {
          beforeEach(() => {
            jest.spyOn(sso as any, "waitForInitMessage").mockImplementationOnce(() => {
              return new Promise((resolve) => setTimeout(() => resolve({}), timeout - 50));
            });
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

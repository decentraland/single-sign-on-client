import { AuthIdentity } from "@dcl/crypto";
import { AuthLinkType, ProviderType } from "@dcl/schemas";
import { SingleSignOn, ConnectionData } from "@dcl/single-sign-on-client";

const address = "0x24e5F44999c151f08609F8e27b2238c773C4D020";
const connectionData: ConnectionData = { address, provider: ProviderType.INJECTED };
const identity: AuthIdentity = {
  ephemeralIdentity: {
    address: "0xF8C8E57A279c1ACAB4d4d7828365fef634FcA15e",
    publicKey:
      "0x0423553e669ddf2153b2a12147cba9f9a5d07a89ec161827779ce4567a81707cef1056097e92d80845cb1d712504b1daaaa17a8cb51f001d0ef0683e4e6b2930ec",
    privateKey: "0xWhyDoYouCare?",
  },
  expiration: new Date("2023-11-26T02:38:41.714Z"),
  authChain: [
    { type: AuthLinkType.SIGNER, payload: "0x24e5f44999c151f08609f8e27b2238c773c4d020", signature: "" },
    {
      type: AuthLinkType.ECDSA_PERSONAL_EPHEMERAL,
      payload:
        "Decentraland Login\nEphemeral address: 0xF8C8E57A279c1ACAB4d4d7828365fef634FcA15e\nExpiration: 2023-11-26T02:38:41.714Z",
      signature:
        "0xb83500e07d944387a56cd943222313cac18457d60fca2832280c0e0a9faa5a0e1714a5fd92aa3c38ca4076bc609f5ae81aaf1143af1519995027c3ac4978ce9d1b",
    },
  ],
};

function App() {
  const onSetConnectionData = () => {
    SingleSignOn.getInstance().setConnectionData(connectionData);
  };

  const onGetConnectionData = async () => {
    console.log("SSO Connection Data", await SingleSignOn.getInstance().getConnectionData());
  };

  const onSetIdentity = () => {
    SingleSignOn.getInstance().setIdentity(address, identity);
  };

  const onGetIdentity = async () => {
    console.log("SSO Identity", await SingleSignOn.getInstance().getIdentity(address));
  };

  return (
    <main>
      <h1>SSO</h1>
      <div style={{ display: "flex", gap: "1rem", marginBottom: "1rem" }}>
        <label style={{ width: 150 }}>Connection Data</label>
        <button onClick={onSetConnectionData}>Set</button>
        <button onClick={onGetConnectionData}>Get</button>
      </div>
      <div style={{ display: "flex", gap: "1rem" }}>
        <label style={{ width: 150 }}>Identity</label>
        <button onClick={onSetIdentity}>Set</button>
        <button onClick={onGetIdentity}>Get</button>
      </div>
    </main>
  );
}

export default App;

import React from "react";
import ReactDOM from "react-dom/client";
import * as SingleSignOn from "@dcl/single-sign-on-client";
import App from "./App.tsx";

const ssoSrc = "https://localhost:3001/";

// Required options to work with localhost.
// Change to an empty object when using https://id.decentraland.{env}
const ssoOpt = { require_tld: false, protocols: undefined };

SingleSignOn.init(ssoSrc, ssoOpt);

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);

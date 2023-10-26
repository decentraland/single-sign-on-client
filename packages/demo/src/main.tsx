import React from "react";
import ReactDOM from "react-dom/client";
import * as SSO from "@dcl/single-sign-on-client";
import App from "./App.tsx";

async function main() {
  // Init Locally
  // await SSO.init();

  // Init Localhost
  await SSO.init({
    src: "http://localhost:3001",
    isUrlOptions: {
      protocols: ["http"],
      require_tld: false,
    },
  });

  // Init Production
  // await SSO.init({
  //   src: "https://id.decentraland.org",
  // });

  ReactDOM.createRoot(document.getElementById("root")!).render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
}

main();

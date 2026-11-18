import "@radix-ui/themes/styles.css";
import "./styles/global.css";

import { Theme } from "@radix-ui/themes";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import { App } from "./App";
import { AuthProvider } from "./auth/AuthContext";

createRoot(document.getElementById("root")!).render(
  <StrictMode>
    {/* Brand: navy on white. The indigo scale is redefined as navy in global.css; --accent-3 tints surfaces. */}
    <Theme className="app-root" appearance="light" accentColor="indigo" grayColor="slate" radius="large" panelBackground="solid">
      <BrowserRouter>
        <AuthProvider>
          <App />
        </AuthProvider>
      </BrowserRouter>
    </Theme>
  </StrictMode>,
);

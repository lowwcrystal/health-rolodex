import { Box } from "@radix-ui/themes";
import { Outlet } from "react-router-dom";
import { HeaderBar } from "./HeaderBar";

export function AppShell() {
  return (
    <Box>
      <HeaderBar />
      <main>
        <Outlet />
      </main>
    </Box>
  );
}

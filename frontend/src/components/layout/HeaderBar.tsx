import { DashboardIcon, ExitIcon, IdCardIcon, PersonIcon } from "@radix-ui/react-icons";
import { Avatar, Box, Container, DropdownMenu, Flex, Text } from "@radix-ui/themes";
import { useEffect, useState, type ReactNode } from "react";
import { Link as RouterLink, NavLink, useLocation, useNavigate } from "react-router-dom";
import { patientApi } from "@/api/patient";
import { onInboxChanged } from "@/features/inbox/inboxEvents";
import { useAuth } from "@/auth/AuthContext";

/** A white text link on the navy header; highlighted while its page is open. `emergency` renders as a red pill. */
function HeaderLink({ to, children, emergency }: { to: string; children: ReactNode; emergency?: boolean }) {
  return (
    <NavLink to={to} className={({ isActive }) => `header-link${emergency ? " header-link-emergency" : ""}${isActive ? " is-active" : ""}`}>
      {children}
    </NavLink>
  );
}

/** Pending family requests for the logged-in patient; refreshed on navigation and after inbox actions. */
function useInboxCount(enabled: boolean): number {
  const location = useLocation();
  const [count, setCount] = useState(0);
  const [tick, setTick] = useState(0);
  useEffect(() => onInboxChanged(() => setTick((t) => t + 1)), []);
  useEffect(() => {
    if (!enabled) {
      setCount(0);
      return;
    }
    let live = true;
    patientApi
      .inbox()
      .then((i) => live && setCount(i.requests.length))
      .catch(() => undefined);
    return () => {
      live = false;
    };
  }, [enabled, location.pathname, tick]);
  return count;
}

export function HeaderBar() {
  const { session, logout } = useAuth();
  const navigate = useNavigate();
  const inboxCount = useInboxCount(session?.role === "patient");

  const handleLogout = async () => {
    await logout();
    navigate("/");
  };

  const home = session?.role === "patient" ? "/dashboard" : session?.role === "doctor" ? "/doctor/dashboard" : "/";
  const accountName =
    session?.role === "patient" ? session.user.username : session?.role === "doctor" ? session.provider.provider_name : "";
  const initial =
    (session?.role === "patient" ? session.user.first_name : accountName.replace(/^Dr\.\s*/, "")).charAt(0).toUpperCase() || "?";

  return (
    <Box asChild className="header-bar no-print">
      <header>
        <Container size="4" px="4">
          <Flex align="center" justify="between" height="64px" gap="4">
            <RouterLink to={home} className="header-brand" aria-label="Health Rolodex home">
              <span className="brand-mark">
                <IdCardIcon width="18" height="18" />
              </span>
              <Text size="4" weight="bold" className="hide-sm">
                Health Rolodex
              </Text>
            </RouterLink>

            {session ? (
              <Flex align="center" gap={{ initial: "2", sm: "3" }}>
                {session.role === "patient" ? (
                  <>
                    <HeaderLink to="/inbox">
                      Inbox
                      {inboxCount > 0 && (
                        <span className="header-count" aria-label={`${inboxCount} new`}>
                          {inboxCount}
                        </span>
                      )}
                    </HeaderLink>
                    <HeaderLink to="/documents">My Documents</HeaderLink>
                    <HeaderLink to="/emergency" emergency>
                      Emergency Site
                    </HeaderLink>
                  </>
                ) : (
                  <HeaderLink to="/doctor/dashboard">Dashboard</HeaderLink>
                )}
                <DropdownMenu.Root>
                  <DropdownMenu.Trigger>
                    <button type="button" className="avatar-trigger" aria-label={`Account menu for ${accountName}`} title={accountName}>
                      <Avatar size="3" radius="full" fallback={initial} />
                    </button>
                  </DropdownMenu.Trigger>
                  <DropdownMenu.Content align="end">
                    <DropdownMenu.Label>{accountName}</DropdownMenu.Label>
                    <DropdownMenu.Item onSelect={() => navigate(home)}>
                      <DashboardIcon /> Dashboard
                    </DropdownMenu.Item>
                    {session.role === "patient" && (
                      <DropdownMenu.Item onSelect={() => navigate("/account")}>
                        <PersonIcon /> Account
                      </DropdownMenu.Item>
                    )}
                    <DropdownMenu.Separator />
                    <DropdownMenu.Item onSelect={handleLogout}>
                      <ExitIcon /> Log out
                    </DropdownMenu.Item>
                  </DropdownMenu.Content>
                </DropdownMenu.Root>
              </Flex>
            ) : (
              <Flex align="center" gap="3">
                <RouterLink to="/login" className="header-link">
                  Log in
                </RouterLink>
                <RouterLink to="/signup" className="header-link header-link-solid">
                  Sign up
                </RouterLink>
              </Flex>
            )}
          </Flex>
        </Container>
      </header>
    </Box>
  );
}

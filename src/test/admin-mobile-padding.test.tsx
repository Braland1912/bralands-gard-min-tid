import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AdminTeam from "@/components/admin/AdminTeam";
import InvitationManager from "@/components/InvitationManager";
import TimeCorrectionRequests from "@/components/TimeCorrectionRequests";

// Mock supabase to avoid real network calls
vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
        eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
    functions: { invoke: () => Promise.resolve({ data: null, error: null }) },
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
  },
}));

vi.mock("@/components/TeamMembers", () => ({
  default: () => <div data-testid="team-members">Team</div>,
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

/**
 * Verifies that admin tab containers reserve bottom space (`pb-24`) on
 * mobile so the last item is not hidden behind the sticky bottom nav.
 */
describe("Admin mobile bottom-nav padding", () => {
  it("AdminTeam root has pb-24 md:pb-6", () => {
    const { container } = renderWithProviders(<AdminTeam />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("pb-24");
    expect(root.className).toContain("md:pb-6");
  });

  it("InvitationManager root has pb-24 md:pb-6", () => {
    const { container } = renderWithProviders(<InvitationManager />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("pb-24");
    expect(root.className).toContain("md:pb-6");
  });

  it("TimeCorrectionRequests root has pb-24 md:pb-6", () => {
    const { container } = renderWithProviders(<TimeCorrectionRequests />);
    const root = container.firstElementChild as HTMLElement;
    expect(root.className).toContain("pb-24");
    expect(root.className).toContain("md:pb-6");
  });
});

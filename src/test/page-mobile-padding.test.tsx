import { describe, it, expect, vi } from "vitest";
import { render } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AdminChecklists from "@/pages/AdminChecklists";
import AdminSchedule from "@/pages/AdminSchedule";

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: () => ({
      select: () => ({
        order: () => Promise.resolve({ data: [], error: null }),
        eq: () => ({ order: () => Promise.resolve({ data: [], error: null }) }),
        gte: () => ({ lte: () => Promise.resolve({ data: [], error: null }) }),
      }),
    }),
    auth: { getUser: () => Promise.resolve({ data: { user: null } }) },
    channel: () => ({ on: () => ({ subscribe: () => ({}) }) }),
    removeChannel: () => {},
  },
}));

vi.mock("@/hooks/useAuth", () => ({
  useAuth: () => ({ user: { id: "test" }, loading: false }),
}));
vi.mock("@/hooks/useAdmin", () => ({
  useAdmin: () => ({ isAdmin: true, loading: false }),
}));

const renderWithProviders = (ui: React.ReactElement) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <QueryClientProvider client={qc}>
      <MemoryRouter>{ui}</MemoryRouter>
    </QueryClientProvider>
  );
};

describe("Employee/Admin page mobile padding", () => {
  it("AdminChecklists inner container has pb-24 md:pb-6", () => {
    const { container } = renderWithProviders(<AdminChecklists />);
    const inner = container.querySelector('[class*="pb-24"]');
    expect(inner).not.toBeNull();
    expect(inner!.className).toContain("md:pb-6");
  });

  it("AdminSchedule inner container has pb-24 md:pb-6", () => {
    const { container } = renderWithProviders(<AdminSchedule />);
    const inner = container.querySelector('[class*="pb-24"]');
    expect(inner).not.toBeNull();
    expect(inner!.className).toContain("md:pb-6");
  });
});

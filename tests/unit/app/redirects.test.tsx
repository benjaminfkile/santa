// docs/site.md section 4 legacy redirects: /santa -> /, /funding -> /donate.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { MemoryRouter, Routes, Route, useLocation } from "react-router-dom";
import { AppRoutes } from "../../../src/app/routes";
import { store } from "../../../src/store/useStore";
import { initialStore } from "../../../src/store/types";

function CurrentLocation() {
  const location = useLocation();
  return <div data-testid="path">{location.pathname}</div>;
}

beforeEach(() => {
  act(() => {
    store.setState({ ...initialStore });
  });
});

afterEach(() => {
  cleanup();
  act(() => {
    store.setState({ ...initialStore });
  });
});

describe("legacy redirects", () => {
  it("redirects /santa to /", () => {
    const { getByTestId } = render(
      <MemoryRouter initialEntries={["/santa"]}>
        <Routes>
          <Route path="*" element={<><AppRoutes /><CurrentLocation /></>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(getByTestId("path").textContent).toBe("/");
  });

  it("redirects /funding to /donate", () => {
    const { getByTestId } = render(
      <MemoryRouter initialEntries={["/funding"]}>
        <Routes>
          <Route path="*" element={<><AppRoutes /><CurrentLocation /></>} />
        </Routes>
      </MemoryRouter>,
    );
    expect(getByTestId("path").textContent).toBe("/donate");
  });
});

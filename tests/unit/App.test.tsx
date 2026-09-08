// docs/site.md section 4. The App renders the Shell and the current route.

import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import App from "../../src/App";
import { store } from "../../src/store/useStore";
import { initialStore } from "../../src/store/types";

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

describe("App", () => {
  it("renders the shell and a loading indicator with no data", () => {
    const { container } = render(<App />);
    expect(container.querySelector("header")).not.toBeNull();
    expect(container.textContent).toContain("Loading");
  });
});

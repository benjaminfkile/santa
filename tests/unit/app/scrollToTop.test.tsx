// docs/site.md section 4. ScrollToTop: a PUSH to a new pathname scrolls the
// window to the top instantly, a POP scrolls nothing, a hash scrolls its
// anchor into view (once more on the next frame for a late element), and a
// same-path search change scrolls nothing.

import { describe, it, expect, afterEach, beforeEach, vi } from "vitest";
import { act, cleanup, render } from "@testing-library/react";
import { createMemoryRouter, RouterProvider, Outlet } from "react-router-dom";
import { ScrollToTop } from "../../../src/app/ScrollToTop";

function Layout() {
  return (
    <>
      <ScrollToTop />
      <Outlet />
    </>
  );
}

function Page() {
  return <h2 id="section-two">Two</h2>;
}

function makeRouter() {
  return createMemoryRouter(
    [{ element: <Layout />, children: [{ path: "*", element: <Page /> }] }],
    { initialEntries: ["/first"] },
  );
}

let scrollTo: ReturnType<typeof vi.fn>;
let scrollIntoView: ReturnType<typeof vi.fn>;

beforeEach(() => {
  scrollTo = vi.fn();
  scrollIntoView = vi.fn();
  window.scrollTo = scrollTo as unknown as typeof window.scrollTo;
  Element.prototype.scrollIntoView = scrollIntoView as unknown as Element["scrollIntoView"];
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe("ScrollToTop", () => {
  it("does nothing on the first load", () => {
    render(<RouterProvider router={makeRouter()} />);
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("a PUSH to a new pathname scrolls to 0, 0 instantly", async () => {
    const router = makeRouter();
    render(<RouterProvider router={router} />);
    await act(() => router.navigate("/second"));
    expect(scrollTo).toHaveBeenCalledTimes(1);
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
  });

  it("a REPLACE to a new pathname scrolls to the top too", async () => {
    const router = makeRouter();
    render(<RouterProvider router={router} />);
    await act(() => router.navigate("/second", { replace: true }));
    expect(scrollTo).toHaveBeenCalledWith({ top: 0, left: 0, behavior: "instant" });
  });

  it("a POP scrolls nothing", async () => {
    const router = makeRouter();
    render(<RouterProvider router={router} />);
    await act(() => router.navigate("/second"));
    scrollTo.mockClear();
    await act(() => router.navigate(-1));
    expect(router.state.location.pathname).toBe("/first");
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });

  it("a hash scrolls the anchor element into view instead of the top", async () => {
    const router = makeRouter();
    render(<RouterProvider router={router} />);
    await act(() => router.navigate("/second#section-two"));
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(scrollIntoView.mock.contexts[0]).toBe(document.getElementById("section-two"));
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("a hash-only change on the same pathname scrolls to its anchor", async () => {
    const router = makeRouter();
    render(<RouterProvider router={router} />);
    await act(() => router.navigate("/first#section-two"));
    expect(scrollIntoView).toHaveBeenCalledWith({ block: "start" });
    expect(scrollTo).not.toHaveBeenCalled();
  });

  it("retries once on the next frame when the anchor is not rendered yet", async () => {
    const frames: FrameRequestCallback[] = [];
    vi.spyOn(window, "requestAnimationFrame").mockImplementation((cb) => {
      frames.push(cb);
      return frames.length;
    });
    const router = makeRouter();
    render(<RouterProvider router={router} />);
    await act(() => router.navigate("/second#late"));
    expect(scrollIntoView).not.toHaveBeenCalled();
    expect(frames).toHaveLength(1);
    const late = document.createElement("div");
    late.id = "late";
    document.body.appendChild(late);
    frames[0](0);
    expect(scrollIntoView).toHaveBeenCalledTimes(1);
    expect(scrollIntoView.mock.contexts[0]).toBe(late);
    expect(frames).toHaveLength(1);
    late.remove();
  });

  it("a same-path search change scrolls nothing", async () => {
    const router = makeRouter();
    render(<RouterProvider router={router} />);
    await act(() => router.navigate("/first?page=2"));
    expect(scrollTo).not.toHaveBeenCalled();
    expect(scrollIntoView).not.toHaveBeenCalled();
  });
});

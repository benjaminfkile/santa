// docs/site.md sections 7.3, 7.4, and 7.5. A media entry of kind video
// renders a controlled, inline-playing video with one MP4 source and its
// poster, in the box an image would take, in a rich text media block and
// in every layout of the media section; a gallery link sits under the
// video as a caption link.

import { describe, it, expect, vi } from "vitest";
import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { render, act } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { Media } from "../../../../src/content/primitives/Media";
import { MediaBlock } from "../../../../src/content/blocks/MediaBlock";
import { MediaGallery } from "../../../../src/content/sections/MediaGallery/MediaGallery";
import type { ContentBundle } from "../../../../src/store/types";

function bundle(): ContentBundle {
  return {
    content: null as unknown as ContentBundle["content"],
    icons: {},
    media: {
      vid: {
        url: "https://cdn/clip.mp4",
        kind: "video",
        width: 1280,
        height: 720,
        alt: "the sleigh",
        credit: "Photo club",
        variants: {},
        dark: null,
        invertInDark: false,
        small: null,
        durationMs: 12000,
        posterMediaId: "poster",
      },
      bare: {
        url: "https://cdn/bare.mp4",
        kind: "video",
        width: 640,
        height: 360,
        alt: "bare",
        variants: {},
        durationMs: 5000,
        posterMediaId: null,
      },
      lost: {
        url: "https://cdn/lost.mp4",
        kind: "video",
        width: 640,
        height: 360,
        alt: "lost",
        variants: {},
        posterMediaId: "nowhere",
      },
      plain: {
        url: "https://cdn/plain.mp4",
        kind: "video",
        width: 640,
        height: 360,
        alt: "plain",
        variants: {},
        posterMediaId: "plainPoster",
      },
      poster: {
        url: "https://cdn/poster.jpg",
        kind: "raster",
        width: 1920,
        height: 1080,
        alt: "",
        variants: { "480": "https://cdn/p480.webp", "960": "https://cdn/p960.webp" },
      },
      plainPoster: {
        url: "https://cdn/plain-poster.gif",
        kind: "gif",
        width: 640,
        height: 360,
        alt: "",
        variants: {},
      },
      pic: { url: "https://cdn/pic.jpg", kind: "raster", width: 800, height: 600, alt: "pic", variants: {} },
    },
  };
}

function wrap(node: React.ReactNode) {
  return <MemoryRouter>{node}</MemoryRouter>;
}

const ROOT = resolve(__dirname, "..", "..", "..", "..");

describe("Media video", () => {
  it("renders a controlled inline video with one MP4 source and the poster's 960 variant", () => {
    const { container } = render(<Media media={{ mediaId: "vid", alt: null }} bundle={bundle()} />);
    expect(container.querySelector("img")).toBeNull();
    const video = container.querySelector("video")!;
    expect(video).not.toBeNull();
    expect(video.hasAttribute("controls")).toBe(true);
    expect(video.hasAttribute("playsinline")).toBe(true);
    expect(video.getAttribute("preload")).toBe("metadata");
    expect(video.getAttribute("width")).toBe("1280");
    expect(video.getAttribute("height")).toBe("720");
    expect(video.getAttribute("poster")).toBe("https://cdn/p960.webp");
    expect(video.hasAttribute("autoplay")).toBe(false);
    expect(video.hasAttribute("loop")).toBe(false);
    expect(video.hasAttribute("muted")).toBe(false);
    expect(video.muted).toBe(false);
    expect(video.getAttribute("aria-label")).toBe("the sleigh");
    const sources = video.querySelectorAll("source");
    expect(sources.length).toBe(1);
    expect(sources[0].getAttribute("src")).toBe("https://cdn/clip.mp4");
    expect(sources[0].getAttribute("type")).toBe("video/mp4");
    expect(video.hasAttribute("srcset")).toBe(false);
  });

  it("a poster without a 960 variant draws its url", () => {
    const { container } = render(<Media media={{ mediaId: "plain", alt: null }} bundle={bundle()} />);
    expect(container.querySelector("video")!.getAttribute("poster")).toBe("https://cdn/plain-poster.gif");
  });

  it("draws no poster when posterMediaId is null or does not resolve", () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => {});
    const { container } = render(
      <>
        <Media media={{ mediaId: "bare", alt: null }} bundle={bundle()} />
        <Media media={{ mediaId: "lost", alt: null }} bundle={bundle()} />
      </>,
    );
    const videos = container.querySelectorAll("video");
    expect(videos.length).toBe(2);
    videos.forEach((v) => expect(v.hasAttribute("poster")).toBe(false));
    warn.mockRestore();
  });

  it("takes no dark or small screen branch", () => {
    const b = bundle();
    b.media!.vid = { ...b.media!.vid!, dark: { url: "https://cdn/dark.jpg" }, invertInDark: true, small: { url: "https://cdn/small.jpg" } };
    const { container } = render(<Media media={{ mediaId: "vid", alt: null }} bundle={b} />);
    expect(container.querySelectorAll("video").length).toBe(1);
    expect(container.querySelector("[data-dark-mode]")).toBeNull();
    expect(container.querySelector("[data-screen]")).toBeNull();
  });

  it("the video takes the image's box: up to its container's width, height from the aspect", () => {
    const css = readFileSync(resolve(ROOT, "src/content/primitives/Video.module.css"), "utf8");
    expect(css).toMatch(/\.video\s*\{[^}]*max-width:\s*100%[^}]*height:\s*auto/);
  });
});

describe("a video in a rich text media block", () => {
  it("renders the video with its credit and caption in the block's size", () => {
    const { container } = render(
      wrap(
        <MediaBlock
          data={{ media: { mediaId: "vid", alt: null }, caption: "Over the valley", size: "medium" }}
          bundle={bundle()}
        />,
      ),
    );
    const figure = container.querySelector("figure")!;
    expect(figure.querySelector("video")).not.toBeNull();
    expect(figure.querySelector("[data-testid='media-credit']")!.textContent).toBe("Photo club");
    expect(figure.querySelector("figcaption")!.textContent).toBe("Over the valley");
    const css = readFileSync(resolve(ROOT, "src/content/sections/RichText/RichText.module.css"), "utf8");
    expect(css).toMatch(/\.blockMediaSmall video \{ max-width: min\(320px, 100%\); \}/);
    expect(css).toMatch(/\.blockMediaMedium video \{ max-width: min\(640px, 100%\); \}/);
  });
});

describe("a video in the media section", () => {
  const link = { label: "Watch more", href: "https://example.org/", icon: null, newTab: true };

  it("a grid cell holds the video inline with its controls", () => {
    const items = [
      { id: 1, data: { media: { mediaId: "vid", alt: null }, caption: "one", link: null } },
      { id: 2, data: { media: { mediaId: "pic", alt: null }, caption: null, link: null } },
    ];
    const { container } = render(
      wrap(<MediaGallery data={{ layout: "grid", columns: 2 }} items={items} bundle={bundle()} />),
    );
    const figures = container.querySelectorAll("figure");
    expect(figures.length).toBe(2);
    expect(figures[0].querySelector("video[controls]")).not.toBeNull();
    expect(figures[1].querySelector("img")).not.toBeNull();
    const css = readFileSync(resolve(ROOT, "src/content/sections/MediaGallery/MediaGallery.module.css"), "utf8");
    expect(css).toMatch(/\.mediaGalleryFigure video \{ display: block; max-width: 100%; height: auto; \}/);
  });

  it("a link never wraps a video: it renders as a caption link under it", () => {
    const items = [{ id: 1, data: { media: { mediaId: "vid", alt: null }, caption: "cap", link } }];
    const { container, getByTestId } = render(
      wrap(<MediaGallery data={{ layout: "single", columns: 3 }} items={items} bundle={bundle()} />),
    );
    const video = container.querySelector("video")!;
    expect(video.closest("a")).toBeNull();
    const caption = getByTestId("media-link-caption");
    const anchor = caption.querySelector("a")!;
    expect(anchor.getAttribute("href")).toBe("https://example.org/");
    expect(anchor.getAttribute("target")).toBe("_blank");
    expect(anchor.textContent).toBe("Watch more");
    // The link line comes after the video in the figure.
    expect(video.compareDocumentPosition(caption) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("a link still wraps an image", () => {
    const items = [{ id: 1, data: { media: { mediaId: "pic", alt: null }, caption: null, link } }];
    const { container, queryByTestId } = render(
      wrap(<MediaGallery data={{ layout: "single", columns: 3 }} items={items} bundle={bundle()} />),
    );
    expect(container.querySelector("img")!.closest("a")).not.toBeNull();
    expect(queryByTestId("media-link-caption")).toBeNull();
  });

  it("a carousel slide holds the video inline and pauses it when the slide leaves", () => {
    const items = [
      { id: 1, data: { media: { mediaId: "vid", alt: null }, caption: null, link: null } },
      { id: 2, data: { media: { mediaId: "pic", alt: null }, caption: null, link: null } },
    ];
    const { container, getByLabelText } = render(
      wrap(<MediaGallery data={{ layout: "carousel", columns: 3 }} items={items} bundle={bundle()} />),
    );
    const video = container.querySelector("video")!;
    expect(video.hasAttribute("controls")).toBe(true);
    Object.defineProperty(video, "paused", { configurable: true, value: false });
    const pause = vi.fn();
    video.pause = pause;
    act(() => (getByLabelText("Next") as HTMLButtonElement).click());
    expect(pause).toHaveBeenCalledTimes(1);
  });
});

// docs/site.md sections 8.7 and 8.9. The legacy Santa pin, one bundled
// asset (`santa-pin.png`, 100 x 192 with the transparent padding trimmed
// and the pin tip at the bottom centre) shared by the tracker's Santa
// marker and the route map's pin. The source is sharp to about 64 css px
// tall, so both maps draw it smaller and it stays crisp at retina.

import santaPinUrl from "./santa-pin.png";

export const SANTA_PIN_URL: string = santaPinUrl;

const SOURCE_WIDTH = 100;
const SOURCE_HEIGHT = 192;

// An `img` of the pin `height` css px tall at the source's aspect,
// decorative (empty alt, `aria-hidden`), never a pointer target.
export function createSantaPinImage(height: number): HTMLImageElement {
  const img = document.createElement("img");
  img.src = SANTA_PIN_URL;
  img.alt = "";
  img.setAttribute("aria-hidden", "true");
  img.draggable = false;
  img.decoding = "async";
  img.style.display = "block";
  img.style.height = `${height}px`;
  img.style.width = `${Math.round((height * SOURCE_WIDTH * 100) / SOURCE_HEIGHT) / 100}px`;
  img.style.pointerEvents = "none";
  return img;
}

// A startup easter egg for anyone who opens the developer console: Santa in
// pixel-art sunglasses, drawn as coloured blocks with %c styles. Each pixel is
// two spaces wide so the cells come out roughly square. Empty cells are
// transparent, and the developer credit sits underneath.

const SPRITE = [
  "..........WW....",
  "......RRRRWW....",
  ".....RRRRRR.....",
  "....RRRRRRRR....",
  "...WWWWWWWWWW...",
  "...SSSSSSSSSS...",
  ".KKKKKKKKKKKKKK.",
  "..KGKKKSSKGKKK..",
  "...KKKSSSSKKK...",
  "...SSSSNNSSSS...",
  "..WWWWWWWWWWWW..",
  "..WWWWWMMWWWWW..",
  "..WWWWWWWWWWWW..",
  "...WWWWWWWWWW...",
  "....WWWWWWWW....",
  "......WWWW......",
];

const PALETTE: Record<string, string> = {
  ".": "transparent", // no background: the console shows through
  R: "#c8102e", // hat
  W: "#f4f1ea", // fur and beard
  S: "#f2c9a0", // face
  K: "#111111", // shades
  G: "#ffffff", // glint on the lenses
  N: "#e8837a", // nose
  M: "#7a1020", // mouth
};

const PIXEL = "  ";
const CELL = "font-size:12px;line-height:12px;";

/** The format string and style arguments for console.log, one line per row. */
export function buildBanner(sprite: string[] = SPRITE): [string, ...string[]] {
  let format = "";
  const styles: string[] = [];
  sprite.forEach((row, i) => {
    if (i > 0) format += "\n";
    // Merge runs of one colour so the console gets fewer %c segments.
    let start = 0;
    for (let x = 1; x <= row.length; x++) {
      if (x === row.length || row[x] !== row[start]) {
        format += "%c" + PIXEL.repeat(x - start);
        styles.push(`${CELL}background:${PALETTE[row[start]] ?? PALETTE["."]};`);
        start = x;
      }
    }
  });
  // No colour on the credit, so it takes the console's own text colour. The
  // URL keeps its scheme because consoles only make a link clickable with one.
  format += "\n\n%cDeveloped by Ben Kile\n\n%chttps://benkile.com";
  styles.push(
    "font:600 13px 'Bricolage Grotesque',system-ui,sans-serif;padding-top:6px;",
    "font:500 12px 'IBM Plex Mono',ui-monospace,monospace;",
  );
  return [format, ...styles];
}

export function printConsoleBanner(): void {
  console.log(...buildBanner());
}

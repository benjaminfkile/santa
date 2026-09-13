// docs/site.md section 4 (route table) and contracts 4.5a. The
// printed-code route. Reads snapshot.qrCodes[tag] (waiting for the first
// snapshot when the store has none yet), sends one scan beacon, then
// navigates with replace: to /<pageSlug> (/ for the home page), to
// forwardUrl through window.location.replace, or to / when the tag is
// absent. The beacon fires before the navigation so a forward never
// cancels it. A malformed tag renders NotFound without a beacon.

import { useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useStore } from "../store/useStore";
import { sendScanBeacon } from "../api/qr";
import { NotFound } from "./NotFound";

const TAG_RE = /^qr-\d+$/;

export function QrPage() {
  const { tag = "" } = useParams();
  const snapshot = useStore((s) => s.snapshot);
  const navigate = useNavigate();
  const fired = useRef(false);
  const valid = TAG_RE.test(tag);

  useEffect(() => {
    if (!valid) return;
    if (fired.current) return;
    if (snapshot === null) return;
    fired.current = true;
    sendScanBeacon(tag, typeof document === "undefined" ? "" : document.referrer);
    const entry = snapshot.qrCodes?.[tag];
    if (entry !== undefined && entry !== null) {
      const forwardUrl = entry.forwardUrl ?? null;
      if (forwardUrl !== null) {
        window.location.replace(forwardUrl);
        return;
      }
      const pageSlug = entry.pageSlug ?? null;
      if (pageSlug !== null && pageSlug !== "" && pageSlug !== "/") {
        navigate(`/${pageSlug}`, { replace: true });
        return;
      }
    }
    navigate("/", { replace: true });
  }, [valid, snapshot, tag, navigate]);

  if (!valid) return <NotFound />;
  return null;
}

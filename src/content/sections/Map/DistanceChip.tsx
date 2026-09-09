// docs/site.md sections 7.6 and 8.6. Distance shown when user location is
// enabled and both fixes exist.

import { formatDistanceMetres } from "../../../map/userLocation";

export function DistanceChip({ distanceMetres }: { distanceMetres: number | null }) {
  if (distanceMetres === null || !Number.isFinite(distanceMetres)) return null;
  const text = formatDistanceMetres(distanceMetres);
  if (text === "") return null;
  return (
    <div className="distance-chip" role="status" aria-live="polite">
      {text} from you
    </div>
  );
}

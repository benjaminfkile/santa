import { useEffect, useState, useRef } from "react";
import Snow from "../../Utils/Snow/Snow";
import { ISponsor } from "../../interfaces";
import getSponsorClassName from "../../Utils/getSponsorClassName";
import NavMenu from "../../NavMenu/NavMenu";
import Logo from "../../Utils/Logo/Logo";
import "./EndShow.css";
interface EndShowProps {
  sponsors: ISponsor[];
}

export default function EndShow({ sponsors }: EndShowProps) {
  const [rotatedSponsors, setRotatedSponsors] = useState<ISponsor[]>([]);
  const [currentSponsor, setCurrentSponsor] = useState<ISponsor | null>(null);

  const sponsorIndex = useRef(0);
  const delay = useRef(2000);

  const shuffle = (array: ISponsor[]) => {
    let curr = array.length;
    while (curr !== 0) {
      const rand = Math.floor(Math.random() * curr);
      curr--;
      [array[curr], array[rand]] = [array[rand], array[curr]];
    }
    return array;
  };

  const getLogoUrlSmall = (s: ISponsor) =>
    // s.logo?.small_url ||
    s.logo?.full_url ||
    // s.logo?.small ||
    // s.logo?.full ||
    "";

  useEffect(() => {
    if (!sponsors || sponsors.length === 0) return;

    const shuffled = shuffle([...sponsors]);
    setRotatedSponsors(shuffled);

    sponsorIndex.current = 0;
    const sponsor = shuffled[0];
    setCurrentSponsor(sponsor);

    delay.current = sponsor.linger ?? 2000;
  }, [sponsors]);

  useEffect(() => {
    if (rotatedSponsors.length === 0) return;

    const timer = setTimeout(() => {
      sponsorIndex.current =
        (sponsorIndex.current + 1) % rotatedSponsors.length;

      const next = rotatedSponsors[sponsorIndex.current];
      setCurrentSponsor(next);

      delay.current = next.linger ?? 2000;
    }, delay.current);

    return () => clearTimeout(timer);
  }, [rotatedSponsors, currentSponsor]);

  const openLink = (url: string | null) => {
    if (url) window.open(url, "_blank");
  };

  return (
    <div
      className="EndShow"
      style={{ backgroundImage: `url("${process.env.REACT_APP_MAP_NOT_ALLOWED_IMG}")` }}

    >
      <Snow />
      <div className="EndShowLogoWraper">
        <Logo />
      </div>
      <NavMenu />
      <div className="endshow-info-card">
        <div className="endshow-header">
          <p className="endshow-header-p1">Santa has left Missoula!</p>
          <p className="endshow-header-p2">
            Thank you to all our sponsors and donors.
          </p>
        </div>

        <div
          className={`endshow-body EndShowModalBody-${getSponsorClassName(
            currentSponsor ? currentSponsor.id : -1
          )}`}
        >
          {!currentSponsor && <p>Loading…</p>}
          {currentSponsor && (
            <img
              src={getLogoUrlSmall(currentSponsor)}
              alt={currentSponsor.name}
            />
          )}
        </div>

        <div className="endshow-footer">
          {currentSponsor && (
            <p onClick={() => openLink(currentSponsor.website_url)}>
              {currentSponsor.name}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}

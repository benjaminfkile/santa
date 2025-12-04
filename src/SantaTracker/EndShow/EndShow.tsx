import { useEffect, useState, useRef } from "react";
import { Modal, Spinner } from "react-bootstrap";
import { Link } from "react-router-dom";
import LaughingSanta from "../../Utils/LaughingSanta/LaughingSanta";
import Snow from "../../Utils/Snow/Snow";
import { ISponsor } from "../../interfaces";
import "./EndShow.css";
import getSponsorClassName from "../../Utils/getSponsorClassName";

interface EndShowProps {
  sponsors: ISponsor[];
}

export default function EndShow({ sponsors }: EndShowProps) {
  const [rotatedSponsors, setRotatedSponsors] = useState<ISponsor[]>([]);
  const [currentSponsor, setCurrentSponsor] = useState<ISponsor | null>(null);

  const sponsorIndex = useRef(0);
  const delay = useRef(2000); // starter delay

  // Shuffle utility
  const shuffle = (array: ISponsor[]) => {
    let curr = array.length;
    while (curr !== 0) {
      const rand = Math.floor(Math.random() * curr);
      curr--;
      [array[curr], array[rand]] = [array[rand], array[curr]];
    }
    return array;
  };

  // Pick best logo URL from ISponsor.logo object
  const getLogoUrlSmall = (s: ISponsor) =>
    s.logo?.small_url ||
    s.logo?.full_url ||
    s.logo?.small ||
    s.logo?.full ||
    "";

  // Initialize once sponsors arrive
  useEffect(() => {
    if (!sponsors || sponsors.length === 0) return;

    const shuffled = shuffle([...sponsors]);
    setRotatedSponsors(shuffled);

    // Set first sponsor immediately
    sponsorIndex.current = 0;
    const sponsor = shuffled[0]
    setCurrentSponsor(sponsor);

    // Set initial delay based on sponsor linger value
    delay.current = sponsor.linger ?? 2000;
  }, [sponsors]);

  // Carousel rotation loop
  useEffect(() => {
    if (rotatedSponsors.length === 0) return;

    const timer = setTimeout(() => {
      sponsorIndex.current =
        (sponsorIndex.current + 1) % rotatedSponsors.length;

      const next = rotatedSponsors[sponsorIndex.current];
      setCurrentSponsor(next);

      // next sponsor delay
      delay.current = next.linger ?? 2000;
    }, delay.current);

    return () => clearTimeout(timer);
  }, [rotatedSponsors, currentSponsor]);

  const openLink = (url: string | null) => {
    if (url) window.open(url, "_blank");
  };

  return (
    <div className="EndShow"
      style={{ backgroundImage: `url("${process.env.REACT_APP_MAP_NOT_ALLOWED_IMG}")` }}
    >
      <div className="EndShowModalBodyLaughingSantaWrapper">
        <LaughingSanta message={"406"} />
      </div>

      <Modal id="endshow-modal" show={true} keyboard={false} centered={true}>
        <Modal.Header>
          <div className="EndShowModalHeader">
            <p className="EndShowModalHeaderP1">Santa has left Missoula!</p>
            <p className="EndShowModalHeaderP2">
              Thank you to all our sponsors and donors.
            </p>
          </div>
        </Modal.Header>

        <Modal.Body>
          <div className={`EndShowModalBody EndShowModalBody-${getSponsorClassName(currentSponsor ? currentSponsor.id : -1)}`}>
            {!currentSponsor && (
              <Spinner id="endshow-waiting-for-images" animation="border" />
            )}

            {currentSponsor && (
              <img src={getLogoUrlSmall(currentSponsor)} alt={currentSponsor.name} />
            )}
          </div>
        </Modal.Body>

        <Modal.Footer>
          <div className="EndShowModalFooter">
            <div id="end-show-sponsor-link">
              {currentSponsor && (
                <p onClick={() => openLink(currentSponsor.website_url)}>
                  {currentSponsor.name}
                </p>
              )}
            </div>

            <Link to="/about">
              <span id="endshow-home-btn" className="material-icons">
                home
              </span>
            </Link>
          </div>
        </Modal.Footer>
      </Modal>

      <Snow />
    </div>
  );
}

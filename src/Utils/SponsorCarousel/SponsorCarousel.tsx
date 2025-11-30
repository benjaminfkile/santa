import { useEffect, useState, useRef } from "react";
import { ISponsor } from "../../interfaces";
import "./SponsorCarousel.css";

interface SponsorCarouselProps {
  sponsors: ISponsor[];
  theme: string;
}

export default function SponsorCarousel({ sponsors, theme }: SponsorCarouselProps) {
  const [currentSponsor, setCurrentSponsor] = useState<ISponsor | null>(null);
  const [shuffled, setShuffled] = useState<ISponsor[]>([]);
  const indexRef = useRef(0);
  const timerRef = useRef<NodeJS.Timeout | null>(null);

  // Shuffle sponsors once when data arrives
  useEffect(() => {
    if (!sponsors || sponsors.length === 0) return;

    const shuffledSponsors = shuffle([...sponsors]);
    setShuffled(shuffledSponsors);
    indexRef.current = 0;
    setCurrentSponsor(shuffledSponsors[0]);
  }, [sponsors]);

  // Carousel rotation effect
  useEffect(() => {
    if (shuffled.length === 0) return;

    const sponsor = shuffled[indexRef.current];
    const delay = sponsor.linger ?? 2000;

    timerRef.current = setTimeout(() => {
      indexRef.current =
        indexRef.current < shuffled.length - 1 ? indexRef.current + 1 : 0;

      setCurrentSponsor(shuffled[indexRef.current]);
    }, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [shuffled, currentSponsor]);

  const shuffle = (arr: ISponsor[]) => {
    let i = arr.length;
    while (i > 0) {
      const j = Math.floor(Math.random() * i);
      i--;
      [arr[i], arr[j]] = [arr[j], arr[i]];
    }
    return arr;
  };

  const openLink = (url: string | null) => {
    if (url) window.open(url, "_blank");
  };

  if (!currentSponsor) return null;

  const logo =
    currentSponsor.logo?.small_url ||
    currentSponsor.logo?.full_url ||
    currentSponsor.logo?.small ||
    currentSponsor.logo?.full ||
    "";

  return (
    <div className="SponsorCarousel">
      <div
        id={`sponsor-carousel-item-${theme.toLowerCase()}`}
        className="SponsorCarouselItem"
      >
        <img
          src={logo}
          alt={currentSponsor.name}
          onClick={() => openLink(currentSponsor.website_url ?? currentSponsor.fb_url)}
        />
      </div>
    </div>
  );
}

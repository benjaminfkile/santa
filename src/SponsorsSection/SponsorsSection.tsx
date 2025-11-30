import { useEffect, useState } from "react";
import NavMenu from "../NavMenu/NavMenu";
import JumpingElf from "../Utils/JumpingElf/JumpingElf";
import Ornaments from "../Utils/Ornaments/Ornaments";
import Logo from "../Utils/Logo/Logo";
import { ISponsor } from "../interfaces";
import "./SponsorsSection.css";

interface SponsorsSectionProps {
  sponsors: ISponsor[];
}

export default function SponsorsSection({ sponsors }: SponsorsSectionProps) {
  const [sortedSponsors, setSortedSponsors] = useState<ISponsor[]>([]);

  useEffect(() => {
    if (!sponsors || sponsors.length === 0) return;

    // Sort by linger (formerly hangTime)
    const sorted = [...sponsors].sort((a, b) => b.linger - a.linger);

    setSortedSponsors(sorted);
  }, [sponsors]);

  const openLink = (url: string | null) => {
    if (url) window.open(url, "_blank");
  };

  const getLogoUrl = (s: ISponsor) =>
    s.logo?.full_url ||
    s.logo?.small_url ||
    s.logo?.full ||
    s.logo?.small ||
    "";

  return (
    <div className="SponsorsSection">
      <NavMenu />
      <JumpingElf />
      <Ornaments />

      <div className="SposorSectionHeader">
        <Logo />
      </div>

      {sortedSponsors.length > 0 && (
        <div className="SponsorList">
          {sortedSponsors.map((sponsor) => (
            <div className="SponsorItem" key={sponsor.id} id={`sponsor-${sponsor.id}`}>
              <div className="SponsorItemHeader">
                <p>{sponsor.name}</p>
              </div>

              <div className="SponsorLogoWrapper">
                <img src={getLogoUrl(sponsor)} alt={sponsor.name} />
              </div>

              {(sponsor.website_url || sponsor.fb_url) && (
                <div className="SponsorFooter">
                  <div className="SponsorFooterItem">
                    {sponsor.website_url && (
                      <a href={sponsor.website_url} target="_blank" rel="noreferrer">
                        {sponsor.name}
                      </a>
                    )}
                  </div>

                  <div className="SponsorFooterItem SponsorFooterItemFB">
                    {sponsor.fb_url && (
                      <img
                        src="/res/fb-icon.png"
                        alt="Facebook"
                        onClick={() => openLink(sponsor.fb_url)}
                      />
                    )}
                  </div>
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

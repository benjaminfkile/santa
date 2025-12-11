export interface ISantaFlyoverData {
  lat: number | null;
  lng: number | null;
  speed: number | null;
  alt: number | null;
  bearing: number | null;
  mode: number | null;
  time: number | null;
  eventUpdate: IEventUpdate;
  interval: number;
  instanceId: string;
  liftoff: number | null | undefined;
}

export interface ISponsor
  extends Omit<ISponsorLatestYearInfo, "amount_donated"> {
  //dont send amount donated
  id: number;
  name: string;
  website_url: string | null;
  fb_url: string | null;
  ig_url: string | null;
  logo: ISponsorLogo;
  linger: number;
  years_as_sponsor: number;
}

export interface ISponsorLatestYearInfo {
  latest_year: number | null;
  amount_donated: number | null;
  active: boolean | null;
  anonymous: boolean | null;
  can_advertise: boolean | null;
}

export interface ISponsorLogo {
  full: string | null;
  small: string | null;
  full_url: string | null;
  small_url: string | null;
}

export interface ISantaRoute {
  lat: number;
  lng: number;
  seq: number;
  time?: string;
}

export interface IEventUpdate {
  id?: number;
  message: string;
  time?: string | null;
  created_at?: string | null;
}

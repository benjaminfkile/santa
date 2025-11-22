export interface IReference {
  cookieTypes: ICookieType[];
}

export interface ICookie {
  cookie_id?: number;
  cookie_type_id: number;
  event_year: number;
  user_hash: string;
  created_at?: string;
}

export interface ICookieType {
  cookie_type_id: number;
  name: string
  total: number
}

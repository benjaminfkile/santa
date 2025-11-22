import React, { useState, useEffect } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import axios from "axios";
import { IReference } from "../../interfaces";

import ChocolateChip from "../../SVG/Cookies/ChocolateChip";
import Gingerbread from "../../SVG/Cookies/Gingerbread";
import Snickerdoodle from "../../SVG/Cookies/Snickerdoodle";
import Sugar from "../../SVG/Cookies/Sugar";
import Happy from "../../SVG/Cookies/Happy";

import authService from "../../Utils/authService";
import "./ChooseCookies.css";

interface CookieType {
  cookie_type_id: number;
  name: string;
}

interface Props {
  onClose: () => void;
  currentTheme: string;
}

const MAX_COOKIES = 5;

const ChooseCookies: React.FC<Props> = ({ onClose, currentTheme }) => {
  const [cookieTypes, setCookieTypes] = useState<CookieType[]>([]);
  const [selected, setSelected] = useState<{ [id: number]: number }>({});
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);

        const refRes = await axios.get<IReference>(
          `${process.env.REACT_APP_WMSFO_LOCATION_DATA_API_URL}/api/reference`
        );

        setCookieTypes(refRes.data.cookieTypes);
      } finally {
        setLoading(false);
      }
    };

    load();
    setSelected({});
  }, []);

  const selectedTotal = Object.values(selected).reduce((a, b) => a + b, 0);
  const limitReached = selectedTotal >= MAX_COOKIES;

  const addCookie = (cookieId: number) => {
    if (limitReached) return;

    setSelected((prev) => ({
      ...prev,
      [cookieId]: (prev[cookieId] || 0) + 1,
    }));
  };

  const removeCookie = (cookieId: number) => {
    if (!selected[cookieId]) return;

    setSelected((prev) => {
      const next = { ...prev };
      next[cookieId]--;
      if (next[cookieId] <= 0) delete next[cookieId];
      return next;
    });
  };

  const handleSubmit = async () => {
    if (selectedTotal === 0) return;

    setSubmitting(true);

    try {
      const payload: { cookie_type_id: number }[] = [];

      Object.entries(selected).forEach(([cookieId, count]) => {
        for (let i = 0; i < count; i++) {
          payload.push({ cookie_type_id: Number(cookieId) });
        }
      });

      await axios.post(
        `${process.env.REACT_APP_WMSFO_LOCATION_DATA_API_URL}/api/cookies`,
        payload,
        {
          headers: {
            "x-device-id": authService.getDeviceId(),
            "x-cookie-token": authService.getToken(),
          },
        }
      );

      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Something went wrong";
      alert(msg);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      id="cookies-modal"
      show
      centered
      className={`CookiesModal CookiesModal${currentTheme}`}
      onHide={onClose}
    >
      <Modal.Header>
        <div className="CookiesModalHeader">
          <div className="CookiesModalHeaderIcon">
            <Happy />
          </div>
        </div>
      </Modal.Header>

      <Modal.Body>
        <div className="CookiesModalBody">
          <div className={`ChooseCookiesInfo ChooseCookiesInfo${currentTheme}`}>
            {loading ? (
              <Spinner animation="border" />
            ) : (
              <>Choose up to ({MAX_COOKIES}) cookies</>
            )}
          </div>

          <div className="ChooseCookiesCookieItemContainer">
            {!loading &&
              cookieTypes.map((c) => {
                const count = selected[c.cookie_type_id] || 0;
                const plusDisabled = limitReached;
                const minusDisabled = count <= 0;

                return (
                  <div
                    key={c.cookie_type_id}
                    className={`ChooseCookiesCookieItem ChooseCookiesCookieItem${currentTheme}`}
                  >
                    <div className="ChooseCookiesCookieItemLeft">
                      <div className="ChooseCookiesCookieItemIcon">
                        {c.cookie_type_id === 1 && <ChocolateChip />}
                        {c.cookie_type_id === 2 && <Sugar />}
                        {c.cookie_type_id === 3 && <Snickerdoodle />}
                        {c.cookie_type_id === 4 && <Gingerbread />}
                      </div>

                      <div className="ChooseCookiesCookieItemName">
                        {c.name}
                      </div>
                    </div>

                    <div className="ChooseCookiesCookieItemRight">
                      <div className="ChooseCookiesCookieItemCount">
                        ({count})
                      </div>

                      <div
                        className={`ChooseCookiesCookieItemButtons ChooseCookiesCookieItemButtons${currentTheme}`}
                      >
                        <div
                          className={`ChooseCookiesCookieItemButton ChooseCookiesCookieItemButton${currentTheme} ${
                            plusDisabled ? "Disabled" : "Enabled"
                          }`}
                          onClick={() => {
                            if (!plusDisabled) addCookie(c.cookie_type_id);
                          }}
                        >
                          +
                        </div>

                        <div
                          className={`ChooseCookiesCookieItemButton ChooseCookiesCookieItemButton${currentTheme} ${
                            minusDisabled ? "Disabled" : "Enabled"
                          }`}
                          onClick={() => {
                            if (!minusDisabled) removeCookie(c.cookie_type_id);
                          }}
                        >
                          -
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
          </div>
        </div>
      </Modal.Body>

      <Modal.Footer>
        <div className="CookiesModalFooter">
          <Button variant="secondary" onClick={onClose} disabled={submitting}>
            Cancel
          </Button>

          <Button
            variant="primary"
            onClick={handleSubmit}
            disabled={submitting || selectedTotal === 0}
          >
            {submitting ? "Submitting..." : "Leave Cookies"}
          </Button>
        </div>
      </Modal.Footer>
    </Modal>
  );
};

export default ChooseCookies;

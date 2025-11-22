import React, { useState, useEffect } from "react";
import { Modal, Button, Spinner } from "react-bootstrap";
import axios from "axios";
import { IReference } from "../../interfaces";
import "./ChooseCookies.css";

import ChocolateChip from "../../SVG/Cookies/ChocolateChip";
import Gingerbread from "../../SVG/Cookies/Gingerbread";
import Snickerdoodle from "../../SVG/Cookies/Snickerdoodle";
import Sugar from "../../SVG/Cookies/Sugar";
import Happy from "../../SVG/Cookies/Happy";

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
  const [actualRemaining, setActualRemaining] = useState<number>(MAX_COOKIES);
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

        const stored = localStorage.getItem("santaCookiesRemaining");
        const num = stored ? parseInt(stored, 10) : MAX_COOKIES;
        setActualRemaining(isNaN(num) ? MAX_COOKIES : num);
      } finally {
        setLoading(false);
      }
    };

    load();
    setSelected({});
  }, []);

  const selectedTotal = Object.values(selected).reduce((a, b) => a + b, 0);
  const displayRemaining = actualRemaining - selectedTotal;

  const addCookie = (cookieId: number) => {
    if (displayRemaining <= 0) return;

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
        payload
      );

      const newRemaining = actualRemaining - selectedTotal;
      setActualRemaining(newRemaining);
      localStorage.setItem("santaCookiesRemaining", String(newRemaining));

      onClose();
    } catch (err: any) {
      const msg = err?.response?.data?.message || "Something went wrong";

      if (msg.toLowerCase().includes("maximum") || msg.includes("5")) {
        setActualRemaining(0);
        localStorage.setItem("santaCookiesRemaining", "0");
        alert("You've already used all your cookies!");
      } else {
        alert(msg);
      }
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
            ) : displayRemaining > 0 ? (
              <>Leave up to ({displayRemaining})</>
            ) : (
              <>You have no cookies left ❌🍪</>
            )}
          </div>
          <div className="ChooseCookiesCookieItemContainer">
            {!loading &&
              cookieTypes.map((c) => {

                const count = selected[c.cookie_type_id] || 0;
                const plusDisabled = displayRemaining <= 0;
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
                        {/* PLUS BUTTON */}
                        <div
                          className={`ChooseCookiesCookieItemButton ChooseCookiesCookieItemButton${currentTheme} ChooseCookiesCookieItemButton${plusDisabled ? "Disabled" : "Enabled"
                            }`}
                          onClick={() => {
                            if (!plusDisabled) addCookie(c.cookie_type_id);
                          }}
                        >
                          +
                        </div>

                        {/* MINUS BUTTON */}
                        <div
                          className={`ChooseCookiesCookieItemButton ChooseCookiesCookieItemButton${currentTheme} ChooseCookiesCookieItemButton${minusDisabled ? "Disabled" : "Enabled"
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
              }
              )}
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

import React, { useState, useEffect } from "react";
import { Modal, Button, ListGroup, Badge, Spinner } from "react-bootstrap";
import axios from "axios";
import { IReference } from "../../interfaces";
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

      alert("Thanks! Santa loves cookies 🎅🍪");
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
    <Modal show centered dialogClassName="CookiesModalWrapper">
      {/* WRAPPER MUST WRAP EVERYTHING */}
      <div
        className="CookiesModal"
        id={`${currentTheme.toLowerCase()}-theme-cookies-modal`}
      >
        <Modal.Header closeButton onHide={onClose}>
          <Modal.Title>🎄 Leave Cookies for Santa 🎄</Modal.Title>
        </Modal.Header>

        <Modal.Body>
          {loading ? (
            <div className="text-center">
              <Spinner animation="border" />
              <p>Loading cookie types...</p>
            </div>
          ) : (
            <>
              <p>
                You may leave <strong>{MAX_COOKIES}</strong> cookies total per
                device.
              </p>

              <p style={{ fontSize: "1.2rem" }}>
                Remaining:
                <Badge
                  variant={displayRemaining > 0 ? "success" : "secondary"}
                  style={{ marginLeft: 10 }}
                >
                  {displayRemaining}
                </Badge>
              </p>

              {displayRemaining === 0 && (
                <p style={{ color: "red", marginBottom: "1rem" }}>
                  You have already used all your cookies 🎅
                </p>
              )}

              <ListGroup>
                {cookieTypes.map((c) => {
                  const count = selected[c.cookie_type_id] || 0;

                  return (
                    <ListGroup.Item key={c.cookie_type_id}
                      id={`cookies-modal-list-group-item-${currentTheme.toLowerCase()}`}
                    >
                      <div className="cookies-modal-list-group-item">
                        <div className="cookie-name" style={{ flex: 1 }}>
                          {c.name}
                          {count > 0 && (
                            <Badge
                              variant="primary"
                              style={{ marginLeft: 10 }}
                            >
                              ×{count}
                            </Badge>
                          )}
                        </div>

                        <Button
                          variant="light"
                          disabled={displayRemaining <= 0}
                          onClick={() => addCookie(c.cookie_type_id)}
                          style={{ marginRight: 10 }}
                        >
                          +
                        </Button>

                        <Button
                          variant="light"
                          disabled={count <= 0}
                          onClick={() => removeCookie(c.cookie_type_id)}
                        >
                          –
                        </Button>
                      </div>
                    </ListGroup.Item>
                  );
                })}
              </ListGroup>
            </>
          )}
        </Modal.Body>

        <Modal.Footer>
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
        </Modal.Footer>
      </div>
    </Modal>
  );
};

export default ChooseCookies;

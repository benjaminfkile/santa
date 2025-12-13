import { useEffect, useRef, useState } from "react";
import fundData from "./FundData";
import { CircularProgressbar, buildStyles } from "react-circular-progressbar";
import "react-circular-progressbar/dist/styles.css";

interface FundsRingProps {
  message?: string;
  ringStrokeWidth?: number;
}

const FundsRing: React.FC<FundsRingProps> = ({
  message,
  ringStrokeWidth = 5,
}) => {
  const [progress, setProgress] = useState(0);
  const targetRef = useRef(0);
  const rafRef = useRef<number | null>(null);

  useEffect(() => {
    const interval = setInterval(() => {
      const raw = fundData.percent;
      const parsed = typeof raw === "string" ? parseInt(raw, 10) : raw;

      if (Number.isFinite(parsed) && parsed >= 0) {
        targetRef.current = Math.min(parsed, 100);
      }
    }, 500);

    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    const animate = () => {
      setProgress((prev) => {
        if (prev === targetRef.current) return prev;
        return prev < targetRef.current ? prev + 1 : prev - 1;
      });

      rafRef.current = requestAnimationFrame(animate);
    };

    rafRef.current = requestAnimationFrame(animate);

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return (
    <div className="FundsRing">
      <div className="FundsRingContent">
        <CircularProgressbar
          value={progress}
          text={`${progress}%`}
          strokeWidth={ringStrokeWidth}
          styles={buildStyles({
            rotation: 0.25,
            strokeLinecap: "butt",
            textSize: "30px",
            pathColor: "#007bff",
            textColor: "#fffffff5",
            trailColor: "#242526",
          })}
        />
        {message && <p>{message}</p>}
      </div>
    </div>
  );
};

export default FundsRing;

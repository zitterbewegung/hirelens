
import React, { useState, useEffect } from 'react';

interface ScoreGaugeProps {
  score: number;
}

const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score }) => {
  const [displayScore, setDisplayScore] = useState(0);

  useEffect(() => {
    const animation = requestAnimationFrame(() => setDisplayScore(score));
    return () => cancelAnimationFrame(animation);
  }, [score]);

  const radius = 80;
  const stroke = 12;
  const normalizedRadius = radius - stroke * 2;
  const circumference = normalizedRadius * 2 * Math.PI;
  const strokeDashoffset = circumference - (displayScore / 100) * circumference;

  const getScoreColor = (s: number) => {
    if (s < 50) return 'text-red-500';
    if (s < 75) return 'text-amber-400';
    return 'text-green-500';
  };
  
  const getStrokeColor = (s: number) => {
    if (s < 50) return 'stroke-red-500';
    if (s < 75) return 'stroke-amber-400';
    return 'stroke-green-500';
  };

  return (
    <div className="relative flex items-center justify-center">
      <svg
        height={radius * 2}
        width={radius * 2}
        className="-rotate-90"
      >
        <circle
          className="text-slate-700"
          stroke="currentColor"
          strokeWidth={stroke}
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
        />
        <circle
          className={`${getStrokeColor(score)} transition-all duration-1000 ease-out`}
          stroke="currentColor"
          strokeWidth={stroke}
          strokeLinecap="round"
          fill="transparent"
          r={normalizedRadius}
          cx={radius}
          cy={radius}
          style={{
            strokeDasharray: `${circumference} ${circumference}`,
            strokeDashoffset,
          }}
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center">
        <span className={`text-5xl font-bold ${getScoreColor(score)}`}>
          {Math.round(displayScore)}
        </span>
        <span className="text-sm text-slate-400">Quality Score</span>
      </div>
    </div>
  );
};

export default ScoreGauge;

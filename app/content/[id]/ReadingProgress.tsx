"use client";
import { useEffect, useState } from "react";
export default function ReadingProgress() {
  const [progress, setProgress] = useState(0);
  useEffect(() => {
    const update = () => { const height = document.documentElement.scrollHeight - window.innerHeight; setProgress(height > 0 ? Math.min(100, Math.round(window.scrollY / height * 100)) : 100); };
    update(); window.addEventListener("scroll", update, { passive: true }); window.addEventListener("resize", update);
    return () => { window.removeEventListener("scroll", update); window.removeEventListener("resize", update); };
  }, []);
  return <div className="reading-progress" role="progressbar" aria-label="읽기 진행률" aria-valuemin={0} aria-valuemax={100} aria-valuenow={progress}><span style={{ width: `${progress}%` }}/></div>;
}

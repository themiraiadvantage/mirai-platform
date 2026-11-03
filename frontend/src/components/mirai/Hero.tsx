"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ArrowDown, ArrowUpRight, ShieldCheck, MoveUpRight } from "lucide-react";

const scenes = [
  {
    src: "/images/mirai-buyers-hero.webp",
    alt: "Prospective buyers view an open plot with a surveyor during an illustrative site visit",
  },
  {
    src: "/images/mirai-coast-hero.webp",
    alt: "Open tropical land with a sandy access road and a distant coastal horizon",
  },
];

export function Hero() {
  const [sceneIndex, setSceneIndex] = useState(0);

  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    let timer: ReturnType<typeof setInterval> | undefined;
    const update = () => {
      clearInterval(timer);
      if (preference.matches || document.hidden) return;
      timer = setInterval(() => setSceneIndex((index) => (index + 1) % scenes.length), 8000);
    };
    update();
    preference.addEventListener("change", update);
    document.addEventListener("visibilitychange", update);
    return () => {
      clearInterval(timer);
      preference.removeEventListener("change", update);
      document.removeEventListener("visibilitychange", update);
    };
  }, []);
  return (
    <>
      <section className="estate-hero" aria-labelledby="home-heading">
        {scenes.map((scene, index) => (
          <img
            key={scene.src}
            className={`estate-hero-photo estate-hero-scene ${sceneIndex === index ? "is-active" : ""}`}
            src={scene.src}
            alt={scene.alt}
            aria-hidden={sceneIndex !== index}
            fetchPriority={index === 0 ? "high" : "low"}
            width={1920}
            height={1080}
          />
        ))}
        <div className="estate-hero-shade" />
        <div className="estate-hero-copy">
          <p className="estate-eyebrow hero-enter">
            <span /> A clearer path to land ownership
          </p>
          <h1 id="home-heading">
            <span>See the land.</span>
            <span>Know the details.</span>
            <span className="estate-gold">Own it with proof.</span>
          </h1>
          <p className="estate-hero-description hero-enter">
            Your next chapter starts on solid ground. Explore land in Lagos and Ogun with every
            boundary, document and site check in one clear record.
          </p>
          <div className="estate-hero-actions hero-enter">
            <Link className="estate-button estate-button-gold" href="/plots">
              Explore verified plots <ArrowUpRight size={19} />
            </Link>
            <a href="#trust" className="estate-text-link">
              How it works <ArrowDown size={16} />
            </a>
          </div>
        </div>
        <a className="estate-hero-note" href="/site-checks">
          <ShieldCheck size={25} strokeWidth={1.3} />
          <span>
            Look beyond the location.<strong>See the details that matter.</strong>
          </span>
          <MoveUpRight size={18} />
        </a>
      </section>
    </>
  );
}

"use client";
import Link from "next/link";
import {
  ArrowDown,
  ArrowUpRight,
  CheckCircle2,
  Clock,
  UserCheck,
  MapPin,
  ShieldCheck,
} from "lucide-react";
import { PublicLayout } from "@/components/mirai/SiteChrome";
import { Steps } from "@/components/mirai/Steps";
import { FinalInvitation } from "./LandingSections";

const WHO = [
  {
    who: "Licensed surveyor",
    what: "Prepares and confirms the survey plan and beacon coordinates.",
    when: "Before listing",
  },
  {
    who: "Verification reviewer",
    what: "Checks the title at the Lands Registry and records the result.",
    when: "Within 14 days of reservation",
  },
  {
    who: "Legal partner",
    what: "Reviews the sale agreement and prepares your deed of assignment.",
    when: "After full payment",
  },
  {
    who: "MIRAI field team",
    what: "Walks the boundaries, photographs each beacon and road access.",
    when: "At least once per plot",
  },
  {
    who: "Site check contributor",
    what: "Runs desk checks on flooding, slope, drainage and land-use limits.",
    when: "Updated every 6 months",
  },
];

export default function HowItWorksPage() {
  return (
    <div className="landing-page process-page">
      <PublicLayout>
        <section className="process-hero marine-surface">
          <div className="process-hero-copy">
            <p className="estate-eyebrow">The MIRAI process</p>
            <h1>
              A clearer path.
              <br />
              From first look
              <br />
              to <span>ownership.</span>
            </h1>
            <p>
              You see what has been checked, by whom and when, before you pay anything beyond the
              reservation.
            </p>
            <a className="estate-button estate-button-gold" href="#ownership-guide">
              Explore the 7 steps <ArrowDown size={18} />
            </a>
            <div className="process-hero-foot">
              <ShieldCheck size={17} /> One record. Every step accounted for.
            </div>
          </div>
          <div className="process-hero-visual">
            <img
              src="/images/land-2.jpg"
              alt="Open land and an access road seen from above"
              width={1280}
              height={800}
              fetchPriority="high"
            />
            <span className="process-photo-note">Illustrative site photography</span>
            <div className="process-photo-caption">
              <MapPin size={22} strokeWidth={1.3} />
              <div>
                <span>KNOW WHAT COMES NEXT</span>
                <p>
                  A plot. A plan.
                  <br />A clear way forward.
                </p>
              </div>
            </div>
          </div>
        </section>
        <nav className="process-chapter-nav" aria-label="Page sections">
          <a href="#ownership-guide">
            <span>01</span> Your ownership journey <ArrowDown size={14} />
          </a>
          <a href="#people-behind-proof">
            <span>02</span> The people behind the proof <ArrowDown size={14} />
          </a>
          <a href="#read-your-record">
            <span>03</span> Read your record <ArrowDown size={14} />
          </a>
        </nav>
        <section id="ownership-guide" className="estate-section estate-process process-journey">
          <div className="process-section-heading">
            <p className="estate-eyebrow">01 / Your ownership journey</p>
            <div>
              <h2>
                7 steps. <span>Proof at each one.</span>
              </h2>
              <p className="estate-lead">
                From discovering a plot to receiving your deed, follow the progress in one connected
                record.
              </p>
            </div>
          </div>
          <Steps />
        </section>
        <section id="people-behind-proof" className="estate-section process-people">
          <div className="process-people-intro">
            <p className="estate-eyebrow">02 / Who checks what</p>
            <h2>
              Every check has
              <br />
              <span>a name and a date.</span>
            </h2>
            <p className="estate-lead">
              Know who is responsible, what they review, and when their work becomes part of your
              record.
            </p>
            <div className="process-people-photo">
              <img
                src="/images/land-1.jpg"
                alt="A concrete boundary beacon on a palm-lined parcel of land"
                width={1280}
                height={800}
                loading="lazy"
              />
              <span>Clear boundaries. Documented checks.</span>
            </div>
          </div>
          <ol className="process-role-list">
            {WHO.map((person, i) => (
              <li key={person.who}>
                <span className="estate-index">0{i + 1}</span>
                <div>
                  <h3>{person.who}</h3>
                  <p>{person.what}</p>
                  <span className="process-role-time">
                    <Clock size={13} />
                    {person.when}
                  </span>
                </div>
                <UserCheck size={21} strokeWidth={1.3} />
              </li>
            ))}
          </ol>
        </section>
        <section id="read-your-record" className="process-record marine-surface">
          <div className="estate-section">
            <div className="process-record-intro">
              <p className="estate-eyebrow">03 / Read your record</p>
              <h2>
                Clarity means knowing
                <br />
                <span>what is still being checked.</span>
              </h2>
              <p className="estate-lead">
                Confirmed details and work in progress are always shown separately, so you can make
                your next move with the full picture.
              </p>
            </div>
            <div className="process-status-grid">
              <article>
                <CheckCircle2 size={27} strokeWidth={1.4} />
                <span className="process-status-label">REVIEWED & ON RECORD</span>
                <h3>Confirmed details</h3>
                <p>
                  A solid border and check icon identify details that have been reviewed and
                  recorded.
                </p>
                <div className="process-status-example">
                  <CheckCircle2 size={16} /> Confirmed
                </div>
              </article>
              <article className="process-status-pending">
                <Clock size={27} strokeWidth={1.4} />
                <span className="process-status-label">IN PROGRESS</span>
                <h3>Still being verified</h3>
                <p>
                  A dashed border and clock icon identify information that is still being checked.
                  Never shown as final.
                </p>
                <div className="process-status-example">
                  <Clock size={16} /> Pending review
                </div>
              </article>
            </div>
            <p className="process-record-note">
              Site checks are estimates from listed sources, not engineering surveys. Where helpful
              we recommend a specialist visit.
            </p>
            <Link href="/plots" className="estate-inline-link">
              Explore verified plots <ArrowUpRight size={18} />
            </Link>
          </div>
        </section>
        <FinalInvitation />
      </PublicLayout>
    </div>
  );
}

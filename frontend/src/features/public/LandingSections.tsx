import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Check,
  FileCheck2,
  MapPinned,
  ReceiptText,
  Wallet,
} from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

const essentials = [
  {
    icon: MapPinned,
    title: "Know what you’re standing on.",
    description:
      "Look beyond the photos. Explore the boundaries, access, and available site checks so you can ask the right questions.",
  },
  {
    icon: FileCheck2,
    title: "See the paperwork clearly.",
    description:
      "See which documents have been reviewed, who checked them, and what still needs attention. Clear information helps you take the next step.",
  },
  {
    icon: ReceiptText,
    title: "Understand the full picture.",
    description:
      "Review the land price, payment options, and additional costs together. Keep your receipts and progress in one plot record.",
  },
];

const plans = [
  {
    number: "01",
    title: "Pay outright",
    time: "One payment",
    copy: "For when you’re ready to take the next step in one go.",
    detail: "No instalment plan cost",
  },
  {
    number: "02",
    title: "Spread it over 3 months",
    time: "A little breathing room",
    copy: "Break the land price into equal monthly payments.",
    detail: "No additional plan cost",
  },
  {
    number: "03",
    title: "Spread it over 6 months",
    time: "More time to plan",
    copy: "A longer schedule to help you plan around your monthly budget.",
    detail: "5% plan cost, shown upfront",
  },
];

const questions = [
  [
    "What should I look at before choosing a plot?",
    "Start with the boundaries, document status, site checks, and full cost breakdown. Look at what has been confirmed and what is still pending, then compare the options against your plans.",
  ],
  [
    "Does every plot have the same payment options?",
    "No. Each plot lists its available plans. You can filter the catalogue by payment plan, then review the total cost and schedule in the plot record.",
  ],
  [
    "What does a pending check mean?",
    "It means that part of the record is still being reviewed. Pending information is labelled separately so you can see what is known and what still needs checking.",
  ],
  [
    "Where can I follow my ownership progress?",
    "Your Land Library brings the plot record, payment history, documents, and updates together. The current demo lets you explore this journey with sample records.",
  ],
];

export function BuyingClarity() {
  return (
    <section className="estate-section estate-clarity" data-reveal>
      <div className="estate-clarity-image">
        <img
          src="/images/land-1.jpg"
          alt="A survey beacon marks the boundary of open land surrounded by palm trees"
          width={1280}
          height={800}
          loading="lazy"
        />
        <div className="estate-image-caption">
          <p>
            A place for your plans.
            <br />A record you can follow.
          </p>
        </div>
      </div>
      <div className="estate-clarity-copy">
        <p className="estate-eyebrow">A better beginning</p>
        <h2>
          Good land decisions start with <span>clear details.</span>
        </h2>
        <p className="estate-lead">
          A plot is more than its size or price. Bring the location, paperwork, and costs into focus
          before you decide what comes next.
        </p>
        <div className="estate-essentials">
          {essentials.map((item, i) => (
            <article key={item.title}>
              <span className="estate-index">0{i + 1}</span>
              <div>
                <h3>{item.title}</h3>
                <p>{item.description}</p>
              </div>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

export function PaymentOptions() {
  return (
    <section className="estate-payments" data-reveal>
      <div className="estate-section">
        <div className="estate-section-heading">
          <h2>
            Your next step.
            <br />
            <span>At your pace.</span>
          </h2>
        </div>
        <div className="estate-plan-grid">
          {plans.map((plan, i) => (
            <article key={plan.number} className={i === 1 ? "estate-plan-featured" : ""}>
              <div className="estate-plan-top">
                <span>{plan.number} /</span>
                <Wallet size={22} strokeWidth={1.3} />
              </div>
              <p className="estate-eyebrow">{plan.time}</p>
              <h3>{plan.title}</h3>
              <p>{plan.copy}</p>
              <div className="estate-plan-detail">
                <Check size={17} />
                {plan.detail}
              </div>
              <Link href="/plots">
                Explore plots <ArrowUpRight size={18} />
              </Link>
            </article>
          ))}
        </div>
        <p className="estate-plan-footnote">
          Available plans vary by plot. Legal, survey, and documentation costs are separate from the
          land price. Review the full breakdown on the plot record.
        </p>
      </div>
    </section>
  );
}

export function BuyerQuestions() {
  return (
    <section className="estate-section estate-faq" data-reveal>
      <div>
        <p className="estate-eyebrow">A little more clarity</p>
        <h2>
          Before you take
          <br />
          <span>the next step.</span>
        </h2>
        <p className="estate-lead">A few things worth knowing as you explore your options.</p>
        <Link href="/faq" className="estate-inline-link">
          More questions, answered <ArrowUpRight size={18} />
        </Link>
      </div>
      <Accordion type="single" collapsible>
        {questions.map(([question, answer], i) => (
          <AccordionItem key={question} value={"buying-question-" + i}>
            <AccordionTrigger className="py-7 text-left text-base font-medium">
              <span className="flex gap-5">
                <span className="estate-index">0{i + 1}</span>
                {question}
              </span>
            </AccordionTrigger>
            <AccordionContent className="pb-7 pl-10 text-sm leading-7 text-muted-foreground">
              {answer}
            </AccordionContent>
          </AccordionItem>
        ))}
      </Accordion>
    </section>
  );
}

export function FinalInvitation() {
  return (
    <section className="estate-invitation marine-surface" data-reveal>
      <img src="/images/mirai-coast-hero.webp" alt="" width={1920} height={1080} loading="lazy" />
      <div className="estate-invitation-shade" />
      <div className="estate-section">
        <p className="estate-eyebrow">A place for what comes next</p>
        <h2>
          Big plans start with
          <br />a little <span>solid ground.</span>
        </h2>
        <p>
          You don’t have to decide today. Start with a closer look, compare the details, and find a
          plot that fits the future you have in mind.
        </p>
        <div className="estate-hero-actions">
          <Link href="/plots" className="estate-button estate-button-gold">
            Find your plot <ArrowUpRight size={20} />
          </Link>
          <Link href="/how-it-works" className="estate-text-link">
            Get to know the process <ArrowRight size={17} />
          </Link>
        </div>
      </div>
    </section>
  );
}

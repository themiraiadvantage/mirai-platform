"use client";

import { useState } from "react";
import { Search } from "lucide-react";
import { PublicLayout } from "@/components/mirai/SiteChrome";
import { EmptyState } from "@/components/mirai/primitives";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Input } from "@/components/ui/input";

const FAQ: Record<string, [string, string][]> = {
  Buying: [
    [
      "Is MIRAI an estate agent?",
      "No. MIRAI is a technology platform that keeps one verified record per plot. We don't sell investment schemes.",
    ],
    [
      "Can I visit a plot before paying?",
      "Yes. Book an inspection from any plot page. Our field team can meet you on site in Lagos or Ogun.",
    ],
    [
      "Which areas do you cover?",
      "Epe, Ibeju-Lekki, Ikorodu in Lagos, and Sagamu, Mowe/Ofada/Ibafo and Abeokuta in Ogun.",
    ],
  ],
  Payments: [
    [
      "How do I pay?",
      "Through Paystack: card, bank transfer or USSD. Every payment gets a receipt in your Land Library.",
    ],
    [
      "What if I miss an instalment?",
      "We contact you to agree a new date. No hidden penalty fees are added.",
    ],
  ],
  Documents: [
    [
      "When can I see full documents?",
      "Summaries are public. Full copies unlock once you reserve the plot.",
    ],
    [
      "What does 'Verified' mean?",
      "A named reviewer checked the document against the Lands Registry on the date shown.",
    ],
  ],
  "Site checks": [
    [
      "Is a plot flood-proof?",
      "We never say that. We show what available data says about flooding, with source and date, and recommend a specialist visit where helpful.",
    ],
    [
      "What does 'Not enough data' mean?",
      "We couldn't find a reliable source yet. We show that honestly rather than guessing.",
    ],
  ],
  "Co-ownership": [
    [
      "How is a partner matched?",
      "We match buyers wanting the same plot size and area within 3 months. Your identity stays hidden until both agree.",
    ],
    ["What if no one matches?", "Your deposit is refunded in full after 90 days."],
  ],
  Refunds: [
    [
      "Is the reservation fee refundable?",
      "Fully within 14 days if a verified document proves invalid; 50% if you cancel personally within 14 days.",
    ],
    ["How long do refunds take?", "Within 21 working days, itemised in writing."],
  ],
};

export default function Page() {
  const [q, setQ] = useState("");
  const groups = Object.entries(FAQ)
    .map(
      ([g, items]) =>
        [g, items.filter(([a, b]) => (a + b).toLowerCase().includes(q.toLowerCase()))] as const,
    )
    .filter(([, i]) => i.length);
  return (
    <PublicLayout>
      <div className="mx-auto max-w-3xl px-5 py-20">
        <h1 className="text-5xl">Questions, answered</h1>
        <div className="relative mt-8">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-low" />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search questions"
            aria-label="Search questions"
            className="pl-9"
          />
        </div>
        <div className="mt-10 space-y-10">
          {groups.length === 0 && <EmptyState title="No answers match that. Try another word." />}
          {groups.map(([g, items]) => (
            <section key={g}>
              <h2 className="mb-2 text-xs uppercase tracking-[0.2em] text-gold">{g}</h2>
              <Accordion type="multiple" className="surface px-5">
                {items.map(([qq, a]) => (
                  <AccordionItem key={qq} value={qq}>
                    <AccordionTrigger className="text-left">{qq}</AccordionTrigger>
                    <AccordionContent className="text-muted-foreground">{a}</AccordionContent>
                  </AccordionItem>
                ))}
              </Accordion>
            </section>
          ))}
        </div>
      </div>
    </PublicLayout>
  );
}

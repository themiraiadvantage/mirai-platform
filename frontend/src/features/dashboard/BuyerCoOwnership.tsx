"use client";
import Link from "next/link";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { PublicLayout } from "@/components/mirai/SiteChrome";
import { Button } from "@/components/ui/button";
import { useSession } from "@/lib/session";
import { authHref } from "@/lib/navigation";
import { propertyNaira as naira } from "@/lib/property-api";
import {
  coStatus,
  openPrivateAsset,
  paidAmount,
  post,
  usePropertyResource,
  type CoRequest,
  type LivePlot,
  type Page,
  type Policy,
} from "@/lib/property-api";

export function StartCoOwnership({ workspace = false }: { workspace?: boolean }) {
  const session = useSession();
  const router = useRouter();
  const [cursor, setCursor] = useState("");
  const [targetCode, setTargetCode] = useState("");
  useEffect(() => {
    setTargetCode(new URLSearchParams(window.location.search).get("plot") || "");
  }, []);
  const resource = usePropertyResource<{
    items: LivePlot[];
    policy: Policy | null;
    nextCursor: string | null;
  }>(
    `/co-ownership/offers?${new URLSearchParams({ ...(cursor ? { cursor } : {}), ...(targetCode ? { q: targetCode } : {}) })}`,
    false,
  );
  const [selected, setSelected] = useState<string>("");
  const [accepted, setAccepted] = useState(false);
  const [preference, setPreference] = useState("");
  const [review, setReview] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useEffect(() => {
    setAccepted(false);
    setReview(false);
    setPreference("");
  }, [session?.id]);
  const plot = resource.data?.items.find((p) => p.id === selected);
  const policy = resource.data?.policy;
  useEffect(() => {
    const code = new URLSearchParams(window.location.search).get("plot");
    const target = resource.data?.items.find((p) => p.code === code);
    if (target) setSelected(target.id);
  }, [resource.data]);
  const total = plot
    ? (Number(plot.price) +
        Number(plot.legalFee) +
        Number(plot.surveyFee) +
        Number(plot.documentationFee)) /
      2
    : 0;
  async function submit() {
    if (!plot || !policy || !accepted || busy) return;
    if (!session) {
      router.push(authHref("/sign-in", `/dashboard/co-own/start?plot=${plot.code}`));
      return;
    }
    setBusy(true);
    setError("");
    try {
      await post("/co-ownership/requests", {
        plotId: plot.id,
        policyId: policy.id,
        version: plot.version,
        accepted: true,
        preference,
      });
      toast.success("Your co-ownership request has been submitted");
      router.push("/dashboard/co-own");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not submit your request.");
    } finally {
      setBusy(false);
    }
  }
  const content = (
    <section className={`mx-auto max-w-7xl ${workspace ? "" : "px-5 py-14"}`}>
      <p className="eyebrow">A shared beginning</p>
      <h1 className="page-title">Start co-ownership</h1>
      <p className="page-subtitle">
        Choose an available plot, review the terms and request a partner match.
      </p>
      {resource.error && (
        <div role="alert" className="surface mt-6 p-5">
          {resource.error}{" "}
          <Button variant="outline" onClick={resource.refresh}>
            Try again
          </Button>
        </div>
      )}
      {resource.loading && (
        <div role="status" className="surface mt-8 animate-pulse p-8">
          Loading co-ownership opportunities…
        </div>
      )}
      {!resource.loading && !resource.error && (!policy || !resource.data?.items.length) && (
        <div className="surface mt-8 p-8">
          <h2 className="text-2xl">No co-ownership plots available yet</h2>
          <p className="mt-3">
            New opportunities will appear here once MIRAI publishes eligible plots and their terms.
          </p>
          <Button className="mt-5" variant="outline" asChild>
            <Link href={workspace ? "/dashboard/explore" : "/plots"}>Explore plots</Link>
          </Button>
          {targetCode && (
            <Button
              className="ml-3 mt-5"
              variant="outline"
              onClick={() => {
                setTargetCode("");
                setCursor("");
                setSelected("");
              }}
            >
              View other opportunities
            </Button>
          )}
        </div>
      )}
      {policy && !!resource.data?.items.length && (
        <div className="mt-8 grid items-start gap-7 lg:grid-cols-2">
          <article className="surface p-7">
            <p className="eyebrow">Terms · Version {policy.version}</p>
            <h2 className="mt-3 text-2xl">{policy.title}</h2>
            <p className="mt-5 whitespace-pre-wrap text-base leading-7 text-slate-700">
              {policy.body}
            </p>
          </article>
          <div className="surface p-7">
            <h2 className="text-2xl">{review ? "Review your request" : "Choose your plot"}</h2>
            {!review ? (
              <div className="mt-5 space-y-3">
                {resource.data.items.map((p) => (
                  <button
                    key={p.id}
                    aria-pressed={selected === p.id}
                    onClick={() => {
                      setSelected(p.id);
                      setAccepted(false);
                    }}
                    className={`w-full rounded-xl border p-4 text-left ${selected === p.id ? "border-amber-700 bg-amber-50" : "border-slate-200"}`}
                  >
                    <strong className="block">
                      {p.code} · {p.location}, {p.state}
                    </strong>
                    <span className="mt-1 block text-slate-700">
                      {p.size} sqm · {naira(Number(p.price) / 2)} land share each
                    </span>
                  </button>
                ))}
                <Button className="mt-4 w-full" disabled={!plot} onClick={() => setReview(true)}>
                  Review selected plot
                </Button>
                <div className="flex gap-3">
                  {cursor && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCursor("");
                        setSelected("");
                      }}
                    >
                      First page
                    </Button>
                  )}
                  {resource.data.nextCursor && (
                    <Button
                      variant="outline"
                      onClick={() => {
                        setCursor(resource.data!.nextCursor!);
                        setSelected("");
                      }}
                    >
                      More plots
                    </Button>
                  )}
                </div>
              </div>
            ) : (
              plot && (
                <div className="mt-5 space-y-5">
                  <p>
                    <strong>{plot.code}</strong> · {plot.title}
                  </p>
                  <dl className="divide-y">
                    {[
                      ["Your land share (50%)", Number(plot.price) / 2],
                      ["Legal fee share", Number(plot.legalFee) / 2],
                      ["Survey fee share", Number(plot.surveyFee) / 2],
                      ["Documentation share", Number(plot.documentationFee) / 2],
                      ["Your total contribution", total],
                    ].map(([label, amount]) => (
                      <div key={String(label)} className="flex justify-between gap-4 py-3">
                        <dt className="text-slate-700">{label}</dt>
                        <dd className="font-semibold">{naira(Number(amount))}</dd>
                      </div>
                    ))}
                  </dl>
                  <p className="rounded-xl bg-slate-50 p-4 text-slate-700">
                    Contribution period: {plot.coMonths} months. Planned deposit:{" "}
                    {naira(((Number(plot.price) / 2) * plot.coDepositPercent) / 100)} (
                    {plot.coDepositPercent}% of your land share), included in your contribution
                    total. No payment is collected when you submit this request.
                  </p>
                  <label className="block text-sm font-semibold">
                    Preferences or notes
                    <textarea
                      className="mt-2 w-full rounded-xl border p-3 font-normal"
                      maxLength={500}
                      rows={3}
                      value={preference}
                      onChange={(e) => setPreference(e.target.value)}
                      placeholder="Anything you would like the matching team to know"
                    />
                  </label>
                  <label className="flex items-start gap-3 text-sm leading-6">
                    <input
                      className="mt-1 size-4"
                      type="checkbox"
                      checked={accepted}
                      onChange={(e) => setAccepted(e.target.checked)}
                    />
                    I have read and accept terms version {policy.version} and the contribution
                    breakdown shown above.
                  </label>
                  {error && (
                    <p role="alert" className="text-red-800">
                      {error}
                    </p>
                  )}
                  <div className="flex gap-3">
                    <Button variant="outline" onClick={() => setReview(false)} disabled={busy}>
                      Back
                    </Button>
                    <Button
                      className="flex-1"
                      disabled={!accepted || busy}
                      onClick={() => void submit()}
                    >
                      {busy ? "Submitting…" : session ? "Submit request" : "Sign in to continue"}
                    </Button>
                  </div>
                </div>
              )
            )}
          </div>
        </div>
      )}
    </section>
  );
  return workspace ? content : <PublicLayout>{content}</PublicLayout>;
}

export function BuyerCoOwnership() {
  const [cursor, setCursor] = useState("");
  const resource = usePropertyResource<Page<CoRequest>>(
    `/co-ownership${cursor ? `?cursor=${cursor}` : ""}`,
  );
  const [busy, setBusy] = useState("");
  const [confirmCancel, setConfirmCancel] = useState("");
  const refreshRecords = resource.refresh;
  useEffect(() => {
    const refresh = () => {
      if (document.visibilityState === "visible") refreshRecords();
    };
    const id = setInterval(refresh, 30000);
    window.addEventListener("focus", refresh);
    return () => {
      clearInterval(id);
      window.removeEventListener("focus", refresh);
    };
  }, [refreshRecords]);
  async function act(r: CoRequest, action: "accept" | "cancel") {
    if (busy) return;
    setBusy(r.id);
    try {
      await post(
        `/co-ownership/requests/${r.id}/${action}`,
        action === "accept" ? { matchId: r.matchId } : {},
      );
      setConfirmCancel("");
      toast.success(action === "accept" ? "Agreement accepted" : "Request cancelled");
      resource.refresh();
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not update request.");
    } finally {
      setBusy("");
    }
  }
  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-5">
        <div>
          <p className="eyebrow">A shared beginning</p>
          <h1 className="page-title">Co-ownership</h1>
          <p className="page-subtitle">Your requests, agreements and contribution records.</p>
        </div>
        <div className="flex gap-3">
          <Button variant="outline" onClick={resource.refresh}>
            Refresh
          </Button>
          <Button asChild>
            <Link href="/dashboard/co-own/start">Start co-ownership</Link>
          </Button>
        </div>
      </div>
      {resource.error && (
        <p role="alert" className="surface mt-7 p-6">
          {resource.error}
        </p>
      )}
      {resource.loading && (
        <p role="status" className="mt-7">
          Loading your requests…
        </p>
      )}
      {!resource.loading && !resource.error && !resource.data?.items.length && (
        <div className="surface mt-8 p-9">
          <h2 className="text-2xl">You haven’t started co-ownership yet.</h2>
          <p className="mt-3 text-slate-700">
            Explore eligible plots and review the terms before submitting your first request.
          </p>
          <Button className="mt-5" asChild>
            <Link href="/dashboard/co-own/start">Explore co-ownership</Link>
          </Button>
        </div>
      )}
      <div className="mt-8 space-y-6">
        {resource.data?.items.map((r) => (
          <article key={r.id} className="surface p-6 md:p-8">
            <div className="flex flex-wrap justify-between gap-4">
              <div>
                <p className="eyebrow">{r.plot.code}</p>
                <h2 className="mt-2 text-2xl">{r.plot.title}</h2>
                <p className="mt-1 text-slate-700">
                  {r.plot.location}, {r.plot.state} · {r.plot.size} sqm
                </p>
              </div>
              <span className="h-fit rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-semibold text-amber-900">
                {coStatus[r.status]}
              </span>
            </div>
            <div className="mt-6 grid gap-4 sm:grid-cols-3">
              {[
                ["Your agreed contribution", r.offer.total],
                ["Confirmed contributions", paidAmount(r)],
                ["Outstanding balance", Math.max(0, r.offer.total - paidAmount(r))],
              ].map(([label, amount]) => (
                <div key={String(label)} className="rounded-xl bg-slate-50 p-4">
                  <p className="text-sm text-slate-600">{label}</p>
                  <strong className="mt-2 block text-xl">{naira(Number(amount))}</strong>
                </div>
              ))}
            </div>
            {r.status === "WAITING" && (
              <p className="mt-5 text-slate-700">
                Your request is saved. MIRAI will notify you when a suitable partner match is ready
                for review. No payment has been collected through this request.
              </p>
            )}
            {r.match && r.status !== "CANCELLED" && (
              <section className="mt-6 border-t pt-6">
                <h3 className="text-lg font-semibold">Partner agreement</h3>
                <p className="mt-3 whitespace-pre-wrap leading-7 text-slate-700">
                  {r.match.agreement}
                </p>
                <ul className="mt-4 space-y-2">
                  {r.match.requests.map((p) => (
                    <li key={p.id}>
                      {p.user.name} · {p.acceptedAt ? "Accepted" : "Awaiting acceptance"}
                    </li>
                  ))}
                </ul>
                {r.status === "PROPOSED" && !r.acceptedAt && (
                  <Button
                    className="mt-5"
                    disabled={busy === r.id}
                    onClick={() => void act(r, "accept")}
                  >
                    Accept this agreement
                  </Button>
                )}
                {r.status === "PROPOSED" && r.acceptedAt && (
                  <p className="mt-4 font-medium text-emerald-800">
                    You have accepted. Waiting for the other buyer.
                  </p>
                )}
              </section>
            )}
            <details className="mt-6 border-t pt-5">
              <summary className="cursor-pointer font-semibold">
                Accepted terms · Version {r.policy.version}
              </summary>
              <p className="mt-4 whitespace-pre-wrap text-slate-700">{r.policy.body}</p>
            </details>
            {!!r.contributions.length && (
              <section className="mt-6">
                <h3 className="font-semibold">Confirmed contributions</h3>
                <div className="mt-3 overflow-x-auto">
                  <table className="w-full text-left text-sm">
                    <thead>
                      <tr className="border-b">
                        <th className="p-3">Received</th>
                        <th className="p-3">Reference</th>
                        <th className="p-3">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      {r.contributions.map((c) => (
                        <tr key={c.id} className="border-b">
                          <td className="p-3">
                            {new Date(c.receivedAt).toLocaleDateString("en-NG")}
                          </td>
                          <td className="p-3">{c.reference}</td>
                          <td className="p-3">{naira(Number(c.amount))}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </section>
            )}
            {r.match?.allocations.map((a) => (
              <div
                key={a.id}
                className="mt-6 rounded-xl border border-emerald-200 bg-emerald-50 p-5"
              >
                <h3 className="font-semibold">Your allocation</h3>
                <p className="mt-2 whitespace-pre-wrap">{a.portion}</p>
                <Button
                  className="mt-4"
                  variant="outline"
                  onClick={() =>
                    void openPrivateAsset(a.documentId).catch((e) => toast.error(e.message))
                  }
                >
                  Open allocation document
                </Button>
              </div>
            ))}
            {["WAITING", "PROPOSED"].includes(r.status) && (
              <div className="mt-6 border-t pt-5">
                {confirmCancel === r.id ? (
                  <div className="space-y-3">
                    <p>
                      Cancel this request? If a match was proposed, the other buyer will return to
                      matching.
                    </p>
                    <div className="flex gap-3">
                      <Button
                        variant="outline"
                        disabled={!!busy}
                        onClick={() => setConfirmCancel("")}
                      >
                        Keep request
                      </Button>
                      <Button disabled={!!busy} onClick={() => void act(r, "cancel")}>
                        Confirm cancellation
                      </Button>
                    </div>
                  </div>
                ) : (
                  <Button variant="outline" onClick={() => setConfirmCancel(r.id)}>
                    {r.status === "PROPOSED" ? "Decline and cancel request" : "Cancel request"}
                  </Button>
                )}
              </div>
            )}
          </article>
        ))}
      </div>
      <div className="mt-6 flex gap-3">
        {cursor && (
          <Button variant="outline" onClick={() => setCursor("")}>
            First page
          </Button>
        )}
        {resource.data?.nextCursor && (
          <Button variant="outline" onClick={() => setCursor(resource.data!.nextCursor!)}>
            Older requests
          </Button>
        )}
      </div>
    </>
  );
}

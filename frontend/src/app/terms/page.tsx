import Link from "next/link";
import { PolicyPage, type PolicySection } from "@/components/mirai/PolicyPage";
import { COMPANY } from "@/lib/company";

export const metadata = {
  title: "Terms of Service",
  description:
    "The terms for using MIRAI, including account responsibilities, property information, service availability, payments, and your rights.",
};
const emailLink = <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>;
const sections: PolicySection[] = [
  {
    id: "agreement",
    title: "About these terms",
    content: (
      <>
        <p>
          These Terms of Service govern your use of the MIRAI website and account services. “MIRAI”,
          “we”, “us”, and “our” refer to the MIRAI service. “You” refers to the person using it.
        </p>
        <p>
          Read these terms before creating an account or using account features. If you do not
          agree, do not create an account or use those features. Our{" "}
          <Link href="/privacy">Privacy Policy</Link> explains how personal information is handled;
          acceptance of these terms is not consent to unrelated processing or marketing.
        </p>
        <p>Questions about the service or these terms can be sent to {emailLink}.</p>
      </>
    ),
  },
  {
    id: "accounts",
    title: "Eligibility and your account",
    content: (
      <>
        <p>
          You must be at least 18 years old and able to enter into a binding agreement to create a
          MIRAI account. If acting for an organisation, you must have authority to do so.
        </p>
        <ul>
          <li>Provide accurate registration details and use an email address you control.</li>
          <li>Complete email verification before signing in.</li>
          <li>
            Keep your password and verification codes confidential, and do not share your account.
          </li>
          <li>
            Tell us promptly if you believe your account has been accessed without permission.
          </li>
          <li>
            Do not impersonate another person, misrepresent your authority, or use an account to
            access someone else’s information.
          </li>
        </ul>
        <p>
          Account access is subject to authentication and security checks. Creating an account does
          not create an ownership interest in land or give access to staff functions.
        </p>
      </>
    ),
  },
  {
    id: "service",
    title: "What the service currently provides",
    content: (
      <>
        <p>
          MIRAI is a technology platform for exploring land information and organising records.
          Account registration, email-code verification, sign-in, session refresh, and sign-out are
          connected services.
        </p>
        <p>
          Property listings, platform statistics, document and site findings, ownership dashboards,
          reservation controls, payment schedules, receipts, and co-ownership matching currently
          include sample or preview information. Preview actions create browser-local records. They
          do not reserve or allocate land, move money, upload legal documents to a document vault,
          or complete a purchase.
        </p>
        <p>
          The website does not currently offer live online land transactions. A displayed plot,
          price, button, record, or generated preview receipt is not a binding offer, title
          document, allocation, or proof of payment.
        </p>
      </>
    ),
  },
  {
    id: "property-information",
    title: "Property information and professional checks",
    content: (
      <>
        <p>
          Maps, photographs, coordinates, boundaries, document statuses, and site findings must be
          read with their source, date, and stated scope. A status such as “Verified” concerns the
          particular check described; it is not a guarantee that every title, planning, access,
          boundary, environmental, or ownership issue has been resolved. Sample statuses are not
          evidence of a completed professional review.
        </p>
        <p>
          Before entering a real land transaction, obtain the relevant independent legal, survey,
          title, planning, and physical-site checks. Information on this website does not replace
          the advice or work of a qualified professional.
        </p>
        <p>
          We do not promise investment returns, future values, development approval, or that a
          property will suit a particular project. Let us know if information appears inaccurate or
          misleading so it can be investigated.
        </p>
      </>
    ),
  },
  {
    id: "payments",
    title: "Prices, reservations, payments, and refunds",
    content: (
      <>
        <p>
          No payment is due simply for creating an account. Current reservation and payment features
          are previews, and no real payment should be made through them. Example prices, fees,
          instalment plans, renewal charges, cancellation windows, and refund calculations on the
          website illustrate the proposed experience; they are not an executed purchase or finance
          agreement.
        </p>
        <p>
          If a live paid service or property transaction is introduced, the applicable price,
          charges, payment schedule, reservation period, cancellation conditions, and refund process
          must be disclosed before you commit. A real transaction requires its own applicable
          written terms and confirmed payment instructions. These website terms do not themselves
          transfer land.
        </p>
        <p>
          Do not send money to a personal account or payment request solely because it refers to
          MIRAI. Confirm the transaction and payment instructions through the published contact. Any
          future contract or fee policy remains subject to your mandatory consumer rights.
        </p>
        <p>
          You can review the currently labelled <Link href="/fees">sample fee information</Link>. It
          does not override this explanation of the service’s present availability.
        </p>
      </>
    ),
  },
  {
    id: "co-ownership",
    title: "Co-ownership and partner matching",
    content: (
      <p>
        Matching preferences and co-ownership illustrations do not form a partnership, promise a
        match, or create a shared ownership interest. A real shared purchase requires a separate
        written agreement covering the parties, ownership shares, contributions, responsibilities,
        allocation, exit, and dispute arrangements, with the appropriate professional checks. The
        platform does not guarantee a match or a financial return.
      </p>
    ),
  },
  {
    id: "acceptable-use",
    title: "Responsible use of the platform",
    content: (
      <>
        <p>
          You may use the website for lawful purposes consistent with these terms. You must not:
        </p>
        <ul>
          <li>
            Attempt to bypass authentication, access another account, or interfere with security
            controls.
          </li>
          <li>Upload or submit unlawful, deceptive, abusive, or rights-infringing content.</li>
          <li>Introduce malware, overload the service, or run unauthorised security tests.</li>
          <li>
            Harvest other people’s information, misuse verification messages, or use the service for
            fraud.
          </li>
          <li>
            Present sample records, documents, screenshots, or receipts as genuine evidence of a
            purchase or ownership.
          </li>
        </ul>
        <p>
          Report a vulnerability privately to {emailLink} and avoid accessing or disclosing anyone
          else’s information.
        </p>
      </>
    ),
  },
  {
    id: "content",
    title: "Content and intellectual property",
    content: (
      <>
        <p>
          The MIRAI name, original interface, graphics, text, and software belong to MIRAI or the
          relevant rights holder. You may view and use the website for its intended purposes.
          Copying, selling, republishing, or commercially exploiting protected material requires
          permission unless the law permits it. Third-party maps, photographs, fonts, and other
          materials remain subject to their owners’ rights.
        </p>
        <p>
          You retain your rights in information you provide. You must have the right to provide it.
          You give us the permission reasonably needed to process that information to deliver the
          requested service, support your account, and meet applicable obligations, as explained in
          the Privacy Policy. This does not give us unrestricted ownership of your personal
          information.
        </p>
      </>
    ),
  },
  {
    id: "availability",
    title: "Availability, restrictions, and account closure",
    content: (
      <>
        <p>
          We may maintain, update, or change the platform and may restrict access where reasonably
          necessary to address misuse, security threats, legal requirements, or a breach of these
          terms. We will give appropriate notice where practicable. Maintenance or network issues
          can interrupt access; keep your own copies of any records important to you.
        </p>
        <p>
          You can stop using the website and sign out at any time. To request account closure or
          deletion, email {emailLink} from your registered address. We may need to verify your
          identity. The Privacy Policy explains retention and deletion; clearing local browser data
          alone does not close an account.
        </p>
        <p>
          Restriction or closure does not remove any rights or obligations that already apply under
          the law or a separate valid agreement.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Responsibility and your legal rights",
    content: (
      <>
        <p>
          MIRAI remains responsible for obligations imposed by applicable law. You are responsible
          for using the platform lawfully and for the accuracy of information you knowingly provide,
          without taking away any protection the law gives you.
        </p>
        <p>
          Nothing in these terms excludes or limits liability where doing so is prohibited,
          including responsibility that cannot lawfully be excluded for fraud, negligence,
          misleading statements, or failure to meet applicable statutory duties. Nothing removes a
          consumer’s mandatory rights or their ability to seek a remedy.
        </p>
        <p>
          The{" "}
          <a
            href="https://fccpc.gov.ng/consumers/consumer-rights-responsibilities/rights-responsibilities/"
            target="_blank"
            rel="noreferrer"
          >
            Federal Competition and Consumer Protection Commission
          </a>{" "}
          publishes information about consumer rights in Nigeria.
        </p>
      </>
    ),
  },
  {
    id: "law-disputes",
    title: "Applicable law and resolving concerns",
    content: (
      <>
        <p>
          These terms are governed by the laws of the Federal Republic of Nigeria, subject to any
          mandatory protections that apply to you. Disputes may be brought before a court with
          lawful jurisdiction.
        </p>
        <p>
          If you have a concern, contact {emailLink} with a clear explanation and relevant details
          so we can try to resolve it. Contacting us first is encouraged, but does not prevent you
          from approaching a competent court, the FCCPC, the Nigeria Data Protection Commission, or
          another relevant authority. There is no compulsory private arbitration requirement in
          these terms.
        </p>
      </>
    ),
  },
  {
    id: "changes-contact",
    title: "Changes and contact",
    content: (
      <>
        <p>
          We may update these terms when the service or applicable requirements change. The date
          above identifies the latest version. Material changes will be highlighted on the website
          or otherwise communicated where appropriate; any acceptance required by law will be
          sought. Changes do not retrospectively remove rights that have already arisen.
        </p>
        <p>
          If a provision cannot lawfully be enforced, the remaining provisions continue to apply to
          the extent permitted by law. A delay in enforcing a provision is not a general waiver of
          it.
        </p>
        <p>
          For service questions, complaints, or account support, contact <strong>MIRAI</strong> at{" "}
          {emailLink}.
        </p>
      </>
    ),
  },
];
export default function Page() {
  return (
    <PolicyPage
      kind="terms"
      title="Terms of Service"
      introduction="Clear expectations for using MIRAI, managing your account, and understanding the information you see before taking your next step."
      summary={[
        "You must be 18 or older, provide accurate account details, and keep your credentials private.",
        "Accounts and email verification are connected. Property, reservation, payment, and co-ownership journeys currently contain preview data and do not complete real transactions.",
        "Creating an account does not reserve land, transfer ownership, or replace a separate property agreement. Your mandatory legal rights remain protected.",
      ]}
      sections={sections}
    />
  );
}

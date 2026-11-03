import { PolicyPage, type PolicySection } from "@/components/mirai/PolicyPage";
import { COMPANY } from "@/lib/company";

export const metadata = {
  title: "Privacy Policy",
  description:
    "How MIRAI collects, uses, protects, and retains your personal information, and how to exercise your privacy rights.",
};
const emailLink = <a href={`mailto:${COMPANY.supportEmail}`}>{COMPANY.supportEmail}</a>;
const sections: PolicySection[] = [
  {
    id: "about",
    title: "Who we are and what this covers",
    content: (
      <>
        <p>
          MIRAI provides a digital platform for exploring land information and organising an
          ownership journey. In this policy, “MIRAI”, “we”, “us”, and “our” refer to the MIRAI
          service responsible for the personal information described here.
        </p>
        <p>
          This policy covers our website, account registration, verification emails, sign-in
          services, browser-based workspace, and communications with us. Contact {emailLink} about
          your information or this policy.
        </p>
      </>
    ),
  },
  {
    id: "information",
    title: "Information we collect",
    content: (
      <>
        <ul>
          <li>
            <strong>Account information:</strong> your name, email address, a protected password
            hash, account identifier, and dates associated with registration and email verification.
          </li>
          <li>
            <strong>Security information:</strong> verification and session records, including
            protected code or token values, expiration dates, and verification-attempt counts. Your
            verification code is delivered to your email address.
          </li>
          <li>
            <strong>Browser workspace information:</strong> a local copy of your profile, optional
            details entered in settings, saved plots, preferences, and any property records created
            through preview features.
          </li>
          <li>
            <strong>Technical information:</strong> your IP address and request information are
            processed when delivering and protecting the website. Infrastructure providers may also
            process browser, device, and connection details.
          </li>
          <li>
            <strong>Communications:</strong> information you choose to include when contacting us by
            email.
          </li>
        </ul>
        <p>
          Account registration does not require identity documents, bank details, or payment-card
          information. Do not upload sensitive documents or enter financial details into property
          preview controls.
        </p>
      </>
    ),
  },
  {
    id: "purposes",
    title: "How and why we use information",
    content: (
      <>
        <ul>
          <li>
            Create and administer your account and confirm that you control your email address.
          </li>
          <li>
            Sign you in, maintain your session, and help prevent unauthorised access or repeated
            verification attempts.
          </li>
          <li>Remember your browser workspace and the preferences you choose.</li>
          <li>Respond to support questions, privacy requests, and reports of misuse.</li>
          <li>Investigate service problems and meet applicable legal obligations.</li>
        </ul>
        <p>
          The account details required at registration are necessary to provide those account
          services. Without them, we cannot create or verify your account. Optional workspace
          information is not required to browse the public website.
        </p>
      </>
    ),
  },
  {
    id: "legal-basis",
    title: "Our grounds for processing",
    content: (
      <>
        <p>
          We rely on the grounds appropriate to the activity: providing the account services you
          request; our legitimate interests in securing, maintaining, and supporting the platform,
          balanced against your rights; and compliance with applicable legal obligations.
        </p>
        <p>
          Where an activity requires consent, we will request it separately. You may withdraw that
          consent without affecting earlier lawful processing. Agreeing to the Terms of Service is
          not blanket consent to marketing or unrelated uses of your information.
        </p>
      </>
    ),
  },
  {
    id: "storage",
    title: "Cookies and browser storage",
    content: (
      <>
        <ul>
          <li>
            <strong>Sign-in cookie:</strong> an essential, HttpOnly refresh cookie supports your
            session for up to 30 days from sign-in. A session can end earlier through sign-out,
            expiry, or security checks. A short-lived access token is held in application memory.
          </li>
          <li>
            <strong>Local storage:</strong> profile copies, property preview records, and workspace
            preferences can remain in this browser until you clear the site’s data. Signing out
            removes the local profile used for the session but does not erase all saved workspace
            records.
          </li>
          <li>
            <strong>Session storage:</strong> the verification screen may remember your email
            address in the current tab. The application removes that reminder after successful code
            verification.
          </li>
        </ul>
        <p>
          You can manage or clear cookies and site data through your browser settings. Blocking
          essential cookies may prevent sign-in or session restoration. Clearing browser storage
          does not delete the account stored on our server.
        </p>
        <p>
          We do not currently operate advertising trackers or behavioural advertising on the
          website. If optional tracking is introduced, this notice and any required choices will be
          updated before it is used.
        </p>
      </>
    ),
  },
  {
    id: "sharing",
    title: "Service providers and sharing",
    content: (
      <>
        <p>
          We use providers where needed to operate the service. Account records are hosted using
          Neon, and verification email is delivered through Google’s email services. Google Fonts
          supplies website fonts, and map views may request imagery from Esri. Those requests can
          disclose your IP address and other connection information to the relevant provider.
        </p>
        <p>
          Support messages sent to our published Gmail address are processed by Google as part of
          email delivery. Each provider’s own privacy terms also apply to its independent
          activities.
        </p>
        <p>
          We do not sell your personal information. Information may also be disclosed when required
          by law, to respond to a valid legal request, or where necessary to address fraud, protect
          rights, or resolve a security incident. Account registration does not publish your account
          details in the public plot catalogue.
        </p>
      </>
    ),
  },
  {
    id: "international",
    title: "Processing outside Nigeria",
    content: (
      <>
        <p>
          Our current account database is hosted in the United States, and our other service
          providers may process information in additional countries. Their locations may have
          different data-protection rules from Nigeria.
        </p>
        <p>
          International processing remains subject to applicable data-protection requirements. You
          can contact us to ask where your information is processed and about the safeguards
          relevant to a transfer. The Nigeria Data Protection Commission explains cross-border
          processing in its{" "}
          <a href="https://ndpc.gov.ng/faqs/" target="_blank" rel="noreferrer">
            official guidance
          </a>
          .
        </p>
      </>
    ),
  },
  {
    id: "retention",
    title: "How long information is kept",
    content: (
      <>
        <p>
          Account information is retained to administer your account until it is closed or deleted,
          subject to information that must be kept for a legitimate security need, legal obligation,
          or dispute. Retention decisions take account of the purpose, sensitivity, and applicable
          requirements.
        </p>
        <p>
          Verification codes stop working after 10 minutes. Sign-in sessions have a maximum lifetime
          of 30 days. Expired verification and session records may remain in the database until
          account deletion or administrative cleanup; expiry does not itself erase every stored
          record.
        </p>
        <p>
          Browser-local workspace records remain until you clear them. Email records and
          service-provider backups may have separate retention periods. Contact us if you need
          information about a particular record or want to request deletion.
        </p>
      </>
    ),
  },
  {
    id: "security",
    title: "Keeping your account secure",
    content: (
      <>
        <p>
          We use password hashing, protected verification values, expiring sessions, and limits on
          repeated authentication attempts to help protect account information. These measures
          reduce risk, but no online service can guarantee complete security.
        </p>
        <p>
          Use a unique password, keep verification codes private, and sign out of shared devices.
          Report suspected unauthorised access to {emailLink}. Do not send us your password or a
          verification code in a support message.
        </p>
      </>
    ),
  },
  {
    id: "rights",
    title: "Your choices and privacy rights",
    content: (
      <>
        <p>
          Depending on the applicable law and circumstances, you may request access to your
          information, correction of inaccurate information, deletion, restriction of processing,
          objection to processing, or a portable copy of information. You may also withdraw consent
          where processing relies on it and raise concerns about decisions made solely by automated
          processing.
        </p>
        <p>
          Send a request to {emailLink}, preferably from the email address associated with your
          account. Explain what you would like us to do. We may need to confirm your identity before
          acting, and will explain any lawful reason a request cannot be fully met. Rights requests
          are handled through this contact; clearing a browser or editing a local profile is not a
          server-side account deletion or correction request.
        </p>
        <p>
          You may complain to the{" "}
          <a href="https://ndpc.gov.ng/" target="_blank" rel="noreferrer">
            Nigeria Data Protection Commission
          </a>
          . Contacting us first is welcome but is not a condition of exercising that right.
        </p>
      </>
    ),
  },
  {
    id: "children",
    title: "Children’s information",
    content: (
      <p>
        MIRAI accounts are intended for adults aged 18 or older. We do not seek to collect personal
        information from children. If you believe a child has provided information, contact us so we
        can investigate and take appropriate action.
      </p>
    ),
  },
  {
    id: "communications",
    title: "Messages and policy updates",
    content: (
      <>
        <p>
          Verification and essential account messages relate to providing and protecting your
          account. They are separate from promotional messages. The website’s newsletter controls
          are not currently connected to a mailing list. Any future optional marketing will provide
          an appropriate choice and a way to stop receiving it.
        </p>
        <p>
          We will update the date at the top when this policy changes. Material changes will be
          highlighted on the website or otherwise communicated where appropriate. Privacy questions
          and requests can be sent to {emailLink}.
        </p>
      </>
    ),
  },
];
export default function Page() {
  return (
    <PolicyPage
      kind="privacy"
      title="Privacy Policy"
      introduction="Your information deserves the same clarity as your land records. Here is what we collect, why we use it, and the choices you have."
      summary={[
        "Account registration and email verification use real personal information. Property workspace features currently use browser-local preview records.",
        "We use essential sign-in cookies, do not sell your personal information, and keep marketing choices separate from your account.",
        "Contact futurewithmirai@gmail.com to ask about your information, request a correction, or request account deletion.",
      ]}
      sections={sections}
    />
  );
}

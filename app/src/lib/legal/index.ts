/**
 * The words of the privacy policy and the terms (docs/plans/legal-pages.md). **A draft, not reviewed by a lawyer**: the
 * pages say so at the top until it has been. The facts in it are checked against the product by `legal.test.ts` (each
 * outside service the app uses is named here). Written for South Africa (POPIA) because that is where MakerFlow starts;
 * a business document's own wording (quotes, invoices) is in the locale pack, not here.
 */

export type LegalSection = { id: string; heading: string; paragraphs?: string[]; list?: string[] };

export const LEGAL_UPDATED = "1 November 2026";

/** Who people write to. Set `NEXT_PUBLIC_LEGAL_CONTACT_EMAIL` when there is an address; until then the pages say it is to come. */
export const legalContact = (env: Record<string, string | undefined> = process.env): string | null => {
  const value = env.NEXT_PUBLIC_LEGAL_CONTACT_EMAIL?.trim();
  return value ? value : null;
};

/** The outside services that handle people's information, and what each is for. */
export const SERVICES = [
  { name: "Supabase", what: "our database, sign-in and file storage (your account, your business, your customers, quotes, jobs, invoices and pictures)", where: "a data centre in the European Union" },
  { name: "Vercel", what: "hosting the app", where: "Dublin, Ireland" },
  { name: "Anthropic", what: "reading a quote or invoice you choose to upload on “Coming from another tool?” (only then; the document is sent once and not kept by us)", where: "the United States" },
] as const;

export const PRIVACY_SECTIONS: LegalSection[] = [
  {
    id: "who",
    heading: "Who this is about",
    paragraphs: [
      "MakerFlow is a service for people who make things to send quotes, track jobs and send invoices. This policy says what information we keep, why, who else handles it, and what you can ask us to do. It follows the Protection of Personal Information Act (POPIA) of South Africa.",
      "For your own account (your email address and how you use the app) we are the “responsible party”. For your customers' details that you put into MakerFlow (names, phone numbers, addresses, what you made for them), you are the responsible party and we are your “operator”: we keep them for you and use them only to run the service.",
    ],
  },
  {
    id: "collect",
    heading: "What we keep",
    list: [
      "Your account: your email address (or, if you sign in with Google when that is on, your Google account's email), and when you signed in.",
      "Your business: its name, contact details, address, VAT details, logo, bank and payment details you choose to show on quotes and invoices.",
      "Your work: customers, products, materials, quotes, jobs, invoices and pictures you add.",
      "Feedback you send us: your message, the page you were on and what device and screen size you were using, and your email only if you tick that we may reply to it.",
      "A count of how many times you used the document reader (to keep it affordable), and nothing about what was on the document.",
      "Nothing for advertising. We do not use tracking or analytics cookies.",
    ],
  },
  {
    id: "why",
    heading: "Why we use it",
    paragraphs: ["Only to run MakerFlow for you: to sign you in, to show you your own information, to make your quotes and invoices, to keep the service working and safe, and to answer you when you write to us. We do not sell your information, and we do not use your customers' details for anything of our own."],
  },
  {
    id: "others",
    heading: "Who else handles it",
    paragraphs: ["We use these services to run MakerFlow. They handle information only on our behalf, for the purpose stated. Some are outside South Africa, so your information is sent abroad to them; we use providers that protect it to a standard comparable to POPIA."],
  },
  {
    id: "documents",
    heading: "Uploading a quote or invoice",
    paragraphs: [
      "If you use “Coming from another tool?”, the document you choose is sent once to our AI provider (above) to be read, and what it finds is put into a form for you to check. We do not store the document. The provider's own terms govern what it does with it; do not upload a document with details you do not have the right to share. We ask the reader to ignore your customers' details on it.",
    ],
  },
  {
    id: "demo",
    heading: "The demo",
    paragraphs: ["“Try the demo” gives you a temporary business with made-up information, tied to an anonymous sign-in in your browser. It is deleted automatically after about six hours (and the sign-in with it). Please do not type real personal details into a demo."],
  },
  {
    id: "keep",
    heading: "How long we keep it",
    paragraphs: [
      "For as long as your account exists. If you delete your account (Settings), your businesses and everything in them are deleted, with their pictures. The one exception, if it ever applies, is an invoice you issued, which the tax rules require you to keep; we will tell you if that stops a deletion. Feedback you sent is kept without your name or email once your account is gone.",
    ],
  },
  {
    id: "rights",
    heading: "Your rights",
    paragraphs: [
      "You can ask what we hold about you, ask us to correct it, ask us to delete it, or object to how we use it. Most of this you can do yourself in the app (change your details, delete your account). For anything else, write to us. If you are not happy with how we handled it, you can complain to the Information Regulator of South Africa (inforegulator.org.za).",
    ],
  },
  {
    id: "cookies",
    heading: "Cookies",
    paragraphs: ["We use only the cookies that keep you signed in. Without them the app cannot know it is you. We use no analytics, advertising or tracking cookies."],
  },
  {
    id: "safe",
    heading: "Keeping it safe",
    paragraphs: ["Your information is kept in a database where each business can only see its own. Sign-in is by an emailed link (no password to steal). No system is perfectly safe: if something happens that affects your information, we will tell you and the Information Regulator as the law requires."],
  },
  {
    id: "changes",
    heading: "Changes",
    paragraphs: ["If we change this policy in a way that matters, we will say so in the app before it takes effect. The date at the top is when it was last changed."],
  },
];

export const TERMS_SECTIONS: LegalSection[] = [
  {
    id: "using",
    heading: "Using MakerFlow",
    paragraphs: [
      "These terms are the agreement between you and MakerFlow when you use it. By creating an account or using the demo you agree to them. If you are using it for a business, you confirm you may act for that business.",
      "MakerFlow is still being built and is in early testing. It may change, be unavailable now and then, or lose a feature. We will do our best to keep your information safe and to tell you about changes that affect you.",
    ],
  },
  {
    id: "account",
    heading: "Your account",
    list: [
      "Keep your sign-in email safe: anyone who can open the sign-in link can use your account.",
      "Give accurate information, and tell us if you think someone else is using your account.",
      "You can delete your account at any time in Settings.",
    ],
  },
  {
    id: "yours",
    heading: "What is yours",
    paragraphs: ["Everything you put in MakerFlow (your business details, customers, products, quotes, jobs, invoices and pictures) stays yours. You give us permission to keep it and show it to you, and to the people you send documents to, so we can run the service. We do not claim any rights over it."],
  },
  {
    id: "responsible",
    heading: "What you are responsible for",
    list: [
      "What you send to your customers: the prices, wording, terms and tax on your quotes and invoices are yours. MakerFlow helps with the sums and the layout, but it is not tax, legal or accounting advice. Check anything that matters with a professional.",
      "Having the right to use the information you enter, including your customers' details.",
      "Not using MakerFlow to break the law, to send spam, to harm anyone, or to try to get into other people's information or to overload the service.",
    ],
  },
  {
    id: "demo",
    heading: "The demo",
    paragraphs: ["The demo is for trying MakerFlow out. It is cleared after about six hours and cannot be recovered. Do not put real information in it."],
  },
  {
    id: "unavailable",
    heading: "When things go wrong",
    paragraphs: [
      "We provide MakerFlow “as is”, and we cannot promise it will always work or be free of mistakes. As far as the law allows, we are not responsible for losses that come from using it, from it being unavailable, or from a mistake in a document you sent, and our total responsibility to you for anything is limited to what you paid us in the 12 months before the problem (which is nothing while it is free). Nothing here limits rights you have under the Consumer Protection Act that cannot be limited.",
    ],
  },
  {
    id: "ending",
    heading: "Ending",
    paragraphs: ["You can stop at any time by deleting your account. We may stop or limit an account that breaks these terms or puts the service or other people at risk; we will tell you why where we can."],
  },
  {
    id: "law",
    heading: "The law",
    paragraphs: ["These terms are governed by the laws of South Africa. If we change them in a way that matters, we will tell you in the app before it takes effect."],
  },
];

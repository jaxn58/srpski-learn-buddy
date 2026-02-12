import { Link } from "wouter";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowLeft, Shield, RefreshCw, FileText } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";
import { useTranslation } from "react-i18next";

type LegalLang = "en" | "de";

const legalCopy: Record<
  LegalLang,
  {
    lastUpdated: string;
    headerTitle: string;
    back: string;
    badges: { terms: string; privacy: string; refunds: string };
    h1: string;
    lastUpdatedLabel: string;
    introNote: string;
    quickLinksTitle: string;
    quickLinks: { terms: string; privacy: string; refunds: string; imprint: string };
    importantSummaryTitle: string;
    summary: { payments: string; guarantee: string; thirdParty: string };
    terms: {
      title: string;
      intro: string;
      serviceTitle: string;
      service: string;
      accountsTitle: string;
      accounts: string;
      eligibilityTitle: string;
      eligibility: string;
      paymentsTitle: string;
      payments: string;
      acceptableUseTitle: string;
      acceptableUse: string[];
      ipTitle: string;
      ip: string;
      availabilityTitle: string;
      availability: string;
      disclaimerTitle: string;
      disclaimer: string;
      liabilityTitle: string;
      liability: string;
      contactTitle: string;
      contactPrefix: string;
    };
    privacy: {
      title: string;
      intro: string;
      controllerTitle: string;
      controllerPrefix: string;
      dataTitle: string;
      data: string[];
      providersTitle: string;
      providersIntro: string;
      providers: Array<{ name: string; desc: string }>;
      transfersTitle: string;
      transfers: string;
      rightsTitle: string;
      rights: string;
    };
    refunds: {
      title: string;
      intro: string;
      rules: string[];
      requestPrefix: string;
      requestSuffix: string;
    };
    imprint: {
      title: string;
      operatorTitle: string;
      contactTitle: string;
      emailLabel: string;
      phoneLabel: string;
      founderTitle: string;
      taxIdLabel: string;
      hostingTitle: string;
      hostingLines: string[];
    };
  }
> = {
  en: {
    lastUpdated: "January 15, 2026",
    headerTitle: "Legal",
    back: "Back",
    badges: { terms: "Terms of Service", privacy: "Privacy", refunds: "Refunds" },
    h1: "Terms of Service (including Privacy & Refund Policy)",
    lastUpdatedLabel: "Last updated:",
    introNote:
      "This page is provided for transparency and compliance (e.g., payment provider verification). It is a practical template and does not constitute legal advice.",
    quickLinksTitle: "Quick links",
    quickLinks: {
      terms: "Terms of Service",
      privacy: "Privacy Policy",
      refunds: "Refund Policy",
      imprint: "Imprint (Legal Notice)",
    },
    importantSummaryTitle: "Important summary",
    summary: {
      payments: "Payments are processed via Dodo Payments; taxes/VAT may be collected automatically where applicable.",
      guarantee:
        "We offer a 14-day money-back guarantee from purchase date (see Refund Policy below).",
      thirdParty:
        "We use third-party services to run the app: Vercel (hosting), Convex (database/backend), Clerk (authentication).",
    },
    terms: {
      title: "1) Terms of Service",
      intro:
        "These Terms govern your access to and use of learn-with.me (the “Service”). By accessing or using the Service, you agree to these Terms.",
      serviceTitle: "1.1 The Service",
      service:
        "The Service provides a structured Serbian language learning experience including course units, a vocabulary trainer, interactive exercises, progress tracking, and optional AI-powered learning assistance.",
      accountsTitle: "1.2 Accounts",
      accounts:
        "You may need an account to access the Service. Authentication is provided via Clerk. You are responsible for maintaining the confidentiality of your account and for all activities that occur under it.",
      eligibilityTitle: "1.3 Eligibility & Beta Access",
      eligibility:
        "During a beta phase, certain users may receive free access to a limited portion of the course (e.g. Unit 1). Beta access may change or end. Any promotional discounts for beta participants are described in the Refund/Discount sections and may be limited to one-time use.",
      paymentsTitle: "1.4 Payments",
      payments:
        "Purchases are processed via Dodo Payments. Taxes/VAT may be collected automatically where applicable. Pricing, available plans, and durations are shown in the checkout flow and/or pricing pages.",
      acceptableUseTitle: "1.5 Acceptable Use",
      acceptableUse: [
        "Do not misuse the Service, attempt unauthorized access, or interfere with normal operation.",
        "Do not use the Service to violate applicable laws or third-party rights.",
        "Do not reverse engineer, scrape, or automate access in a way that harms the Service or other users.",
      ],
      ipTitle: "1.6 Intellectual Property",
      ip: "The Service and its content (including course materials, software, branding, and design) are protected by intellectual property laws. You receive a limited, non-exclusive, non-transferable license to use the Service for personal learning purposes.",
      availabilityTitle: "1.7 Availability & Changes",
      availability:
        "We may update, change, suspend, or discontinue parts of the Service. We aim to keep the Service available, but do not guarantee uninterrupted access.",
      disclaimerTitle: "1.8 Disclaimer",
      disclaimer:
        "The Service is provided on an “as is” basis. The Service is educational and not a professional certification program. We do not guarantee specific learning outcomes.",
      liabilityTitle: "1.9 Limitation of Liability",
      liability:
        "To the maximum extent permitted by applicable law, we are not liable for indirect, incidental, special, consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or indirectly.",
      contactTitle: "1.10 Contact",
      contactPrefix: "For support or legal inquiries, contact:",
    },
    privacy: {
      title: "2) Privacy Policy",
      intro:
        "This section summarizes how we process personal data. A dedicated Privacy Policy may be provided and updated separately.",
      controllerTitle: "2.1 Controller",
      controllerPrefix:
        "JACKSENN DESIGN DOO (see Imprint below). For privacy-related inquiries contact ",
      dataTitle: "2.2 What data we process",
      data: [
        "Account data (e.g. name, email) used for authentication and account management.",
        "Learning progress (e.g. completed units, XP, streaks) stored to provide the Service.",
        "Technical data (e.g. IP address, device/browser data) for security and performance.",
        "Payment metadata (handled by our payment provider, Dodo Payments).",
      ],
      providersTitle: "2.3 Service providers",
      providersIntro: "We use third-party providers to operate the Service:",
      providers: [
        { name: "Vercel", desc: "hosting and delivery of the web application." },
        { name: "Convex", desc: "database and backend functions (data storage and processing)." },
        { name: "Clerk", desc: "authentication and user identity management." },
        { name: "Dodo Payments", desc: "payment processing (including tax/VAT handling where applicable)." },
      ],
      transfersTitle: "2.4 International transfers",
      transfers:
        "Depending on the provider and your location, data may be processed in different countries. Where applicable, we rely on contractual safeguards (e.g. standard contractual clauses) and provider security measures.",
      rightsTitle: "2.5 Your rights",
      rights:
        "You may have rights to access, correct, delete, or export your personal data, and to object to certain processing. Contact us to exercise your rights.",
    },
    refunds: {
      title: "3) Refund Policy",
      intro:
        "We offer a 14-day money-back guarantee. If you are not satisfied, contact us within 14 days of purchase to request a refund.",
      rules: [
        "Refund requests must be submitted within 14 days of the purchase date.",
        "After 14 days, refunds are not available.",
        "Refunds may be issued through our payment provider’s systems (Dodo Payments).",
      ],
      requestPrefix: "For refund requests, email ",
      requestSuffix: " with your purchase email and the approximate purchase date.",
    },
    imprint: {
      title: "4) Imprint (Legal Notice)",
      operatorTitle: "Operator of the Website / Service:",
      contactTitle: "Contact:",
      emailLabel: "Email:",
      phoneLabel: "Phone:",
      founderTitle: "Founder / Responsible Person:",
      taxIdLabel: "Tax Identification Number (PIB):",
      hostingTitle: "Hosting & processors:",
      hostingLines: [
        "Hosting: Vercel (web app)",
        "Database/Backend: Convex",
        "Authentication: Clerk",
        "Payments: Dodo Payments",
      ],
    },
  },
  de: {
    lastUpdated: "15. Januar 2026",
    headerTitle: "Rechtliches",
    back: "Zurück",
    badges: { terms: "AGB", privacy: "Datenschutz", refunds: "Rückerstattung" },
    h1: "Nutzungsbedingungen (inkl. Datenschutz & Rückerstattung)",
    lastUpdatedLabel: "Zuletzt aktualisiert:",
    introNote:
      "Diese Seite dient der Transparenz und Compliance (z.B. zur Verifizierung durch Zahlungsanbieter). Sie ist eine praktische Vorlage und stellt keine Rechtsberatung dar.",
    quickLinksTitle: "Schnelllinks",
    quickLinks: {
      terms: "Nutzungsbedingungen (AGB)",
      privacy: "Datenschutz",
      refunds: "Rückerstattung",
      imprint: "Impressum",
    },
    importantSummaryTitle: "Wichtige Zusammenfassung",
    summary: {
      payments:
        "Zahlungen werden über Dodo Payments abgewickelt; Steuern/MwSt. können je nach Land automatisch erhoben werden.",
      guarantee:
        "Wir bieten eine 14-tägige Geld-zurück-Garantie ab Kaufdatum (siehe Rückerstattungsrichtlinie unten).",
      thirdParty:
        "Wir nutzen Drittanbieter für den Betrieb der App: Vercel (Hosting), Convex (Datenbank/Backend), Clerk (Authentifizierung).",
    },
    terms: {
      title: "1) Nutzungsbedingungen (AGB)",
      intro:
        "Diese Bedingungen regeln deinen Zugriff auf und die Nutzung von learn-with.me (der „Service“). Durch Zugriff oder Nutzung stimmst du diesen Bedingungen zu.",
      serviceTitle: "1.1 Der Service",
      service:
        "Der Service bietet ein strukturiertes Serbisch-Lernerlebnis mit Kurseinheiten, Vokabeltrainer, interaktiven Übungen, Fortschrittsverfolgung und optionaler KI-Lernunterstützung.",
      accountsTitle: "1.2 Konten",
      accounts:
        "Für die Nutzung kann ein Konto erforderlich sein. Die Authentifizierung erfolgt über Clerk. Du bist verantwortlich für die Vertraulichkeit deines Kontos und für alle Aktivitäten, die darüber erfolgen.",
      eligibilityTitle: "1.3 Teilnahme & Beta-Zugang",
      eligibility:
        "Während einer Beta-Phase können bestimmte Nutzer kostenlosen Zugang zu einem begrenzten Teil des Kurses erhalten (z.B. Unit 1). Der Beta-Zugang kann sich ändern oder enden. Etwaige Promotions/Rabatte für Beta-Teilnehmer sind in den Rückerstattungs-/Rabatt-Abschnitten beschrieben und können auf einmalige Nutzung begrenzt sein.",
      paymentsTitle: "1.4 Zahlungen",
      payments:
        "Käufe werden über Dodo Payments abgewickelt. Steuern/MwSt. können je nach Land automatisch erhoben werden. Preise, verfügbare Pläne und Laufzeiten werden im Checkout und/oder auf den Preis-Seiten angezeigt.",
      acceptableUseTitle: "1.5 Zulässige Nutzung",
      acceptableUse: [
        "Den Service nicht missbrauchen, keinen unbefugten Zugriff versuchen und den Betrieb nicht stören.",
        "Den Service nicht zur Verletzung geltender Gesetze oder Rechte Dritter nutzen.",
        "Kein Reverse Engineering, Scraping oder automatisierten Zugriff einsetzen, der dem Service oder anderen Nutzern schadet.",
      ],
      ipTitle: "1.6 Geistiges Eigentum",
      ip: "Der Service und seine Inhalte (inkl. Kursmaterialien, Software, Branding und Design) sind durch Urheber- und andere Schutzrechte geschützt. Du erhältst eine eingeschränkte, nicht-exklusive, nicht übertragbare Lizenz zur Nutzung für persönliche Lernzwecke.",
      availabilityTitle: "1.7 Verfügbarkeit & Änderungen",
      availability:
        "Wir können Teile des Services aktualisieren, ändern, aussetzen oder einstellen. Wir bemühen uns um Verfügbarkeit, garantieren jedoch keinen unterbrechungsfreien Zugriff.",
      disclaimerTitle: "1.8 Haftungsausschluss",
      disclaimer:
        "Der Service wird „wie besehen“ bereitgestellt. Er dient Bildungszwecken und ist kein professionelles Zertifizierungsprogramm. Wir garantieren keine bestimmten Lernergebnisse.",
      liabilityTitle: "1.9 Haftungsbeschränkung",
      liability:
        "Soweit gesetzlich zulässig, haften wir nicht für indirekte, zufällige, besondere, Folge- oder Strafschäden oder entgangene Gewinne/Umsätze, unabhängig davon, ob sie direkt oder indirekt entstehen.",
      contactTitle: "1.10 Kontakt",
      contactPrefix: "Für Support oder rechtliche Anfragen kontaktiere:",
    },
    privacy: {
      title: "2) Datenschutz",
      intro:
        "Dieser Abschnitt fasst zusammen, wie wir personenbezogene Daten verarbeiten. Eine gesonderte Datenschutzerklärung kann separat bereitgestellt und aktualisiert werden.",
      controllerTitle: "2.1 Verantwortliche Stelle",
      controllerPrefix: "JACKSENN DESIGN DOO (siehe Impressum unten). Für Datenschutz-Anfragen kontaktiere ",
      dataTitle: "2.2 Welche Daten wir verarbeiten",
      data: [
        "Kontodaten (z.B. Name, E-Mail) für Authentifizierung und Kontoverwaltung.",
        "Lernfortschritt (z.B. abgeschlossene Units, XP, Streaks) zur Bereitstellung des Services.",
        "Technische Daten (z.B. IP-Adresse, Geräte-/Browserdaten) für Sicherheit und Performance.",
        "Zahlungs-Metadaten (werden über unseren Zahlungsanbieter Dodo Payments verarbeitet).",
      ],
      providersTitle: "2.3 Dienstleister",
      providersIntro: "Wir nutzen Drittanbieter, um den Service zu betreiben:",
      providers: [
        { name: "Vercel", desc: "Hosting und Auslieferung der Web-App." },
        { name: "Convex", desc: "Datenbank und Backend-Funktionen (Speicherung/Verarbeitung)." },
        { name: "Clerk", desc: "Authentifizierung und Identitätsverwaltung." },
        { name: "Dodo Payments", desc: "Zahlungsabwicklung (inkl. Steuer/MwSt.-Handling, falls zutreffend)." },
      ],
      transfersTitle: "2.4 Internationale Übermittlungen",
      transfers:
        "Je nach Anbieter und Standort können Daten in verschiedenen Ländern verarbeitet werden. Soweit erforderlich, nutzen wir vertragliche Schutzmechanismen (z.B. Standardvertragsklauseln) und Sicherheitsmaßnahmen der Anbieter.",
      rightsTitle: "2.5 Deine Rechte",
      rights:
        "Je nach Rechtslage hast du Rechte auf Auskunft, Berichtigung, Löschung oder Export deiner personenbezogenen Daten sowie Widerspruch gegen bestimmte Verarbeitungen. Kontaktiere uns zur Ausübung deiner Rechte.",
    },
    refunds: {
      title: "3) Rückerstattung",
      intro:
        "Wir bieten eine 14-tägige Geld-zurück-Garantie. Wenn du nicht zufrieden bist, kontaktiere uns innerhalb von 14 Tagen nach Kauf, um eine Rückerstattung zu beantragen.",
      rules: [
        "Rückerstattungsanträge müssen innerhalb von 14 Tagen ab Kaufdatum gestellt werden.",
        "Nach 14 Tagen sind Rückerstattungen nicht verfügbar.",
        "Rückerstattungen erfolgen ggf. über die Systeme unseres Zahlungsanbieters (Dodo Payments).",
      ],
      requestPrefix: "Für Rückerstattungsanfragen schreibe an ",
      requestSuffix: " mit deiner Kauf-E-Mail und dem ungefähren Kaufdatum.",
    },
    imprint: {
      title: "4) Impressum",
      operatorTitle: "Betreiber der Website / des Services:",
      contactTitle: "Kontakt:",
      emailLabel: "E-Mail:",
      phoneLabel: "Telefon:",
      founderTitle: "Gründer / Verantwortliche Person:",
      taxIdLabel: "Steuernummer (PIB):",
      hostingTitle: "Hosting & Auftragsverarbeiter:",
      hostingLines: [
        "Hosting: Vercel (Web-App)",
        "Datenbank/Backend: Convex",
        "Authentifizierung: Clerk",
        "Zahlungen: Dodo Payments",
      ],
    },
  },
};

function SectionTitle({ id, children }: { id: string; children: string }) {
  return (
    <h2 id={id} className="scroll-mt-24 text-2xl font-bold tracking-tight">
      {children}
    </h2>
  );
}

function P({ children }: { children: ReactNode }) {
  return <p className="text-sm md:text-base text-muted-foreground leading-relaxed">{children}</p>;
}

function Li({ children }: { children: ReactNode }) {
  return <li className="text-sm md:text-base text-muted-foreground leading-relaxed">{children}</li>;
}

export default function Terms() {
  const { i18n } = useTranslation();
  const lang: LegalLang = i18n.language === "de" ? "de" : "en";
  const c = legalCopy[lang];

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50">
      <header className="w-full border-b bg-gradient-to-r from-red-50/80 via-white/80 to-blue-50/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-primary" />
              <div className="flex flex-col leading-tight">
                <span className="text-xs text-muted-foreground">learn-with.me</span>
                <span className="text-lg font-bold">{c.headerTitle}</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="outline" className="border-primary/30">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  {c.back}
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>

      <main className="container py-10">
        <div className="max-w-4xl mx-auto space-y-6">
          <div className="space-y-3">
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant="secondary">
                <FileText className="h-3.5 w-3.5 mr-2" />
                {c.badges.terms}
              </Badge>
              <Badge variant="outline">
                <Shield className="h-3.5 w-3.5 mr-2" />
                {c.badges.privacy}
              </Badge>
              <Badge variant="outline">
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                {c.badges.refunds}
              </Badge>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              {c.h1}
            </h1>
            <P>
              {c.lastUpdatedLabel} <span className="font-medium text-foreground">{c.lastUpdated}</span>
            </P>
            <P>{c.introNote}</P>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>{c.quickLinksTitle}</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2 text-sm">
              <a className="underline underline-offset-4" href="#terms">
                {c.quickLinks.terms}
              </a>
              <a className="underline underline-offset-4" href="#privacy">
                {c.quickLinks.privacy}
              </a>
              <a className="underline underline-offset-4" href="#refunds">
                {c.quickLinks.refunds}
              </a>
              <a className="underline underline-offset-4" href="#imprint">
                {c.quickLinks.imprint}
              </a>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                <span className="mr-2">📌</span>
                {c.importantSummaryTitle}
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc pl-5 space-y-2">
                <Li>{c.summary.payments}</Li>
                <Li>{c.summary.guarantee}</Li>
                <Li>{c.summary.thirdParty}</Li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                <SectionTitle id="terms">{c.terms.title}</SectionTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <P>{c.terms.intro}</P>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.terms.serviceTitle}</h3>
                <P>{c.terms.service}</P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.terms.accountsTitle}</h3>
                <P>{c.terms.accounts}</P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.terms.eligibilityTitle}</h3>
                <P>{c.terms.eligibility}</P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.terms.paymentsTitle}</h3>
                <P>{c.terms.payments}</P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.terms.acceptableUseTitle}</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {c.terms.acceptableUse.map((item) => (
                    <Li key={item}>{item}</Li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.terms.ipTitle}</h3>
                <P>{c.terms.ip}</P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.terms.availabilityTitle}</h3>
                <P>{c.terms.availability}</P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.terms.disclaimerTitle}</h3>
                <P>{c.terms.disclaimer}</P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.terms.liabilityTitle}</h3>
                <P>{c.terms.liability}</P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.terms.contactTitle}</h3>
                <P>
                  {c.terms.contactPrefix}{" "}
                  <a className="underline" href="mailto:hello@jacksenn.me">
                    hello@jacksenn.me
                  </a>
                </P>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                <SectionTitle id="privacy">{c.privacy.title}</SectionTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <P>{c.privacy.intro}</P>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.privacy.controllerTitle}</h3>
                <P>
                  {c.privacy.controllerPrefix}
                  <a className="underline" href="mailto:hello@jacksenn.me">
                    hello@jacksenn.me
                  </a>
                  .
                </P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.privacy.dataTitle}</h3>
                <ul className="list-disc pl-5 space-y-2">
                  {c.privacy.data.map((item) => (
                    <Li key={item}>{item}</Li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.privacy.providersTitle}</h3>
                <P>{c.privacy.providersIntro}</P>
                <ul className="list-disc pl-5 space-y-2">
                  {c.privacy.providers.map((p) => (
                    <Li key={p.name}>
                      <strong>{p.name}</strong>: {p.desc}
                    </Li>
                  ))}
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.privacy.transfersTitle}</h3>
                <P>{c.privacy.transfers}</P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">{c.privacy.rightsTitle}</h3>
                <P>{c.privacy.rights}</P>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                <SectionTitle id="refunds">{c.refunds.title}</SectionTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <P>{c.refunds.intro}</P>
              <ul className="list-disc pl-5 space-y-2">
                {c.refunds.rules.map((rule) => (
                  <Li key={rule}>{rule}</Li>
                ))}
              </ul>
              <P>
                {c.refunds.requestPrefix}
                <a className="underline" href="mailto:hello@jacksenn.me">
                  hello@jacksenn.me
                </a>
                {c.refunds.requestSuffix}
              </P>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                <SectionTitle id="imprint">{c.imprint.title}</SectionTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <P>
                {c.imprint.operatorTitle}
                <br />
                <strong className="text-foreground">JACKSENN DESIGN DOO</strong>
                <br />
                Celuga BB, 85000 Bar, Montenegro
              </P>
              <P>
                {c.imprint.contactTitle}
                <br />
                {c.imprint.emailLabel}{" "}
                <a className="underline" href="mailto:hello@jacksenn.me">
                  hello@jacksenn.me
                </a>
                <br />
                {c.imprint.phoneLabel} +38267626681
              </P>
              <P>
                {c.imprint.founderTitle} Jens H. Theuer
                <br />
                {c.imprint.taxIdLabel} 03636321
              </P>
              <P>
                {c.imprint.hostingTitle}
                <br />
                {c.imprint.hostingLines.map((line, idx) => (
                  <span key={line}>
                    {line}
                    {idx < c.imprint.hostingLines.length - 1 ? <br /> : null}
                  </span>
                ))}
              </P>
            </CardContent>
          </Card>

        </div>
      </main>

      <AppFooter />
    </div>
  );
}


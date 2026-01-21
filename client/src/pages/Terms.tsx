import { Link } from "wouter";
import type { ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { BookOpen, ArrowLeft, Shield, RefreshCw, FileText } from "lucide-react";
import { AppFooter } from "@/components/AppFooter";

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
  const lastUpdated = "January 15, 2026";

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50">
      <header className="w-full border-b bg-gradient-to-r from-red-50/80 via-white/80 to-blue-50/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container py-6">
          <div className="flex items-center justify-between gap-4">
            <div className="flex items-center gap-2">
              <BookOpen className="h-8 w-8 text-primary" />
              <div className="flex flex-col leading-tight">
                <span className="text-xs text-muted-foreground">learn-with.me</span>
                <span className="text-lg font-bold">Legal</span>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Link href="/">
                <Button variant="outline" className="border-primary/30">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back
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
                Terms of Service
              </Badge>
              <Badge variant="outline">
                <Shield className="h-3.5 w-3.5 mr-2" />
                Privacy
              </Badge>
              <Badge variant="outline">
                <RefreshCw className="h-3.5 w-3.5 mr-2" />
                Refunds
              </Badge>
            </div>

            <h1 className="text-3xl md:text-4xl font-bold tracking-tight">
              Terms of Service (including Privacy & Refund Policy)
            </h1>
            <P>
              Last updated: <span className="font-medium text-foreground">{lastUpdated}</span>
            </P>
            <P>
              This page is provided for transparency and compliance (e.g., payment provider verification). It is a
              practical template and does not constitute legal advice.
            </P>
          </div>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>Quick links</CardTitle>
            </CardHeader>
            <CardContent className="grid sm:grid-cols-2 gap-2 text-sm">
              <a className="underline underline-offset-4" href="#terms">
                Terms of Service
              </a>
              <a className="underline underline-offset-4" href="#privacy">
                Privacy Policy
              </a>
              <a className="underline underline-offset-4" href="#refunds">
                Refund Policy
              </a>
              <a className="underline underline-offset-4" href="#imprint">
                Imprint (Legal Notice)
              </a>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                <span className="mr-2">📌</span>
                Important summary
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <ul className="list-disc pl-5 space-y-2">
                <Li>
                  Payments are processed by Paddle as Merchant of Record; taxes/VAT may be collected automatically.
                </Li>
                <Li>
                  We offer a <strong>14-day money-back guarantee</strong> from purchase date (see Refund Policy below).
                </Li>
                <Li>
                  We use third-party services to run the app: Vercel (hosting), Convex (database/backend), Clerk
                  (authentication).
                </Li>
              </ul>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                <SectionTitle id="terms">1) Terms of Service</SectionTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <P>
                These Terms govern your access to and use of learn-with.me (the “Service”). By accessing or using the
                Service, you agree to these Terms.
              </P>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">1.1 The Service</h3>
                <P>
                  The Service provides a structured Serbian language learning experience including course units, a
                  vocabulary trainer, interactive exercises, progress tracking, and optional AI-powered learning
                  assistance.
                </P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">1.2 Accounts</h3>
                <P>
                  You may need an account to access the Service. Authentication is provided via Clerk. You are
                  responsible for maintaining the confidentiality of your account and for all activities that occur
                  under it.
                </P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">1.3 Eligibility & Beta Access</h3>
                <P>
                  During a beta phase, certain users may receive free access to a limited portion of the course (e.g.
                  Unit 1). Beta access may change or end. Any promotional discounts for beta participants are
                  described in the Refund/Discount sections and may be limited to one-time use.
                </P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">1.4 Payments</h3>
                <P>
                  Purchases are processed by Paddle (Merchant of Record). Paddle may collect taxes/VAT where applicable.
                  Pricing, available plans, and durations are shown in the checkout flow and/or pricing pages.
                </P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">1.5 Acceptable Use</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <Li>Do not misuse the Service, attempt unauthorized access, or interfere with normal operation.</Li>
                  <Li>Do not use the Service to violate applicable laws or third-party rights.</Li>
                  <Li>
                    Do not reverse engineer, scrape, or automate access in a way that harms the Service or other users.
                  </Li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">1.6 Intellectual Property</h3>
                <P>
                  The Service and its content (including course materials, software, branding, and design) are protected
                  by intellectual property laws. You receive a limited, non-exclusive, non-transferable license to use
                  the Service for personal learning purposes.
                </P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">1.7 Availability & Changes</h3>
                <P>
                  We may update, change, suspend, or discontinue parts of the Service. We aim to keep the Service
                  available, but do not guarantee uninterrupted access.
                </P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">1.8 Disclaimer</h3>
                <P>
                  The Service is provided on an “as is” basis. The Service is educational and not a professional
                  certification program. We do not guarantee specific learning outcomes.
                </P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">1.9 Limitation of Liability</h3>
                <P>
                  To the maximum extent permitted by applicable law, we are not liable for indirect, incidental, special,
                  consequential, or punitive damages, or any loss of profits or revenues, whether incurred directly or
                  indirectly.
                </P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">1.10 Contact</h3>
                <P>
                  For support or legal inquiries, contact: <a className="underline" href="mailto:hello@jacksenn.me">hello@jacksenn.me</a>
                </P>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                <SectionTitle id="privacy">2) Privacy Policy</SectionTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <P>
                This section summarizes how we process personal data. A dedicated Privacy Policy may be provided and
                updated separately.
              </P>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">2.1 Controller</h3>
                <P>
                  JACKSENN DESIGN DOO (see Imprint below). For privacy-related inquiries contact{" "}
                  <a className="underline" href="mailto:hello@jacksenn.me">hello@jacksenn.me</a>.
                </P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">2.2 What data we process</h3>
                <ul className="list-disc pl-5 space-y-2">
                  <Li>Account data (e.g., name, email) used for authentication and account management.</Li>
                  <Li>Learning progress (e.g., completed units, XP, streaks) stored to provide the Service.</Li>
                  <Li>Technical data (e.g., IP address, device/browser data) for security and performance.</Li>
                  <Li>Payment metadata (handled primarily by Paddle as Merchant of Record).</Li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">2.3 Service providers</h3>
                <P>We use third-party providers to operate the Service:</P>
                <ul className="list-disc pl-5 space-y-2">
                  <Li>
                    <strong>Vercel</strong>: hosting and delivery of the web application.
                  </Li>
                  <Li>
                    <strong>Convex</strong>: database and backend functions (data storage and processing).
                  </Li>
                  <Li>
                    <strong>Clerk</strong>: authentication and user identity management.
                  </Li>
                  <Li>
                    <strong>Paddle</strong>: payment processing as Merchant of Record (tax/VAT handling).
                  </Li>
                </ul>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">2.4 International transfers</h3>
                <P>
                  Depending on the provider and your location, data may be processed in different countries. Where
                  applicable, we rely on contractual safeguards (e.g., standard contractual clauses) and provider
                  security measures.
                </P>
              </div>

              <div className="space-y-2">
                <h3 className="text-lg font-semibold">2.5 Your rights</h3>
                <P>
                  You may have rights to access, correct, delete, or export your personal data, and to object to certain
                  processing. Contact us to exercise your rights.
                </P>
              </div>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                <SectionTitle id="refunds">3) Refund Policy</SectionTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <P>
                We offer a <strong>14-day money-back guarantee</strong>. If you are not satisfied, contact us within 14
                days of purchase to request a refund.
              </P>
              <ul className="list-disc pl-5 space-y-2">
                <Li>Refund requests must be submitted within 14 days of the purchase date.</Li>
                <Li>After 14 days, refunds are not available.</Li>
                <Li>
                  Because payments are processed by Paddle as Merchant of Record, refunds may be issued through Paddle’s
                  systems.
                </Li>
              </ul>
              <P>
                For refund requests, email{" "}
                <a className="underline" href="mailto:hello@jacksenn.me">hello@jacksenn.me</a>{" "}
                with your purchase email and the approximate purchase date.
              </P>
            </CardContent>
          </Card>

          <Card className="border-2">
            <CardHeader>
              <CardTitle>
                <SectionTitle id="imprint">4) Imprint (Legal Notice)</SectionTitle>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <P>
                Operator of the Website / Service:
                <br />
                <strong className="text-foreground">JACKSENN DESIGN DOO</strong>
                <br />
                Celuga BB, 85000 Bar, Montenegro
              </P>
              <P>
                Contact:
                <br />
                Email:{" "}
                <a className="underline" href="mailto:hello@jacksenn.me">
                  hello@jacksenn.me
                </a>
                <br />
                Phone: +38267626681
              </P>
              <P>
                Founder / Responsible Person: Jens H. Theuer
                <br />
                Tax Identification Number (PIB): 03636321
              </P>
              <P>
                Hosting & processors:
                <br />
                Hosting: Vercel (web app)
                <br />
                Database/Backend: Convex
                <br />
                Authentication: Clerk
                <br />
                Payments: Paddle
              </P>
            </CardContent>
          </Card>

        </div>
      </main>

      <AppFooter />
    </div>
  );
}


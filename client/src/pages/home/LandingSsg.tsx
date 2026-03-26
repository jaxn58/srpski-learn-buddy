import * as React from "react";
import type { LandingCounts, LandingModuleCard } from "./landingData";

type TFunction = (key: string, options?: Record<string, any>) => string;

/**
 * SSR/SSG-safe landing page content for `/`.
 *
 * Important constraints:
 * - No browser APIs (window/localStorage)
 * - No Clerk components
 * - No runtime data fetching
 *
 * This component is used by the build-time prerender script to inject readable HTML
 * into `dist/public/landing.html`.
 */
export function LandingSsg(props: {
  t: TFunction;
  counts: LandingCounts;
  modules: LandingModuleCard[];
  showWaitlist: boolean;
}) {
  const { t, counts, modules, showWaitlist } = props;

  const heroDescriptionHtml = showWaitlist
    ? t("home.hero.descriptionWaitlist")
    : t("home.hero.description", counts);

  const modulesSubtitleHtml = showWaitlist
    ? t("home.units.subtitleWaitlist")
    : t("home.units.subtitle", counts);

  return (
    <div className="min-h-screen bg-gradient-to-br from-red-50 via-white to-blue-50">
      <header className="w-full border-b bg-gradient-to-r from-red-50/80 via-white/80 to-blue-50/80 backdrop-blur-sm">
        <div className="container py-3 sm:py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-md bg-primary/10" aria-hidden="true" />
              <h1 className="hidden sm:inline text-2xl font-bold bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {t("home.header.title")}
              </h1>
            </div>

            <div className="flex items-center gap-2 sm:gap-3">
              <a href="/sign-in" className="inline-flex">
                <span className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-4 py-2">
                  {t("home.header.login")}
                </span>
              </a>
            </div>
          </div>
        </div>
      </header>

      <main>
        {/* Hero */}
        <section className="container py-12 sm:py-16 md:py-20">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <a href="#beta-registration" className="inline-block px-4 py-2 bg-accent/20 rounded-full text-primary font-semibold mb-4 border border-accent/40 cursor-pointer hover:opacity-80 transition-opacity">
              {t("home.hero.badge")}
            </a>

            <h2 className="text-3xl sm:text-4xl md:text-5xl lg:text-6xl font-bold tracking-tight">
              <span className="bg-gradient-to-r from-primary to-secondary bg-clip-text text-transparent">
                {t("home.hero.title")}
              </span>
              <br />
              {t("home.hero.titleHighlight")}
            </h2>

            <p className="text-lg sm:text-xl md:text-2xl font-semibold text-foreground/80 max-w-2xl mx-auto">
              {t("home.hero.subtitle")}
            </p>

            <p
              className="text-base sm:text-lg md:text-xl text-muted-foreground max-w-2xl mx-auto"
              dangerouslySetInnerHTML={{ __html: heroDescriptionHtml }}
            />

            <div className="flex flex-wrap gap-3 sm:gap-4 justify-center pt-4">
              <a
                href="/sign-in"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium bg-primary text-primary-foreground hover:bg-primary/90 h-12 px-6 sm:px-8 text-base sm:text-lg"
              >
                {t("home.header.login")}
              </a>
              <a
                href="#units"
                className="inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium border border-input bg-background hover:bg-accent hover:text-accent-foreground h-12 px-6 sm:px-8 text-base sm:text-lg"
              >
                {t("home.hero.ctaSecondary")}
              </a>
            </div>
          </div>
        </section>

        {/* Features (copy-heavy, good for SEO) */}
        <section className="w-full bg-white/50">
          <div className="container py-16">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4 sm:gap-6">
              <div className="border-2 bg-white rounded-xl p-6">
                <h3 className="font-semibold">{t("home.features.structuredPlan.title")}</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {showWaitlist
                    ? t("home.features.structuredPlan.descWaitlist")
                    : t("home.features.structuredPlan.desc", counts)}
                </p>
              </div>
              <div className="border-2 bg-white rounded-xl p-6">
                <h3 className="font-semibold">{t("home.features.aiProfessor.title")}</h3>
                <p className="text-sm text-muted-foreground mt-2">{t("home.features.aiProfessor.desc")}</p>
              </div>
              <div className="border-2 bg-white rounded-xl p-6">
                <h3 className="font-semibold">{t("home.features.gamification.title")}</h3>
                <p className="text-sm text-muted-foreground mt-2">{t("home.features.gamification.desc")}</p>
              </div>
              <div className="border-2 bg-white rounded-xl p-6">
                <h3 className="font-semibold">{t("home.features.progress.title")}</h3>
                <p className="text-sm text-muted-foreground mt-2">{t("home.features.progress.desc")}</p>
              </div>
              <div className="border-2 bg-white rounded-xl p-6">
                <h3 className="font-semibold">{t("home.features.vocabulary.title")}</h3>
                <p className="text-sm text-muted-foreground mt-2">
                  {showWaitlist ? t("home.features.vocabulary.descWaitlist") : t("home.features.vocabulary.desc", counts)}
                </p>
              </div>
            </div>
          </div>
        </section>

        {/* Modules (DB-backed) */}
        <section id="units" className="w-full bg-gradient-to-br from-red-50 via-blue-50/30 to-white">
          <div className="container py-12 sm:py-16 md:py-20">
            <div className="max-w-7xl mx-auto">
              <div className="text-center space-y-4 mb-12">
                <h3 className="text-2xl sm:text-3xl md:text-4xl font-bold">{t("home.units.title")}</h3>
                <p
                  className="text-base sm:text-lg md:text-xl text-muted-foreground"
                  dangerouslySetInnerHTML={{ __html: modulesSubtitleHtml }}
                />
              </div>

              <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6">
                {modules.map((m) => (
                  <div key={m.id} className="border-2 bg-white rounded-xl p-6">
                    <div className="text-sm font-semibold text-primary mb-1">
                      {t("home.units.module", { number: m.number })}
                    </div>
                    <div className="text-lg font-semibold">{m.title}</div>
                    <p className="text-sm text-muted-foreground mt-1">{m.description}</p>
                    <div className="mt-3 text-sm text-muted-foreground">
                      {t("home.units.lessonsPlaceholder")}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}


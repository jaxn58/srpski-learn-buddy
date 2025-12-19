import React, { createContext, useContext, useState, useEffect } from "react";
import { useTranslation } from "react-i18next";

type Language = "en" | "de";

interface LanguageContextType {
  language: Language;
  setLanguage: (language: Language) => void;
}

const LanguageContext = createContext<LanguageContextType | undefined>(
  undefined
);

export function LanguageProvider({
  children,
  defaultLanguage = "en",
}: {
  children: React.ReactNode;
  defaultLanguage?: Language;
}) {
  const { i18n } = useTranslation();
  const [language, setLanguageState] = useState<Language>(() => {
    // Try to get language from localStorage
    const stored = localStorage.getItem("app-language");
    if (stored === "en" || stored === "de") {
      return stored;
    }
    return defaultLanguage;
  });

  const setLanguage = (newLanguage: Language) => {
    setLanguageState(newLanguage);
    localStorage.setItem("app-language", newLanguage);
    i18n.changeLanguage(newLanguage);
  };

  // Sync i18n on mount
  useEffect(() => {
    i18n.changeLanguage(language);
  }, [i18n, language]);

  return (
    <LanguageContext.Provider value={{ language, setLanguage }}>
      {children}
    </LanguageContext.Provider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error("useLanguage must be used within a LanguageProvider");
  }
  return context;
}
















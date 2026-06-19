import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import en from "./locales/en.json";
import ko from "./locales/ko.json";
import bn from "./locales/bn.json";
import es from "./locales/es.json";

i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      ko: { translation: ko },
      bn: { translation: bn },
      es: { translation: es },
    },
    fallbackLng: "en",
    supportedLngs: ["en", "ko", "bn", "es"],
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      caches: ["localStorage"],
      lookupLocalStorage: "leadpilot_lang",
    },
  });

// Default to English on first visit (no detection bias)
if (!localStorage.getItem("leadpilot_lang")) {
  i18n.changeLanguage("en");
  localStorage.setItem("leadpilot_lang", "en");
}

export default i18n;

export const languages = [
  { code: "en", name: "English", flag: "🇺🇸" },
  { code: "ko", name: "한국어", flag: "🇰🇷" },
  { code: "bn", name: "বাংলা", flag: "🇧🇩" },
  { code: "es", name: "Español", flag: "🇪🇸" },
] as const;

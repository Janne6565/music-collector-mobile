import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { defaultNS, resources } from "@/i18n/resources";

void i18n.use(initReactI18next).init({
  resources,
  defaultNS,
  lng: "en",
  fallbackLng: "en",
  interpolation: { escapeValue: false },
});

export default i18n;

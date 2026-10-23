import type { Locale } from "@/lib/i18n/locales";

/**
 * The home page's Labs section. The link-card collection it showed was retired for Markdown articles (Labs, Part 3);
 * Task 7 renders the three newest articles in the page's language here. Until then it renders nothing, as it did
 * while there were no entries.
 */
export const hasLabs: (locale: Locale) => boolean = () => false;
export const HAS_LABS = false;

// Typed signatures without named parameters: nothing is read until Task 7, and unused parameters would warn.
const Labs: (props: { locale?: Locale }) => null = () => null;
export default Labs;

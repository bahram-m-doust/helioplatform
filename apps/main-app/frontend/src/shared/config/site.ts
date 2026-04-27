/**
 * Build-time config for the (now-stripped) main-app.
 *
 * After Phase 5.8 the customer-facing surface lives on Framer
 * (``platform.helio.ae``); the only routes left in this app are the
 * onboarding questionnaire and a tiny landing placeholder. The
 * agent / OpenRouter / community config that used to live here is gone:
 *
 *   - OpenRouter calls were a security smell (key leaked to bundle);
 *     replaced by ``agents/soul-print/`` backend + admin UI.
 *   - Per-agent base URLs only mattered for the deleted /image-generator
 *     etc. pages; the admin app at ``admin.helio.ae`` calls them now.
 *   - Community URL is unused after HelioGram extraction (Phase 6).
 */

const env = (import.meta as any).env ?? {};

// Only kept exports — anything the questionnaire, auth modal, or
// SiteHeader/SiteFooter still reads.
export const COMMUNITY_URL: string = env.VITE_COMMUNITY_URL?.trim() || '';

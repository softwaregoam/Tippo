# In-app guides and FAQ

The sidebar's “Butuh panduan?” button opens a dedicated “Panduan & FAQ” workspace page instead of taking the user to data settings and showing a toast. It closes mobile navigation and follows the active business theme.

The guide's starting steps differ for Jastip and Open PO. Shared sections cover order entry, payment, discounts, HPP, status transitions, refunds, Excel import and backups. Eleven expandable FAQ answers cover the current product behavior, including plan limits and draft subscription invoices. A contents navigation links to sections; action buttons open the related workspace menu. No data is written by reading the guides or navigating from them.

Validation: lint and production build pass. Four production Chromium checks at 320 and 1440 px in light and dark themes cover opening from the sidebar, closing mobile navigation, FAQ keyboard interaction, Jastip/Open PO content, working menu actions and zero workspace saves. Screenshots: `preview-help-{320,1440}-{light,dark}.png`. Vercel deployment and physical devices were not verified.

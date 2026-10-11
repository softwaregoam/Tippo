# Warm charcoal dark theme

Dark mode uses neutral charcoal surfaces across the workspace, landing page and account screens. Jastip keeps a mint accent; Open PO keeps an apricot accent. The shared palette also covers table headers, dropdowns, input fields, disabled states, dialog footers and notifications.

| Element | Color |
| --- | --- |
| Canvas | `#171918` |
| Sidebar / dialog | `#1E2220` |
| Cards / inputs | `#262C28` |
| Main text | `#F2F0E9` |
| Secondary text | `#ADB6AE` |
| Jastip accent | `#91C9B1` |
| Open PO accent | `#E4B080` |

Calculated contrast against card background: main text 12.50:1, secondary text 6.84:1, control border 3.89:1. Primary button text against mint is 9.42:1 and against apricot 9.10:1. These are checks of the listed color pairs, not a complete accessibility audit.

Validation: lint and production build pass. Ten production Chromium browser checks cover business switching and order-dialog opening at 320, 768 and 1440 px in both themes, plus homepage interactions at 320 and 1440 px in both themes. Updated dark-mode screenshots are stored in the existing preview-business and preview-landing files. The landing test now scopes the example-testimonial assertion to its own section because public feedback uses the same layout class. Production Vercel deployment and physical mobile devices were not verified.

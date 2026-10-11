# Sidebar organization

The Jastip / Open PO switch lives below the sidebar brand. The main-content switch is removed. Business menus appear in this order: Ringkasan, Pesanan, Produk (PO only), Batch PO / Perjalanan, Pelanggan, HPP & Margin. A divider separates Pengaturan data, Panduan & FAQ, and Kritik & saran. Paket & langganan remains at the bottom.

Both businesses use a neutral sidebar: warm cream in light mode and charcoal in dark mode. Mint/apricot accents identify the selected business, current menu and active left border. Menu controls have at least 44 px height. Collapsed desktop navigation keeps icon-only business choices and menu names through title tooltips. Mobile users can switch businesses inside the navigation panel; choosing a business or page closes it. Escape restores focus to the menu opener.

Validation: lint and production build pass. Four sidebar checks at 390/1440 px in both themes cover ordering, grouping, mobile close/focus behavior, desktop collapse, tooltips, business changes and guide navigation. Six existing business-switch checks at 320/768/1440 px and four guide-page checks at 320/1440 px pass in both themes. Visual review caught and corrected the old PO background overriding neutral light colors and the Open PO switch label wrapping. Production Vercel deployment and physical devices were not verified.

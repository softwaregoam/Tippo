# Order status

Jastip and Open PO use the same order badges: blue Tercatat, purple Dikirim, green Selesai and red Dibatalkan, with light and dark variants. Payment labels use green for Lunas, yellow for Bayar sebagian and neutral text for Belum dibayar.

Desktop users open the status dialog with the two-way arrow in Tindakan. Mobile users open Ubah status from the order detail. The dialog shows the current status and four radio choices; selecting a choice does not save it. Simpan status is disabled until the status changes. Saving failure retains the dialog and selection. Cancellation with received payments remains blocked until the existing refund flow clears the payment balance. Status changes do not change items, payments or refunds. Dashboard orders remain read-only.

Validation: lint and production build pass. 21 browser checks cover both businesses and themes, desktop and mobile status changes, cancellation before save, failed saves, payment cancellation guard, unpaid cancellation, read-only dashboard, sidebar grouping and collapse, and business switching. Dialog screenshots are stored as preview-order-status-*.png. Physical devices and Vercel deployment were not verified.

# Form opening and mobile placeholders

Order dialogs initially focus their close button instead of the product input or selector. Customer, batch and product forms no longer autofocus editable fields; refund amount autofocus is removed too. Intentional focus after adding an item, asking for partial payment, or a validation error is retained.

New Jastip and Open PO orders start with empty customer, date and quantity fields. Their placeholders are respectively “Pilih pelanggan”, “Pilih tanggal” and “Contoh: 2”. On phones the customer placeholder uses compact spacing and can wrap on narrow screens, preserving the equal customer/date columns without truncating its text.

Production Chromium validation: six order workflows (both businesses at 320, 390 and 1440 px) check initial empty values, close-button focus, no open selection, placeholders, saving and editing. Two additional checks at 390 and 1440 px verify customer, Jastip batch, PO batch and product opening focus, including Tab navigation to the customer name. Lint and production build pass. Real-device virtual keyboard behavior and production Vercel deployment were not verified.

Batch closing dates and refund dates now use the shared calendar-only DatePicker too. Disabled date displays retain the grey field style. Four additional production browser checks pass: both batch forms at 390 and 1440 px, and refund success/failure workflows. They click the left side of the field to open the native calendar, close it without closing the form, verify showPicker on click and Enter, and verify manual typing, deletion and paste cannot change the date. All date inputs in the application now come from the shared DatePicker.

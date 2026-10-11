# Repeated taps on selection fields

The shared Radix Select trigger remains pointer-accessible while its list is open. A pointer gesture starting on an open trigger closes the list and suppresses the following click, preventing touch clicks from reopening it. Keyboard gestures clear this suppression and retain Radix keyboard behavior.

Validation: production Chromium with a 390 × 844 touch viewport, authenticated workspace and mocked Supabase responses. Three repeated open/close cycles preserve the product filter value; selecting an option works; Enter opens and Escape closes with focus restored. Repeated taps on the customer field in the order dialog close the list, selecting Alya works, and Escape leaves the order form open. Lint and production build pass. Physical iOS Safari was not tested.

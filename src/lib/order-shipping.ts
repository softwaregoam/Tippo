export type ShippingFields = { shippingDate: string; shippingTime: string; shippingMethod: string };
export function shippingFieldErrors(fields:ShippingFields):Partial<Record<keyof ShippingFields,string>> {
 const errors:Partial<Record<keyof ShippingFields,string>>={};
 if(fields.shippingDate){const date=new Date(`${fields.shippingDate}T00:00:00Z`);if(!/^\d{4}-\d{2}-\d{2}$/.test(fields.shippingDate)||!Number.isFinite(date.getTime())||date.toISOString().slice(0,10)!==fields.shippingDate)errors.shippingDate="Pilih tanggal kirim yang valid.";}
 if(fields.shippingTime&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(fields.shippingTime))errors.shippingTime="Jam kirim menggunakan format 24 jam (HH:mm).";
 if(fields.shippingMethod.length>120)errors.shippingMethod="Metode kirim maksimal 120 karakter.";
 return errors;
}

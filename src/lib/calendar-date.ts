/** Format a saved calendar date without shifting its day to the browser timezone. */
export function formatCalendarDate(value:string,includeYear=true):string {
 if(!value)return "Belum diisi";
 const date=new Date(`${value}T00:00:00Z`);
 if(!Number.isFinite(date.getTime()))return "Belum diisi";
 return date.toLocaleDateString("id-ID",{day:"numeric",month:"short",...(includeYear?{year:"numeric" as const}:{}),timeZone:"UTC"});
}

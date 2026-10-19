import { CURRENCY_CHOICES } from "./currency-catalog.ts";
export { CURRENCY_CHOICES } from "./currency-catalog.ts";
export const currencyLabel=(code:string)=>{const item=CURRENCY_CHOICES.find(item=>item.code===code);return item?`${item.code} · ${item.name} (${item.country})`:code;};
export function searchCurrencies(query:string,includeRupiah=true){
 const tokens=query.normalize("NFKC").toLocaleLowerCase("id").trim().split(/\s+/).filter(Boolean);
 return CURRENCY_CHOICES.filter(item=>(includeRupiah||item.code!=="IDR")&&tokens.every(token=>`${item.code} ${item.name} ${item.country} ${item.aliases}`.toLocaleLowerCase("id").includes(token)));
}

import { FX_CURRENCIES } from "./purchase-fx.ts";
const details = {
 JPY:{name:"Yen",country:"Jepang",aliases:"Japan"},
 KRW:{name:"Won",country:"Korea Selatan",aliases:"Korsel South Korea"},
 SGD:{name:"Dolar",country:"Singapura",aliases:"Singapore dollar"},
 USD:{name:"Dolar",country:"Amerika Serikat",aliases:"AS USA US dollar"},
 EUR:{name:"Euro",country:"Zona Euro",aliases:"Eropa European eurozone"},
 CNY:{name:"Yuan",country:"Tiongkok",aliases:"China Cina Renminbi"},
 MYR:{name:"Ringgit",country:"Malaysia",aliases:""},
 THB:{name:"Baht",country:"Thailand",aliases:""},
 HKD:{name:"Dolar",country:"Hong Kong",aliases:"Hongkong dollar"},
 AUD:{name:"Dolar",country:"Australia",aliases:"Australian dollar"},
 GBP:{name:"Pound sterling",country:"Britania Raya",aliases:"Inggris UK United Kingdom British pound"},
};
export const CURRENCY_CHOICES=[{code:"IDR",name:"Rupiah",country:"Indonesia",aliases:"Rupiah Indonesia"},...FX_CURRENCIES.map(code=>({code,...details[code]}))];
export const currencyLabel=(code:string)=>{const item=CURRENCY_CHOICES.find(item=>item.code===code);return item?`${item.code} · ${item.name} (${item.country})`:code;};
export function searchCurrencies(query:string,includeRupiah=true){
 const tokens=query.normalize("NFKC").toLocaleLowerCase("id").trim().split(/\s+/).filter(Boolean);
 return CURRENCY_CHOICES.filter(item=>(includeRupiah||item.code!=="IDR")&&tokens.every(token=>`${item.code} ${item.name} ${item.country} ${item.aliases}`.toLocaleLowerCase("id").includes(token)));
}

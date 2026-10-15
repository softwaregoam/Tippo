import assert from "node:assert/strict";
import JSZip from "jszip";

/** ECMA-376 CT_SheetPr requires tabColor, outlinePr, then pageSetUpPr. */
export async function assertXlsxSheetProperties(bytes:Uint8Array) {
 const zip=await JSZip.loadAsync(bytes,{checkCRC32:true});
 const order=["tabColor","outlinePr","pageSetUpPr"];
 for(const [name,file] of Object.entries(zip.files)){
  if(!/^xl\/worksheets\/sheet\d+\.xml$/.test(name))continue;
  const xml=await file.async("string"),properties=xml.match(/<sheetPr\b[^>]*>([\s\S]*?)<\/sheetPr>/)?.[1]??"";
  const children=[...properties.matchAll(/<(tabColor|outlinePr|pageSetUpPr)(?=[\s/>])/g)].map(match=>order.indexOf(match[1]));
  assert.deepEqual(children,[...children].sort((a,b)=>a-b),`${name}: invalid CT_SheetPr child order; Microsoft Excel may reject this file`);
 }
}

import {test,expect} from "@playwright/test";
const endpoint="https://bkplemoflteubfgvqhke.supabase.co",owner="00000000-0000-0000-0000-000000000001";
async function authenticate(page:import("@playwright/test").Page){
 const exp=Math.floor(Date.now()/1000)+3600,token=[Buffer.from('{"alg":"HS256","typ":"JWT"}').toString("base64url"),Buffer.from(JSON.stringify({sub:owner,exp,aud:"authenticated"})).toString("base64url"),"test"].join(".");
 const auth={access_token:token,refresh_token:"test-refresh",token_type:"bearer",expires_in:3600,expires_at:exp,user:{id:owner,aud:"authenticated",role:"authenticated",email:"tester@example.test",app_metadata:{},user_metadata:{business_name:"Tippo Test"},created_at:"2026-10-12T00:00:00Z"}};
 await page.addInitScript(auth=>{localStorage.setItem("sb-bkplemoflteubfgvqhke-auth-token",JSON.stringify(auth));},auth);
 await page.route(endpoint+"/auth/v1/**",route=>route.fulfill({json:route.request().url().endsWith("/user")?auth.user:auth}));
 await page.route(endpoint+"/rest/v1/rpc/get_tippo_workspace",route=>route.fulfill({json:{data:{batches:[],products:[],customers:[],orders:[]},version:0,subscription:{tier:"free",expiresAt:null},usage:[]}}));
}
for(const width of [320,1440])for(const theme of ["light","dark"])test("SNAP VA BNI "+width+" "+theme+" persists payment and copies VA without granting Pro",async({page,context})=>{
 test.skip(process.env.PLAYWRIGHT_DOKU_SNAP!=="true","Requires SNAP build");
 await page.setViewportSize({width,height:900});await page.addInitScript(t=>localStorage.setItem("tippo.theme.v1",t),theme);await authenticate(page);
 await context.grantPermissions(["clipboard-read","clipboard-write"]);
 let paid=false,created=false,creates=0;
 await page.route(endpoint+"/functions/v1/tippo-doku-snap-test/**",async route=>{
  expect(route.request().headers().authorization).toContain("Bearer ");
  if(route.request().method()==="POST"){created=true;creates++;expect(route.request().postDataJSON()).toEqual({});}
  await route.fulfill({json:{environment:"snap-production-test",proUntil:null,invoice:created?{id:"test",number:"TSNP-"+"A".repeat(32),amount:10,currency:"IDR",bank:"BNI",status:paid?"paid":"pending",vaNumber:"9882917230000000000000000001",vaName:"Tippo Uji Pembayaran",instructionsUrl:"https://app.doku.com/how-to-pay/virtual-account/bni/test",createdAt:"2026-10-12T00:00:00Z",expiresAt:"2050-10-12T00:00:00Z",paidAt:paid?"2026-10-12T01:00:00Z":null}:null}});
 });
 await page.goto("/app?billing=snap-test");const panel=page.getByRole("region",{name:"Uji pembayaran SNAP"});
 await panel.getByRole("button",{name:"Buat VA BNI Rp10"}).click();await expect(panel).toContainText("9882917230000000000000000001");
 await panel.getByRole("button",{name:"Salin nomor VA"}).click();await expect(panel.getByRole("status")).toContainText("berhasil disalin");
 expect(await page.evaluate(()=>navigator.clipboard.readText())).toBe("9882917230000000000000000001");
 await page.reload();await expect(panel).toContainText("Menunggu pembayaran");expect(creates).toBe(1);
 paid=true;await panel.getByRole("button",{name:"Cek status pembayaran"}).click();await expect(panel).toContainText("Lunas (uji produksi)");
 await expect(page.getByRole("region",{name:"Paket aktif",exact:true})).toContainText("Gratis");await expect(page.getByRole("region",{name:"Paket Pro",exact:true})).toContainText("25.000");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});
test("SNAP rejection and unsafe instruction responses are recoverable and never linked",async({page})=>{
 test.skip(process.env.PLAYWRIGHT_DOKU_SNAP!=="true","Requires SNAP build");await authenticate(page);
 let fail=true;
 await page.route(endpoint+"/functions/v1/tippo-doku-snap-test/**",route=>route.fulfill(fail?{status:400,json:{error:"SNAP_REJECTED"}}:{json:{environment:"snap-production-test",proUntil:null,invoice:{id:"test",number:"TSNP-"+"B".repeat(32),amount:10,currency:"IDR",bank:"BNI",status:"pending",vaNumber:"9882917230000000000000000001",vaName:"Tippo Test",instructionsUrl:"https://evil.test/pay",createdAt:"2026-10-12T00:00:00Z",expiresAt:"2050-10-12T00:00:00Z",paidAt:null}}}));
 await page.goto("/app?billing=snap-test");const panel=page.getByRole("region",{name:"Uji pembayaran SNAP"});
 await expect(panel.getByRole("alert")).toContainText("DOKU menolak");fail=false;await panel.getByRole("button",{name:"Cek status pembayaran"}).click();await expect(panel.getByRole("alert")).toContainText("belum dapat dimuat");await expect(panel.getByRole("link")).toHaveCount(0);
});

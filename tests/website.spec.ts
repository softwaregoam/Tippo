import { chooseOption } from "./select-helper";
import { expect, test, type Page, type Locator } from "@playwright/test";
import type { AppData } from "../src/lib/types";
import { readFile } from "node:fs/promises";

test("DOKU production replaces an old Rp10 link with a new Rp1.000 invoice",async({page})=>{
 test.skip(process.env.PLAYWRIGHT_DOKU_PRODUCTION_TEST!=="true","Requires production test build");
 await authenticate(page);let amount=10;
 await page.route(endpoint+"/functions/v1/tippo-doku-production-test/**",async route=>{
  if(route.request().method()==="POST"){expect(route.request().postDataJSON()).toEqual({});amount=1000;}
  await route.fulfill({json:{environment:"production-test",proUntil:null,invoice:{id:"test",number:"TPT-"+"A".repeat(32),amount,currency:"IDR",status:"pending",checkoutUrl:"https://jokul.doku.com/checkout/link/test",createdAt:"2026-10-12T00:00:00Z",expiresAt:"2050-10-12T00:00:00Z",paidAt:null}}});
 });
 await page.goto("/app?billing=production-test");const panel=page.getByRole("region",{name:"Uji pembayaran produksi"});
 await expect(panel).toContainText("invoice uji lama Rp10");
 await expect(panel.getByRole("link",{name:"Buka pembayaran DOKU"})).toHaveCount(0);
 await panel.getByRole("button",{name:"Siapkan pembayaran Rp1.000"}).click();
 await expect(panel.locator(".pro-invoice-details")).toContainText("Rp1.000");
 await expect(panel.getByRole("link",{name:"Buka pembayaran DOKU"})).toBeVisible();
});

for(const width of [320,1440])test(`DOKU production Rp1.000 test at ${width}px`,async({page})=>{
 test.skip(process.env.PLAYWRIGHT_DOKU_PRODUCTION_TEST!=="true","Requires production test build");
 await page.setViewportSize({width,height:900});await authenticate(page);
 let paid=false,created=false;
 await page.route(`${endpoint}/functions/v1/tippo-doku-production-test/**`,async route=>{
  if(route.request().method()==="POST"){created=true;expect(route.request().postDataJSON()).toEqual({});}
  await route.fulfill({json:{environment:"production-test",proUntil:null,invoice:created?{id:"test",number:"TPT-"+"A".repeat(32),amount:1000,currency:"IDR",status:paid?"paid":"pending",checkoutUrl:"https://jokul.doku.com/checkout/link/test",createdAt:"2026-10-12T00:00:00Z",expiresAt:"2050-10-12T00:00:00Z",paidAt:paid?"2026-10-12T01:00:00Z":null}:null}});
 });
 await page.goto("/app?billing=production-test");
 const panel=page.getByRole("region",{name:"Uji pembayaran produksi"});
 await expect(panel).toBeVisible();await panel.getByRole("button",{name:"Siapkan pembayaran Rp1.000"}).click();
 await expect(panel.getByRole("link",{name:"Buka pembayaran DOKU"})).toHaveAttribute("href","https://jokul.doku.com/checkout/link/test");
 await expect(panel).toContainText("Rp1.000");paid=true;await panel.getByRole("button",{name:"Cek status pembayaran"}).click();await expect(panel).toContainText("Lunas (uji produksi)");
 await expect(page.getByRole("region",{name:"Paket Pro",exact:true})).toContainText("25.000");
 await expect(page.getByRole("region",{name:"Paket aktif",exact:true})).toContainText("Gratis");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth)).toBe(true);
});

const endpoint="https://bkplemoflteubfgvqhke.supabase.co";
const owner="00000000-0000-0000-0000-000000000001";
function session() {
  const exp=Math.floor(Date.now()/1000)+3600;
  const token=[Buffer.from(JSON.stringify({alg:"HS256",typ:"JWT"})).toString("base64url"),Buffer.from(JSON.stringify({sub:owner,exp,aud:"authenticated"})).toString("base64url"),"test-signature"].join(".");
  return {access_token:token,refresh_token:"test-refresh",token_type:"bearer",expires_in:3600,expires_at:exp,user:{id:owner,aud:"authenticated",role:"authenticated",email:"naya@example.test",app_metadata:{},user_metadata:{business_name:"Titipan Naya"},created_at:"2026-10-08T00:00:00Z"}};
}
const fixture: AppData={batches:[{id:"trip",type:"jastip",name:"Jastip Seoul",origin:"Seoul",closeDate:"2026-12-01",status:"open",directCosts:0}],customers:[{id:"aly",name:"Alya",phone:""}],products:[],orders:[]};
async function checkCalendarOnly(page:Page,input:Locator,form:Locator) {
  const value=await input.inputValue();
  await input.click({position:{x:8,y:20}});
  await page.keyboard.press("Escape");
  await expect(form).toBeVisible();
  await input.evaluate(element=>{Object.defineProperty(element,"showPicker",{value:()=>{element.setAttribute("data-picker-calls",String(Number(element.getAttribute("data-picker-calls")??0)+1));}});});
  await input.click({position:{x:8,y:20}});
  await expect(input).toHaveAttribute("data-picker-calls","1");
  await input.press("Enter");
  await expect(input).toHaveAttribute("data-picker-calls","2");
  await input.press("Backspace");
  await page.keyboard.type("20261011");
  await expect(input).toHaveValue(value);
  const pasteBlocked=await input.evaluate(element=>!element.dispatchEvent(new Event("paste",{bubbles:true,cancelable:true})));
  expect(pasteBlocked).toBe(true);
}
async function authenticate(page:Page, options:{failSave?:boolean;missing?:boolean;pro?:boolean;workspace?:AppData}={}) {
  const auth=session(); let version=0; let data=structuredClone(options.workspace ?? fixture); const requests: {p_data:AppData;p_expected_version:number}[]=[];
  await page.addInitScript(({auth})=>{
    if(!sessionStorage.getItem("auth-test-seeded")){localStorage.setItem("sb-bkplemoflteubfgvqhke-auth-token",JSON.stringify(auth));sessionStorage.setItem("auth-test-seeded","1");}
    localStorage.setItem("tippo.subscription.demo.v1",JSON.stringify({tier:"pro",expiresAt:"2099-01-01T00:00:00Z",mode:"demo"}));
    localStorage.setItem("tippo.workspace.v1",JSON.stringify({batches:[],customers:[],products:[],orders:[]}));
  },{auth});
  await page.route(`${endpoint}/**`,async route=>{
    const url=route.request().url();
    if(url.includes("/rpc/get_tippo_workspace")) {
      if(options.missing) return route.fulfill({status:404,json:{code:"PGRST202",message:"schema cache"}});
      return route.fulfill({json:{data,version,subscription:{tier:options.pro?"pro":"free",expiresAt:options.pro?"2099-01-01T00:00:00Z":null},usage:[]}});
    }
    if(url.includes("/rpc/save_tippo_workspace")) {
      expect(route.request().method()).toBe("POST");
      expect(route.request().headers().authorization.startsWith("Bearer ")).toBeTruthy();
      const body=route.request().postDataJSON(); requests.push(body);
      if(options.failSave) return route.fulfill({status:400,json:{message:"TIPPO_CONFLICT",code:"P0001"}});
      expect(body.p_expected_version).toBe(version); data=body.p_data; version++;
      return route.fulfill({json:{data,version,subscription:{tier:options.pro?"pro":"free",expiresAt:options.pro?"2099-01-01T00:00:00Z":null},usage:[]}});
    }
    if(url.includes("/auth/v1/logout")) return route.fulfill({status:204,body:""});
    if(url.includes("/auth/v1/user")) return route.fulfill({json:auth.user});
    return route.fulfill({json:{}});
  });
  return requests;
}
async function openSection(page:Page,name:string) {
 await page.locator(".page-heading h1").waitFor({state:"visible"});
 const menu=page.getByRole("button",{name:"Buka navigasi",exact:true});
 if(await menu.isVisible()&&await menu.getAttribute("aria-expanded")==="false")await menu.click();
 const target=name==="Paket & langganan"?page.getByRole("button",{name,exact:true}):page.getByRole("navigation",{name:"Navigasi utama"}).getByRole("button",{name,exact:true});
 await target.click();
}
async function openNavigation(page:Page) {
 await page.locator(".page-heading h1").waitFor({state:"visible"});
 const menu=page.getByRole("button",{name:"Buka navigasi",exact:true});
 if(await menu.isVisible()&&await menu.getAttribute("aria-expanded")==="false") await menu.click();
}
async function openBusiness(page:Page,name:string) {
 await openNavigation(page);
 await page.getByRole("group",{name:"Pilih usaha"}).getByRole("button",{name,exact:true}).click();
 await openSection(page,name==="Open PO"?"Produk":"Perjalanan");
}
for (const width of [320,1440]) for (const theme of ["light","dark"]) {
test(`homepage interactions and mobile navigation lead to real routes ${width} ${theme}`,async({page})=>{
  await page.setViewportSize({width,height:1000});
  await page.addInitScript(theme=>localStorage.setItem("tippo.theme.v1",theme),theme);
  const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/"); await expect(page.locator(".wordmark").first()).toHaveText("Tippo."); await expect(page).toHaveTitle("Tippo: Jastip & Open PO");await expect(page.getByRole("heading",{level:1})).toHaveText("Titip & Pesan, Beres di Tippo.");
  await expect(page.getByText("Contoh pesanan fiktif",{exact:true})).toBeVisible();
  await expect(page.locator(".ledger-product")).toHaveCount(2);
  await expect(page.locator(".ledger-total")).toContainText(/Rp\s*1\.638\.000/);
  await expect(page.locator(".ledger-mode-context")).toContainText("Ringkasan · Perjalanan · Pesanan · HPP & Margin");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({path:`docs/preview-landing-jastip-${width}-${theme}.png`});
  await page.getByRole("group",{name:"Pilihan alur pesanan"}).getByRole("button",{name:"Open PO"}).click();
  await expect(page.getByText("Produk siap, pesanan lebih ringkas.",{exact:true})).toBeVisible();
  await expect(page.locator(".ledger-total")).toContainText(/Rp\s*533\.000/);
  await expect(page.locator(".ledger-payment")).toContainText(/Rp\s*383\.000/);
  await expect(page.locator(".ledger-mode-context")).toContainText("Ringkasan · Produk · Batch PO · Pesanan · HPP & Margin");
  await expect(page.locator(".order-ledger")).toHaveClass(/ledger-po/);
  await page.screenshot({path:`docs/preview-landing-po-${width}-${theme}.png`});
  await page.locator("summary").filter({hasText:"Apakah ringkasan Jastip dan Open PO digabung?"}).click();
  await expect(page.locator("details[open]")).toContainText("Tidak. Penjualan, HPP, pembayaran, tagihan, dan grafik bulanan hanya menampilkan usaha yang sedang dipilih.");
  await expect(page.locator('[aria-labelledby="testimonials-title"]')).toContainText("Belum merupakan ulasan pelanggan asli.");
  await expect(page.locator(".testimonials-list figure")).toHaveCount(2);
  await page.locator("summary").filter({hasText:"Satu pesanan bisa berisi beberapa barang?"}).click();
  await expect(page.getByText("Bisa. Tambahkan beberapa barang",{exact:false})).toBeVisible();
  await page.setViewportSize({width:390,height:844}); await page.getByRole("button",{name:"Buka menu",exact:true}).click();
  await page.getByRole("navigation",{name:"Navigasi website"}).getByRole("link",{name:"Harga",exact:true}).click();
  await expect(page.getByRole("button",{name:"Buka menu",exact:true})).toBeVisible();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await page.getByRole("link",{name:"Buat akun gratis",exact:true}).first().click();
  await expect(page).toHaveURL(/\/daftar$/); await expect(page.getByLabel("Nama usaha",{exact:true})).toBeVisible();
  expect(errors).toEqual([]);
});
}
test("registration uses Supabase signup and waits for email confirmation",async({page})=>{
  let payload:Record<string,unknown>|null=null;
  await page.route(`${endpoint}/auth/v1/signup**`,async route=>{payload=route.request().postDataJSON();expect(route.request().url()).toContain("redirect_to=");await route.fulfill({json:{id:owner,email:"naya@example.test",identities:[{id:"identity"}]}});});
  await page.goto("/daftar"); await page.getByLabel("Nama usaha",{exact:true}).fill("Titipan Naya");await page.getByLabel("Email",{exact:true}).fill("naya@example.test"); await page.getByLabel("Kata sandi",{exact:true}).fill("example-password-strong");
  await page.getByRole("button",{name:"Buat akun gratis",exact:true}).click();
  await expect(page.getByRole("status")).toContainText("mengonfirmasi akun");
  expect(payload).toMatchObject({email:"naya@example.test",data:{business_name:"Titipan Naya"}}); await expect(page).toHaveURL(/\/daftar$/);
});
test("mobile workspace navigation traps focus, closes with Escape and resets on resize", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("/demo");
  const menu = page.getByRole("button",{name:"Buka navigasi",exact:true});
  const sidebar = page.locator("#workspace-navigation");
  await menu.click();
  await expect(menu).toHaveAttribute("aria-expanded","true");
  await expect(sidebar.getByRole("button",{name:"Tutup navigasi",exact:true})).toBeFocused();
  await page.keyboard.press("Shift+Tab");
  await expect(sidebar.getByRole("button",{name:"Paket & langganan",exact:true})).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(sidebar.getByRole("button",{name:"Tutup navigasi",exact:true})).toBeFocused();
  await page.keyboard.press("Escape");
  await expect(menu).toBeFocused();
  await expect(sidebar).not.toBeVisible();
  await menu.click();
  await page.setViewportSize({width:1024,height:900});
  await page.setViewportSize({width:390,height:844});
  await expect(sidebar).not.toBeVisible();
  await expect(menu).toHaveAttribute("aria-expanded","false");
  await page.evaluate(() => document.documentElement.style.fontSize = "200%");
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(390);
});
test("monthly chart values can be selected with keyboard and touch", async ({page}) => {
  await page.addInitScript(() => localStorage.setItem("tippo.subscription.demo.v1",JSON.stringify({tier:"pro",expiresAt:"2099-01-01T00:00:00Z",mode:"demo"})));
  await page.goto("/demo");
  const months = page.getByRole("group",{name:"Pilih bulan pada grafik"}).getByRole("button");
  await months.first().focus();
  await page.keyboard.press("Enter");
  await expect(months.first()).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".chart-selected-value")).toContainText(await months.first().innerText());
  await page.setViewportSize({width:390,height:844});
  await months.last().click();
  await expect(months.last()).toHaveAttribute("aria-pressed","true");
  await expect(page.locator(".chart-selected-value")).toContainText(await months.last().innerText());
});
test("login errors are friendly and password visibility and recovery work",async({page})=>{
  await page.route(`${endpoint}/auth/v1/token**`,route=>route.fulfill({status:400,json:{code:"invalid_credentials",msg:"Invalid login credentials"}}));
  await page.route(`${endpoint}/auth/v1/recover**`,route=>route.fulfill({json:{}}));
  await page.goto("/masuk");await page.getByLabel("Email",{exact:true}).fill("naya@example.test");await page.getByLabel("Kata sandi",{exact:true}).fill("wrong-example");
  await page.getByRole("button",{name:"Tampilkan kata sandi"}).click(); await expect(page.getByLabel("Kata sandi",{exact:true})).toHaveAttribute("type","text");
  await page.getByRole("button",{name:"Masuk ke Tippo"}).click();await expect(page.locator(".auth-alert.error")).toContainText("belum cocok");
  await page.getByRole("link",{name:"Lupa kata sandi?"}).click();await expect(page).toHaveURL(/\/lupa-password$/);await page.getByLabel("Email",{exact:true}).fill("naya@example.test");await page.getByRole("button",{name:"Kirim tautan pemulihan"}).click();await expect(page.getByRole("status")).toContainText("Jika email terdaftar");
});
test("private workspace redirects visitors without a session",async({page})=>{
  await page.goto("/app");await expect(page).toHaveURL(/\/masuk$/);await expect(page.getByRole("heading",{name:"Masuk ke Tippo."})).toBeVisible();
});
test("browser back retains session and the homepage offers the existing account", async ({page}) => {
  await authenticate(page);
  let logoutCalls = 0;
  page.on("request", request => { if (request.url().includes("/auth/v1/logout")) logoutCalls++; });
  await page.goto("/");
  await expect(page.getByRole("link", {name:"Buka usaha saya", exact:true})).toBeVisible();
  const savedToken = await page.evaluate(() => localStorage.getItem("sb-bkplemoflteubfgvqhke-auth-token"));
  await page.getByRole("link", {name:"Buka usaha saya", exact:true}).click();
  await expect(page.locator(".page-heading h1")).toBeVisible();
  await page.goBack();
  await expect(page).toHaveURL(/\/$/);
  await expect(page.getByRole("link", {name:"Buka usaha saya", exact:true})).toBeVisible();
  await expect(page.locator(".landing-nav-actions").getByRole("link", {name:"Masuk", exact:true})).toHaveCount(0);
  expect(await page.evaluate(() => localStorage.getItem("sb-bkplemoflteubfgvqhke-auth-token"))).toBe(savedToken);
  await page.goForward();
  await expect(page.locator(".page-heading h1")).toBeVisible();
  await page.reload();
  await expect(page.locator(".page-heading h1")).toBeVisible();
  await page.goto("/masuk");
  await expect(page).toHaveURL(/\/app$/);
  await page.goto("/daftar");
  await expect(page).toHaveURL(/\/app$/);
  expect(logoutCalls).toBe(0);
  await page.getByRole("button", {name:"Menu akun",exact:true}).click();
  await page.getByRole("menuitem", {name:"Keluar",exact:true}).click();
  await expect(page).toHaveURL(/\/masuk$/);
  await page.goto("/");
  await expect(page.locator(".landing-nav-actions").getByRole("link", {name:"Masuk",exact:true})).toBeVisible();
  await expect(page.getByRole("link", {name:"Buka usaha saya",exact:true})).toHaveCount(0);
});
test("successful email login opens the authenticated account workspace",async({page})=>{
  const auth=session();
  await page.route(`${endpoint}/**`,route=>{
    const url=route.request().url();
    if(url.includes("/auth/v1/token")) return route.fulfill({json:auth});
    if(url.includes("/auth/v1/user")) return route.fulfill({json:auth.user});
    return route.fulfill({json:{data:fixture,version:0,subscription:{tier:"free",expiresAt:null},usage:[]}});
  });
  await page.goto("/masuk");await page.getByLabel("Email",{exact:true}).fill("naya@example.test");await page.getByLabel("Kata sandi",{exact:true}).fill("example-password-strong");await page.getByRole("button",{name:"Masuk ke Tippo"}).click();await expect(page).toHaveURL(/\/app$/);await expect(page.getByRole("heading",{name:"Ringkasan Jastip."})).toBeVisible();await page.getByRole("button",{name:"Menu akun",exact:true}).click();await expect(page.getByText("Titipan Naya",{exact:true})).toBeVisible();await page.keyboard.press("Escape");
});
test("account saves await Supabase, ignore local Pro and keep demo data separate",async({page})=>{
  const requests=await authenticate(page);const errors:string[]=[];page.on("pageerror",e=>errors.push(e.message));
  await page.goto("/app");await expect(page).toHaveTitle("Tippo: Jastip & Open PO");await expect(page.getByRole("heading",{name:"Ringkasan Jastip."})).toBeVisible();await expect(page.locator(".cloud-toolbar, .owner")).toHaveCount(0);await page.getByRole("button",{name:"Menu akun",exact:true}).click();await expect(page.getByText("Titipan Naya",{exact:true})).toBeVisible();await page.keyboard.press("Escape");
  await expect(page.getByLabel("Pilih bulan ringkasan")).toBeDisabled();
  await openSection(page,"Pesanan");
  await page.getByRole("button",{name:"Pesanan jastip baru",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Pesanan jastip baru",exact:true});
  await chooseOption(dialog.getByLabel("Pelanggan",{exact:true}), "aly");await dialog.getByLabel("Nama barang",{exact:true}).fill("Tote Canvas");await dialog.getByLabel("Harga jual / barang",{exact:true}).fill("150000");await dialog.getByLabel("Harga beli / barang",{exact:true}).fill("100000");
  await dialog.getByRole("button",{name:"Simpan pesanan",exact:false}).click();await expect(dialog).not.toBeVisible();expect(requests).toHaveLength(1);expect(requests[0].p_data.orders[0].items[0].product).toBe("Tote Canvas");
  expect(await page.evaluate(()=>JSON.parse(localStorage.getItem("tippo.workspace.v1")!).orders)).toEqual([]);
  await page.getByRole("button",{name:"Paket & langganan",exact:true}).click();await expect(page.getByRole("button",{name:"Coba Pro (demo)"})).toHaveCount(0);await expect(page.getByRole("link",{name:"Lihat invoice Pro",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Menu akun",exact:true}).click();await page.getByRole("menuitem",{name:"Keluar",exact:true}).click();await expect(page).toHaveURL(/\/masuk$/);expect(errors).toEqual([]);
});

test("account dropdown supports keyboard, outside click, settings and demo exit", async ({page}) => {
  await page.setViewportSize({width:390,height:844});
  await page.goto("/demo");
  const opener = page.getByRole("button",{name:"Menu akun",exact:true});
  await expect(page.locator(".sidebar").getByText("Pengaturan data",{exact:true})).toHaveCount(1);
  await opener.focus(); await page.keyboard.press("ArrowDown");
  const settings = page.getByRole("menuitem",{name:"Profil bisnis",exact:true});
  const exit = page.getByRole("menuitem",{name:"Keluar demo",exact:true});
  await expect(settings).toBeFocused();
  await page.keyboard.press("ArrowDown"); await expect(page.getByRole("menuitem", { name: "Mode gelap", exact: true })).toBeFocused();
  await page.keyboard.press("ArrowDown"); await expect(exit).toBeFocused();
  await page.keyboard.press("Home"); await expect(settings).toBeFocused();
  await page.keyboard.press("End"); await expect(exit).toBeFocused();
  await page.keyboard.press("Escape"); await expect(opener).toBeFocused();
  await expect(opener).toHaveAttribute("aria-expanded","false");
  await opener.click(); await page.locator(".demo-toolbar > span").click();
  await expect(page.getByRole("menu",{name:"Menu akun",exact:true})).toHaveCount(0);
  await opener.focus(); await page.keyboard.press("ArrowUp"); await expect(exit).toBeFocused();
  await page.keyboard.press("Tab"); await expect(opener).toHaveAttribute("aria-expanded","false");
  await opener.click(); await expect(settings).toBeFocused(); await page.keyboard.press("Enter");
  await expect(page.getByRole("heading",{name:"Profil bisnis.",exact:true})).toBeVisible();
  await expect(opener).toBeFocused();
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
  await opener.focus(); await page.keyboard.press("ArrowUp"); await expect(exit).toBeFocused();
  await page.keyboard.press("Space"); await expect(page).toHaveURL(/\/$/);
});

test("sign out clears the local session even when remote logout fails", async ({page}) => {
  await authenticate(page);
  await page.route(`${endpoint}/auth/v1/logout**`,route=>route.fulfill({status:500,json:{message:"Logout unavailable"}}));
  await page.goto("/app"); await expect(page.getByRole("heading",{name:"Ringkasan Jastip."})).toBeVisible();
  await page.getByRole("button",{name:"Menu akun",exact:true}).click();
  await page.getByRole("menuitem",{name:"Keluar",exact:true}).click();
  await expect(page).toHaveURL(/\/masuk$/);
  expect(await page.evaluate(() => localStorage.getItem("sb-bkplemoflteubfgvqhke-auth-token"))).toBeNull();
});
test("failed account save retains form inputs and never announces a successful save",async({page})=>{
  await authenticate(page,{failSave:true}); await page.goto("/app");await expect(page.getByRole("heading",{name:"Ringkasan Jastip."})).toBeVisible();
  await openSection(page,"Pesanan");await page.getByRole("button",{name:"Pesanan jastip baru",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Pesanan jastip baru",exact:true});
  await chooseOption(dialog.getByLabel("Pelanggan",{exact:true}), "aly");await dialog.getByLabel("Nama barang",{exact:true}).fill("Belum tersimpan");await dialog.getByLabel("Harga jual / barang",{exact:true}).fill("50000");await dialog.getByRole("button",{name:"Simpan pesanan",exact:false}).click();await expect(dialog).toBeVisible();await expect(dialog.getByLabel("Nama barang",{exact:true})).toHaveValue("Belum tersimpan");await expect(dialog.getByRole("alert")).toBeVisible();await expect(dialog.getByRole("alert")).toContainText("perangkat lain");await expect(page.locator(".cloud-error")).toContainText("perangkat lain");await expect(page.getByText("Pesanan baru berhasil dicatat",{exact:true})).toHaveCount(0);
});
test("missing remote database displays a recovery screen instead of demo transactions",async({page})=>{
  await authenticate(page,{missing:true});await page.goto("/app");await expect(page.getByRole("heading",{name:"Ruang usahamu belum terbuka."})).toBeVisible();await expect(page.locator(".workspace-wait-card [role=alert]")).toContainText("mengaktifkan database");await expect(page.getByRole("heading",{name:"Ringkasan Jastip."})).toHaveCount(0);
});


test("sidebar minimizes on desktop and keeps mobile navigation usable", async ({page}) => {
  await page.goto("/demo");
  await expect(page.locator(".breadcrumb")).toContainText("Halaman");
  await expect(page.locator(".owner")).toHaveCount(0);
  await expect(page.getByRole("button", {name:"Menu akun",exact:true}).locator("svg")).toHaveCount(1);
  await page.getByRole("button",{name:"Minimalkan sidebar"}).click();
  await expect(page.locator(".sidebar")).toHaveCSS("width","76px");
  await openBusiness(page,"Jastip");
  await expect(page.getByRole("button",{name:"Pesanan jastip baru",exact:true})).toBeVisible();
  await page.getByRole("button",{name:"Perluas sidebar"}).click();
  await expect(page.locator(".sidebar")).toHaveCSS("width","228px");
  await page.getByRole("button",{name:"Minimalkan sidebar"}).click();
  await page.setViewportSize({width:390,height:844});
  await page.getByRole("button",{name:"Buka navigasi"}).click();
  await expect(page.locator(".sidebar")).toHaveCSS("width","280px");
  await expect(page.getByRole("button",{name:"Tutup navigasi",exact:true}).last()).toBeFocused();
  await openBusiness(page,"Open PO");
  await expect(page.locator(".sidebar")).not.toBeVisible();
});

test.describe("selection toggle", () => {
  test.use({ hasTouch: true, viewport: { width: 390, height: 844 } });
  test("repeated touch closes the selection without changing its value", async ({page}) => {
    await authenticate(page);
    await page.goto("/app");
    await openBusiness(page, "Open PO");
    const filter = page.locator('button[aria-label="Filter produk"]');
    const initial = await filter.getAttribute("data-value");
    for (let attempt = 0; attempt < 3; attempt++) {
      await filter.tap();
      await expect(page.getByRole("listbox")).toBeVisible();
      await filter.tap();
      await expect(page.getByRole("listbox")).toHaveCount(0);
      await expect(filter).toHaveAttribute("data-value", initial!);
    }
    await filter.tap();
    await page.getByRole("option", { name: "Semua produk", exact: true }).tap();
    await expect(filter).toHaveText("Semua produk");
    await filter.focus();
    await page.keyboard.press("Enter");
    await expect(page.getByRole("listbox")).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(filter).toBeFocused();
    await openBusiness(page, "Jastip");
    await openSection(page, "Pesanan");
    await page.getByRole("button", { name: "Pesanan jastip baru", exact: true }).click();
    const form = page.getByRole("dialog", { name: "Pesanan jastip baru", exact: true });
    const customer = form.locator('button[aria-label="Pelanggan"]');
    await customer.tap();
    await expect(page.getByRole("listbox")).toBeVisible();
    await customer.tap();
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(form).toBeVisible();
    await customer.tap();
    await page.getByRole("option", { name: "Alya", exact: true }).tap();
    await expect(customer).toContainText("Alya");
    await customer.tap();
    await page.keyboard.press("Escape");
    await expect(page.getByRole("listbox")).toHaveCount(0);
    await expect(form).toBeVisible();
  });
});

for (const width of [390,1440]) test(`data forms do not focus editable fields when opened ${width}`, async ({page}) => {
  await authenticate(page);
  await page.setViewportSize({width,height:844});
  await page.goto("/app");
  await openSection(page,"Pelanggan");
  await page.getByRole("button",{name:"Tambah pelanggan",exact:true}).click();
  let form=page.getByRole("dialog",{name:"Tambah pelanggan",exact:true});
  await expect(form.getByRole("button",{name:"Tutup",exact:true})).toBeFocused();
  await page.keyboard.press("Tab");
  await expect(form.getByLabel("Nama pelanggan",{exact:true})).toBeFocused();
  await page.keyboard.press("Escape");
  await openBusiness(page,"Jastip");
  await page.getByRole("button",{name:"Batch jastip baru",exact:true}).click();
  form=page.getByRole("dialog",{name:"Batch jastip baru",exact:true});
  await expect(form.getByRole("button",{name:"Tutup",exact:true})).toBeFocused();
  await checkCalendarOnly(page,form.getByLabel("Tutup pesanan",{exact:true}),form);
  await page.keyboard.press("Escape");
  await openBusiness(page,"Open PO");
  await page.getByRole("button",{name:"Produk baru",exact:true}).click();
  form=page.getByRole("dialog",{name:"Produk baru",exact:true});
  await expect(form.getByRole("button",{name:"Tutup produk",exact:true})).toBeFocused();
  await page.keyboard.press("Escape");
  await openSection(page,"Batch PO");
  await page.getByRole("button",{name:"Batch PO baru",exact:true}).first().click();
  form=page.getByRole("dialog",{name:"Batch PO baru",exact:true});
  await expect(form.getByRole("button",{name:"Tutup",exact:true})).toBeFocused();
  await checkCalendarOnly(page,form.getByLabel("Tutup pesanan",{exact:true}),form);
});

for(const width of [390,1440]) test(`product categories are selected or added on request ${width}`,async({page})=>{
  const data=structuredClone(fixture);
  data.products.push({id:"category-product",name:"Roti",category:"Makanan",variant:"",sku:"",unitPrice:25000,unitCost:12000,active:true});
  const requests=await authenticate(page,{workspace:data});
  await page.setViewportSize({width,height:844});
  await page.goto("/app");await openBusiness(page,"Open PO");
  await page.getByRole("button",{name:"Produk baru",exact:true}).click();
  let form=page.getByRole("dialog",{name:"Produk baru",exact:true});
  await expect(form.getByRole("textbox",{name:"Kategori (opsional)",exact:true})).toHaveCount(0);
  const category=form.getByRole("combobox",{name:"Kategori (opsional)",exact:true});
  await expect(category).toHaveText("Pilih kategori");
  await chooseOption(category,"Makanan");await expect(category).toHaveText("Makanan");
  await category.click();await expect(page.getByRole("option",{name:"Pilih kategori tersimpan",exact:true})).toHaveCount(0);await page.keyboard.press("Escape");
  const toggle=form.getByRole("switch",{name:"Kategori manual",exact:true});
  await expect(toggle).toHaveAttribute("aria-checked","false");
  await toggle.click();
  await expect(category).toHaveCount(0);
  await form.getByRole("textbox",{name:"Kategori (opsional)",exact:true}).fill("Draf kategori");
  await toggle.focus();await page.keyboard.press("Space");
  await expect(category).toHaveText("Makanan");
  await expect(form.getByRole("textbox",{name:"Kategori (opsional)",exact:true})).toHaveCount(0);
  await toggle.click();
  await expect(toggle).toHaveAttribute("aria-checked","true");
  await expect(form.getByRole("textbox",{name:"Kategori (opsional)",exact:true})).toHaveValue("Draf kategori");
  await form.getByRole("textbox",{name:"Kategori (opsional)",exact:true}).fill("Pakaian");
  await form.getByLabel("Nama produk",{exact:true}).fill("Kaos baru");
  await form.getByLabel("Harga jual / unit",{exact:true}).fill("50000");
  await form.getByRole("button",{name:"Simpan produk",exact:false}).click();
  await expect(form).toHaveCount(0);expect(requests[0].p_data.products[0]).toMatchObject({name:"Kaos baru",category:"Pakaian"});
  await page.getByRole("button",{name:"Produk baru",exact:true}).click();
  form=page.getByRole("dialog",{name:"Produk baru",exact:true});
  await expect(form.getByRole("textbox",{name:"Kategori (opsional)",exact:true})).toHaveCount(0);
  await chooseOption(form.getByRole("combobox",{name:"Kategori (opsional)",exact:true}),"Pakaian");
  await expect(form.getByRole("combobox",{name:"Kategori (opsional)",exact:true})).toHaveText("Pakaian");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
});

for(const width of [320,1440]) for(const theme of ["light","dark"]) test(`help opens guides and FAQ with working navigation ${width} ${theme}`,async({page})=>{
  const saves=await authenticate(page);
  await page.setViewportSize({width,height:1000});
  await page.addInitScript(theme=>localStorage.setItem("tippo.theme.v1",theme),theme);
  await page.goto("/app");
  async function openHelp() {
    await page.locator(".page-heading h1").waitFor();
    const menu=page.getByRole("button",{name:"Buka navigasi",exact:true});
    if(await menu.isVisible()) await menu.click();
    await page.getByRole("button",{name:"Panduan & FAQ",exact:true}).click();
    await expect(page.getByRole("heading",{level:1})).toHaveText("Panduan & FAQ.");
    await expect(page.locator(".toast")).toHaveCount(0);
    if(width<600) await expect(page.locator(".sidebar")).not.toBeVisible();
  }
  await openHelp();
  await expect(page.getByRole("region",{name:"Panduan Jastip",exact:true})).toContainText("Nama barang, varian, warna, ukuran");
  await page.getByRole("navigation",{name:"Daftar isi panduan"}).getByRole("link",{name:"Pertanyaan umum",exact:true}).click();
  const question=page.locator("summary").filter({hasText:"Bagaimana batas diskon dihitung?"});
  await question.focus();await page.keyboard.press("Enter");
  await expect(page.locator(".help-faq details[open]")).toContainText("tidak termasuk ongkir");
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  await page.screenshot({path:`docs/preview-help-${width}-${theme}.png`,fullPage:true});
  await page.getByRole("button",{name:"Buka Perjalanan",exact:true}).click();
  await expect(page.getByRole("heading",{level:1})).toHaveText("Perjalanan Jastip.");
  await openBusiness(page,"Open PO");await openHelp();
  await expect(page.getByRole("region",{name:"Panduan Open PO",exact:true})).toContainText("Buka Produk");
  await page.getByRole("button",{name:"Buka Produk",exact:true}).click();
  await expect(page.getByRole("heading",{level:1})).toHaveText("Produk Open PO.");
  await openHelp();await page.getByRole("button",{name:"Buka Kritik & saran",exact:true}).click();
  await expect(page.getByRole("heading",{level:1})).toHaveText("Kritik & saran.");
  expect(saves).toHaveLength(0);
});

for(const width of [390,1440]) for(const theme of ["light","dark"]) test(`sidebar groups menus and switches businesses ${width} ${theme}`,async({page})=>{
 await authenticate(page);await page.setViewportSize({width,height:900});await page.addInitScript(theme=>localStorage.setItem("tippo.theme.v1",theme),theme);await page.goto("/app");
 await openNavigation(page);
 const sidebar=page.locator(".sidebar");
 await expect(sidebar.getByRole("group",{name:"Pilih usaha"})).toBeVisible();
 await expect(sidebar.locator(".sidebar-plan-badge")).toHaveText("Gratis");await expect(sidebar.getByText("Bantuan & pengaturan",{exact:true})).toBeVisible();
 const switchWidths=await sidebar.locator(".business-switch button").evaluateAll(buttons=>buttons.map(b=>b.getBoundingClientRect().width));expect(Math.abs(switchWidths[0]-switchWidths[1])).toBeLessThan(1);
 await expect(page.locator("main .business-switch")).toHaveCount(0);
 await expect(sidebar.locator(".sidebar-menu-group").first().getByRole("button")).toHaveText(["Ringkasan","Pesanan","Perjalanan","Pelanggan","HPP & Margin"]);
 await sidebar.getByRole("button",{name:"Open PO",exact:true}).click();
 await expect(page.getByRole("heading",{level:1})).toHaveText("Ringkasan Open PO.");
 if(width<760) await expect(sidebar).not.toBeVisible();
 await openNavigation(page);
 await expect(sidebar.locator(".sidebar-menu-group").first().getByRole("button")).toHaveText(["Ringkasan","Pesanan","Produk","Batch PO","Pelanggan","HPP & Margin"]);
 await expect(sidebar.getByRole("group",{name:"Menu pendukung"}).getByRole("button")).toHaveText(["Pengaturan data","Panduan & FAQ","Kritik & saran"]);
 await sidebar.screenshot({path:`docs/preview-sidebar-${width}-${theme}.png`});
 if(width>=760) {
  await sidebar.getByRole("button",{name:"Minimalkan sidebar"}).click();await expect(sidebar).toHaveCSS("width","76px");
  await expect(sidebar.getByRole("button",{name:"Panduan & FAQ"})).toHaveAttribute("title","Panduan & FAQ");
  await sidebar.getByRole("button",{name:"Jastip",exact:true}).click();await expect(page.getByRole("heading",{level:1})).toHaveText("Ringkasan Jastip.");
  await sidebar.getByRole("button",{name:"Perluas sidebar"}).click();
 } else {
  await page.keyboard.press("Shift+Tab");await expect(sidebar.getByRole("button",{name:"Paket & langganan",exact:true})).toBeFocused();
  await page.keyboard.press("Tab");await expect(sidebar.getByRole("button",{name:"Tutup navigasi",exact:true})).toBeFocused();
  await page.keyboard.press("Escape");await expect(page.getByRole("button",{name:"Buka navigasi"})).toBeFocused();await openNavigation(page);
 }
 await sidebar.getByRole("button",{name:"Panduan & FAQ",exact:true}).click();await expect(page.getByRole("heading",{level:1})).toHaveText("Panduan & FAQ.");
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
});

test("custom selections support keyboard, touch and Escape without closing the order", async ({page}) => {
  await page.goto("/demo");
  await expect(page.locator(".top-avatar")).toHaveText("Akun");
  await expect(page.getByText("Akun Supabase", {exact:true})).toHaveCount(0);
  const month=page.getByRole("combobox", {name:"Pilih bulan ringkasan"});
  await expect(month).toBeDisabled();
  await expect(page.locator(".month-picker")).toHaveCSS("background-color", "rgb(233, 234, 231)");
  await page.getByRole("navigation", {name:"Navigasi utama"}).getByRole("button", {name:"Open PO",exact:true}).click();
  const filter=page.getByRole("combobox",{name:"Filter produk"});
  await filter.focus();await page.keyboard.press("Enter");
  await expect(page.getByRole("listbox")).toBeVisible();
  await expect(page.getByRole("option",{name:"Produk aktif",exact:true})).toHaveAttribute("aria-selected","true");
  await page.keyboard.press("Home");await page.keyboard.press("ArrowDown");await page.keyboard.press("Enter");
  await expect(filter).toHaveText("Diarsipkan");await expect(filter).toBeFocused();
  await page.setViewportSize({width:390,height:844});
  await chooseOption(filter, "all");await expect(filter).toHaveText("Semua produk");
  await page.getByRole("button",{name:"Pesanan PO baru",exact:true}).click();
  const form=page.getByRole("dialog",{name:"Pesanan PO baru",exact:true});
  const product=form.getByLabel("Produk",{exact:true});
  expect(await form.locator("form").evaluate((el)=>new FormData(el as HTMLFormElement).get("batchId"))).toBe(await form.getByLabel("Batch PO").getAttribute("data-value"));
  await product.click();await page.keyboard.press("Escape");
  await expect(page.getByRole("listbox")).toHaveCount(0);await expect(form).toBeVisible();await expect(product).toBeFocused();
  await page.keyboard.press("Escape");await expect(form).not.toBeVisible();
});

test("customer creation waits for the account save and keeps inputs on failure", async ({page}) => {
  const requests=await authenticate(page,{failSave:true});await page.goto("/app");
  await page.getByRole("navigation",{name:"Navigasi utama"}).getByRole("button",{name:"Pelanggan",exact:true}).click();
  await page.getByRole("button",{name:"Tambah pelanggan",exact:true}).click();const form=page.getByRole("dialog",{name:"Tambah pelanggan",exact:true});
  await form.getByLabel("Nama pelanggan",{exact:true}).fill("Pelanggan Gagal");await form.getByLabel("Alamat (opsional)").fill("Jalan Mawar 3");await form.getByRole("button",{name:"Simpan pelanggan",exact:true}).click();
  await expect(form.getByRole("alert")).toHaveText("Pelanggan belum tersimpan. Coba lagi.");await expect(form.getByLabel("Nama pelanggan",{exact:true})).toHaveValue("Pelanggan Gagal");await expect(form).toBeVisible();
  expect(requests).toHaveLength(1);expect(requests[0].p_data.customers).toHaveLength(2);expect(requests[0].p_data.customers[1].address).toBe("Jalan Mawar 3");await expect(form.getByLabel("Alamat (opsional)")).toHaveValue("Jalan Mawar 3");await expect(page.getByText("Pelanggan berhasil ditambahkan",{exact:true})).toHaveCount(0);
});

test("customer dialog restores keyboard focus after cancel and save", async ({page}) => {
  await page.goto("/demo");await page.getByRole("navigation",{name:"Navigasi utama"}).getByRole("button",{name:"Pelanggan",exact:true}).click();const add=page.getByRole("button",{name:"Tambah pelanggan",exact:true});
  await add.focus();await page.keyboard.press("Enter");let form=page.getByRole("dialog",{name:"Tambah pelanggan",exact:true});await expect(form.getByLabel("Nama pelanggan",{exact:true})).toBeFocused();await page.keyboard.press("Escape");await expect(form).not.toBeVisible();await expect(add).toBeFocused();
  await page.keyboard.press("Enter");form=page.getByRole("dialog",{name:"Tambah pelanggan",exact:true});await form.getByLabel("Nama pelanggan",{exact:true}).fill("Pelanggan Keyboard");await page.keyboard.press("Tab");await expect(form.getByLabel("Nomor WhatsApp (opsional)")).toBeFocused();await page.keyboard.press("Tab");await expect(form.getByLabel("Alamat (opsional)")).toBeFocused();await page.keyboard.press("Tab");await page.keyboard.press("Tab");await expect(form.getByRole("button",{name:"Simpan pelanggan",exact:true})).toBeFocused();await page.keyboard.press("Enter");await expect(form).not.toBeVisible();await expect(add).toBeFocused();
});

for(const failSave of [false,true])test(`product Excel import ${failSave?"retains preview on RPC failure":"saves atomically to the account"}`,async({page})=>{
  const requests=await authenticate(page,{failSave,pro:true});
  await page.goto("/app");await openBusiness(page,"Open PO");
  await page.getByRole("button",{name:"Import produk Excel",exact:true}).click();
  const dialog=page.getByRole("dialog",{name:"Import produk Excel",exact:true});
  const ExcelJS=(await import("exceljs")).default;const book=new ExcelJS.Workbook();const sheet=book.addWorksheet("Produk");sheet.addRow(["produk","varian","sku_produk","harga_jual","harga_beli"]);sheet.addRow(["Produk akun","","SKU-A",150000,100000]);
  await dialog.getByLabel("File Excel produk").setInputFiles({name:"produk.xlsx",mimeType:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",buffer:Buffer.from(await book.xlsx.writeBuffer())});
  await dialog.getByRole("button",{name:"Import 1 produk",exact:true}).click();
  if(failSave){await expect(dialog.getByRole("alert")).toContainText("Produk belum tersimpan");await expect(dialog).toBeVisible();await expect(dialog.getByText(/1 dari 1 produk valid/)).toBeVisible();await expect(page.getByRole("status").filter({hasText:"produk berhasil diimpor"})).toHaveCount(0);}
  else {await expect(dialog).not.toBeVisible();await expect(page.getByRole("heading",{name:"Produk akun",exact:true})).toBeVisible();}
  expect(requests).toHaveLength(1);expect(requests[0].p_data.products[0]).toMatchObject({name:"Produk akun",unitPrice:150000,unitCost:100000});expect(requests[0].p_data.orders).toHaveLength(0);expect(requests[0].p_expected_version).toBe(0);
});

test("cloud Free account cannot unlock Excel imports with a local demo Pro entitlement",async({page})=>{
  const requests=await authenticate(page);
  await page.goto("/app");
  await expect(page.locator(".sidebar-plan-badge")).toHaveText("Gratis");
  for(const mode of ["Jastip","Open PO"]){
    await openBusiness(page,mode);
    await openSection(page,"Pesanan");
    await page.getByRole("button",{name:"Import Excel",exact:true}).click();
    await expect(page.getByRole("region",{name:"Paket Pro"})).toBeVisible();
    await expect(page.getByRole("dialog")).toHaveCount(0);
  }
  await openBusiness(page,"Open PO");
  await openSection(page,"Produk");
  await page.getByRole("button",{name:"Import produk Excel",exact:true}).click();
  await expect(page.getByRole("region",{name:"Paket Pro"})).toBeVisible();
  await expect(page.getByRole("dialog")).toHaveCount(0);
  expect(requests).toHaveLength(0);
});

for(const width of [320,390,1440])for(const theme of ["light","dark"])test(`DOKU sandbox checkout ${width} ${theme} persists server invoice and keeps production entitlement separate`,async({page})=>{
 test.skip(process.env.PLAYWRIGHT_DOKU_SANDBOX!=="true","Requires a build with NEXT_PUBLIC_DOKU_SANDBOX_ENABLED=true");
 await page.setViewportSize({width,height:1000});await page.addInitScript(t=>localStorage.setItem("tippo.theme.v1",t),theme);await authenticate(page);
 const state:{environment:string;invoice:null|{id:string;number:string;amount:number;currency:string;status:string;checkoutUrl:string;createdAt:string;expiresAt:string;paidAt:string|null};proUntil:string|null}={environment:"sandbox",invoice:null,proUntil:null};let creates=0,statusCalls=0;
 await page.route(`${endpoint}/functions/v1/tippo-doku-sandbox/**`,async route=>{
  expect(route.request().headers().authorization).toContain("Bearer ");
  if(route.request().url().endsWith("/checkout")){creates++;expect(route.request().postDataJSON()).toEqual({});state.invoice={id:"sandbox-invoice",number:"TSBX-"+"A".repeat(32),amount:25000,currency:"IDR",status:"pending",checkoutUrl:"https://sandbox.doku.com/checkout/preview",createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),paidAt:null};}
  else statusCalls++;
  return route.fulfill({json:state});
 });
 await page.goto("/app?billing=sandbox");const panel=page.getByRole("region",{name:"Pembayaran Pro sandbox",exact:true});await expect(panel).toBeVisible();await panel.getByRole("button",{name:"Buat pembayaran sandbox",exact:true}).click();await expect(panel).toContainText("Menunggu pembayaran");await expect(panel.getByRole("link",{name:"Buka pembayaran DOKU"})).toHaveAttribute("href","https://sandbox.doku.com/checkout/preview");expect(creates).toBe(1);
 await page.reload();await expect(panel).toContainText("Menunggu pembayaran");expect(creates).toBe(1);
 state.invoice!.status="paid";state.invoice!.paidAt=new Date().toISOString();state.proUntil=new Date(Date.now()+30*86400000).toISOString();await panel.getByRole("button",{name:"Cek status pembayaran",exact:true}).click();await expect(panel).toContainText("Lunas (sandbox)");await expect(panel).toContainText("Simulasi masa Pro tercatat sampai");await expect(page.getByRole("region",{name:"Paket aktif",exact:true})).toContainText("Paketmu: Gratis");expect(statusCalls).toBeGreaterThanOrEqual(3);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);await panel.screenshot({path:`docs/preview-doku-sandbox-${width}-${theme}.png`});
});

test("DOKU sandbox backend failure stays recoverable and an unsafe URL is never linked",async({page})=>{
 test.skip(process.env.PLAYWRIGHT_DOKU_SANDBOX!=="true","Requires a build with NEXT_PUBLIC_DOKU_SANDBOX_ENABLED=true");
 await authenticate(page);let fail=true;await page.route(`${endpoint}/functions/v1/tippo-doku-sandbox/**`,route=>route.fulfill(fail?{status:503,json:{error:"SANDBOX_NOT_CONFIGURED"}}:{json:{environment:"sandbox",proUntil:null,invoice:{id:"i",number:"TSBX-"+"B".repeat(32),amount:25000,currency:"IDR",status:"pending",checkoutUrl:"https://sandbox.doku.com.evil.test/pay",createdAt:new Date().toISOString(),expiresAt:new Date(Date.now()+3600000).toISOString(),paidAt:null}}}));
 await page.goto("/app?billing=sandbox");const panel=page.getByRole("region",{name:"Pembayaran Pro sandbox",exact:true});await expect(panel.getByRole("alert")).toContainText("belum dapat dimuat");fail=false;await panel.getByRole("button",{name:"Cek status pembayaran",exact:true}).click();await expect(panel.getByRole("alert")).toContainText("belum dapat dimuat");await expect(panel.getByRole("link")).toHaveCount(0);await expect(panel.getByRole("button",{name:"Cek status pembayaran",exact:true})).toBeEnabled();
});

for(const path of ["/masuk","/daftar"])test(`Google OAuth starts independently of empty email fields on ${path}`,async({page})=>{
  await page.route(`${endpoint}/auth/v1/settings`,route=>route.fulfill({json:{external:{google:true}}}));
  await page.route(`${endpoint}/auth/v1/authorize**`,route=>route.fulfill({contentType:"text/html",body:"<h1>Pilih akun Google (simulasi)</h1>"}));
  await page.goto(path);
  await page.getByRole("button",{name:"Masuk dengan Google",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Pilih akun Google (simulasi)"})).toBeVisible();
  const url=new URL(page.url());expect(url.origin).toBe(endpoint);expect(url.searchParams.get("provider")).toBe("google");expect(url.searchParams.get("redirect_to")).toBe(new URL("/auth/callback",test.info().project.use.baseURL).href);expect(url.searchParams.get("prompt")).toBe("select_account");
});

test("unconfigured Google provider shows a useful error and preserves the email form",async({page})=>{
  await page.route(`${endpoint}/auth/v1/settings`,route=>route.fulfill({json:{external:{google:false}}}));
  await page.goto("/masuk");await page.getByLabel("Email",{exact:true}).fill("naya@example.test");
  await page.getByRole("button",{name:"Masuk dengan Google",exact:true}).click();
  await expect(page.locator(".auth-alert[role=alert]")).toHaveText("Login Google belum diaktifkan. Gunakan email untuk sementara.");
  await expect(page.getByLabel("Email",{exact:true})).toHaveValue("naya@example.test");await expect(page.getByRole("button",{name:"Masuk ke Tippo",exact:true})).toBeEnabled();
});

test("Google callback creates the account session from tokens and opens its workspace",async({page})=>{
  await authenticate(page);
  await page.addInitScript(()=>localStorage.removeItem("sb-bkplemoflteubfgvqhke-auth-token"));
  const auth=session();
  await page.goto(`/auth/callback#access_token=${auth.access_token}&refresh_token=${auth.refresh_token}&expires_in=3600&token_type=bearer`);
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading",{name:"Ringkasan Jastip."})).toBeVisible();
  await expect(page.locator(".sidebar-plan-badge")).toHaveText("Gratis");
});

test("cancelled Google login offers a retry instead of opening the workspace",async({page})=>{
  await page.goto("/auth/callback?error=access_denied&error_description=cancelled");
  await expect(page.getByRole("heading",{name:"Login belum berhasil."})).toBeVisible();
  await page.getByRole("link",{name:"Kembali ke halaman masuk",exact:true}).click();await expect(page).toHaveURL(/\/masuk$/);
});


test("Google settings network failure allows retry without losing email input",async({page})=>{
  let attempt=0;
  await page.route(`${endpoint}/auth/v1/settings`,route=>{attempt++;return attempt===1?route.abort("failed"):route.fulfill({json:{external:{google:true}}});});
  await page.route(`${endpoint}/auth/v1/authorize**`,route=>route.fulfill({contentType:"text/html",body:"<h1>Google simulasi</h1>"}));
  await page.goto("/masuk");await page.getByLabel("Email",{exact:true}).fill("naya@example.test");
  await page.getByRole("button",{name:"Masuk dengan Google",exact:true}).click();
  await expect(page.locator(".auth-alert[role=alert]")).toContainText("Periksa koneksi internetmu");
  await expect(page.getByLabel("Email",{exact:true})).toHaveValue("naya@example.test");
  await page.getByRole("button",{name:"Masuk dengan Google",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Google simulasi"})).toBeVisible();
});

test("business profile persists in demo and data settings are in the sidebar",async({page})=>{
  await page.goto("/demo");
  await page.getByRole("button",{name:"Menu akun",exact:true}).click();
  await expect(page.getByRole("menuitem",{name:"Pengaturan data",exact:true})).toHaveCount(0);
  await page.getByRole("menuitem",{name:"Profil bisnis",exact:true}).click();
  await expect(page.getByRole("button",{name:"Pesanan baru",exact:true})).toHaveCount(0);
  await page.getByLabel("Nama usaha",{exact:true}).fill("Usaha Uji");
  await page.getByLabel("Nomor WhatsApp usaha (opsional)").fill("081234567890");
  await page.getByLabel("Alamat usaha (opsional)").fill("Jalan Melati 12\nBandung");
  await expect(page.getByLabel("Email akun")).toHaveAttribute("readonly","");
  await page.getByRole("button",{name:"Simpan profil",exact:true}).click();
  await expect(page.locator(".toast")).toContainText("Profil bisnis berhasil disimpan");
  await page.reload();await page.getByRole("button",{name:"Menu akun",exact:true}).click();await page.getByRole("menuitem",{name:"Profil bisnis",exact:true}).click();
  await expect(page.getByLabel("Nama usaha",{exact:true})).toHaveValue("Usaha Uji");await expect(page.getByLabel("Alamat usaha (opsional)")).toHaveValue("Jalan Melati 12\nBandung");
  await page.locator(".sidebar").getByRole("button",{name:"Pengaturan data",exact:true}).click();
  await expect(page.getByRole("heading",{name:"Pengaturan data.",exact:true})).toBeVisible();await expect(page.getByRole("button",{name:"Ekspor data",exact:true})).toBeVisible();
});

for(const fail of [false,true])test(`cloud business profile ${fail?"preserves input on failure":"saves to account metadata and survives reload"}`,async({page})=>{
  await authenticate(page);let payload:Record<string,unknown>|undefined;
  const auth=session();
  await page.route(`${endpoint}/auth/v1/user`,async route=>{
    if(route.request().method()==="PUT"){
      payload=route.request().postDataJSON();
      if(fail)return route.fulfill({status:500,json:{message:"unavailable"}});
      auth.user.user_metadata={...auth.user.user_metadata,...payload!.data as object};
    }
    return route.fulfill({json:auth.user});
  });
  await page.addInitScript(()=>localStorage.setItem("tippo.business.demo.v1",JSON.stringify({name:"DO NOT USE DEMO",phone:"",address:""})));
  await page.goto("/app");await page.getByRole("button",{name:"Menu akun",exact:true}).click();await page.getByRole("menuitem",{name:"Profil bisnis",exact:true}).click();
  await expect(page.getByLabel("Nama usaha",{exact:true})).toHaveValue("Titipan Naya");
  await page.getByLabel("Nama usaha",{exact:true}).fill("Titipan Baru");await page.getByLabel("Alamat usaha (opsional)").fill("Bandung");
  await page.getByRole("button",{name:"Simpan profil",exact:true}).click();
  if(fail){await expect(page.locator(".business-profile-card [role=alert]")).toContainText("Profil belum tersimpan");await expect(page.getByLabel("Nama usaha",{exact:true})).toHaveValue("Titipan Baru");await expect(page.getByText("Profil bisnis berhasil disimpan",{exact:true})).toHaveCount(0);}
  else{await expect(page.locator(".toast")).toContainText("Profil bisnis berhasil disimpan");expect(payload!.data).toEqual({business_name:"Titipan Baru",business_phone:"",business_address:"Bandung"});await page.reload();await page.getByRole("button",{name:"Menu akun",exact:true}).click();await page.getByRole("menuitem",{name:"Profil bisnis",exact:true}).click();await expect(page.getByLabel("Nama usaha",{exact:true})).toHaveValue("Titipan Baru");}
});


for(const failSave of [false,true])test(`account refund ${failSave?"retains form on failure":"saves net payment and refund together"}`,async({page})=>{
 const data:AppData={...structuredClone(fixture),orders:[{id:"refund-cloud",batchId:"trip",customerId:"aly",createdAt:"2026-10-09T00:00:00Z",date:"2026-10-09",paid:100000,status:"new",serviceFee:0,shippingCharge:0,notes:"",items:[{id:"refund-item",product:"Refund cloud",variant:"",color:"",size:"",quantity:1,unitPrice:100000,unitCost:50000}]}]};
 const requests=await authenticate(page,{failSave,workspace:data});await page.goto("/app");await openBusiness(page,"Jastip");await openSection(page,"Pesanan");await page.getByRole("button",{name:"Refund Refund cloud",exact:true}).click();const dialog=page.getByRole("dialog",{name:"Refund pesanan",exact:true});await checkCalendarOnly(page,dialog.getByLabel("Tanggal refund",{exact:true}),dialog);await dialog.getByLabel("Nominal refund",{exact:true}).fill("50000");await dialog.getByRole("button",{name:"Catat refund",exact:true}).click();
 if(failSave){await expect(dialog.getByRole("alert")).toContainText("Refund belum tersimpan");await expect(dialog.getByLabel("Nominal refund",{exact:true})).toHaveValue("50.000");await expect(page.getByText("Refund berhasil dicatat",{exact:true})).toHaveCount(0);}
 else await expect(dialog).not.toBeVisible();
 expect(requests).toHaveLength(1);expect(requests[0].p_data.orders[0].paid).toBe(50000);expect(requests[0].p_data.orders[0].refunds![0].amount).toBe(50000);
});

 test("demo is unavailable and management tables have only edit and removal actions",async({page})=>{
 await page.goto("/demo");await expect(page).toHaveURL(/\/masuk$/);await expect(page.locator('a[href="/demo"]')).toHaveCount(0);await page.goto("/");await expect(page.locator('a[href="/demo"]')).toHaveCount(0);
 const data=structuredClone(fixture);data.batches.push({...data.batches[0],id:"po-test",type:"po",name:"PO Uji"});data.products.push({id:"product-test",name:"Produk Uji",variant:"",sku:"",unitPrice:25000,unitCost:12000,active:true});await authenticate(page,{workspace:data});await page.goto("/app");await openBusiness(page,"Open PO");let table=page.getByRole("table",{name:"Daftar produk PO"});await expect(table.getByRole("button",{name:"Edit produk Produk Uji"})).toBeVisible();await table.screenshot({path:"docs/preview-account-products-simple.png"});await expect(table.getByRole("button",{name:"Pesan produk"})).toHaveCount(0);await openSection(page,"Batch PO");table=page.getByRole("table",{name:"Daftar batch PO"});await expect(table.getByRole("button",{name:"Edit batch PO Uji"})).toBeVisible();await expect(table.getByRole("button",{name:/HPP|Tambah pesanan/})).toHaveCount(0);await openBusiness(page,"Jastip");table=page.getByRole("table",{name:"Daftar perjalanan Jastip"});await expect(table.getByRole("button",{name:/HPP|Tambah pesanan/})).toHaveCount(0);await expect(table.getByRole("button",{name:"Edit batch Jastip Seoul"})).toBeVisible();await table.screenshot({path:"docs/preview-account-journeys-simple.png"});await page.setViewportSize({width:390,height:844});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 });

test("customers use a searchable table with address and edit action",async({page})=>{
 const data=structuredClone(fixture);
 data.customers[0].phone="08123456789"; data.customers[0].address="Jalan Mawar 12, Jakarta";
 await authenticate(page,{workspace:data}); await page.goto("/app"); await openSection(page,"Pelanggan");
 const table=page.getByRole("table",{name:"Daftar pelanggan"});
 await expect(table).toContainText("Jalan Mawar 12, Jakarta"); await expect(table).toContainText("08123456789");
 await expect(table.getByRole("columnheader",{name:"Jumlah pesanan"})).toHaveCSS("text-align","center");
 await expect(table.locator('td[data-label="Jumlah pesanan"]')).toHaveCSS("text-align","center");
 await expect(table.getByRole("columnheader",{name:"Aksi"})).toHaveCSS("text-align","center");
 await table.screenshot({path:"docs/preview-customer-table-desktop.png"});
 await page.getByLabel("Cari pelanggan").fill("Tidak ada"); await expect(page.getByText("Pelanggan tidak ditemukan",{exact:true})).toBeVisible();
 await page.getByRole("button",{name:"Reset pencarian"}).click(); await table.getByRole("button",{name:"Edit pelanggan Alya"}).click();
 await expect(page.getByRole("dialog",{name:"Edit pelanggan"}).getByLabel("Alamat (opsional)")).toHaveValue("Jalan Mawar 12, Jakarta");
 await page.keyboard.press("Escape"); await page.setViewportSize({width:390,height:844});
 expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(390);
 await expect(table).not.toBeVisible(); await page.locator(".mobile-data-list").screenshot({path:"docs/preview-customer-table-mobile.png"});
});

test("dashboard recent orders are read only while Jastip retains actions",async({page})=>{
 const data=structuredClone(fixture);
 data.orders.push({id:"recent-test",batchId:"trip",customerId:"aly",date:new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Jakarta"}),createdAt:new Date().toISOString(),status:"new",paid:0,serviceFee:0,shippingCharge:0,notes:"",items:[{id:"recent-item",product:"Barang Ringkasan",productId:null,variant:"",color:"",size:"",quantity:1,unitPrice:25000,unitCost:12000}]});
 await authenticate(page,{workspace:data}); await page.goto("/app"); const recent=page.locator(".recent-card");
 await expect(recent).toContainText("Barang Ringkasan"); await expect(recent).toContainText("Tercatat");
 await expect(recent.getByRole("button")).toHaveCount(0); await expect(recent.getByRole("combobox")).toHaveCount(0);
 await expect(recent.getByRole("columnheader",{name:"Tindakan"})).toHaveCount(0);
 const alignment=await recent.locator("table").evaluate(t=>{
   const h=t.querySelector(".status-column-title")!,v=t.querySelector("tbody .status-tag")!;
   const hr=h.getBoundingClientRect(),vr=v.getBoundingClientRect();
   return Math.abs((hr.x+hr.width/2)-(vr.x+vr.width/2));
 });
 expect(alignment).toBeLessThan(1); await recent.screenshot({path:"docs/preview-dashboard-orders-readonly.png"});
 await openBusiness(page,"Jastip"); await openSection(page,"Pesanan");
 await expect(page.getByRole("button",{name:"Edit pesanan Barang Ringkasan"})).toBeVisible();
 await expect(page.getByRole("button",{name:"Ubah status pesanan Barang Ringkasan untuk Alya"})).toBeVisible();
});

test("product status actions confirm archive and restore and preserve status on cancel",async({page})=>{
 const data=structuredClone(fixture);data.products.push({id:"status-product",name:"Produk Status",variant:"",sku:"",unitPrice:25000,unitCost:12000,active:true});await authenticate(page,{workspace:data});await page.goto("/app");await openBusiness(page,"Open PO");const row=page.getByRole("row").filter({hasText:"Produk Status"});await expect(row.locator(".product-status-active")).toHaveText("Aktif");await row.getByRole("button",{name:"Arsipkan produk Produk Status",exact:true}).click();const confirmation=page.getByRole("dialog",{name:"Arsipkan produk ini?"});await expect(confirmation).toBeVisible();await confirmation.getByRole("button",{name:"Batal",exact:true}).click();await expect(row.locator(".product-status-active")).toHaveText("Aktif");await row.getByRole("button",{name:"Arsipkan produk Produk Status",exact:true}).click();await confirmation.getByRole("button",{name:"Ya, arsipkan produk",exact:true}).click();await chooseOption(page.getByLabel("Filter produk"),"archived");await expect(row.locator(".product-status-archived")).toHaveText("Diarsipkan");await row.getByRole("button",{name:"Aktifkan kembali Produk Status",exact:true}).click();await page.getByRole("dialog",{name:"Aktifkan kembali produk ini?"}).getByRole("button",{name:"Ya, aktifkan kembali",exact:true}).click();await chooseOption(page.getByLabel("Filter produk"),"active");await expect(row.locator(".product-status-active")).toHaveText("Aktif");
});

test("mobile product archive action closes detail and confirms before saving",async({page})=>{
 await page.setViewportSize({width:390,height:844});const data=structuredClone(fixture);data.products.push({id:"archive-mobile",name:"Produk Arsip",variant:"",sku:"",unitPrice:25000,unitCost:12000,active:true});const requests=await authenticate(page,{workspace:data});await page.goto("/app");await openBusiness(page,"Open PO");await page.getByRole("button",{name:"Detail Produk Arsip",exact:true}).click();await page.getByRole("dialog",{name:"Detail Produk Arsip",exact:true}).getByRole("button",{name:"Arsipkan produk",exact:true}).click();await expect(page.getByRole("dialog",{name:"Detail Produk Arsip",exact:true})).toHaveCount(0);const confirmation=page.getByRole("dialog",{name:"Arsipkan produk ini?"});await expect(confirmation).toBeVisible();expect(requests).toHaveLength(0);await confirmation.getByRole("button",{name:"Ya, arsipkan produk",exact:true}).click();await chooseOption(page.getByLabel("Filter produk"),"archived");await expect(page.getByRole("button",{name:"Detail Produk Arsip",exact:true})).toContainText("Diarsipkan");expect(requests[0].p_data.products[0].active).toBe(false);
});

for(const mobileWidth of [320,390]) for(const mobileTheme of ["light","dark"]) test(`mobile compact lists ${mobileWidth} ${mobileTheme} open details and keep dashboard read only`,async({page})=>{
 await page.addInitScript(theme=>localStorage.setItem("tippo.theme.v1",theme),mobileTheme);
 const data=structuredClone(fixture);data.customers[0].address="Jakarta";data.products.push({id:"mobile-product",name:"Roti Mobile",variant:"Coklat",sku:"RM",category:"Makanan",unitPrice:25000,unitCost:12000,active:true});data.batches.push({...data.batches[0],id:"mobile-po",name:"PO Mobile",type:"po"});data.orders.push({id:"mobile-order",batchId:"trip",customerId:"aly",date:new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Jakarta"}),createdAt:new Date().toISOString(),status:"new",paid:10000,shippingCharge:0,serviceFee:0,notes:"",items:[{id:"mobile-item",productId:null,product:"Roti Mobile",variant:"",color:"",size:"",quantity:1,unitPrice:25000,unitCost:12000}]});await authenticate(page,{workspace:data});await page.setViewportSize({width:mobileWidth,height:844});await page.goto("/app");const recent=page.locator(".recent-card");await recent.getByRole("button",{name:"Detail Alya",exact:true}).click();let dialog=page.getByRole("dialog",{name:"Detail Alya",exact:true});await expect(dialog).toContainText(/15\.000/);await expect(dialog.getByRole("button",{name:/^Edit$|^Invoice$|^Refund$/})).toHaveCount(0);await dialog.getByRole("button",{name:"Tutup detail"}).click();
 async function nav(name:string){if(name==="Jastip"||name==="Open PO")await openBusiness(page,name);else await openSection(page,name);}
 await nav("Open PO");await page.getByRole("button",{name:"Detail Roti Mobile",exact:true}).click();dialog=page.getByRole("dialog",{name:"Detail Roti Mobile",exact:true});await expect(dialog).toContainText("Makanan");await dialog.screenshot({path:"docs/preview-mobile-product-detail.png"});await dialog.getByRole("button",{name:"Edit produk",exact:true}).click();await expect(page.getByRole("dialog",{name:"Edit produk",exact:true})).toBeVisible();await page.keyboard.press("Escape");await openSection(page,"Batch PO");await page.getByRole("button",{name:"Detail PO Mobile",exact:true}).click();await expect(page.getByRole("dialog",{name:"Detail PO Mobile"})).toContainText("Seoul");await page.keyboard.press("Escape");await nav("Jastip");await page.getByRole("button",{name:"Detail Jastip Seoul",exact:true}).click();await page.keyboard.press("Escape");await openSection(page,"Pesanan");await page.getByRole("button",{name:"Detail Alya",exact:true}).click();dialog=page.getByRole("dialog",{name:"Detail Alya",exact:true});await expect(dialog.getByRole("button",{name:"Edit",exact:true})).toBeVisible();await dialog.getByRole("button",{name:"Invoice",exact:true}).click();await expect(page.getByRole("dialog",{name:/Invoice/})).toBeVisible();await page.keyboard.press("Escape");await nav("Pelanggan");await page.getByRole("button",{name:"Detail Alya",exact:true}).click();dialog=page.getByRole("dialog",{name:"Detail Alya",exact:true});await expect(dialog).toContainText("Jakarta");await page.keyboard.press("Escape");await page.screenshot({path:"docs/preview-mobile-customer-list.png",fullPage:true});expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(mobileWidth);
});

test("new customers prepend and editing an older customer preserves order",async({page})=>{
 const requests=await authenticate(page);await page.goto("/app");await page.getByRole("navigation",{name:"Navigasi utama"}).getByRole("button",{name:"Pelanggan",exact:true}).click();await page.getByRole("button",{name:"Tambah pelanggan",exact:true}).click();let d=page.getByRole("dialog",{name:"Tambah pelanggan",exact:true});await d.getByLabel("Nama pelanggan",{exact:true}).fill("Pelanggan Baru");await d.getByRole("button",{name:"Simpan pelanggan",exact:true}).click();await expect(page.getByRole("table",{name:"Daftar pelanggan"}).locator("tbody tr").first()).toContainText("Pelanggan Baru");expect(requests[0].p_data.customers.map(c=>c.name)).toEqual(["Pelanggan Baru","Alya"]);await page.getByRole("button",{name:"Edit pelanggan Alya",exact:true}).click();d=page.getByRole("dialog",{name:"Edit pelanggan",exact:true});await d.getByLabel("Nama pelanggan",{exact:true}).fill("Alya Edit");await d.getByRole("button",{name:"Simpan pelanggan",exact:true}).click();await expect(page.getByRole("table",{name:"Daftar pelanggan"}).locator("tbody tr").first()).toContainText("Pelanggan Baru");expect(requests[1].p_data.customers.map(c=>c.name)).toEqual(["Pelanggan Baru","Alya Edit"]);
});

test("orders sort by creation time rather than editable transaction date",async({page})=>{
 const data=structuredClone(fixture);data.orders=[{id:"sort-old",batchId:"trip",customerId:"aly",date:"2026-10-10",createdAt:"2026-10-01T00:00:00Z",status:"new",paid:0,shippingCharge:0,serviceFee:0,notes:"",items:[{id:"sort-item-old",productId:null,product:"Pesanan Lama",variant:"",color:"",size:"",quantity:1,unitPrice:25000,unitCost:12000}]},{id:"sort-new",batchId:"trip",customerId:"aly",date:"2026-10-01",createdAt:"2026-10-10T00:00:00Z",status:"new",paid:0,shippingCharge:0,serviceFee:0,notes:"",items:[{id:"sort-item-new",productId:null,product:"Pesanan Baru",variant:"",color:"",size:"",quantity:1,unitPrice:25000,unitCost:12000}]}];await authenticate(page,{workspace:data});await page.goto("/app");await expect(page.locator(".recent-card tbody tr").first()).toContainText("Pesanan Baru");await openBusiness(page,"Jastip");await openSection(page,"Pesanan");await expect(page.locator(".orders-table tbody tr").first()).toContainText("Pesanan Baru");
});

for(const width of [320,1440])for(const theme of ["light","dark"])test(`unpaid dashboard ${width} ${theme} shows monthly balances without actions`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript(t=>localStorage.setItem("tippo.theme.v1",t),theme);
 const data=structuredClone(fixture),date=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Jakarta"});
 for(let i=0;i<9;i++){
  const id=`bill-${i}`;data.customers.push({id,name:i===5?"Pelanggan tagihan 5 dengan nama sangat panjang untuk layar ponsel":"Pelanggan tagihan "+i,phone:""});
  data.orders.push({id,batchId:"trip",customerId:id,date:i===8?"2025-01-01":date,createdAt:`2026-10-10T00:00:0${i}Z`,status:i===7?"cancelled":"new",paid:i===7?0:i===6?25000:5000,serviceFee:2000,shippingCharge:3000,notes:"",items:[{id:`item-${i}`,product:"Produk tagihan",productId:null,variant:"",color:"",size:"",quantity:2,unitPrice:10000,unitCost:5000}]});
 }
 await authenticate(page,{workspace:data});await page.goto("/app");const card=page.getByRole("region",{name:"Tagihan belum lunas"});
 await expect(card).toContainText("6 pesanan");await expect(card.locator("li")).toHaveCount(5);await expect(card.locator("li").first()).toContainText("Pelanggan tagihan 5");await expect(card.locator("li").first()).toContainText("Rp 20.000");await expect(card.locator(".unpaid-total")).toContainText("Rp 120.000");await expect(card).toContainText("Menampilkan 5 dari 6 tagihan terbaru.");await expect(card).not.toContainText("Pelanggan tagihan 6");await expect(card).not.toContainText("Pelanggan tagihan 7");await expect(card).not.toContainText("Pelanggan tagihan 8");await expect(card.getByRole("button")).toHaveCount(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
 await page.locator(".dashboard-middle").screenshot({path:`docs/preview-dashboard-bills-${width}-${theme}.png`});
});
for(const paid of [false,true])test(`unpaid dashboard distinguishes ${paid?"settled orders":"no orders"}`,async({page})=>{
 const data=structuredClone(fixture);
 if(paid)data.orders.push({id:"paid-order",batchId:"trip",customerId:"aly",date:new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Jakarta"}),createdAt:new Date().toISOString(),status:"done",paid:25000,serviceFee:0,shippingCharge:0,notes:"",items:[{id:"paid-item",product:"Produk lunas",productId:null,variant:"",color:"",size:"",quantity:1,unitPrice:25000,unitCost:12000}]});
 await authenticate(page,{workspace:data});await page.goto("/app");const card=page.getByRole("region",{name:"Tagihan belum lunas"});await expect(card).toContainText(paid?"Semua tagihan bulan ini sudah lunas.":"Belum ada tagihan bulan ini.");await expect(card.locator("li")).toHaveCount(0);
});

for(const mode of ["Jastip","Open PO"])for(const width of [390,1440])for(const theme of ["light","dark"])test(`order status dialog ${mode} ${width} ${theme} saves explicitly and keeps cancellation guard`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript(t=>localStorage.setItem("tippo.theme.v1",t),theme);const requests=await authenticate(page,{workspace:twoBusinessWorkspace()});await page.goto("/app");await expect(page.locator(".recent-card").getByRole("button",{name:/Ubah status/})).toHaveCount(0);await openBusiness(page,mode);await openSection(page,"Pesanan");
 const customer=mode==="Jastip"?"Alya":"Bima PO";
 async function openStatus(){if(width<760){await page.getByRole("button",{name:`Detail ${customer}`,exact:true}).click();await page.getByRole("dialog",{name:`Detail ${customer}`,exact:true}).getByRole("button",{name:"Ubah status",exact:true}).click();await expect(page.getByRole("dialog",{name:`Detail ${customer}`,exact:true})).toHaveCount(0);}else await page.getByRole("button",{name:/Ubah status pesanan/}).click();return page.getByRole("dialog",{name:"Ubah status pesanan",exact:true});}
 let dialog=await openStatus();await expect(dialog.getByRole("button",{name:"Simpan status"})).toBeDisabled();await dialog.getByRole("radio",{name:"Dikirim",exact:true}).check();expect(requests).toHaveLength(0);await dialog.getByRole("button",{name:"Batal",exact:true}).click();expect(requests).toHaveLength(0);dialog=await openStatus();await expect(dialog.getByRole("radio",{name:"Tercatat",exact:true})).toBeChecked();await dialog.getByRole("radio",{name:"Dibatalkan",exact:true}).check();await expect(dialog).toContainText("Catat refund seluruh pembayaran");await expect(dialog.getByRole("button",{name:"Simpan status"})).toBeDisabled();await dialog.getByRole("radio",{name:"Dikirim",exact:true}).check();await dialog.screenshot({path:`docs/preview-order-status-${mode==="Jastip"?"jastip":"po"}-${width}-${theme}.png`});await dialog.getByRole("button",{name:"Simpan status"}).click();await expect(dialog).toHaveCount(0);expect(requests).toHaveLength(1);expect(requests[0].p_data.orders.find(o=>o.id===(mode==="Jastip"?"jastip-business-order":"po-business-order"))?.status).toBe("shipped");expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
});

test("order status save failure keeps dialog and draft selection open",async({page})=>{
 await authenticate(page,{workspace:twoBusinessWorkspace(),failSave:true});await page.goto("/app");await openBusiness(page,"Jastip");await openSection(page,"Pesanan");await page.getByRole("button",{name:/Ubah status pesanan/}).click();const dialog=page.getByRole("dialog",{name:"Ubah status pesanan",exact:true});await dialog.getByRole("radio",{name:"Dikirim",exact:true}).check();await dialog.getByRole("button",{name:"Simpan status"}).click();await expect(dialog.getByRole("alert")).toContainText("Status belum tersimpan");await expect(dialog.getByRole("radio",{name:"Dikirim",exact:true})).toBeChecked();await expect(page.locator(".orders-table .order-status-new")).toHaveText("Tercatat");
});

test("unpaid order can be cancelled without changing its products or payments",async({page})=>{
 const data=twoBusinessWorkspace();data.orders[0].paid=0;data.orders[0].refunds=[];const requests=await authenticate(page,{workspace:data});await page.goto("/app");await openBusiness(page,"Jastip");await openSection(page,"Pesanan");await page.getByRole("button",{name:/Ubah status pesanan/}).click();const dialog=page.getByRole("dialog",{name:"Ubah status pesanan",exact:true});await dialog.getByRole("radio",{name:"Dibatalkan",exact:true}).check();await dialog.getByRole("button",{name:"Simpan status"}).click();await expect(dialog).toHaveCount(0);expect(requests[0].p_data.orders[0]).toEqual({...data.orders[0],status:"cancelled"});await expect(page.locator(".orders-table .order-status-cancelled")).toHaveText("Dibatalkan");
});

function twoBusinessWorkspace():AppData {
 const data=structuredClone(fixture),date=new Date().toLocaleDateString("en-CA",{timeZone:"Asia/Jakarta"});
 data.customers.push({id:"bima",name:"Bima PO",phone:""});
 data.batches.push({...data.batches[0],id:"po-business",type:"po",name:"PO Mingguan"});
 data.products.push({id:"po-product",name:"Produk PO",variant:"Coklat",sku:"PO-1",unitPrice:100000,unitCost:50000,active:true});
 data.orders.push({id:"jastip-business-order",batchId:"trip",customerId:"aly",date,createdAt:new Date().toISOString(),status:"new",paid:10000,refunds:[{id:"refund-jastip",amount:1000,date,reason:"Koreksi pembayaran",createdAt:new Date().toISOString()}],serviceFee:0,shippingCharge:0,notes:"",items:[{id:"jastip-business-item",product:"Titipan Jastip",productId:null,variant:"",color:"",size:"",quantity:1,unitPrice:25000,unitCost:12000}]});
 data.orders.push({id:"po-business-order",batchId:"po-business",customerId:"bima",date,createdAt:new Date().toISOString(),status:"new",paid:20000,serviceFee:0,shippingCharge:0,notes:"",items:[{id:"po-business-item",product:"Produk PO",productId:"po-product",variant:"Coklat",color:"",size:"",quantity:1,unitPrice:100000,unitCost:50000}]});
 return data;
}
for(const width of [320,768,1440])for(const theme of ["light","dark"])test(`business switch ${width} ${theme} scopes summaries navigation forms and remembers mode`,async({page})=>{
 await page.setViewportSize({width,height:1000});await page.addInitScript(t=>localStorage.setItem("tippo.theme.v1",t),theme);
 await authenticate(page,{workspace:twoBusinessWorkspace()});await page.goto("/app");
 await openNavigation(page);
 const switcher=page.getByRole("group",{name:"Pilih usaha"});await expect(switcher.getByRole("button",{name:"Jastip",exact:true})).toHaveAttribute("aria-pressed","true");await expect(page.getByRole("heading",{level:1})).toHaveText("Ringkasan Jastip.");await expect(page.locator(".stats-grid")).toContainText("Rp 25.000");await expect(page.locator(".payments-card")).toContainText("Rp 1.000");await expect(page.locator(".unpaid-card")).toContainText("Alya");await expect(page.locator(".recent-card")).not.toContainText("Produk PO");await expect(page.locator(".batch-preview")).not.toContainText("PO Mingguan");await expect(page.locator(".quota-banner")).toContainText("Jastip 1 / 5");
 await openSection(page,"HPP & Margin");const hpp=page.getByLabel("Pilih batch untuk HPP");await hpp.click();await expect(page.getByRole("option",{name:"Jastip Seoul",exact:true})).toBeVisible();await expect(page.getByRole("option",{name:"PO Mingguan",exact:true})).toHaveCount(0);await page.keyboard.press("Escape");
 const jastipAccent=await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue("--primary"));
 await openNavigation(page);
 await switcher.getByRole("button",{name:"Open PO",exact:true}).focus();await page.keyboard.press("Enter");await expect(page.getByRole("heading",{level:1})).toHaveText("Ringkasan Open PO.");await expect(page.locator(".stats-grid")).toContainText("Rp 100.000");await expect(page.locator(".payments-card")).not.toContainText("Refund pesanan bulan ini");await expect(page.locator(".unpaid-card")).toContainText("Bima PO");await expect(page.locator(".unpaid-card")).not.toContainText("Alya");await expect(page.locator(".recent-card")).not.toContainText("Titipan Jastip");await expect(page.locator(".quota-banner")).toContainText("Open PO 1 / 5");expect(await page.evaluate(()=>getComputedStyle(document.documentElement).getPropertyValue("--primary"))).not.toBe(jastipAccent);await expect(page.locator(".current-month-chart")).toHaveAttribute("aria-label",/100\.000.*50\.000/);
 await page.screenshot({path:`docs/preview-business-po-${width}-${theme}.png`,fullPage:true});
 await openSection(page,"HPP & Margin");await hpp.click();await expect(page.getByRole("option",{name:"PO Mingguan",exact:true})).toBeVisible();await expect(page.getByRole("option",{name:"Jastip Seoul",exact:true})).toHaveCount(0);await page.keyboard.press("Escape");
 await openSection(page,"Pesanan");await page.getByRole("button",{name:"Pesanan PO baru",exact:true}).click();const form=page.getByRole("dialog",{name:"Pesanan PO baru",exact:true});await expect(form).toBeVisible();await expect(form.getByLabel("Batch PO",{exact:true})).toHaveAttribute("data-value","po-business");await page.keyboard.press("Escape");
 await page.reload();await openNavigation(page);await expect(switcher.getByRole("button",{name:"Open PO",exact:true})).toHaveAttribute("aria-pressed","true");await expect(page.getByRole("heading",{level:1})).toHaveText("Ringkasan Open PO.");await switcher.getByRole("button",{name:"Jastip",exact:true}).click();await expect(page.locator(".recent-card")).toContainText("Titipan Jastip");await openSection(page,"Pesanan");await page.getByRole("button",{name:"Pesanan jastip baru",exact:true}).click();await expect(page.getByRole("dialog",{name:"Pesanan jastip baru",exact:true})).toBeVisible();await page.keyboard.press("Escape");await openSection(page,"Ringkasan");expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
 await page.screenshot({path:`docs/preview-business-jastip-${width}-${theme}.png`,fullPage:true});
});
test("HPP save in one business preserves the other business transactions",async({page})=>{
 const original=twoBusinessWorkspace(),requests=await authenticate(page,{workspace:original});await page.goto("/app");await openSection(page,"HPP & Margin");await page.getByRole("button",{name:"Simpan harga beli",exact:true}).click();await expect.poll(()=>requests.length).toBe(1);expect(requests[0].p_data.orders.find(o=>o.id==="po-business-order")).toEqual(original.orders.find(o=>o.id==="po-business-order"));expect(requests[0].p_data.batches).toEqual(original.batches);expect(requests[0].p_data.products).toEqual(original.products);
});

test("Pro historical month and annual chart stay scoped when switching business",async({page})=>{
 const data=twoBusinessWorkspace();
 for(const order of [...data.orders])data.orders.push({...order,id:order.id+"-old",date:"2025-01-10",createdAt:"2025-01-10T00:00:00Z",paid:0,refunds:[],items:order.items.map(item=>({...item,id:item.id+"-old",unitPrice:order.batchId==="trip"?30000:90000,unitCost:order.batchId==="trip"?8000:60000}))});
 await authenticate(page,{workspace:data,pro:true});await page.goto("/app");await chooseOption(page.getByLabel("Pilih bulan ringkasan"),"2025-01");await expect(page.locator(".stats-grid")).toContainText("Rp 30.000");await expect(page.locator(".chart-summary")).toContainText("Rp 30.000");await expect(page.locator(".monthly-chart svg")).toHaveAttribute("aria-label",/30\.000.*8\.000/);
 await page.getByRole("group",{name:"Pilih usaha"}).getByRole("button",{name:"Open PO",exact:true}).click();await expect(page.getByLabel("Pilih bulan ringkasan")).toHaveAttribute("data-value","2025-01");await expect(page.locator(".stats-grid")).toContainText("Rp 90.000");await expect(page.locator(".chart-summary")).toContainText("Rp 90.000");await expect(page.locator(".monthly-chart svg")).toHaveAttribute("aria-label",/90\.000.*60\.000/);await expect(page.locator(".unpaid-card")).toContainText("Bima PO");await expect(page.locator(".unpaid-card")).not.toContainText("Alya");
});

test("Pro keeps the chosen historical month visible when the other business has no data that year",async({page})=>{
 const data=twoBusinessWorkspace(),source=data.orders[0];data.orders.push({...source,id:"old-jastip-only",date:"2024-01-10",createdAt:"2024-01-10T00:00:00Z",refunds:[],paid:0,items:source.items.map(item=>({...item,id:"old-jastip-only-item"}))});await authenticate(page,{workspace:data,pro:true});await page.goto("/app");await chooseOption(page.getByLabel("Pilih bulan ringkasan"),"2024-01");await page.getByRole("group",{name:"Pilih usaha"}).getByRole("button",{name:"Open PO",exact:true}).click();await expect(page.getByLabel("Pilih bulan ringkasan")).toHaveAttribute("data-value","2024-01");await expect(page.getByLabel("Pilih bulan ringkasan")).toContainText("Januari 2024");await expect(page.locator(".unpaid-card")).toContainText("Belum ada tagihan bulan ini.");await expect(page.locator(".stats-grid .stat-value").first()).toContainText("Rp 0");
});

for (const [business,width] of [["Open PO",1440],["Jastip",1440],["Open PO",390],["Jastip",390]] as const) {
 test(`batch status advances irreversibly with confirmation ${business} ${width}`, async ({page}) => {
  await page.setViewportSize({width,height:900});
  const data=twoBusinessWorkspace(), requests=await authenticate(page,{workspace:data});
  await page.goto("/app");await openBusiness(page,business);
  if(width<600)await page.evaluate(()=>{localStorage.setItem("tippo.theme.v1","dark");document.documentElement.dataset.theme="dark";});
  if(business==="Open PO")await openSection(page,"Batch PO");
  const batch=data.batches.find(b=>b.type===(business==="Open PO"?"po":"jastip"))!;
  const openStatus=async()=>{
   if(width<600)await page.getByRole("button",{name:`Detail ${batch.name}`,exact:true}).click();
   const label=requests.length===0?"Tutup batch":"Selesaikan batch";
   const action=page.getByRole("button",{name:`${label} ${batch.name}`,exact:true});
   await expect(action).toHaveAttribute("title",label);await action.click();
  };
  await openStatus();const dialog=page.getByRole("dialog",{name:business==="Open PO"?"Ubah status batch PO":"Ubah status perjalanan",exact:true});
  await expect(dialog.getByRole("button",{name:"Batal",exact:true})).toBeFocused();
  await page.mouse.click(2,2);await expect(dialog).toBeVisible();
  await expect(dialog).toContainText("tidak bisa dibuka kembali");await expect(dialog.locator(".batch-status-flow")).toHaveText("DibukaDitutup");
  await dialog.getByRole("button",{name:"Batal",exact:true}).click();expect(requests).toHaveLength(0);
  await openStatus();await dialog.getByRole("button",{name:"Simpan perubahan",exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(requests[0].p_data.batches.find(b=>b.id===batch.id)!.status).toBe("closed");expect(requests[0].p_data.orders).toEqual(data.orders);
  await openStatus();await expect(dialog.locator(".batch-status-flow")).toHaveText("DitutupSelesai");await expect(dialog).toContainText("tidak bisa diubah lagi");
  await page.screenshot({path:`docs/preview-batch-status-${business==="Open PO"?"po":"jastip"}-${width}.png`});
  await dialog.getByRole("button",{name:"Simpan perubahan",exact:true}).click();await expect(dialog).toHaveCount(0);
  expect(requests[1].p_data.batches.find(b=>b.id===batch.id)!.status).toBe("completed");
  if(width<600)await page.getByRole("button",{name:`Detail ${batch.name}`,exact:true}).click();
  await expect(page.getByRole("button",{name:new RegExp(`^(Tutup batch|Selesaikan batch) ${batch.name}$`)})).toHaveCount(0);
  await expect(page.getByRole("img",{name:`Status terkunci ${batch.name}`,exact:true})).toHaveCount(0);
  const actions=width<600?page.getByRole("dialog",{name:`Detail ${batch.name}`,exact:true}).locator(".modal-body"):page.getByRole("row").filter({hasText:batch.name}).locator(".management-actions");
  await expect(actions.getByRole("button")).toHaveCount(1);await expect(actions.getByRole("button",{name:width<600?"Edit batch":`Edit batch ${batch.name}`,exact:true})).toBeVisible();
  await page.screenshot({path:`docs/preview-batch-locked-${business==="Open PO"?"po":"jastip"}-${width}.png`});
  if(width<600)await page.getByRole("button",{name:"Tutup detail",exact:true}).click();
  await page.reload();await expect(page.getByRole("heading",{name:`Ringkasan ${business}.`,exact:true})).toBeVisible();
  await openSection(page,business==="Open PO"?"Batch PO":"Perjalanan");
  await expect(page.getByRole("button",{name:new RegExp(`^(Tutup batch|Selesaikan batch) ${batch.name}$`)})).toHaveCount(0);
  expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
 });
}

test("batch status confirmation stays open when cloud saving fails",async({page})=>{
 const requests=await authenticate(page,{failSave:true});await page.goto("/app");await openBusiness(page,"Jastip");
 await page.getByRole("button",{name:"Tutup batch Jastip Seoul",exact:true}).click();
 const dialog=page.getByRole("dialog",{name:"Ubah status perjalanan",exact:true});
 await dialog.getByRole("button",{name:"Simpan perubahan",exact:true}).click();
 await expect(dialog.getByRole("alert")).toHaveText("Status belum tersimpan. Coba lagi.");
 expect(requests).toHaveLength(1);await dialog.getByRole("button",{name:"Batal",exact:true}).click();
 await expect(page.getByRole("table",{name:"Daftar perjalanan Jastip"}).getByText("Dibuka",{exact:true})).toBeVisible();
});

for (const [width,pro] of [[1440,false],[390,false],[1440,true],[390,true]] as const) {
 test(`Pro invoice draft persists and exports without activating payment ${width} ${pro}`,async({page,context})=>{
  await context.grantPermissions(["clipboard-read","clipboard-write"]);
  await page.setViewportSize({width,height:1000});
  if(width<600)await page.addInitScript(()=>localStorage.setItem("tippo.theme.v1","dark"));
  const requests=await authenticate(page,{pro});await page.goto("/app");await openSection(page,"Paket & langganan");
  const panel=page.getByRole("region",{name:"Invoice langganan Pro",exact:true});
  await panel.getByRole("button",{name:"Buat draf invoice Pro",exact:true}).click();
  await expect(panel).toContainText("Titipan Naya");await expect(panel).toContainText("naya@example.test");await expect(panel).toContainText("Rp25.000");
  const id=await panel.locator("dd").first().innerText();expect(id).toMatch(/^INV-PRO-\d{8}-[A-F0-9]{16}$/);
  const date=await panel.locator("dd").nth(1).innerText();expect(date).toMatch(/\d{1,2} [A-Za-z]+ \d{4}.*WIB/);
  await panel.getByRole("button",{name:"Salin invoice",exact:true}).click();
  await expect.poll(()=>page.evaluate(()=>navigator.clipboard.readText())).toContain("Ini bukan bukti pembayaran.");
  const downloadPromise=page.waitForEvent("download");await panel.getByRole("button",{name:"Unduh invoice (.txt)",exact:true}).click();
  const download=await downloadPromise;expect(download.suggestedFilename()).toBe(`${id}.txt`);
  const body=await readFile((await download.path())!,"utf8");expect(body).toContain(id);expect(body).toContain("Total: Rp25.000");
  await page.reload();await openSection(page,"Paket & langganan");await expect(panel.locator("dd").first()).toHaveText(id);await expect(panel.locator("dd").nth(1)).toHaveText(date);
  await expect(panel.getByRole("button",{name:"Buat draf invoice Pro",exact:true})).toHaveCount(0);
  await expect(page.getByRole("region",{name:"Paket aktif",exact:true})).toContainText(pro?"Paketmu: Pro":"Paketmu: Gratis");
  expect(requests).toHaveLength(0);expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
  await panel.screenshot({path:`docs/preview-pro-invoice-${width}-${pro?"pro":"free"}.png`});
 });
}

test("Pro invoice copy failure offers download without changing entitlement",async({page})=>{
 const requests=await authenticate(page);await page.goto("/app");await openSection(page,"Paket & langganan");
 const panel=page.getByRole("region",{name:"Invoice langganan Pro",exact:true});await panel.getByRole("button",{name:"Buat draf invoice Pro",exact:true}).click();
 await page.evaluate(()=>Object.defineProperty(navigator,"clipboard",{value:{writeText:async()=>{throw new Error("Denied");}},configurable:true}));
 await panel.getByRole("button",{name:"Salin invoice",exact:true}).click();await expect(panel.getByRole("alert")).toContainText("Gunakan Unduh invoice");
 await expect(panel.getByRole("button",{name:"Unduh invoice (.txt)",exact:true})).toBeEnabled();expect(requests).toHaveLength(0);
});

test("Pro invoice handles blocked browser storage without claiming a saved draft",async({page})=>{
 await authenticate(page);await page.addInitScript(()=>{const original=Storage.prototype.setItem;Storage.prototype.setItem=function(key,value){if(key.startsWith("tippo.pro-invoice.draft.v1."))throw new Error("Blocked");return original.call(this,key,value);};});
 await page.goto("/app");await openSection(page,"Paket & langganan");const panel=page.getByRole("region",{name:"Invoice langganan Pro",exact:true});
 await panel.getByRole("button",{name:"Buat draf invoice Pro",exact:true}).click();await expect(panel.getByRole("alert")).toContainText("Draf belum tersimpan");await expect(panel.locator("dl")).toHaveCount(0);
});

for (const width of [1440,390]) {
 test(`feedback sends authenticated input without changing workspace ${width}`,async({page})=>{
  await page.setViewportSize({width,height:1000});if(width<600)await page.addInitScript(()=>localStorage.setItem("tippo.theme.v1","dark"));
  const saves=await authenticate(page),feedback:Record<string,string>[]=[];
  await page.route(`${endpoint}/rest/v1/rpc/submit_tippo_feedback`,async route=>{const body=route.request().postDataJSON();feedback.push(body);await new Promise(resolve=>setTimeout(resolve,200));await route.fulfill({json:{id:body.p_id,createdAt:new Date().toISOString()}});});
  await page.goto("/app");await openSection(page,"Kritik & saran");
  await expect(page.getByLabel("Jenis masukan",{exact:true})).toHaveText("Pilih jenis masukan");
  await expect(page.getByLabel("Bagian Tippo",{exact:true})).toHaveText("Pilih bagian Tippo");
  await page.getByLabel("Judul",{exact:true}).fill("Filter pelanggan");await page.getByLabel("Pesan",{exact:true}).fill("Tambahkan filter pelanggan di daftar pesanan PO.");
  await page.getByRole("button",{name:"Kirim masukan",exact:true}).click();
  await expect(page.getByRole("region",{name:"Form kritik dan saran"}).getByRole("alert")).toHaveText("Pilih jenis masukan.");expect(feedback).toHaveLength(0);
  await chooseOption(page.getByLabel("Jenis masukan",{exact:true}),"issue");
  await page.getByRole("button",{name:"Kirim masukan",exact:true}).click();
  await expect(page.getByRole("region",{name:"Form kritik dan saran"}).getByRole("alert")).toHaveText("Pilih bagian Tippo.");expect(feedback).toHaveLength(0);
  await chooseOption(page.getByLabel("Bagian Tippo",{exact:true}),"po");
  await page.getByLabel("Judul",{exact:true}).fill(" Filter pelanggan ");await page.getByLabel("Pesan",{exact:true}).fill(" Tambahkan filter pelanggan di daftar pesanan PO. ");
  await page.getByRole("region",{name:"Form kritik dan saran",exact:true}).screenshot({path:`docs/preview-feedback-${width}.png`});
  await page.getByRole("button",{name:"Kirim masukan",exact:true}).click();await expect(page.getByRole("button",{name:"Mengirim…",exact:true})).toBeDisabled();
  await expect(page.getByRole("status",{name:"Masukan terkirim",exact:true})).toBeVisible();expect(feedback).toHaveLength(1);expect(feedback[0]).toMatchObject({p_category:"issue",p_area:"po",p_subject:"Filter pelanggan",p_message:"Tambahkan filter pelanggan di daftar pesanan PO."});expect(feedback[0]).not.toHaveProperty("owner_id");expect(saves).toHaveLength(0);
  await page.getByRole("button",{name:"Kirim masukan lain",exact:true}).click();await expect(page.getByLabel("Judul",{exact:true})).toBeFocused();await expect(page.getByLabel("Pesan",{exact:true})).toHaveValue("");expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
 });
}
for (const [business,width] of [["Jastip",1440],["Open PO",1440],["Jastip",390],["Open PO",390],["Jastip",320],["Open PO",320]] as const) test(`order discounts persist and validate ${business} ${width}`,async({page})=>{
  const data=structuredClone(fixture);
  data.batches.push({id:"discount-po",name:"PO Diskon",type:"po",origin:"",closeDate:"2026-12-01",status:"open",directCosts:0});
  data.products.push({id:"discount-product",name:"Roti Diskon",variant:"",sku:"DIS",unitPrice:25000,unitCost:12000,active:true});
  const requests=await authenticate(page,{workspace:data});
  await page.setViewportSize({width,height:1000}); await page.goto("/app"); await openBusiness(page,business); await openSection(page,"Pesanan");
  await page.getByRole("button",{name:business==="Jastip"?"Pesanan jastip baru":"Pesanan PO baru",exact:true}).click();
  let form=page.getByRole("dialog",{name:business==="Jastip"?"Pesanan jastip baru":"Pesanan PO baru",exact:true});
  const date=form.locator('input[type="date"]');
  await expect(date).toHaveValue("");
  await expect(form.getByLabel("Pelanggan",{exact:true})).toHaveAttribute("data-value", "");
  await expect(form.getByLabel("Pelanggan",{exact:true})).toHaveText("Pilih pelanggan");
  await expect(form.getByLabel("Jumlah barang",{exact:true})).toHaveValue("");
  await expect(form.getByRole("button",{name:/^Tutup formulir pesanan/})).toBeFocused();
  await expect(page.getByRole("listbox")).toHaveCount(0);
  if(width<600) {
    const customerPlaceholder=form.getByLabel("Pelanggan",{exact:true}).locator('span').first();
    expect(await customerPlaceholder.evaluate(element=>element.scrollWidth<=element.clientWidth+1)).toBe(true);
    await form.locator('.order-context').screenshot({path:`docs/preview-empty-order-context-${business==="Jastip"?"jastip":"po"}-${width}.png`});
    await expect(form.getByLabel("Jumlah barang",{exact:true})).toHaveAttribute("placeholder","Contoh: 2");
  }
  await date.fill(""); await expect(form.locator('.date-picker-display')).toHaveText("Pilih tanggal");
  if(width===1440) {
    await date.click({position:{x:8,y:20}});
    await page.keyboard.press("Escape");
    await expect(form).toBeVisible();
  }
  await date.evaluate(element=>{Object.defineProperty(element,"showPicker",{value:()=>{element.setAttribute("data-picker-calls",String(Number(element.getAttribute("data-picker-calls")??0)+1));}});});
  await date.click({position:{x:8,y:20}}); await expect(date).toHaveAttribute("data-picker-calls","1");
  await date.press("Enter"); await expect(date).toHaveAttribute("data-picker-calls","2");
  await date.press("Backspace"); await page.keyboard.type("20261011"); await expect(date).toHaveValue("");
  await date.fill("2026-10-11"); await expect(form.locator('.date-picker-display')).toHaveText("11/10/2026");
  await chooseOption(form.getByLabel("Pelanggan",{exact:true}),"new");
  await expect(form.getByLabel("Alamat (opsional)",{exact:true})).toHaveAttribute("placeholder","Alamat lengkap pelanggan");
  await expect(form.getByLabel("Jumlah barang",{exact:true})).toHaveAttribute("placeholder","Contoh: 2");
  if(width<600) {
    await date.fill("");
    const placeholderFits=await form.locator('.date-picker-display > span').evaluate(element=>element.scrollWidth<=element.clientWidth+1);
    expect(placeholderFits).toBe(true);
    await form.locator('.order-context').screenshot({path:`docs/preview-mobile-placeholders-${business==="Jastip"?"jastip":"po"}-${width}.png`});
    await date.fill("2026-10-11");
  }
  await chooseOption(form.getByLabel("Pelanggan",{exact:true}),"aly");
  if(business==="Jastip") {
    await form.getByLabel("Nama barang",{exact:true}).fill("Roti Diskon");
    await form.getByLabel("Harga jual / barang",{exact:true}).fill("25000");
    await form.getByLabel("Harga beli / barang",{exact:true}).fill("12000");
  } else {
    await chooseOption(form.getByLabel("Pelanggan",{exact:true}),"aly");
    await chooseOption(form.getByLabel("Produk",{exact:true}),"discount-product");
    await form.locator('input[type="date"]').fill("2026-10-11");
  }
  await form.getByLabel("Jumlah barang",{exact:true}).fill("2");
  await form.locator('input[name="shippingCharge"]').fill("5000");
  await chooseOption(form.getByLabel("Jenis diskon",{exact:true}),"percent");
  await form.getByLabel("Diskon",{exact:true}).fill("101");
  await expect(form.getByLabel("Diskon",{exact:true})).toHaveValue("100"); expect(requests).toHaveLength(0);
  await form.getByLabel("Diskon",{exact:true}).fill("10");
  await expect(form.locator(".payment-total")).toContainText("50.000");
  await form.getByRole("button",{name:"Lunas",exact:true}).click();
  await expect(form.locator('input[name="paid"]')).toHaveValue("50.000");
  if(width<600) {
    const layout=await form.evaluate(element=>{
      const paid=element.querySelector('input[name="paid"]')!.getBoundingClientRect();
      const field=element.querySelector('.payment-field')!.getBoundingClientRect();
      const buttons=Array.from(element.querySelectorAll('.payment-shortcuts button')).map(button=>button.getBoundingClientRect());
      const date=element.querySelector('input[type="date"]')!.getBoundingClientRect();
      const dateField=element.querySelector('input[type="date"]')!.closest('.field')!.getBoundingClientRect();
      const cells=element.querySelectorAll('.summary-strip .summary-cell');
      return {paidWidth:paid.width,fieldWidth:field.width,buttonWidths:buttons.map(b=>b.width),below:buttons[0].top>=paid.bottom,stacked:buttons[1].top>=buttons[0].bottom,dateFits:date.right<=dateField.right+1&&date.left>=dateField.left-1,hppAbove:cells[1].getBoundingClientRect().top<cells[0].getBoundingClientRect().top};
    });
    expect(Math.abs(layout.paidWidth-layout.fieldWidth)).toBeLessThan(1);
    for(const buttonWidth of layout.buttonWidths) expect(Math.abs(buttonWidth-layout.fieldWidth)).toBeLessThan(1);
    expect(layout.below&&layout.stacked&&layout.dateFits&&layout.hppAbove).toBe(true);
    expect(await page.evaluate(()=>document.documentElement.scrollWidth)).toBe(width);
    await form.locator('.order-payment').screenshot({path:`docs/preview-mobile-payment-${business==="Jastip"?"jastip":"po"}-${width}.png`});
    await form.locator('.order-context').screenshot({path:`docs/preview-mobile-order-context-${business==="Jastip"?"jastip":"po"}-${width}.png`});
  }
  await form.locator(".order-discount-fields").locator("..").screenshot({path:`docs/preview-discount-${business==="Jastip"?"jastip":"po"}-${width}.png`});
  await form.getByRole("button",{name:"Simpan pesanan",exact:true}).click(); await expect(form).toHaveCount(0);
  expect(requests[0].p_data.orders[0].discount).toEqual({type:"percent",value:10}); expect(requests[0].p_data.orders[0].paid).toBe(50000);
  await page.reload(); await openSection(page,"Pesanan");
  if(width<600) {
    await page.getByRole("button",{name:"Detail Alya",exact:true}).click();
    await page.getByRole("dialog",{name:"Detail Alya",exact:true}).getByRole("button",{name:"Edit",exact:true}).click();
  } else await page.getByRole("button",{name:"Edit pesanan Roti Diskon",exact:true}).click();
  form=page.getByRole("dialog",{name:business==="Jastip"?"Edit pesanan jastip":"Edit pesanan PO",exact:true});
  await expect(form.getByLabel("Diskon",{exact:true})).toHaveValue("10");
  await chooseOption(form.getByLabel("Jenis diskon",{exact:true}),"amount");
  await expect(form.getByLabel("Diskon",{exact:true})).toHaveValue("");
  await form.getByLabel("Diskon",{exact:true}).fill("55001");
  await expect(form.getByLabel("Diskon",{exact:true})).toHaveValue("55.000");
  expect(requests).toHaveLength(1);
  await expect(form.locator(".payment-total")).toContainText("Rp 0");
  await expect(form.getByRole("button",{name:"Lunas",exact:true})).toBeDisabled();
  await expect(form.getByRole("button",{name:"Bayar sebagian",exact:true})).toBeDisabled();
  await form.locator('input[name="shippingCharge"]').fill("0");
  await expect(form.getByLabel("Diskon",{exact:true})).toHaveValue("50.000");
  await form.getByLabel("Jumlah barang",{exact:true}).fill("1");
  await expect(form.getByLabel("Diskon",{exact:true})).toHaveValue("25.000");
  await form.getByLabel("Jumlah barang",{exact:true}).fill("2");
  await form.locator('input[name="shippingCharge"]').fill("5000");
  await form.getByLabel("Diskon",{exact:true}).fill("10000");
  await form.getByRole("button",{name:"Simpan pesanan",exact:true}).click();
  await expect(form.getByText("Pembayaran tidak boleh melebihi total tagihan setelah diskon.",{exact:true})).toBeVisible();
  expect(requests).toHaveLength(1);
  await form.getByRole("button",{name:"Lunas",exact:true}).click();
  await form.getByRole("button",{name:"Simpan pesanan",exact:true}).click(); await expect(form).toHaveCount(0);
  expect(requests[1].p_data.orders[0].discount).toEqual({type:"amount",value:10000}); expect(requests[1].p_data.orders[0].paid).toBe(45000);
});

for(const business of ["Jastip","Open PO"] as const) test(`mobile dialogs lock background and restore scroll ${business}`,async({page})=>{
  const data=twoBusinessWorkspace(); const source=data.orders.find(o=>data.batches.find(b=>b.id===o.batchId)?.type===(business==="Jastip"?"jastip":"po"))!;
  data.orders=Array.from({length:24},(_,i)=>({...source,id:`scroll-order-${i}`,items:source.items.map((item,j)=>({...item,id:`scroll-item-${i}-${j}`}))}));
  await authenticate(page,{workspace:data,pro:true}); await page.setViewportSize({width:390,height:700});
  await page.goto("/app"); await openBusiness(page,business); await openSection(page,"Pesanan");
  const row=page.locator("main .mobile-data-row").nth(10); await row.scrollIntoViewIfNeeded();
  const original=await page.evaluate(()=>window.scrollY); expect(original).toBeGreaterThan(0);
  await row.click(); let dialog=page.getByRole("dialog"); await expect(dialog).toBeVisible();
  await expect(page.locator("body")).toHaveCSS("position","fixed");
  await expect(page.locator("body")).toHaveCSS("top",`${-original}px`);
  await page.mouse.move(2,690); await page.mouse.wheel(0,600);
  await expect(page.locator("body")).toHaveCSS("top",`${-original}px`);
  await dialog.getByRole("button",{name:"Edit",exact:true}).click();
  dialog=page.getByRole("dialog",{name:business==="Jastip"?"Edit pesanan jastip":"Edit pesanan PO",exact:true});
  await expect(dialog).toBeVisible(); await expect(page.locator("body")).toHaveCSS("position","fixed");
  await expect(page.locator("body")).toHaveCSS("top",`${-original}px`);
  await dialog.evaluate(element=>{element.scrollTop=0;});
  await page.mouse.move(195,350); await page.mouse.wheel(0,600);
  await expect.poll(()=>dialog.evaluate(element=>element.scrollTop)).toBeGreaterThan(0);
  await expect(page.locator("body")).toHaveCSS("top",`${-original}px`);
  await dialog.getByRole("button",{name:/^Tutup formulir pesanan/}).click();
  await expect(dialog).toHaveCount(0);
  await expect.poll(()=>page.evaluate(()=>document.body.style.position)).toBe("");
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBe(original);
  await page.mouse.move(195,350); await page.mouse.wheel(0,300);
  await expect.poll(()=>page.evaluate(()=>window.scrollY)).toBeGreaterThan(original);
});

test("feedback failure retains input and retries with the same request id",async({page})=>{
 await authenticate(page);const ids:string[]=[];
 await page.route(`${endpoint}/rest/v1/rpc/submit_tippo_feedback`,async route=>{const body=route.request().postDataJSON();ids.push(body.p_id);if(ids.length===1)return route.fulfill({status:404,json:{code:"PGRST202",message:"schema cache"}});return route.fulfill({json:{id:body.p_id,createdAt:new Date().toISOString()}});});
 await page.goto("/app");await openSection(page,"Kritik & saran");await chooseOption(page.getByLabel("Jenis masukan",{exact:true}),"suggestion");await chooseOption(page.getByLabel("Bagian Tippo",{exact:true}),"general");await page.getByLabel("Judul",{exact:true}).fill("Saran baru");await page.getByLabel("Pesan",{exact:true}).fill("Tolong tambahkan pencarian untuk pelanggan.");await page.getByRole("button",{name:"Kirim masukan",exact:true}).click();await expect(page.getByRole("region",{name:"Form kritik dan saran",exact:true}).getByRole("alert")).toContainText("mengaktifkan database kritik & saran");await expect(page.getByLabel("Pesan",{exact:true})).toHaveValue("Tolong tambahkan pencarian untuk pelanggan.");await page.getByRole("button",{name:"Kirim masukan",exact:true}).click();await expect(page.getByRole("status",{name:"Masukan terkirim",exact:true})).toBeVisible();expect(ids).toHaveLength(2);expect(ids[0]).toBe(ids[1]);
});

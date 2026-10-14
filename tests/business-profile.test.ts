import {test} from "node:test";
import assert from "node:assert/strict";
import {readBusinessProfile,validateBusinessProfile} from "../src/lib/business-profile.ts";

test("business profile trims fields and permits optional contact information",()=>{
  assert.deepEqual(validateBusinessProfile({name:"  Tippo Uji  ",phone:" 0812 ",address:"  Jalan Melati\nBandung  "}),{name:"Tippo Uji",phone:"0812",address:"Jalan Melati\nBandung",invoiceStoreName:"",invoicePrefix:"INV"});
  assert.deepEqual(validateBusinessProfile({name:"Tippo Uji",phone:"",address:""}),{name:"Tippo Uji",phone:"",address:"",invoiceStoreName:"",invoicePrefix:"INV"});
  for(const profile of [{name:"   ",phone:"",address:""},{name:"x".repeat(121),phone:"",address:""},{name:"Uji",phone:"x".repeat(31),address:""},{name:"Uji",phone:"",address:"x".repeat(1001)}])assert.throws(()=>validateBusinessProfile(profile));
});

test("malformed stored business metadata falls back without importing other properties",()=>{
  assert.deepEqual(readBusinessProfile({name:{unexpected:true},phone:42,address:null,tier:"pro"}),{name:"Usaha kamu",phone:"",address:"",invoiceStoreName:"",invoicePrefix:"INV"});
  assert.deepEqual(readBusinessProfile(null,"Usaha demo"),{name:"Usaha demo",phone:"",address:"",invoiceStoreName:"",invoicePrefix:"INV"});
  assert.deepEqual(readBusinessProfile({name:"Uji",phone:"",address:"Bandung",tier:"pro"}),{name:"Uji",phone:"",address:"Bandung",invoiceStoreName:"",invoicePrefix:"INV"});
});


test("invoice identity validates and normalizes independently from business name",()=>{
 const profile={name:"Usaha Akun",phone:"",address:"",invoiceStoreName:"  Toko Naya  ",invoicePrefix:"  naya/2026  "};
 assert.deepEqual(validateBusinessProfile(profile),{...profile,invoiceStoreName:"Toko Naya",invoicePrefix:"NAYA/2026"});
 assert.equal(readBusinessProfile({name:"Usaha Akun"}).invoiceStoreName,"");
 for(const invoicePrefix of ["", "A".repeat(21), "INV\nStatus: Lunas", "INV SPACE", "*INV*"])assert.throws(()=>validateBusinessProfile({...profile,invoicePrefix}));
 assert.throws(()=>validateBusinessProfile({...profile,invoiceStoreName:"x".repeat(121)}));
 const fallback=readBusinessProfile({name:"Usaha Akun",invoiceStoreName:42,invoicePrefix:"INV\nStatus: Lunas"});
 assert.equal(fallback.invoiceStoreName,"");assert.equal(fallback.invoicePrefix,"INV");
});

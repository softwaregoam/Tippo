import {test} from "node:test";
import assert from "node:assert/strict";
import {readBusinessProfile,validateBusinessProfile} from "../src/lib/business-profile.ts";

test("business profile trims fields and permits optional contact information",()=>{
  assert.deepEqual(validateBusinessProfile({name:"  Tippo Uji  ",phone:" 0812 ",address:"  Jalan Melati\nBandung  "}),{name:"Tippo Uji",phone:"0812",address:"Jalan Melati\nBandung"});
  assert.deepEqual(validateBusinessProfile({name:"Tippo Uji",phone:"",address:""}),{name:"Tippo Uji",phone:"",address:""});
  for(const profile of [{name:"   ",phone:"",address:""},{name:"x".repeat(121),phone:"",address:""},{name:"Uji",phone:"x".repeat(31),address:""},{name:"Uji",phone:"",address:"x".repeat(1001)}])assert.throws(()=>validateBusinessProfile(profile));
});

test("malformed stored business metadata falls back without importing other properties",()=>{
  assert.deepEqual(readBusinessProfile({name:{unexpected:true},phone:42,address:null,tier:"pro"}),{name:"Usaha kamu",phone:"",address:""});
  assert.deepEqual(readBusinessProfile(null,"Usaha demo"),{name:"Usaha demo",phone:"",address:""});
  assert.deepEqual(readBusinessProfile({name:"Uji",phone:"",address:"Bandung",tier:"pro"}),{name:"Uji",phone:"",address:"Bandung"});
});

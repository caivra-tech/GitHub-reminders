import test from "node:test";
import assert from "node:assert/strict";
import http from "node:http";
import { spawn } from "node:child_process";
import { mkdtemp, writeFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";

const repository = "caivra-tech/test-consumer";
const event = {action:"created",issue:{number:1},comment:{id:123456,created_at:new Date(Date.now()-1000).toISOString(),body:"/remind in 30 minutes Replay integration",user:{login:"octocat",type:"User"}}};
async function fixture(t, {lost=false,stale=false,barrier=false}={}) {
  const comments=[]; let posts=0,gets=0; let waiting=[];
  const server=http.createServer(async(req,res)=>{
    const chunks=[];for await(const chunk of req)chunks.push(chunk);
    const body=Buffer.concat(chunks).toString();
    const respond=(status,data)=>{res.writeHead(status,{"content-type":"application/json"});res.end(JSON.stringify(data));};
    if(req.method==="GET" && req.url.startsWith("/repos/caivra-tech/test-consumer/issues/1/comments?")){
      gets++;
      if(barrier && gets<=2){waiting.push(()=>respond(200,[]));if(waiting.length===2){waiting.forEach(f=>f());waiting=[];}return;}
      return respond(200,stale?[]:comments);
    }
    if(req.method==="POST" && req.url==="/repos/caivra-tech/test-consumer/issues/1/comments"){
      posts++;const text=JSON.parse(body).body;
      const created_at=JSON.parse(text.match(/<!-- github-reminders:v1\n([^\n]+)\n-->/)[1]).createdAt;
      const comment={id:1000+posts,body:text,user:{id:41898282,login:"github-actions[bot]",type:"Bot"},performed_via_github_app:{id:15368,slug:"github-actions"},issue_url:"https://api.github.com/repos/caivra-tech/test-consumer/issues/1",created_at};
      comments.push(comment);return respond(lost?503:201,lost?{error:"lost response"}:comment);
    }
    respond(404,{error:"unexpected request",url:req.url});
  });
  await new Promise(resolve=>server.listen(0,"127.0.0.1",resolve));
  const dir=await mkdtemp(path.join(os.tmpdir(),"reminder-test-"));
  const eventPath=path.join(dir,"event.json");await writeFile(eventPath,JSON.stringify(event));
  t.after(async()=>{await new Promise(resolve=>server.close(resolve));await rm(dir,{recursive:true,force:true});});
  return {comments,get posts(){return posts;},async run(){
    return new Promise(resolve=>{
      const child=spawn(process.execPath,[new URL("../src/index.mjs",import.meta.url).pathname],{env:{...process.env,GITHUB_TOKEN:"test",GITHUB_REPOSITORY:repository,GITHUB_EVENT_NAME:"issue_comment",GITHUB_EVENT_PATH:eventPath,GITHUB_API_URL:"http://127.0.0.1:"+server.address().port}});
      let stderr="";child.stderr.on("data",x=>stderr+=x);child.on("close",code=>resolve({code,stderr}));
    });
  }};
}
test("sequential replay and process restart create one record",async t=>{
  const f=await fixture(t);assert.equal((await f.run()).code,0);assert.equal((await f.run()).code,0);assert.equal(f.posts,1);
});
test("POST succeeded but response lost: readback recovers",async t=>{
  const f=await fixture(t,{lost:true});assert.equal((await f.run()).code,0);assert.equal(f.posts,1);
});
test("POST response lost and readback stale: fail closed",async t=>{
  const f=await fixture(t,{lost:true,stale:true});const r=await f.run();assert.notEqual(r.code,0);assert.match(r.stderr,/outcome unknown/);assert.equal(f.posts,1);
});
test("independent writers expose non-atomic creation race (known limitation)",async t=>{
  const f=await fixture(t,{barrier:true});await Promise.all([f.run(),f.run()]);assert.equal(f.posts,2);assert.equal(f.comments.length,2);
});

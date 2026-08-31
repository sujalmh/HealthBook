/**
 * AI Request Verification — Thorough multimodal for both completions and responses with file inputs
 * 6 cases: chat+file, chat text-only, responses+file, responses text-only, timeout AbortError, 500 !ok
 * Logs to .teamwork/verification/ai-request-verification.log with PASS per case
 */
import fs from 'fs';
import path from 'path';
import { getAIConfig, getAIEndpoint, getAIModel } from '../../src/core/ai/config.ts';
import { extractWithAI } from '../../src/core/ai/client.ts';
import { isMultimodalRequestBody } from '../../src/core/ai/vision.ts';

// Setup localStorage mock if not exists (Node)
if (typeof (globalThis as any).localStorage === 'undefined') {
  const store = new Map<string,string>();
  (globalThis as any).localStorage = {
    getItem: (k:string)=> store.get(k) ?? null,
    setItem: (k:string,v:string)=> store.set(k,v),
    removeItem: (k:string)=> store.delete(k),
    clear: ()=> store.clear(),
  } as any;
}
function clearStorage(){ try{(globalThis as any).localStorage.clear();}catch{} }

function setConfig(opts:{baseURL:string,provider:string,model:string,apiKey:string,enabled:string,timeout?:string}){
  clearStorage();
  process.env.VITE_AI_BASE_URL = opts.baseURL;
  process.env.VITE_AI_PROVIDER = opts.provider;
  process.env.VITE_AI_MODEL = opts.model;
  process.env.VITE_AI_VISION_MODEL = opts.model;
  process.env.VITE_AI_API_KEY = opts.apiKey;
  process.env.VITE_AI_ENABLED = opts.enabled;
  process.env.VITE_AI_STRUCTURED_OUTPUTS = 'true';
  process.env.VITE_AI_TEMPERATURE = '0.1';
  process.env.VITE_AI_MAX_TOKENS = '4096';
  if(opts.timeout) process.env.VITE_AI_TIMEOUT_MS = opts.timeout;
  else process.env.VITE_AI_TIMEOUT_MS = '30000';
  // also clear possible SettingsStore overrides that might have been set
  try{
    (globalThis as any).localStorage.removeItem('carecanvas_settings');
    (globalThis as any).localStorage.removeItem('carecanvas_ai_settings');
    (globalThis as any).localStorage.removeItem('carecanvas_ai_config');
  }catch{}
}

const LOG_PATH = path.resolve(process.cwd(), '.teamwork/verification/ai-request-verification.log');
const logs:string[]=[];
function log(msg:string){ logs.push(msg); console.log(msg); }
function pass(caseName:string){ log(`[PASS] ${caseName}`); }
function fail(caseName:string, reason:string){ log(`[FAIL] ${caseName} — ${reason}`); throw new Error(`${caseName} FAIL: ${reason}`); }

const syntheticImageDataUrl = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+ip1sAAAAASUVORK5CYII=';
const testFactsChat = { facts: [{ name:'Apixaban', category:'medication', value:'5mg', unit:'mg', confidence:0.92, plainExplanation:'Apixaban 5mg twice daily' }, { name:'Creatinine', category:'lab', value:1.9, unit:'mg/dL', confidence:0.88, plainExplanation:'Creatinine 1.9 mg/dL elevated' }] };
const testFactsResponses = { facts: [{ name:'Creatinine', category:'lab', value:1.9, unit:'mg/dL', confidence:0.9, plainExplanation:'Creatinine elevated' }] };

async function run(){
  log('AI Request Verification — 6 cases thorough multimodal start');
  let overallPass = true;
  const originalFetch = (globalThis as any).fetch;

  // --- Case 1: chat+file ---
  try{
    setConfig({baseURL:'https://example.com/v1',provider:'chat',model:'test-model',apiKey:'sk-test',enabled:'true'});
    let captured:{url:string,headers:any,body:any,signal:any}|null=null;
    (globalThis as any).fetch = async (url:string, opts:any)=>{
      captured={url,headers:opts.headers,body:JSON.parse(opts.body),signal:opts.signal};
      // ensure signal passed
      if(!opts.signal) fail('chat+file signal','AbortSignal not passed');
      return {
        ok:true, status:200, statusText:'OK',
        text: async()=>'',
        json: async()=> ({ choices:[{message:{content:JSON.stringify(testFactsChat)}}] })
      } as any;
    };
    const cfg = getAIConfig();
    const facts = await extractWithAI('hello file text', syntheticImageDataUrl, 'lab_slip_photo', {patientId:'p1',documentId:'doc1'});
    if(!captured) fail('chat+file','fetch not captured');
    if(captured!.url !== getAIEndpoint(cfg)) fail('chat+file',`url mismatch ${captured!.url} vs ${getAIEndpoint(cfg)}`);
    if(captured!.headers.Authorization !== 'Bearer sk-test') fail('chat+file','Authorization missing');
    if(captured!.body.model !== getAIModel(cfg, true)) fail('chat+file',`model mismatch ${captured!.body.model}`);
    if(!isMultimodalRequestBody(captured!.body, 'chat')) fail('chat+file','isMultimodalRequestBody false for chat+file should be true');
    // check image_url present and text present
    const bodyStr = JSON.stringify(captured!.body);
    if(!bodyStr.includes('image_url')) fail('chat+file','body missing image_url');
    if(!bodyStr.includes('hello file text')) fail('chat+file','body missing text');
    // structured params present
    if(!captured!.body.response_format || captured!.body.response_format.type !== 'json_object') fail('chat+file','structured response_format missing');
    if(!Array.isArray(facts) || facts.length===0) fail('chat+file','facts empty');
    if(captured!.signal === undefined) fail('chat+file','signal undefined');
    pass('Case 1 chat+file multimodal single body Authorization Bearer endpoint model PASS');
  }catch(e:any){
    log(`[FAIL] Case 1 chat+file — ${e.message}`);
    overallPass=false;
  }finally{
    (globalThis as any).fetch = originalFetch;
  }

  // --- Case 2: chat text-only ---
  try{
    setConfig({baseURL:'https://example.com/v1',provider:'chat',model:'test-model',apiKey:'sk-test',enabled:'true'});
    let captured:any=null;
    (globalThis as any).fetch = async (url:string, opts:any)=>{
      captured={url,headers:opts.headers,body:JSON.parse(opts.body),signal:opts.signal};
      return {
        ok:true, status:200, statusText:'OK',
        text: async()=>'',
        json: async()=> ({ choices:[{message:{content:JSON.stringify(testFactsChat)}}] })
      } as any;
    };
    const cfg = getAIConfig();
    const facts = await extractWithAI('hello text only', undefined, 'discharge_summary', {patientId:'p1',documentId:'doc2'});
    if(!captured) fail('chat text-only','fetch not captured');
    if(captured.url !== 'https://example.com/v1/chat/completions') fail('chat text-only','url not chat/completions');
    if(captured.headers.Authorization !== 'Bearer sk-test') fail('chat text-only','auth');
    if(captured.body.model !== 'test-model') fail('chat text-only','model');
    if(isMultimodalRequestBody(captured.body,'chat')) fail('chat text-only','isMultimodal true should be false for text-only');
    if(!captured.body.response_format) fail('chat text-only','structured missing');
    if(captured.signal === undefined) fail('chat text-only','signal undefined');
    if(!Array.isArray(facts)) fail('chat text-only','facts not array');
    pass('Case 2 chat text-only endpoint model headers structured PASS (isMultimodal false)');
  }catch(e:any){
    log(`[FAIL] Case 2 chat text-only — ${e.message}`);
    overallPass=false;
  }finally{(globalThis as any).fetch=originalFetch;}

  // --- Case 3: responses+file ---
  try{
    setConfig({baseURL:'https://example.com/v1',provider:'responses',model:'test-model',apiKey:'sk-test',enabled:'true'});
    let captured:any=null;
    (globalThis as any).fetch = async (url:string, opts:any)=>{
      captured={url,headers:opts.headers,body:JSON.parse(opts.body),signal:opts.signal};
      return {
        ok:true, status:200, statusText:'OK',
        text: async()=>'',
        json: async()=> ({ output_text: JSON.stringify(testFactsResponses), output:[{content:[{type:'output_text', text: JSON.stringify(testFactsResponses)}]}] })
      } as any;
    };
    const cfg = getAIConfig();
    const facts = await extractWithAI('hello responses file', syntheticImageDataUrl, 'lab_slip_photo', {patientId:'p1',documentId:'doc3'});
    if(!captured) fail('responses+file','fetch not captured');
    if(captured.url !== 'https://example.com/v1/responses') fail('responses+file',`url ${captured.url} not responses`);
    if(captured.headers.Authorization !== 'Bearer sk-test') fail('responses+file','auth');
    if(captured.body.model !== 'test-model') fail('responses+file','model');
    if(!isMultimodalRequestBody(captured.body,'responses')) fail('responses+file','isMultimodal false should be true for responses+file');
    const bodyStr = JSON.stringify(captured.body);
    if(!bodyStr.includes('input_image')) fail('responses+file','missing input_image');
    if(!bodyStr.includes('hello responses file')) fail('responses+file','missing text');
    // structured for responses is text.format
    if(!captured.body.text || !captured.body.text.format || captured.body.text.format.type !== 'json_schema') fail('responses+file','text.format json_schema missing');
    if(captured.signal===undefined) fail('responses+file','signal undefined');
    if(!Array.isArray(facts)) fail('responses+file','facts');
    pass('Case 3 responses+file multimodal single body input_image+input_text PASS');
  }catch(e:any){
    log(`[FAIL] Case 3 responses+file — ${e.message}`);
    overallPass=false;
  }finally{(globalThis as any).fetch=originalFetch;}

  // --- Case 4: responses text-only ---
  try{
    setConfig({baseURL:'https://example.com/v1',provider:'responses',model:'test-model',apiKey:'sk-test',enabled:'true'});
    let captured:any=null;
    (globalThis as any).fetch = async (url:string, opts:any)=>{
      captured={url,headers:opts.headers,body:JSON.parse(opts.body),signal:opts.signal};
      return {
        ok:true, status:200, statusText:'OK',
        text: async()=>'',
        json: async()=> ({ output_text: JSON.stringify(testFactsChat) })
      } as any;
    };
    const cfg = getAIConfig();
    const facts = await extractWithAI('hello responses text only', undefined, 'discharge_summary', {patientId:'p1',documentId:'doc4'});
    if(!captured) fail('responses text-only','fetch not captured');
    if(captured.url !== 'https://example.com/v1/responses') fail('responses text-only','url');
    if(captured.headers.Authorization !== 'Bearer sk-test') fail('responses text-only','auth');
    if(captured.body.model !== 'test-model') fail('responses text-only','model');
    if(isMultimodalRequestBody(captured.body,'responses')) fail('responses text-only','isMultimodal true should be false for text-only');
    if(!captured.body.text || captured.body.text.format.type !== 'json_schema') fail('responses text-only','structured missing');
    if(captured.signal===undefined) fail('responses text-only','signal undefined');
    pass('Case 4 responses text-only endpoint model headers structured PASS (isMultimodal false)');
  }catch(e:any){
    log(`[FAIL] Case 4 responses text-only — ${e.message}`);
    overallPass=false;
  }finally{(globalThis as any).fetch=originalFetch;}

  // --- Case 5: timeout AbortError throws "timed out after 30000ms" (or configured) and signal passed ---
  try{
    // Use short timeout 50ms for quick test
    setConfig({baseURL:'https://example.com/v1',provider:'chat',model:'test-model',apiKey:'sk-test',enabled:'true',timeout:'50'});
    let signalCaptured:any=null;
    (globalThis as any).fetch = async (url:string, opts:any)=>{
      signalCaptured = opts.signal;
      // Simulate fetch that waits for abort
      return new Promise((resolve, reject)=>{
        const sig = opts.signal;
        if(sig){
          if(sig.aborted) { const err:any=new Error('AbortError'); err.name='AbortError'; reject(err); return; }
          sig.addEventListener('abort', ()=>{
            const err:any=new Error('AbortError'); err.name='AbortError'; reject(err);
          });
        }
        // never resolve otherwise, will abort via controller
      }) as any;
    };
    let threw=false;
    let errMsg='';
    try{
      await extractWithAI('timeout test', undefined, 'discharge_summary', {patientId:'p1',documentId:'doc5'});
    }catch(err:any){
      threw=true;
      errMsg = err.message || String(err);
    }
    if(!signalCaptured) fail('timeout','AbortSignal not passed to fetch');
    if(!threw) fail('timeout','should have thrown timeout');
    if(!errMsg.includes('timed out after')) fail('timeout',`errMsg missing timed out after got ${errMsg}`);
    if(!errMsg.includes('50ms') && !errMsg.includes('30000ms')) fail('timeout',`errMsg missing timeoutMs ${errMsg}`);
    pass('Case 5 timeout AbortError throws "timed out after 50ms" and AbortSignal passed PASS');
  }catch(e:any){
    log(`[FAIL] Case 5 timeout — ${e.message}`);
    overallPass=false;
  }finally{(globalThis as any).fetch=originalFetch; setConfig({baseURL:'https://example.com/v1',provider:'chat',model:'test-model',apiKey:'sk-test',enabled:'true'});}

  // --- Case 6: 500 !ok throws "AI request failed 500" and file path returns [] not heuristic ---
  try{
    setConfig({baseURL:'https://example.com/v1',provider:'chat',model:'test-model',apiKey:'sk-test',enabled:'true'});
    (globalThis as any).fetch = async (url:string, opts:any)=>{
      return {
        ok:false, status:500, statusText:'Internal Server Error',
        text: async()=> 'server error body',
        json: async()=> null
      } as any;
    };
    let threw=false;
    let errMsg='';
    try{
      await extractWithAI('hello 500 file', syntheticImageDataUrl, 'lab_slip_photo', {patientId:'p1',documentId:'doc6'});
    }catch(err:any){
      threw=true;
      errMsg=err.message;
    }
    if(!threw) fail('500 throws','extractWithAI should throw on 500');
    if(!errMsg.includes('AI request failed 500')) fail('500 throws',`errMsg ${errMsg} missing AI request failed 500`);
    // Now test vaultTools file path returns [] not heuristic
    // Need to use harness
    const { createTestHarness } = await import('../../test/harness/webmcp-test-shim.ts');
    // Set active user
    (globalThis as any).localStorage.setItem('carecanvas_active_user', JSON.stringify({userId:'test-patient-500', name:'Test Patient', role:'patient'}));
    const harness = createTestHarness('test-patient-500','patient');
    // Mock fetch still 500
    (globalThis as any).fetch = async (url:string, opts:any)=>{
      return {
        ok:false, status:500, statusText:'Internal Server Error',
        text: async()=> 'server error',
        json: async()=> null
      } as any;
    };
    // Ensure config still enabled
    setConfig({baseURL:'https://example.com/v1',provider:'chat',model:'test-model',apiKey:'sk-test',enabled:'true'});
    const result:any = await harness.engine.execute('extract_fact', { documentId:'doc500', rawText: syntheticImageDataUrl, docType:'lab_slip_photo' } as any, harness.context);
    // For file 500, vaultTools should return success true data [] not heuristic
    if(!result.success) fail('500 vault file','should be success true even on AI fail for file');
    if(!Array.isArray(result.data) || result.data.length !== 0) fail('500 vault file',`data should be [] got ${JSON.stringify(result.data)} length ${result.data?.length}`);
    // plainLanguageSummary for file failure is expected to contain "no heuristic" but not return heuristic facts
    // Ensure data empty ensures no heuristic placeholder used
    pass('Case 6 500 !ok throws "AI request failed 500" and file path returns [] not heuristic PASS');
  }catch(e:any){
    log(`[FAIL] Case 6 500 — ${e.message}`);
    overallPass=false;
  }finally{(globalThis as any).fetch=originalFetch;}

  // Final log
  if(overallPass){
    log('OVERALL PASS — 6 cases thorough multimodal verified');
  }else{
    log('OVERALL FAIL — one or more cases failed');
  }
  // Write log file
  try{
    fs.mkdirSync(path.dirname(LOG_PATH), {recursive:true});
    fs.writeFileSync(LOG_PATH, logs.join('\n')+'\n');
    // also copy to .teamwork/logs
    const altPath = path.resolve(process.cwd(), '.teamwork/logs/ai-request-verification.log');
    fs.mkdirSync(path.dirname(altPath), {recursive:true});
    fs.writeFileSync(altPath, logs.join('\n')+'\n');
  }catch(e){ console.error('log write failed',e); }

  if(!overallPass) process.exit(1);
}

run().catch(e=>{ console.error(e); process.exit(1); });

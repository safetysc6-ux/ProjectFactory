function json(data,status=200){return new Response(JSON.stringify(data),{status,headers:{'content-type':'application/json; charset=utf-8','access-control-allow-origin':'*'}})}
function parseDataUrl(v=''){const m=v.match(/^data:([^;]+);base64,(.+)$/);return m?{mimeType:m[1],data:m[2]}:null}
async function gemini(env,model,body){if(!env.GEMINI_API_KEY)throw new Error('ยังไม่ได้ตั้ง GEMINI_API_KEY');const r=await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${env.GEMINI_API_KEY}`,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify(body)});const j=await r.json();if(!r.ok)throw new Error(j?.error?.message||'Gemini API error');return j}
function textFrom(j){return (j.candidates||[]).flatMap(c=>c.content?.parts||[]).map(p=>p.text||'').join('').trim()}
export default {async fetch(req,env){try{const u=new URL(req.url);if(req.method==='OPTIONS')return new Response(null,{headers:{'access-control-allow-origin':'*','access-control-allow-headers':'content-type','access-control-allow-methods':'GET,POST,OPTIONS'}});if(u.pathname==='/api/health')return json({ok:true,service:'dola-scene-saver',version:2,ai:!!env.GEMINI_API_KEY});if(u.pathname==='/api/proxy'){const target=u.searchParams.get('url')||'';let host='';try{host=new URL(target).hostname}catch{}if(!host.endsWith('.dola.com')&&host!=='dola.com')return json({error:'อนุญาตเฉพาะลิงก์ dola.com'},400);const r=await fetch(target,{redirect:'follow'});if(!r.ok)return json({error:'โหลดวิดีโอจาก Dola ไม่สำเร็จ',status:r.status},502);return new Response(r.body,{headers:{'content-type':r.headers.get('content-type')||'video/mp4','cache-control':'private, max-age=300'}})}if(u.pathname==='/api/analyze'&&req.method==='POST'){const x=await req.json();const img=parseDataUrl(x.image);const prompt=`คุณคือ AI Creative Director สำหรับสร้างคอนเทนต์ Affiliate

เมื่อฉันแนบรูปสินค้าและรายละเอียด ให้สร้าง:
1. วิเคราะห์สินค้า
2. Prompt รูป BEFORE
3. Prompt รูป AFTER
4. Video Prompt ฉาก 1
5. Video Prompt ฉาก 2
6. สคริปต์เสียง 20 วินาที
7. Caption
8. Hashtags

กฎ:
- สินค้าต้องตรงภาพอ้างอิง ห้ามเพี้ยน ห้ามเปลี่ยนรูปทรง สี สัดส่วน หรือชิ้นส่วน
- ใช้ผู้ชายไทยคนเดียว อายุประมาณ 28–35 ปี ผมดำสั้น ลุคพ่อบ้านธรรมชาติ และรักษาหน้าตา/เสื้อผ้าให้ต่อเนื่อง
- ฉาก 1 ห้ามติดตั้งสินค้า ให้เก็บกวาด ทำความสะอาด และเตรียมพื้นที่เท่านั้น
- ฉาก 2 จึงเริ่มติดตั้ง ต้องเห็นการหยิบ วาง ประกอบ และติดตั้งทีละขั้นตอน
- ห้ามสินค้าและชิ้นส่วนวาป ห้ามโผล่ ห้ามหาย ห้ามประกอบตัวเอง
- เปลี่ยนมุมกล้องระหว่าง Wide, Medium และ Close-up ตามความเหมาะสม
- ใช้ Timelapse/Speed Ramp ได้ แต่ขั้นตอนติดตั้งต้องมองเห็นต่อเนื่อง
- วิดีโอห้ามมีเสียงพูด ห้าม Voiceover ห้ามตัวละครขยับปากพูด และห้ามดนตรี ใช้เสียงบรรยากาศจริงเท่านั้น
- สคริปต์เสียงพากย์สร้างแยกจาก Video Prompt
- Hook, ฉาก, มุมกล้อง, สคริปต์, Caption และ Hashtags ต้องคิดใหม่ทุกครั้ง ห้ามซ้ำโดยไม่จำเป็น
- ห้ามเดาสเปกหรือคุณสมบัติที่ไม่มีข้อมูล

ข้อกำหนดเอาต์พุตเพิ่มเติม:
- ทำคอนเทนต์แนวตั้ง 9:16
- Video Prompt แต่ละฉากออกแบบสำหรับประมาณ 10 วินาที
- สคริปต์เสียงเป็นภาษาไทยธรรมชาติ ความยาวสำหรับพูดประมาณ 20 วินาที มี Hook ต้นคลิปและ CTA ท้ายคลิป แต่ห้ามบอกราคาและห้ามอ้างว่าเคยใช้จริงถ้าไม่มีข้อมูล
- ตอบกลับเป็น JSON เท่านั้น ห้ามใส่ markdown หรือข้อความอื่นนอก JSON
- ใช้ key ตามนี้เท่านั้น:
{"analysis":"วิเคราะห์สินค้า","beforePrompt":"Prompt รูป BEFORE","afterPrompt":"Prompt รูป AFTER","scene1Prompt":"Video Prompt ฉาก 1","scene2Prompt":"Video Prompt ฉาก 2","voiceScript":"สคริปต์เสียง 20 วินาที","caption":"Caption","hashtags":"Hashtags"}

สินค้า: ${x.name}
รายละเอียดสินค้า: ${x.detail||'-'}`;const parts=[{text:prompt}];if(img)parts.push({inlineData:img});const j=await gemini(env,env.GEMINI_TEXT_MODEL||'gemini-2.5-flash',{contents:[{parts}],generationConfig:{responseMimeType:'application/json'}});let t=textFrom(j).replace(/^```json\s*|```$/g,'').trim();return json(JSON.parse(t))}if(u.pathname==='/api/tts'&&req.method==='POST'){const x=await req.json();const j=await gemini(env,env.GEMINI_TTS_MODEL||'gemini-2.5-flash-preview-tts',{contents:[{parts:[{text:x.text}]}],generationConfig:{responseModalities:['AUDIO'],speechConfig:{voiceConfig:{prebuiltVoiceConfig:{voiceName:'Kore'}}}}});const part=(j.candidates||[]).flatMap(c=>c.content?.parts||[]).find(p=>p.inlineData?.data);if(!part)return json({error:'โมเดลไม่ได้ส่งเสียงกลับมา'},502);return json({mimeType:part.inlineData.mimeType||'audio/L16;codec=pcm;rate=24000',base64:part.inlineData.data})}return env.ASSETS.fetch(req)}catch(e){return json({error:e.message||String(e)},500)}}};

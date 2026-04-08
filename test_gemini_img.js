const KEY = 'AIzaSyDwBo6g5EnsKEJ7fRWt-uB96H3qcESE11w';
const body = {
  contents: { parts: [{ text: 'Professional tea exhibition booth, natural lighting, Chinese style, photorealistic' }] }
};
fetch('https://generativelanguage.googleapis.com/v1beta/models/gemini-3-pro-image-preview:generateContent?key=' + KEY, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(body)
}).then(r => r.json()).then(d => {
  if (d.error) console.log('Img Gen Error:', d.error.code, d.error.message?.slice(0,150));
  else {
    const imgData = d.candidates?.[0]?.content?.parts?.find(p => p.inlineData);
    if (imgData) console.log('Image generated, base64 length:', imgData.inlineData.data.length);
    else {
      const textPart = d.candidates?.[0]?.content?.parts?.find(p => p.text);
      console.log('Text response:', textPart?.text?.slice(0,200) || JSON.stringify(d.candidates?.[0]?.content?.parts || []).slice(0,200));
    }
  }
}).catch(e => console.error('Fetch error:', e.message));

const {
  Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits,
  SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, ActivityType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

let Canvas;
let arabicFontRegistered = false;
try {
  Canvas = require('canvas');
  const fontDir = path.join(__dirname, 'fonts');
  const fontPath = path.join(fontDir, 'NotoSansArabic-Bold.ttf');
  if (!fs.existsSync(fontDir)) fs.mkdirSync(fontDir, { recursive: true });

  function isValidFont(f) {
    try {
      const buf = fs.readFileSync(f);
      return buf.length > 10000 && (
        buf.slice(0, 4).toString() === '\x00\x01\x00\x00' ||
        buf.slice(0, 4).toString() === 'true' ||
        buf.slice(0, 4).toString() === 'OTTO' ||
        buf.slice(4, 8).toString() === 'glyf' ||
        buf.toString('ascii', 0, 4) === 'wOFF' ||
        buf.toString('ascii', 0, 4) === 'wOF2'
      );
    } catch { return false; }
  }

  if (!fs.existsSync(fontPath) || !isValidFont(fontPath)) {
    const fontUrls = [
      'https://fonts.gstatic.com/s/notosansarabic/v33/nwpxtLGrOAZMl5nJ_wfgRg3DrWFZWsnVBJ_sS6tlqHHFlhQ5l3sQWIHPqzCfL2uvuw.ttf',
      'https://raw.githubusercontent.com/google/fonts/main/ofl/notosansarabic/static/NotoSansArabic-Bold.ttf',
    ];
    let downloaded = false;
    for (const u of fontUrls) {
      if (downloaded) break;
      try {
        const { execSync } = require('child_process');
        execSync('curl -fsSL --max-time 20 -o "' + fontPath + '" "' + u + '"', { timeout: 25000 });
        if (isValidFont(fontPath)) { downloaded = true; break; }
        else { try { fs.unlinkSync(fontPath); } catch {} }
      } catch { try { fs.unlinkSync(fontPath); } catch {} }
    }
  }

  if (fs.existsSync(fontPath) && isValidFont(fontPath)) {
    try {
      Canvas.registerFont(fontPath, { family: 'Arabic' });
      arabicFontRegistered = true;
      console.log('✅ Arabic font loaded successfully');
    } catch (e) { console.error('Font register error:', e.message); }
  } else {
    console.log('⚠️ Arabic font not available — banners will use fallback font');
  }
  console.log('✅ Canvas loaded');
} catch (e) { Canvas = null; console.error('❌ Canvas failed to load:', e.message); }

// ══════════════════════════════════════════════════════════════
//  BANNER GENERATOR
// ══════════════════════════════════════════════════════════════
const BANNER_W = 1024, BANNER_H = 300;
const BANNER_SCALE = 2;
const BANNER_THEMES = {
  'الخدمات':          { emoji: '🛒', c1: '#0a4', c2: '#0f6', accent: '#0fa' },
  'التخفيضات':       { emoji: '🎁', c1: '#f06', c2: '#f0a', accent: '#f6a' },
  'التقييمات':       { emoji: '⭐', c1: '#fa0', c2: '#fc0', accent: '#fd0' },
  'التواصل-مع-الستاف':{ emoji: '💬', c1: '#06f', c2: '#08f', accent: '#0af' },
  'الإعلانات':       { emoji: '📣', c1: '#a0f', c2: '#c0f', accent: '#d0f' },
  'القواعد':         { emoji: '📋', c1: '#80f', c2: '#a0f', accent: '#b0f' },
  'العامة':          { emoji: '💬', c1: '#08f', c2: '#0af', accent: '#0cf' },
  'اوامر-البوت':     { emoji: '🤖', c1: '#06f', c2: '#09f', accent: '#0bf' },
  'حالة-السيرفر':    { emoji: '📊', c1: '#08c', c2: '#0ac', accent: '#0cf' },
  'الترحيب':         { emoji: '👋', c1: '#0c6', c2: '#0f6', accent: '#0f9' },
  'فتح-تذكرة':       { emoji: '🎫', c1: '#fa0', c2: '#fc0', accent: '#fe0' },
  'التسليمات':       { emoji: '📦', c1: '#0a6', c2: '#0c6', accent: '#0f6' },
  'شات-الستاف':      { emoji: '💼', c1: '#a0f', c2: '#c0f', accent: '#d0f' },
  'ملاحظات-الستاف':  { emoji: '📋', c1: '#80f', c2: '#a0f', accent: '#b0f' },
  'تقديم-للادارة':   { emoji: '📝', c1: '#06f', c2: '#08f', accent: '#0af' },
  'السجلات':         { emoji: '📝', c1: '#668', c2: '#88a', accent: '#99b' },
  'لوحة-التحكم':     { emoji: '🔧', c1: '#f33', c2: '#f66', accent: '#f88' },
  'كيف-تطلب':        { emoji: '📖', c1: '#0a6', c2: '#0c6', accent: '#0f6' },
};

function hexToRgb(hex) {
  let h = hex.replace('#', '');
  if (h.length === 3) h = h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return { r: parseInt(h.substring(0,2),16), g: parseInt(h.substring(2,4),16), b: parseInt(h.substring(4,6),16) };
}
function rgba(hex, a) { const c = hexToRgb(hex); return 'rgba('+c.r+','+c.g+','+c.b+','+a+')'; }

function generateBanner(channelName, emoji, color1, color2, accent) {
  if (!Canvas) return null;
  const S = BANNER_SCALE;
  const c = Canvas.createCanvas(BANNER_W * S, BANNER_H * S);
  const ctx = c.getContext('2d');
  ctx.scale(S, S);

  const cleanName = (channelName || '').replace(/^.+?[・·]\s*/, '').replace(/-/g, ' ').trim();
  const theme = getBannerForChannel(channelName) || { c1: color1 || '#0ff', c2: color2 || '#08f', accent: accent || '#0ff' };
  const c1 = color1 || theme.c1;
  const c2 = color2 || theme.c2;
  const ac = accent || theme.accent;

  ctx.fillStyle = '#050510';
  ctx.fillRect(0, 0, BANNER_W, BANNER_H);

  for (let j = 0; j < 5; j++) {
    const x = Math.random() * BANNER_W;
    const y = Math.random() * BANNER_H;
    const r = 80 + Math.random() * 150;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, rgba(c1, 0.1));
    grad.addColorStop(1, 'transparent');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const centerGlow = ctx.createRadialGradient(BANNER_W / 2, BANNER_H / 2, 0, BANNER_W / 2, BANNER_H / 2, 300);
  centerGlow.addColorStop(0, rgba(ac, 0.08));
  centerGlow.addColorStop(1, 'transparent');
  ctx.fillStyle = centerGlow;
  ctx.beginPath();
  ctx.arc(BANNER_W / 2, BANNER_H / 2, 300, 0, Math.PI * 2);
  ctx.fill();

  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.strokeStyle = ac;
  ctx.lineWidth = 0.5;
  for (let y = 20; y < BANNER_H; y += 20) {
    ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(BANNER_W, y); ctx.stroke();
  }
  for (let x = 20; x < BANNER_W; x += 20) {
    ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, BANNER_H); ctx.stroke();
  }
  ctx.restore();

  const neonLine = (y, width) => {
    const g = ctx.createLinearGradient(BANNER_W / 2 - width, 0, BANNER_W / 2 + width, 0);
    g.addColorStop(0, 'transparent');
    g.addColorStop(0.15, rgba(ac, 0.25));
    g.addColorStop(0.5, ac);
    g.addColorStop(0.85, rgba(ac, 0.25));
    g.addColorStop(1, 'transparent');
    ctx.save();
    ctx.shadowColor = ac; ctx.shadowBlur = 15;
    ctx.fillStyle = g;
    ctx.fillRect(BANNER_W / 2 - width, y - 1, width * 2, 2);
    ctx.shadowBlur = 8;
    ctx.fillRect(BANNER_W / 2 - width, y - 1, width * 2, 2);
    ctx.restore();
  };
  neonLine(6, 300);
  neonLine(BANNER_H - 6, 300);

  const neonCorner = (cx, cy, flipX, flipY) => {
    ctx.save();
    ctx.translate(cx, cy);
    ctx.scale(flipX ? -1 : 1, flipY ? -1 : 1);
    ctx.shadowColor = ac; ctx.shadowBlur = 12;
    ctx.strokeStyle = ac; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(0, 30); ctx.lineTo(0, 0); ctx.lineTo(30, 0);
    ctx.stroke();
    ctx.shadowBlur = 6; ctx.stroke();
    ctx.restore();
  };
  neonCorner(20, 20, false, false);
  neonCorner(BANNER_W - 20, 20, true, false);
  neonCorner(20, BANNER_H - 20, false, true);
  neonCorner(BANNER_W - 20, BANNER_H - 20, true, true);

  const displayName = cleanName || channelName || '';
  if (displayName) {
    const isArabic = /[\u0600-\u06FF]/.test(displayName);
    const fontName = isArabic && arabicFontRegistered
      ? 'bold 54px "Arabic", sans-serif'
      : 'bold 54px sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textX = BANNER_W / 2;
    const textY = BANNER_H / 2 - 8;

    ctx.save();
    ctx.shadowColor = ac; ctx.shadowBlur = 60;
    ctx.fillStyle = rgba(ac, 0.19);
    ctx.font = fontName;
    ctx.fillText(displayName, textX, textY);
    ctx.shadowBlur = 35;
    ctx.fillText(displayName, textX, textY);
    ctx.restore();

    ctx.save();
    ctx.shadowColor = '#ffffff'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#ffffff';
    ctx.font = fontName;
    ctx.fillText(displayName, textX, textY);
    ctx.restore();

    const sepGrad = ctx.createLinearGradient(BANNER_W / 2 - 140, 0, BANNER_W / 2 + 140, 0);
    sepGrad.addColorStop(0, 'transparent');
    sepGrad.addColorStop(0.2, rgba(ac, 0.19));
    sepGrad.addColorStop(0.5, ac);
    sepGrad.addColorStop(0.8, rgba(ac, 0.19));
    sepGrad.addColorStop(1, 'transparent');
    ctx.save();
    ctx.shadowColor = ac; ctx.shadowBlur = 10;
    ctx.fillStyle = sepGrad;
    ctx.fillRect(BANNER_W / 2 - 140, BANNER_H / 2 + 30, 280, 1.5);
    ctx.restore();
  }

  const fontSmall = arabicFontRegistered ? '600 13px "Arabic", sans-serif' : '600 13px sans-serif';
  ctx.font = fontSmall;
  ctx.textAlign = 'center';
  ctx.save();
  ctx.shadowColor = ac; ctx.shadowBlur = 10;
  ctx.fillStyle = rgba(ac, 0.5);
  ctx.fillText('AI Shop Bot', BANNER_W / 2, BANNER_H - 22);
  ctx.restore();

  return Buffer.from(c.toBuffer('image/png'));
}

function getBannerForChannel(channelName) {
  for (const [key, theme] of Object.entries(BANNER_THEMES)) {
    if (channelName.includes(key)) {
      return { ...theme, name: key };
    }
  }
  return null;
}

async function sendBannerToChannel(channel) {
  if (!Canvas) { console.log('⚠️ Canvas not available for banner'); return false; }
  const theme = getBannerForChannel(channel.name);
  if (!theme) return false;
  try {
    const buf = generateBanner(channel.name, null, theme.c1, theme.c2, theme.accent);
    if (!buf) { console.log('⚠️ generateBanner returned null for', channel.name); return false; }
    const { AttachmentBuilder } = require('discord.js');
    const attachment = new AttachmentBuilder(buf, { name: `banner-${theme.name}.png` });
    await channel.send({ files: [attachment] });
    console.log('✅ Banner sent to', channel.name);
    return true;
  } catch (e) { console.log('❌ Banner failed for', channel.name, ':', e.message); return false; }
}

// ══════════════════════════════════════════════════════════════
//  CONFIG & DATA
// ══════════════════════════════════════════════════════════════
const DATA = path.join(__dirname, 'data');
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });

const load = (file, fb) => {
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); }
  catch { return fb; }
};
const save = (file, d) => fs.writeFileSync(path.join(DATA, file), JSON.stringify(d, null, 2), 'utf8');

const CFG = load('config.json', {});
if (process.env.BOT_TOKEN) CFG.token = process.env.BOT_TOKEN;
if (process.env.CLIENT_ID) CFG.clientId = process.env.CLIENT_ID;
if (process.env.GUILD_ID) CFG.guildId = process.env.GUILD_ID;
if (!CFG.autoRoles) CFG.autoRoles = [];
if (!CFG.logsChannel) CFG.logsChannel = '';
if (!CFG.automod) CFG.automod = { antispam: true, badwords: true, badwordsList: ['كسم', 'نكت', 'xnxx', 'porn', 'sex', 'incest'], antispamLimit: 5, antispamTime: 10 };
if (!CFG.welcomeChannel) CFG.welcomeChannel = '';
if (!CFG.primaryCurrency) CFG.primaryCurrency = 'usd';
if (!CFG.welcomeMessage) CFG.welcomeMessage = 'مرحباً بك {user} في السيرفر! 👋';
save('config.json', CFG);

const getCategories = () => load('categories.json', DEFAULT_CATEGORIES);
const saveCategories = (cats) => save('categories.json', cats);
const DEFAULT_SERVICES = [
  // 🤖 أدوات الذكاء الاصطناعي
  { id: 1, name: 'ChatGPT Plus اشتراك شهري', description: 'اشتراك ChatGPT Plus لمدة شهر — GPT-4o — غير محدود', price: 250000000, category: 'ai', emoji: '🤖', active: true },
  { id: 2, name: 'Claude Pro اشتراك شهري', description: 'اشتراك Claude Pro لمدة شهر — Claude 3.5 Sonnet — 5x أكثر', price: 250000000, category: 'ai', emoji: '🧠', active: true },
  { id: 3, name: 'Midjourney اشتراك', description: 'اشتراك Midjourney — توليد صور بالذكاء الاصطناعي — 30 ساعة شهرياً', price: 416667000, category: 'ai', emoji: '🖼️', active: true },
  { id: 4, name: 'Suno AI توليد موسيقى', description: 'توليد موسيقى بالذكاء الاصطناعي — أي جنس — صوت احترافي', price: 125000000, category: 'ai', emoji: '🎵', active: true },
  { id: 5, name: 'ElevenLabs صوت AI', description: 'تحويل نص لكلام صوتي بالذكاء الاصطناعي — أصوات واقعية — أي لغة', price: 83333000, category: 'ai', emoji: '🔊', active: true },
  { id: 6, name: 'CapCut Pro اشتراك', description: 'اشتراك CapCut Pro — مونتاج بالذكاء الاصطناعي — ميزات متقدمة', price: 133333000, category: 'ai', emoji: '✂️', active: true },
  { id: 7, name: 'توليد صور AI', description: 'توليد أي صورة بالذكاء الاصطناعي — DALL-E 3 — 3 صور', price: 16667000, category: 'ai', emoji: '📸', active: true },
  { id: 8, name: 'صوت AI — نص لكلام', description: 'تحويل أي نص لصوت طبيعي — اختيار الصوت واللغة والسرعة', price: 16667000, category: 'ai', emoji: '🎙️', active: true },
  { id: 9, name: 'صوت AI — كلام لنص', description: 'تحويل أي تسجيل صوتي لنص مكتوب — بدقة عالية + سرعة', price: 16667000, category: 'ai', emoji: '📝', active: true },
  { id: 10, name: 'تحليل بيانات AI', description: 'تحليل أي مجموعة بيانات بالذكاء الاصطناعي — رسوم بيانية + تقارير', price: 83333000, category: 'ai', emoji: '📊', active: true },
  { id: 11, name: 'كتابة محتوى بالـ AI', description: 'كتابة مقالات أو سكريبتات أو محتوى تسويقي بالذكاء الاصطناعي', price: 25000000, category: 'ai', emoji: '✍️', active: true },
  { id: 12, name: 'تصميم لوجو بالـ AI', description: 'تصميم لوجو بالذكاء الاصطناعي — أي ستايل — تعديلات', price: 25000000, category: 'ai', emoji: '🎨', active: true },
  // 📺 اشتراكات البث
  { id: 13, name: 'Netflix اشتراك شهري', description: 'اشتراك Netflix لمدة شهر — فردي أو مشترك — 4K', price: 666667000, category: 'subscriptions', emoji: '🎬', active: true },
  { id: 14, name: 'Spotify Premium', description: 'اشتراك Spotify Premium لمدة شهر — بدون إعلانات — تحميل', price: 416667000, category: 'subscriptions', emoji: '🎵', active: true },
  { id: 15, name: 'YouTube Premium', description: 'اشتراك YouTube Premium لمدة شهر — بدون إعلانات — خلف الشاشة', price: 500000000, category: 'subscriptions', emoji: '▶️', active: true },
  { id: 16, name: 'Disney+ / Prime Video', description: 'اشتراك Disney+ أو Amazon Prime Video لمدة شهر', price: 416667000, category: 'subscriptions', emoji: '🏰', active: true },
  { id: 17, name: 'Crunchyroll أنمي', description: 'اشتراك Crunchyroll — أنمي بدون إعلانات — ترجمة عربية', price: 333333000, category: 'subscriptions', emoji: '🎌', active: true },
  { id: 18, name: 'Canva Pro اشتراك', description: 'اشتراك Canva Pro — تصميم بدون حدود — قوالب احترافية', price: 500000000, category: 'subscriptions', emoji: '🎨', active: true },
  // 🎨 التصميم
  { id: 19, name: 'تصميم لوجو احترافي', description: 'تصميم لوجو احترافي — أحجام متعددة — شفاف — أي ستايل', price: 250000000, category: 'design', emoji: '✏️', active: true },
  { id: 20, name: 'تصميم بوستر إعلاني', description: 'تصميم بوستر إعلاني أو ترويجي — جودة عالية + تعديلات', price: 166667000, category: 'design', emoji: '🖼️', active: true },
  { id: 21, name: 'تصميم بانر', description: 'تصميم بانر لسوشيال ميديا أو ويب — جميع الأحجام', price: 125000000, category: 'design', emoji: '🎨', active: true },
  { id: 22, name: 'تصميم UI/UX', description: 'تصميم واجهة مستخدم احترافية — Mockups + Prototypes', price: 500000000, category: 'design', emoji: '📱', active: true },
  { id: 23, name: 'تصميم هوية بصرية', description: 'تصميم هوية بصرية كاملة — لوجو + ألوان + خطوط + بطاقات', price: 833333000, category: 'design', emoji: '💼', active: true },
  { id: 24, name: 'تصميم Thumbnail يوتيوب', description: 'تصميم صورة غلاف لليوتيوب — جذابة + احترافية + عالية الجودة', price: 83333000, category: 'design', emoji: '📺', active: true },
  { id: 25, name: '_retouch_ صور', description: 'retouch احترافي للصور — تنعيم البشرة — إزالة العيوب — تحسين الألوان', price: 50000000, category: 'design', emoji: '🖌️', active: true },
  { id: 26, name: 'إزالة الخلفية', description: 'إزالة خلفية الصورة بدقة — استبدال أو شفاف', price: 16667000, category: 'design', emoji: '✂️', active: true },
  // 🎬 المونتاج
  { id: 27, name: 'مونتاج فيديو احترافي', description: 'مونتاج فيديو احترافي — قص + ترتيب + انتقالات + موسيقى', price: 500000000, category: 'montage', emoji: '🎬', active: true },
  { id: 28, name: 'مونتاج Reels / تيك توك', description: 'مونتاج ريلز أو تيك توك — سرعة + تأثيرات + موسيقى ترند', price: 166667000, category: 'montage', emoji: '📱', active: true },
  { id: 29, name: 'مونتاج يوتيوب', description: 'مونتاج فيديو يوتيوب كامل — قص + موسيقى + تأثيرات + ترجمة', price: 833333000, category: 'montage', emoji: '▶️', active: true },
  { id: 30, name: 'تصميم إنтро/أوترو', description: 'تصميم مقدمة ونهاية للفيديوهات — أنيميشن + لوجو', price: 250000000, category: 'montage', emoji: '✨', active: true },
  { id: 31, name: 'موشن جرافيك', description: 'تصميم موشن جرافيك — أنيميشن — شرح — إعلانات متحركة', price: 833333000, category: 'montage', emoji: '🎭', active: true },
  { id: 32, name: 'إنشاء فيديو AI', description: 'إنشاء فيديو بالذكاء الاصطناعي — كرتوني أو واقعي — جودة HD', price: 166667000, category: 'montage', emoji: '🤖', active: true },
  // 💻 البرمجة
  { id: 33, name: 'بوت Discord مخصص', description: 'إنشاء بوت Discord مخصص — أوامر + تذاكر + أتمتة + إدارة', price: 500000000, category: 'dev', emoji: '🤖', active: true },
  { id: 34, name: 'تطوير موقع ويب كامل', description: 'تطوير موقع ويب كامل — تصميم + كود + ربط + استضافة', price: 1666667000, category: 'dev', emoji: '🌐', active: true },
  { id: 35, name: 'Landing Page', description: 'تصميم صفحة هبوط احترافية — متجاوبة + سريعة + تحويل عالي', price: 333333000, category: 'dev', emoji: '📄', active: true },
  { id: 36, name: 'تطوير تطبيق موبايل', description: 'تطوير تطبيق موبايل كامل — Android أو iOS — تصميم + كود', price: 2500000000, category: 'dev', emoji: '📱', active: true },
  { id: 37, name: 'سكربت أتمتة', description: 'كتابة سكربت لأتمتة أي مهمة — Python, JS — سريع وموثوق', price: 250000000, category: 'dev', emoji: '⚙️', active: true },
  { id: 38, name: 'إعداد WordPress', description: 'إعداد و تخصيص موقع WordPress — ثيم + بلاغينات + إعداد', price: 166667000, category: 'dev', emoji: '🔧', active: true },
  { id: 39, name: 'ربط API', description: 'ربط أي API مع مشروعك — REST + JSON + أمان', price: 166667000, category: 'dev', emoji: '🔗', active: true },
  { id: 40, name: 'إصلاح مشكلة برمجية', description: 'إصلاح أي bug أو مشكلة في كودك — أي لغة برمجة', price: 83333000, category: 'dev', emoji: '🐛', active: true },
  // 📚 الخدمات الأكاديمية
  { id: 41, name: 'كتابة مقالات أكاديمية', description: 'كتابة أي نوع من المقالات — أكاديمي، تسويقي، تقني، إبداعي', price: 166667000, category: 'academic', emoji: '📝', active: true },
  { id: 42, name: 'ترجمة احترافية', description: 'ترجمة أي نص — بدقة عالية + سياق طبيعي + مراجعة', price: 125000000, category: 'academic', emoji: '🌐', active: true },
  { id: 43, name: 'حلول رياضيات', description: 'حلول مسائل رياضيات — جبر — حساب تفاضلي — احصاء — أي مستوى', price: 83333000, category: 'academic', emoji: '🔢', active: true },
  { id: 44, name: 'حلول فيزياء', description: 'حلول مسائل فيزياء — ميكانيكا — كهرباء — أي مستوى', price: 83333000, category: 'academic', emoji: '⚛️', active: true },
  { id: 45, name: 'تصميم CV / سيرة ذاتية', description: 'تصميم سيرة ذاتية احترافية — جذابة — متوافقة مع ATS', price: 83333000, category: 'academic', emoji: '📋', active: true },
  { id: 46, name: 'ملخصات ومراجعات', description: 'عمل ملخصات وشيتات مذاكرة لأي مادة — مرتّبة ومفصّلة', price: 50000000, category: 'academic', emoji: '📖', active: true },
  // ⚡ خدمات عامة
  { id: 47, name: 'إعداد سيرفر Discord', description: 'إعداد سيرفر كامل — رولات + قنوات + صلاحيات + بوتات + ترحيب', price: 166667000, category: 'general', emoji: '🎮', active: true },
  { id: 48, name: 'مساعدة برمجية', description: 'مساعدة في أي لغة برمجة — Python, JS, C++, Java, PHP', price: 83333000, category: 'general', emoji: '💻', active: true },
  { id: 49, name: 'كتابة محتوى تسويقي', description: 'كتابة محتوى تسويقي — إعلانات — وصف منتج — سوشيال ميديا', price: 125000000, category: 'general', emoji: '📢', active: true },
  { id: 50, name: 'إدارة سوشيال ميديا', description: 'إدارة حسابات سوشيال ميديا — محتوى + جدولة + تفاعل', price: 500000000, category: 'general', emoji: '📱', active: true },
  { id: 51, name: 'إعداد متجر إلكتروني', description: 'إعداد متجر إلكتروني كامل — منتجات + سلة + دفع إلكتروني', price: 833333000, category: 'general', emoji: '🛒', active: true },
  { id: 52, name: 'كوسات وتدريب', description: 'دورة تدريبية في أي مجال — تصميم — برمجة — تسويق — على مكالمتك', price: 250000000, category: 'general', emoji: '🎓', active: true },
  // 🏗️ بروجيكتات بالطلب
  { id: 53, name: 'بروجيكت ويب كامل بالطلب', description: 'أي بروجيكت ويب بالطلب — وصف متطلباتك وهننفذهولك', price: 500000000, category: 'projects', emoji: '🌐', active: true },
  { id: 54, name: 'بروجيكت موبايل بالطلب', description: 'أي تطبيق موبايل بالطلب — Android أو iOS — وصف متطلباتك', price: 500000000, category: 'projects', emoji: '📱', active: true },
  { id: 55, name: 'بروجيكت برمجي خاص', description: 'أي بروجيكت برمجي بالطلب — سكربتات — أتمتة — أدوات', price: 300000000, category: 'projects', emoji: '⚙️', active: true },
  { id: 56, name: 'بروجيكت تصميم بالطلب', description: 'أي تصميم بالطلب — لوجو — بوستر — هوية بصرية', price: 166667000, category: 'projects', emoji: '🎨', active: true },
  { id: 57, name: 'بروجيكت مونتاج بالطلب', description: 'أي فيديو أو مونتاج بالطلب — ريلز — يوتيوب — إعلانات', price: 300000000, category: 'projects', emoji: '🎬', active: true },
  { id: 58, name: 'بروجيكت أكاديمي بالطلب', description: 'أي عمل أكاديمي بالطلب — بحث — تقرير — عرض', price: 166667000, category: 'projects', emoji: '📚', active: true },
  { id: 59, name: 'بروجيكت خاص بأي خدمة', description: 'مش لاقي الخدمة اللي عايزها؟ اطلب أي خدمة خاصة واحنا هننفذهالك', price: 83333000, category: 'projects', emoji: '✨', active: true },
  // 📱 حسابات واشتراكات رقمية
  { id: 60, name: 'حساب Steam مميز', description: 'حساب Steam بألعاب مميزة — أو شحن محفظة Steam', price: 250000000, category: 'accounts', emoji: '🎮', active: true },
  { id: 61, name: 'PlayStation Plus اشتراك', description: 'اشتراك PlayStation Plus — ألعاب مجانية — أونلاين', price: 333333000, category: 'accounts', emoji: '🎮', active: true },
  { id: 62, name: 'Xbox Game Pass اشتراك', description: 'اشتراك Xbox Game Pass — مئات الألعاب — PC + Console', price: 333333000, category: 'accounts', emoji: '🟢', active: true },
  { id: 63, name: 'Adobe Creative Cloud', description: 'اشتراك Adobe — Photoshop + Illustrator + Premiere + كل البرامج', price: 500000000, category: 'accounts', emoji: '🎨', active: true },
  { id: 64, name: 'حسابات تطبيقات مميزة', description: 'حسابات مميزة لأي تطبيق — أدوبي — فوتوشاوب — أي حاجة', price: 166667000, category: 'accounts', emoji: '📱', active: true },
  // 📢 خدمات السوشيال ميديا
  { id: 65, name: 'زيادة متابعين انستجرام', description: 'زيادة متابعين حقيقيين لحسابك على انستجرام — فوري + آمن', price: 166667000, category: 'social', emoji: '📸', active: true },
  { id: 66, name: 'زيادة متابعين تيك توك', description: 'زيادة متابعين ومشاهدات لحسابك على تيك توك — فوري', price: 166667000, category: 'social', emoji: '🎵', active: true },
  { id: 67, name: 'زيادة متابعين يوتيوب', description: 'زيادة مشتركين ومشاهدات لقناتك على يوتيوب — فوري', price: 250000000, category: 'social', emoji: '▶️', active: true },
  { id: 68, name: 'تصميم محتوى سوشيال', description: 'تصميم بوستات — ريلز — ستوريز — لجميع المنصات', price: 83333000, category: 'social', emoji: '🎨', active: true },
  { id: 69, name: 'إدارة حساب سوشيال ميديا', description: 'إدارة حسابك على أي منصة — محتوى + جدولة + تفاعل — لمدة شهر', price: 500000000, category: 'social', emoji: '📱', active: true },
  // 📦 منتجات رقمية جاهزة
  { id: 70, name: 'قوالب بوتات Discord', description: 'قوالب جاهزة لبوتات ديسكورد — جاهزة للتعديل والتشغيل', price: 50000000, category: 'products', emoji: '🤖', active: true },
  { id: 71, name: 'قوالب مواقع', description: 'قوالب جاهزة لمواقع الويب — HTML + CSS — متجاوبة', price: 50000000, category: 'products', emoji: '🌐', active: true },
  { id: 72, name: 'قوالب عروض تقديمية', description: 'قوالب PowerPoint / Google Slides — احترافية ومتنوعة', price: 25000000, category: 'products', emoji: '📊', active: true },
  { id: 73, name: 'إيموجيز وستيكرز مخصصة', description: 'تصميم إيموجيز وستيكرز مخصصة لسيرفرك أو تطبيقك', price: 50000000, category: 'products', emoji: '😀', active: true },
  { id: 74, name: 'خطوط وأصول تصميم', description: 'خطوط عربية وإنجليزية + عناصر تصميم جاهزة', price: 25000000, category: 'products', emoji: '🔤', active: true },
];
const DEFAULT_CATEGORIES = [
  { id: 'ai', name: 'أدوات الذكاء الاصطناعي', emoji: '🤖' },
  { id: 'subscriptions', name: 'اشتراكات البث', emoji: '📺' },
  { id: 'design', name: 'التصميم', emoji: '🎨' },
  { id: 'montage', name: 'المونتاج', emoji: '🎬' },
  { id: 'dev', name: 'البرمجة والتطوير', emoji: '💻' },
  { id: 'academic', name: 'الخدمات الأكاديمية', emoji: '📚' },
  { id: 'general', name: 'خدمات عامة', emoji: '⚡' },
  { id: 'projects', name: 'بروجيكتات بالطلب', emoji: '🏗️' },
  { id: 'accounts', name: 'حسابات واشتراكات رقمية', emoji: '🔑' },
  { id: 'social', name: 'خدمات السوشيال ميديا', emoji: '📢' },
  { id: 'products', name: 'منتجات رقمية جاهزة', emoji: '📦' },
];

const getServices  = () => load('services.json', DEFAULT_SERVICES);
const getReviews   = () => load('reviews.json', []);
const getOrders    = () => load('orders.json', []);
const getWarnings  = () => load('warnings.json', []);

const getGiveaways = () => load('giveaways.json', []);
const getSpamData  = () => load('spam.json', []);
const getRaidData  = () => load('raid.json', []);

// ══════════════════════════════════════════════════════════════
//  HELPERS
// ══════════════════════════════════════════════════════════════
const sleep = ms => new Promise(r => setTimeout(r, ms));

function fmt(n) {
  const num = Number(n) || 0;
  if (num >= 1e9) return (num / 1e9).toFixed(1) + 'B';
  if (num >= 1e6) return (num / 1e6).toFixed(num % 1e6 === 0 ? 0 : 1) + 'M';
  if (num >= 1e3) return (num / 1e3).toFixed(0) + 'K';
  return num.toLocaleString('en-US');
}

function safe(val, max = 1000) {
  if (val == null) return '';
  return String(val).replace(/[\u0000-\u001F\u007F-\u009F]/g, '').substring(0, max);
}

function nextId(arr) {
  if (!arr.length) return 1;
  let mx = 0;
  for (const item of arr) { const id = Number(item.id) || 0; if (id > mx) mx = id; }
  return mx + 1;
}

function ts() { return `<t:${Math.floor(Date.now() / 1000)}:R>`; }


async function sendLog(guild, embed) {
  if (!CFG.logsChannel) return;
  const ch = guild.channels.cache.get(CFG.logsChannel);
  if (!ch) return;
  try { await ch.send({ embeds: [embed] }); } catch {}
}

// ══════════════════════════════════════════════════════════════
//  CLIENT
// ══════════════════════════════════════════════════════════════
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.MessageContent,
  ],
  partials: [Partials.Channel, Partials.Message, Partials.GuildMember],
});

// ══════════════════════════════════════════════════════════════
//  ANTI-SPAM
// ══════════════════════════════════════════════════════════════
const spamTracker = new Map();
const applyTempData = new Map();

function checkSpam(userId) {
  if (!CFG.automod || !CFG.automod.antispam) return false;
  const limit = CFG.automod.antispamLimit || 5;
  const time = (CFG.automod.antispamTime || 10) * 1000;
  const now = Date.now();
  if (!spamTracker.has(userId)) spamTracker.set(userId, []);
  const msgs = spamTracker.get(userId).filter(t => now - t < time);
  msgs.push(now);
  spamTracker.set(userId, msgs);
  return msgs.length >= limit;
}

function checkBadWords(text) {
  if (!CFG.automod || !CFG.automod.badwords) return false;
  const lower = text.toLowerCase();
  return (CFG.automod.badwordsList || []).some(w => lower.includes(w.toLowerCase()));
}

// ══════════════════════════════════════════════════════════════
//  SLASH COMMANDS
// ══════════════════════════════════════════════════════════════
const COMMANDS = [
  // ── Admin ──
  new SlashCommandBuilder().setName('setup').setDescription('جهّز السيرفر كلّه')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('add-service').setDescription('ضيف خدمة جديدة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('name').setDescription('اسم الخدمة').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('الوصف').setRequired(true))
    .addNumberOption(o => o.setName('price').setDescription('السعر').setRequired(true))
    .addStringOption(o => o.setName('category').setDescription('معرف التصنيف (اكتب /list-categories)').setRequired(true))
    .addStringOption(o => o.setName('emoji').setDescription('إيموجي')),
  new SlashCommandBuilder().setName('remove-service').setDescription('امسح خدمة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('id').setDescription('رقم الخدمة').setRequired(true)),
  new SlashCommandBuilder().setName('edit-service').setDescription('عدّل خدمة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('id').setDescription('رقم الخدمة').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('اسم جديد'))
    .addNumberOption(o => o.setName('price').setDescription('سعر جديد'))
    .addStringOption(o => o.setName('description').setDescription('وصف جديد')),
  new SlashCommandBuilder().setName('announce').setDescription('ابعت إعلان')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('title').setDescription('العنوان').setRequired(true))
    .addStringOption(o => o.setName('content').setDescription('المحتوى').setRequired(true))
    .addStringOption(o => o.setName('emoji').setDescription('إيموجي')),
  new SlashCommandBuilder().setName('auto-role').setDescription('إدارة الرولات التلقائية')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('add').setDescription('ضيف رول').addRoleOption(o => o.setName('role').setDescription('الرول').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('امسح رول').addRoleOption(o => o.setName('role').setDescription('الرول').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('عرض القائمة'))
    .addSubcommand(sub => sub.setName('clear').setDescription('مسح كل الرولات')),
  new SlashCommandBuilder().setName('set-logs').setDescription('حدّد قناة السجلات')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o => o.setName('channel').setDescription('القناة').setRequired(true)),
  new SlashCommandBuilder().setName('automod').setDescription('إعداد الحماية التلقائية')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('antispam').setDescription('شغّل/وقف منع السبام')
      .addStringOption(o => o.setName('state').setDescription('on/off').setRequired(true)
        .addChoices({ name: 'شغّل', value: 'on' }, { name: 'وقف', value: 'off' })))
    .addSubcommand(sub => sub.setName('badwords').setDescription('شغّل/وقف فلتر الكلمات')
      .addStringOption(o => o.setName('state').setDescription('on/off').setRequired(true)
        .addChoices({ name: 'شغّل', value: 'on' }, { name: 'وقف', value: 'off' })))
    .addSubcommand(sub => sub.setName('add-word').setDescription('ضيف كلمة ممنوعة')
      .addStringOption(o => o.setName('word').setDescription('الكلمة').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove-word').setDescription('امسح كلمة ممنوعة')
      .addStringOption(o => o.setName('word').setDescription('الكلمة').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('عرض الإعدادات')),
  new SlashCommandBuilder().setName('add-category').setDescription('ضيف تصنيف جديد')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('id').setDescription('معرف التصنيف (انجليزي)').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('اسم التصنيف بالعربي').setRequired(true))
    .addStringOption(o => o.setName('emoji').setDescription('إيموجي التصنيف')),
  new SlashCommandBuilder().setName('remove-category').setDescription('امسح تصنيف')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('id').setDescription('معرف التصنيف').setRequired(true)),
  new SlashCommandBuilder().setName('list-categories').setDescription('عرض التصنيفات'),

  // ── Moderation ──
  new SlashCommandBuilder().setName('ban').setDescription('احظر عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب')),
  new SlashCommandBuilder().setName('kick').setDescription('طرد عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب')),
  new SlashCommandBuilder().setName('mute').setDescription('كتم عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addNumberOption(o => o.setName('minutes').setDescription('المدة بالدقائق').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب')),
  new SlashCommandBuilder().setName('unmute').setDescription('فكّ كتم')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),
  new SlashCommandBuilder().setName('warn').setDescription('حدّر عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب').setRequired(true)),
  new SlashCommandBuilder().setName('warnings').setDescription('شوف تحذيرات عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),
  new SlashCommandBuilder().setName('clear-warnings').setDescription('امسح تحذيرات')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),
  new SlashCommandBuilder().setName('purge').setDescription('امسح رسائل')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addNumberOption(o => o.setName('amount').setDescription('العدد').setRequired(true)),

  // ── Shop ──
  new SlashCommandBuilder().setName('services').setDescription('شوف الخدمات'),
  new SlashCommandBuilder().setName('order').setDescription('اطلب خدمة')
    .addStringOption(o => o.setName('service').setDescription('رقم الخدمة').setRequired(true)),
  new SlashCommandBuilder().setName('support').setDescription('افتح تذكرة دعم فني'),
  new SlashCommandBuilder().setName('close').setDescription('اقفل التذكرة'),

  // ── Giveaway ──
  new SlashCommandBuilder().setName('giveaway').setDescription('عمل سحبية')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('prize').setDescription('الجائزة').setRequired(true))
    .addNumberOption(o => o.setName('winners').setDescription('عدد الفائزين').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('المدة (مثلاً 1h, 30m, 1d)').setRequired(true)),
  new SlashCommandBuilder().setName('end-giveaway').setDescription('خلّص السحبية')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('message-id').setDescription('رسالة السحبية').setRequired(true)),

  // ── General ──
  new SlashCommandBuilder().setName('review').setDescription('قيّم خدمة')
    .addStringOption(o => o.setName('service').setDescription('رقم الخدمة').setRequired(true))
    .addNumberOption(o => o.setName('rating').setDescription('التقييم 1-5').setRequired(true))
    .addStringOption(o => o.setName('comment').setDescription('تعليق')),
  new SlashCommandBuilder().setName('leaderboard').setDescription('ترتيب التقييمات'),
  new SlashCommandBuilder().setName('server-info').setDescription('معلومات السيرفر'),
  new SlashCommandBuilder().setName('user-info').setDescription('معلومات عضو')
    .addUserOption(o => o.setName('user').setDescription('العضو')),
  new SlashCommandBuilder().setName('stats').setDescription('إحصائيات البوت'),
  new SlashCommandBuilder().setName('ticket-stats').setDescription('إحصائيات التذاكر'),
  new SlashCommandBuilder().setName('top-customers').setDescription('أفضل الزبائن'),
  new SlashCommandBuilder().setName('help').setDescription('شوف كل الأوامر'),
  new SlashCommandBuilder().setName('banners').setDescription('ولّد بانرات للقنوات وابعتهم'),
];

// ══════════════════════════════════════════════════════════════
//  HANDLER: SETUP
// ══════════════════════════════════════════════════════════════
async function cmdSetup(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const g = interaction.guild;
  const log = [];

  let chs;
  try { chs = await g.channels.fetch(); } catch { chs = g.channels.cache; }
  for (const [, ch] of chs) {
    try { await ch.delete(); log.push(`❌ ${ch.name}`); } catch {}
    await sleep(800);
  }

  let rls;
  try { rls = await g.roles.fetch(); } catch { rls = g.roles.cache; }
  for (const [, r] of rls) {
    if (r.name === '@everyone' || r.managed) continue;
    try { await r.delete(); log.push(`❌ رول ${r.name}`); } catch {}
    await sleep(600);
  }
  await sleep(1500);

  const roles = {};
  const roleDefs = [
    { k: 'owner', n: '👑 ┃ المالك', c: '#FFD700', p: [PermissionFlagsBits.Administrator] },
    { k: 'admin', n: '💎 ┃ ادمن', c: '#E74C3C', p: [PermissionFlagsBits.Administrator] },
    { k: 'mod', n: '⚡ ┃ مشرف', c: '#E67E22', p: [PermissionFlagsBits.BanMembers, PermissionFlagsBits.KickMembers, PermissionFlagsBits.ModerateMembers, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.SendMessages] },
    { k: 'staff', n: '⭐ ┃ ستاف', c: '#F1C40F', p: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.SendMessages] },
    { k: 'trial', n: '🌟 ┃ ستاف تجريبي', c: '#3498DB', p: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.ManageMessages] },
    { k: 'vip', n: '🔥 ┃ VIP', c: '#9B59B6', p: [] },
    { k: 'customer', n: '🛒 ┃ زبون', c: '#1ABC9C', p: [] },
  ];
  for (const rd of roleDefs) {
    try { roles[rd.k] = await g.roles.create({ name: rd.n, color: rd.c, permissions: rd.p }); log.push(`✅ ${rd.n}`); } catch { log.push(`❌ ${rd.n}`); }
    await sleep(600);
  }

  const staffOnly = [
    { id: g.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.staff?.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.admin?.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.owner?.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.mod?.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ].filter(o => o.id);
  const adminOnly = [
    { id: g.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: roles.admin?.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
    { id: roles.owner?.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ].filter(o => o.id);
  const noSend = [{ id: g.id, deny: [PermissionFlagsBits.SendMessages] }];
  const full = [{ id: g.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }];

  const structure = [
    { n: '╔════════════ 🏪 المتجر ════════════', chs: [
      { n: '🛒・الخدمات', p: full },
      { n: '📝・كيف-تطلب', p: noSend },
      { n: '⭐・التقييمات', p: [{ id: g.id, deny: [PermissionFlagsBits.SendMessages] }, ...(roles.customer ? [{ id: roles.customer.id, allow: [PermissionFlagsBits.SendMessages] }] : [])] },
      { n: '💬・التواصل-مع-الستاف', p: full },
    ]},
    { n: '╔════════════ 📢 الإعلانات ════════════', chs: [
      { n: '📣・الإعلانات', p: noSend },
      { n: '📋・القواعد', p: noSend },
    ]},
    { n: '╔════════════ 💬 الدردشة ════════════', chs: [
      { n: '💬・العامة', p: full },
      { n: '🤖・اوامر-البوت', p: full },
    ]},
    { n: '╔════════════ 📌 معلومات ════════════', chs: [
      { n: '📊・حالة-السيرفر', p: noSend },
      { n: '👋・الترحيب', p: noSend },
    ]},
    { n: '╔════════════ 🎫 التذاكر ════════════', chs: [
      { n: '🎫・فتح-تذكرة', p: full },
    ]},
    { n: '╔════════════ 📦 التوصيل ════════════', chs: [
      { n: '📦・التسليمات', p: noSend },
    ]},
    { n: '╔════════════ 👔 الستاف ════════════', chs: [
      { n: '💼・شات-الستاف', p: staffOnly },
      { n: '📋・ملاحظات-الستاف', p: staffOnly },
      { n: '📝・تقديم-للادارة', p: full },
    ]},
    { n: '╔════════════ 🛡️ السجلات ════════════', chs: [
      { n: '📝・السجلات', p: noSend },
    ]},
    { n: '╔════════════ ⚙️ الإدارة ════════════', chs: [
      { n: '🔧・لوحة-التحكم', p: adminOnly },
    ]},
  ];

  for (const cat of structure) {
    try {
      const c = await g.channels.create({ name: cat.n, type: ChannelType.GuildCategory });
      log.push(`✅ ${cat.n}`);
      for (const ch of cat.chs) {
        try { await g.channels.create({ name: ch.n, type: ChannelType.GuildText, parent: c.id, permissionOverwrites: ch.p }); log.push(`✅ ${ch.n}`); } catch { log.push(`❌ ${ch.n}`); }
        await sleep(600);
      }
    } catch { log.push(`❌ كاتيقوري`); }
    await sleep(600);
  }

  await sleep(1500);
  try { await g.channels.fetch(); } catch {}

  if (Canvas) {
    console.log('🎨 Canvas available, sending banners...');
    let bannerCount = 0;
    for (const [, ch] of g.channels.cache) {
      if (!ch.isTextBased()) continue;
      const ok = await sendBannerToChannel(ch);
      if (ok) bannerCount++;
      await sleep(800);
    }
    console.log(`🎨 Banners done: ${bannerCount} sent`);
  } else {
    console.log('⚠️ Canvas not available — no banners will be sent');
  }

  const logsCh = g.channels.cache.find(c => c.name.includes('السجلات') && c.isTextBased());
  if (logsCh) { CFG.logsChannel = logsCh.id; save('config.json', CFG); }

  if (!fs.existsSync(path.join(DATA, 'services.json'))) {
    const defaultServices = DEFAULT_SERVICES.map(s => ({ ...s, createdAt: Date.now() }));
    save('services.json', defaultServices);
  }
  if (!fs.existsSync(path.join(DATA, 'categories.json'))) {
    saveCategories(DEFAULT_CATEGORIES);
  }

  // ── 🛒 الخدمات — Embed + Select Menu (تصنيفات أولاً) ──
  const svcCh = g.channels.cache.find(c => c.name.includes('الخدمات') && c.isTextBased());
  if (svcCh) {
    const e = new EmbedBuilder()
      .setTitle('🔥 متجر الذكاء الاصطناعي 🔥')
      .setDescription(
        '## 🚀 أهلاً بيك في أحسن متجر لخدمات الذكاء الاصطناعي\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💥 ليه تختارنا؟\n\n' +
        '## 🔥 سيرفر خدمات يجمع لك كل شي بمكان واحد\n\n' +
        '## 💬 دعم فني شغال 24/7 وما نوقف\n\n' +
        '## 🧰 أدوات وخدمات تساعدك بكل شي تحتاجه\n\n' +
        '## 🤖 ميكر شغال طول الوقت 24/7\n\n' +
        '## 🎨 تصاميم حلوة واحترافية على ذوقك\n\n' +
        '## 🎉 توزيعات وهدايا بشكل مستمر\n\n' +
        '## ⚡ طلباتك تمشي بسرعة وسهولة\n\n' +
        '## 🛠️ تقدر تطلب أي خدمة خاصة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 عايز تطلب إزاي؟\n\n' +
        '**`1️⃣`** اختار التصنيف من القائمة اللي تحت\n\n' +
        '**`2️⃣`** اختار الخدمة اللي عايزها من التصنيف\n\n' +
        '**`3️⃣`** شوف التفاصيل والسعر\n\n' +
        '**`4️⃣`** اضغط على زر **🛒 اطلب دلوقتي**\n\n' +
        '**`5️⃣`** هنفتحلك تذكرة وننجزلك طلبك\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🔗 زور المتجر بتاعنا أونلاين\n\n' +
        '**🛒 [المتجر بتاعنا — اطلب أونلاين](https://ai-shop-bot-production.up.railway.app/shop)**\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💳 طرق الدفع\n\n' +
        '**💰 فودافون كاش** — ابعت على التذكرة\n\n' +
        '**🏦 تحويل بنكي** — ابعت على التذكرة\n\n' +
        '**📱 اتصالات كاش** — ابعت على التذكرة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🏗️ بروجيكتات بالطلب\n\n' +
        '**مش لاقي الخدمة اللي عايزها؟**\n\n' +
        'اكتب في التذكرة أي بروجيكت خاص وهننفذهولك!\n\n' +
        '**ويب — موبايل — تصميم — مونتاج — أي حاجة**\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .setColor(0xFF0000)
      .setThumbnail(g.iconURL({ dynamic: true }))
      .setTimestamp()
      .setFooter({ text: `🛍️ ${g.name} — متجر الذكاء الاصطناعي`, iconURL: g.iconURL({ dynamic: true }) });
    const cats = getCategories();
    const services = getServices();
    const catSelect = new StringSelectMenuBuilder()
      .setCustomId('category_menu')
      .setPlaceholder('📂 اختار التصنيف الأول...')
      .addOptions(cats.map(c => {
        const count = services.filter(s => s.category === c.id && s.active).length;
        return {
          label: `${c.emoji} ${c.name}`.substring(0, 100),
          description: `${count} خدمة متاحة`.substring(0, 100),
          value: c.id,
        };
      }));
    const row1 = new ActionRowBuilder().addComponents(catSelect);
    const row2 = new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId('open_ticket_support').setLabel('🛠️ دعم فني').setStyle(ButtonStyle.Secondary),
      new ButtonBuilder().setLabel('🛒 زيارة المتجر').setStyle(ButtonStyle.Link).setURL('https://ai-shop-bot-production.up.railway.app/shop'),
    );
    await svcCh.send({ embeds: [e], components: [row1, row2] }).catch(() => {});
  }

  // ── 📝 كيف تطلب — Embed محسّن ──
  const howCh = g.channels.cache.find(c => c.name.includes('كيف-تطلب') && c.isTextBased());
  if (howCh) {
    await howCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━ 📝 دليل طلب الخدمة ━━━━━━━━')
      .setDescription(
        '## 📝 دليل طلب الخدمة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## اتبع الخطوات دي:\n\n' +
        '**`1️⃣`** 🛒 اختار الخدمة من قناة **🛒・الخدمات**\n\n' +
        '**`2️⃣`** 📋 شوف التفاصيل والسعر بتاعها\n\n' +
        '**`3️⃣`** 💬 اضغط زر **🛒 اطلب دلوقتي** عشان تفتح تذكرة\n\n' +
        '**`4️⃣`** 💰 ادفع بالطريقة اللي تناسبك\n\n' +
        '**`5️⃣`** ✅ الستاف هينفّذ طلبك ويسلّملك\n\n' +
        '**`6️⃣`** ⭐ قيّم تجربتك بـ `/review`\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 نصايح مهمة\n\n' +
        '• تأكد إنك اختارت الخدمة الصح قبل ما تطلب\n' +
        '• احتفظ بإيصال الدفع\n' +
        '• لو عندك سؤال، استخدم قناة **💬・التواصل-مع-الستاف**\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .setColor(0x2ECC71)
      .setTimestamp()
      .setFooter({ text: `🛍️ ${g.name}`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── 📋 القواعد ──
  const rulesCh = g.channels.cache.find(c => c.name.includes('القواعد') && c.isTextBased());
  if (rulesCh) {
    await rulesCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 📋 قواعد السيرفر ━━━━━━━━━━')
      .setDescription(
        '## 📋 قواعد السيرفر\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📌 القسم الأول — السلوك العام\n\n' +
        '**1.** 🤝 **الاحترام المتبادل** — ممنوع الإهانة أو السخرية من أي حد\n' +
        '**2.** 🚫 **ممنوع المحتوى المخالف** — أي محتوى خارج أو عنصري ممنوع\n' +
        '**3.** 🗣️ **اللغة العربية** — الأفضل تتكلم عربي\n' +
        '**4.** 🔞 **ممنوع محتوى 18+** — أي محتوى للبالغين ممنوع\n\n' +
        '## 📌 القسم الثاني — الطلبات والخدمات\n\n' +
        '**5.** 💰 **الدفع مقدم** — مفيش طلب يتنفذ من غير دفع\n' +
        '**6.** 📋 **التفاصيل الصح** — تأكد إن البيانات بتاعتك صحيحة\n' +
        '**7.** ⏳ **الانتظار** — الستاف بيشتغلوا بالترتيب\n\n' +
        '## 📌 القسم الثالث — الحماية والخصوصية\n\n' +
        '**8.** 🔒 **ممنوع تشارك حساباتك** — ممنوع حد يشارك بياناتك\n' +
        '**9.** 🛡️ **ممنوع السبام** — ممنوع إرسال رسائل متكررة\n\n' +
        '## 📌 القسم الرابع — القيادة\n\n' +
        '**10.** 👑 **-slotted ا服从 الستاف** — أوامر الستاف نهائية\n' +
        '**11.** 📢 **ممنوع سبام الأوامر** — ممنوع تكرر الاستفسارات\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ⚠️ عقوبات المخالفات\n\n' +
        '**مخالفة أولى:** تحذير شفهي\n' +
        '**مخالفة ثانية:** كتم لمدة ساعة\n' +
        '**مخالفة ثالثة:** طرد من السيرفر\n' +
        '**مخالفة رابعة:** حظر دائم\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📝 لماتدخل السيرفر، أنت موافق على القواعد دي'
      )
      .setColor(0xE67E22)
      .setTimestamp()
      .setFooter({ text: `⚖️ ${g.name} — القواعد والإرشادات`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── 🎫 فتح تذكرة ──
  const ticketCh = g.channels.cache.find(c => c.name.includes('فتح-تذكرة') && c.isTextBased());
  if (ticketCh) {
    const btn2 = new ButtonBuilder().setCustomId('open_ticket_support').setLabel('🛠️ دعم فني').setStyle(ButtonStyle.Primary);
    const btnShop = new ButtonBuilder().setLabel('🛒 زيارة المتجر').setStyle(ButtonStyle.Link).setURL('https://ai-shop-bot-production.up.railway.app/shop');
    await ticketCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 🎫 افتح تذكرة ━━━━━━━━━━')
      .setDescription(
        '## 🎫 افتح تذكرة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## محتاج مساعدة؟ افتح تذكرة دعم فني\n\n' +
        '## 🛠️ الدعم الفني\n' +
        '• للمساعدة في الطلبات\n' +
        '• للأسئلة عن الخدمات\n' +
        '• للشكاوى والاقتراحات\n\n' +
        '## ⏰ وقت الاستجابة\n' +
        '**من 5 لـ 15 دقيقة**\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 نصيحة\n\n' +
        'قبل ما تفتح تذكرة، تأكد إن الإجابة موجودة في:\n' +
        '• قناة **📝・كيف-تطلب** — عشان تعرف تطلب إزاي\n' +
        '• قناة **🤖・اوامر-البوت** — عشان تشوف كل الأوامر\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .setColor(0x9B59B6)
      .setTimestamp()
      .setFooter({ text: `🎫 ${g.name}`, iconURL: g.iconURL({ dynamic: true }) })
    ], components: [new ActionRowBuilder().addComponents(btn2, btnShop)] }).catch(() => {});
  }

  // ── 📝 تقديم للادارة ──
  const applyCh = g.channels.cache.find(c => c.name.includes('تقديم-للادارة') && c.isTextBased());
  if (applyCh) {
    await applyCh.send({ embeds: [new EmbedBuilder()
      .setTitle('🔥 تقديم للادارة 🔥')
      .setDescription(
        '## 📝 تقديم للانضمام لفريق الستاف\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🎯 عايز تكون من الستاف؟\n\n' +
        'اضغط الزر اللي تحت واملأ الاستبيان\n' +
        'هنراجع طلبك ونتواصل معاك\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📋 المتطلبات\n\n' +
        '✅ **عمرك فوق 16 سنة**\n' +
        '✅ **بتتكلم عربي كويس**\n' +
        '✅ **بتعرف تشتغل على ديسكورد**\n' +
        '✅ **عندك وقت فاضي تساعد الناس**\n' +
        '✅ **متمرن وصبور ومحترم**\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 نصايح\n\n' +
        '• اكتب إجابات واقعية ومفصّلة\n' +
        '• متخليش الإجابات قصيرة\n' +
        '• كن صادق في إجاباتك\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .setColor(0xFF6B00)
      .setTimestamp()
      .setFooter({ text: `📝 ${g.name} — تقديم للادارة`, iconURL: g.iconURL({ dynamic: true }) })],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('apply_staff').setLabel('📝 قدّم الآن').setStyle(ButtonStyle.Success),
      )]
    }).catch(() => {});
  }
  // ── 🔧 لوحة التحكم ──
  const adminPanelCh = g.channels.cache.find(c => c.name.includes('لوحة-التحكم') && c.isTextBased());

  await interaction.editReply(`✅ تم الإعداد!\n\n${log.join('\n')}`);
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: SHOP
// ══════════════════════════════════════════════════════════════
async function cmdServices(interaction) {
  const services = getServices().filter(s => s.active);
  if (!services.length) return interaction.reply({ content: '📭 مفيش خدمات حالياً', ephemeral: true });
  const cats = getCategories();
  const catMap = {};
  for (const c of cats) catMap[c.id] = c;
  const grouped = {};
  for (const s of services) { const cat = s.category || 'other'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(s); }
  const embed = new EmbedBuilder().setTitle('🛒 الخدمات المتاحة').setDescription('اختار خدمة من القائمة').setColor(0xFF0000).setTimestamp().setFooter({ text: `${services.length} خدمة` });
  for (const [catId, items] of Object.entries(grouped)) {
    const catInfo = catMap[catId] || { name: catId, emoji: '📁' };
    embed.addFields({ name: `${catInfo.emoji} ${catInfo.name}`, value: items.map(s => `${s.emoji || '🛒'} **${safe(s.name, 40)}** — \`${fmt(s.price)}\``).join('\n') });
  }
  const select = new StringSelectMenuBuilder().setCustomId('services_menu').setPlaceholder('🛒 اختار خدمة...').addOptions(services.slice(0, 25).map(s => ({ label: `${s.emoji || '🛒'} ${s.name}`.substring(0, 100), description: `${fmt(s.price)} كريديت`.substring(0, 100), value: String(s.id) })));
  await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(select)] });
}

async function cmdAddService(interaction) {
  const name = interaction.options.getString('name'), desc = interaction.options.getString('description'), price = interaction.options.getNumber('price'), category = interaction.options.getString('category'), emoji = interaction.options.getString('emoji') || '🛒';
  const cats = getCategories();
  const catInfo = cats.find(c => c.id === category);
  const services = getServices();
  const id = nextId(services);
  services.push({ id, name, description: desc, price, category, emoji, active: true, createdAt: Date.now() });
  save('services.json', services);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`${emoji} ${name}`).setDescription(desc).addFields({ name: '💰 السعر', value: `\`${fmt(price)}\``, inline: true }, { name: '📂 التصنيف', value: catInfo ? `${catInfo.emoji} ${catInfo.name}` : category, inline: true }, { name: '🆔', value: `${id}`, inline: true }).setColor(0x2ECC71).setTimestamp()], ephemeral: true });
}

async function cmdEditService(interaction) {
  const id = parseInt(interaction.options.getString('id')), services = getServices(), svc = services.find(s => s.id === id);
  if (!svc) return interaction.reply({ content: '❌ الخدمة مش موجودة', ephemeral: true });
  const name = interaction.options.getString('name'), price = interaction.options.getNumber('price'), desc = interaction.options.getString('description');
  if (name) svc.name = name; if (price) svc.price = price; if (desc) svc.description = desc;
  save('services.json', services);
  await interaction.reply({ content: `✅ تم التعديل: ${svc.emoji} ${svc.name} — \`${fmt(svc.price)}\``, ephemeral: true });
}

async function cmdRemoveService(interaction) {
  const id = parseInt(interaction.options.getString('id')), services = getServices(), svc = services.find(s => s.id === id);
  if (!svc) return interaction.reply({ content: '❌ مش موجودة', ephemeral: true });
  save('services.json', services.filter(s => s.id !== id));
  await interaction.reply({ content: `✅ تم المسح: ${svc.emoji} ${svc.name}`, ephemeral: true });
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: CATEGORIES
// ══════════════════════════════════════════════════════════════
async function cmdAddCategory(interaction) {
  const id = interaction.options.getString('id').toLowerCase().replace(/[^a-z0-9_-]/g, '');
  const name = interaction.options.getString('name');
  const emoji = interaction.options.getString('emoji') || '📁';
  const cats = getCategories();
  if (cats.find(c => c.id === id)) return interaction.reply({ content: `❌ التصنيف \`${id}\` موجود أصلاً`, ephemeral: true });
  cats.push({ id, name, emoji });
  saveCategories(cats);
  await interaction.reply({ content: `✅ تم إضافة التصنيف: ${emoji} ${name} (\`${id}\`)`, ephemeral: true });
}

async function cmdRemoveCategory(interaction) {
  const id = interaction.options.getString('id');
  let cats = getCategories();
  const cat = cats.find(c => c.id === id);
  if (!cat) return interaction.reply({ content: `❌ التصنيف \`${id}\` غير موجود`, ephemeral: true });
  const servicesUsing = getServices().filter(s => s.category === id);
  if (servicesUsing.length) return interaction.reply({ content: `❌ فيه ${servicesUsing.length} خدمة في التصنيف ده. امسحها الأول`, ephemeral: true });
  cats = cats.filter(c => c.id !== id);
  saveCategories(cats);
  await interaction.reply({ content: `✅ تم حذف التصنيف: ${cat.emoji} ${cat.name}`, ephemeral: true });
}

async function cmdListCategories(interaction) {
  const cats = getCategories();
  const services = getServices();
  const desc = cats.map(c => {
    const count = services.filter(s => s.category === c.id).length;
    return `${c.emoji} **${c.name}** (\`${c.id}\`) — ${count} خدمة`;
  }).join('\n');
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('📂 التصنيفات').setDescription(desc).setColor(0x3498DB).setTimestamp()], ephemeral: true });
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: TICKETS
// ══════════════════════════════════════════════════════════════
function getTicketCat(g) { return g.channels.cache.find(c => c.name.includes('التذاكر') && c.type === ChannelType.GuildCategory) || g.channels.cache.find(c => c.type === ChannelType.GuildCategory); }
function getTicketOverwrites(g, userId) {
  const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
  const ow = [{ id: g.id, deny: [PermissionFlagsBits.ViewChannel] }, { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }];
  if (staffRole) ow.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  return ow;
}

async function cmdOrder(interaction) {
  await interaction.reply({ content: '🛒 **اطلب من المتجر:**\nhttps://ai-shop-bot-production.up.railway.app/shop\n\nمن هناك تقدر تشوف كل الخدمات بالأسعار وتعمل طلب مباشر.', ephemeral: true });
}

async function cmdSupport(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const g = interaction.guild, orders = getOrders(), orderId = nextId(orders);
  const channel = await g.channels.create({ name: `support-${orderId}-${interaction.user.username}`.substring(0, 100), type: ChannelType.GuildText, parent: getTicketCat(g)?.id, permissionOverwrites: getTicketOverwrites(g, interaction.user.id) });
  orders.push({ id: orderId, type: 'support', serviceName: 'دعم فني', serviceEmoji: '🛠️', userId: interaction.user.id, username: interaction.user.username, channelId: channel.id, status: 'open', createdAt: Date.now() });
  save('orders.json', orders);
  const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
  await channel.send({ embeds: [new EmbedBuilder()
    .setTitle(`🛠️ تذكرة دعم #${orderId}`)
    .setDescription(
      `# أهلاً بيك في التذكرة بتاعتك!\n\n` +
      `**العميل:** ${interaction.user}\n` +
      `**رقم التذكرة:** \`${orderId}\`\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `## 💬 اكتب مشكلتك هنا\n\n` +
      `وصف مشكلتك بالتفصيل عشان نقدر نساعدك بسرعة\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
    )
    .setColor(0x3498DB)
    .setTimestamp()
    .setFooter({ text: `🎫 ${g.name} — التذاكر`, iconURL: g.iconURL({ dynamic: true }) })],
    components: [new ActionRowBuilder().addComponents(
      new ButtonBuilder().setCustomId(`ticket_complete_${orderId}`).setLabel('✅ تم الاستلام').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId(`ticket_close_${orderId}`).setLabel('🗑️ اقفل التذكرة').setStyle(ButtonStyle.Danger),
    )]
  });
  await interaction.editReply(`✅ تم فتح تذكرة الدعم: ${channel}`);
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🛠️ تذكرة دعم جديدة').setDescription(`**العميل:** ${interaction.user}\n**القناة:** ${channel}`).setColor(0x3498DB).setTimestamp());
}

async function cmdClose(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const orders = getOrders(), order = orders.find(o => o.channelId === interaction.channel.id);
  if (!order) return interaction.editReply('❌ ده مش تذكرة');
  order.status = 'closed'; order.closedAt = Date.now(); order.closedBy = interaction.user.id;
  save('orders.json', orders);
  await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🔒 تذكرة اتقفلت').setDescription(`**اقفلها:** ${interaction.user}`).setColor(0xE74C3C).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🔒 تذكرة اتقفلت').setDescription(`**اقفلها:** ${interaction.user}\n**التذكرة:** #${order.id}`).setColor(0xE74C3C).setTimestamp());
  await sleep(3000); try { await interaction.channel.delete(); } catch {}
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: MODERATION
// ══════════════════════════════════════════════════════════════
async function cmdBan(interaction) {
  const user = interaction.options.getUser('user'), reason = interaction.options.getString('reason') || 'من غير سبب';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ مش موجود', ephemeral: true });
  if (!member.bannable) return interaction.reply({ content: '❌ مقدرش أحظره', ephemeral: true });
  await member.ban({ reason });
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔨 تم الحظر').setDescription(`**العضو:** ${user}\n**بواسطة:** ${interaction.user}\n**السبب:** ${reason}`).setColor(0xE74C3C).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🔨 عضو محظور').setDescription(`**العضو:** ${user.tag} (${user.id})\n**بواسطة:** ${interaction.user}\n**السبب:** ${reason}`).setColor(0xE74C3C).setTimestamp());
}

async function cmdKick(interaction) {
  const user = interaction.options.getUser('user'), reason = interaction.options.getString('reason') || 'من غير سبب';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ مش موجود', ephemeral: true });
  if (!member.kickable) return interaction.reply({ content: '❌ مقدرش أطرده', ephemeral: true });
  await member.kick(reason);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🚪 تم الطرد').setDescription(`**العضو:** ${user}\n**بواسطة:** ${interaction.user}\n**السبب:** ${reason}`).setColor(0xF39C12).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🚪 عضو مطرود').setDescription(`**العضو:** ${user.tag} (${user.id})\n**بواسطة:** ${interaction.user}\n**السبب:** ${reason}`).setColor(0xF39C12).setTimestamp());
}

async function cmdMute(interaction) {
  const user = interaction.options.getUser('user'), minutes = interaction.options.getNumber('minutes'), reason = interaction.options.getString('reason') || 'من غير سبب';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ مش موجود', ephemeral: true });
  if (!member.moderatable) return interaction.reply({ content: '❌ مقدرش أكتمه', ephemeral: true });
  await member.timeout(minutes * 60 * 1000, reason);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔇 تم الكتم').setDescription(`**العضو:** ${user}\n**المدة:** ${minutes} دقيقة\n**السبب:** ${reason}`).setColor(0x9B59B6).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🔇 عضو مكتوم').setDescription(`**العضو:** ${user.tag}\n**المدة:** ${minutes} دقيقة\n**بواسطة:** ${interaction.user}`).setColor(0x9B59B6).setTimestamp());
}

async function cmdUnmute(interaction) {
  const user = interaction.options.getUser('user');
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ مش موجود', ephemeral: true });
  await member.timeout(null);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔊 فكّ الكتم').setDescription(`**العضو:** ${user}`).setColor(0x2ECC71).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🔊 فكّ كتم').setDescription(`**العضو:** ${user.tag}\n**بواسطة:** ${interaction.user}`).setColor(0x2ECC71).setTimestamp());
}

async function cmdWarn(interaction) {
  const user = interaction.options.getUser('user'), reason = interaction.options.getString('reason');
  const warnings = getWarnings();
  warnings.push({ id: nextId(warnings), userId: user.id, username: user.username, reason, issuedBy: interaction.user.id, issuedByName: interaction.user.username, createdAt: Date.now() });
  save('warnings.json', warnings);
  const count = warnings.filter(w => w.userId === user.id).length;
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('⚠️ تحذير').setDescription(`**العضو:** ${user}\n**السبب:** ${reason}\n**التحذيرات:** ${count}`).setColor(0xF1C40F).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('⚠️ تحذير جديد').setDescription(`**العضو:** ${user.tag}\n**السبب:** ${reason}\n**بواسطة:** ${interaction.user}\n**الإجمالي:** ${count}`).setColor(0xF1C40F).setTimestamp());
  if (count >= 3) { try { await user.send(`⚠️ وصلت ${count} تحذيرات في ${interaction.guild.name}. ممكن يتم حظرك.`); } catch {} }
}

async function cmdWarnings(interaction) {
  const user = interaction.options.getUser('user'), warnings = getWarnings().filter(w => w.userId === user.id);
  if (!warnings.length) return interaction.reply({ content: `✅ ${user} مفيهوش تحذيرات`, ephemeral: true });
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`⚠️ تحذيرات ${user.username}`).setDescription(warnings.map((w, i) => `**${i + 1}.** ${w.reason} — بواسطة ${w.issuedByName} <t:${Math.floor(w.createdAt / 1000)}:R>`).join('\n')).setColor(0xF1C40F).setTimestamp()], ephemeral: true });
}

async function cmdClearWarnings(interaction) {
  const user = interaction.options.getUser('user');
  let warnings = getWarnings(); const before = warnings.filter(w => w.userId === user.id).length;
  warnings = warnings.filter(w => w.userId !== user.id); save('warnings.json', warnings);
  await interaction.reply({ content: `✅ تم مسح ${before} تحذيرات من ${user}`, ephemeral: true });
}

async function cmdPurge(interaction) {
  const amount = interaction.options.getNumber('amount');
  if (amount < 1 || amount > 100) return interaction.reply({ content: '❌ العدد من 1 لـ 100', ephemeral: true });
  const deleted = await interaction.channel.bulkDelete(amount, true);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🗑️ مسح الرسائل').setDescription(`تم مسح ${deleted.size} رسالة`).setColor(0xE74C3C).setTimestamp()], ephemeral: true });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🗑️ مسح رسائل').setDescription(`**بواسطة:** ${interaction.user}\n**القناة:** ${interaction.channel}\n**العدد:** ${deleted.size}`).setColor(0xE74C3C).setTimestamp());
  await sleep(3000); try { await interaction.deleteReply(); } catch {}
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: REVIEW / LEADERBOARD
// ══════════════════════════════════════════════════════════════
async function cmdReview(interaction) {
  const id = parseInt(interaction.options.getString('service')), rating = interaction.options.getNumber('rating'), comment = interaction.options.getString('comment') || '';
  const services = getServices(), svc = services.find(s => s.id === id);
  if (!svc) return interaction.reply({ content: '❌ الخدمة مش موجودة', ephemeral: true });
  if (rating < 1 || rating > 5) return interaction.reply({ content: '❌ التقييم من 1 لـ 5', ephemeral: true });
  const reviews = getReviews();
  reviews.push({ id: nextId(reviews), serviceId: id, serviceName: svc.name, userId: interaction.user.id, username: interaction.user.username, rating, comment, createdAt: Date.now() });
  save('reviews.json', reviews);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('⭐ تم التقييم').setDescription(`**الخدمة:** ${svc.emoji} ${svc.name}\n**التقييم:** ${'★'.repeat(rating) + '☆'.repeat(5 - rating)}\n**التعليق:** ${comment || '—'}`).setColor(0xF1C40F).setTimestamp()] });
}

async function cmdLeaderboard(interaction) {
  const reviews = getReviews();
  if (!reviews.length) return interaction.reply({ content: '📭 مفيش تقييمات', ephemeral: true });
  const stats = {};
  for (const r of reviews) { const n = r.username || 'unknown'; if (!stats[n]) stats[n] = { total: 0, count: 0 }; stats[n].total += Number(r.rating) || 0; stats[n].count++; }
  const entries = Object.entries(stats).map(([name, s]) => ({ name, avg: s.total / s.count, count: s.count })).sort((a, b) => b.avg - a.avg || b.count - a.count).slice(0, 10);
  const medals = ['🥇', '🥈', '🥉'];
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🏆 الترتيب').setDescription(entries.map((e, i) => `${medals[i] || `**${i + 1}.**`} ${e.name} — ⭐ ${e.avg.toFixed(1)} (${e.count})`).join('\n')).setColor(0xFFD700).setTimestamp()] });
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: GIVEAWAY
// ══════════════════════════════════════════════════════════════
function parseDuration(str) {
  const match = str.match(/^(\d+)\s*(m|h|d)$/i);
  if (!match) return null;
  const num = parseInt(match[1]);
  const unit = match[2].toLowerCase();
  if (unit === 'm') return num * 60 * 1000;
  if (unit === 'h') return num * 60 * 60 * 1000;
  if (unit === 'd') return num * 24 * 60 * 60 * 1000;
  return null;
}

async function cmdGiveaway(interaction) {
  const prize = interaction.options.getString('prize'), winners = interaction.options.getNumber('winners'), durationStr = interaction.options.getString('duration');
  const duration = parseDuration(durationStr);
  if (!duration) return interaction.reply({ content: '❌ صيغة الوقت غلط. استخدم مثلاً: `1h`, `30m`, `1d`', ephemeral: true });

  const endAt = Date.now() + duration;
  const embed = new EmbedBuilder()
    .setTitle('🎉 سحبية جديدة!')
    .setDescription(`**الجائزة:** ${prize}\n**عدد الفائزين:** ${winners}\n**تنتهي:** <t:${Math.floor(endAt / 1000)}:R>\n\n reacted ✅ للمشاركة`)
    .setColor(0xFF0000).setTimestamp().setFooter({ text: `ينتهي <t:${Math.floor(endAt / 1000)}:R>` });

  const row = new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('giveaway_join').setLabel(`✅ ت participate (${0})`).setStyle(ButtonStyle.Success));
  const msg = await interaction.reply({ embeds: [embed], components: [row], fetchReply: true });

  const giveaways = getGiveaways();
  giveaways.push({ id: msg.id, prize, winners, endAt, participants: [], guildId: interaction.guild.id, channelId: interaction.channel.id, ended: false });
  save('giveaways.json', giveaways);

  setTimeout(async () => {
    const g = getGiveaways();
    const gw = g.find(x => x.id === msg.id);
    if (!gw || gw.ended) return;
    gw.ended = true;
    save('giveaways.json', g);

    if (!gw.participants.length) {
      try { await msg.edit({ embeds: [new EmbedBuilder().setTitle('🎉 سحبية خلصت').setDescription(`**الجائزة:** ${prize}\n\n❌ لا يوجد مشاركين`).setColor(0x808080).setTimestamp()], components: [] }); } catch {}
      return;
    }

    const shuffled = gw.participants.sort(() => 0.5 - Math.random());
    const win = shuffled.slice(0, winners);
    try { await msg.edit({ embeds: [new EmbedBuilder().setTitle('🎉 سحبية خلصت!').setDescription(`**الجائزة:** ${prize}\n**الفائزون:** ${win.map(id => `<@${id}>`).join(', ')}\n\n!مبروك`).setColor(0x2ECC71).setTimestamp()], components: [] }); } catch {}
    try { await interaction.channel.send(`🎉 مبروك لـ ${win.map(id => `<@${id}>`).join(' ')}! كسبوا بـ **${prize}**!`); } catch {}
  }, duration);
}

async function cmdEndGiveaway(interaction) {
  const messageId = interaction.options.getString('message-id');
  const giveaways = getGiveaways();
  const gw = giveaways.find(g => g.id === messageId);
  if (!gw) return interaction.reply({ content: '❌ السحبية مش موجودة', ephemeral: true });
  if (gw.ended) return interaction.reply({ content: '❌ السحبية خلصت أصلاً', ephemeral: true });
  gw.ended = true; save('giveaways.json', giveaways);
  if (!gw.participants.length) {
    const ch = interaction.guild.channels.cache.get(gw.channelId);
    if (ch) { const msg = await ch.messages.fetch(messageId).catch(() => null); if (msg) await msg.edit({ embeds: [new EmbedBuilder().setTitle('🎉 سحبية خلصت').setDescription(`**الجائزة:** ${gw.prize}\n\n❌ لا يوجد مشاركين`).setColor(0x808080).setTimestamp()], components: [] }).catch(() => {}); }
    return interaction.reply({ content: '✅ تم إنهاء السحبية', ephemeral: true });
  }
  const shuffled = gw.participants.sort(() => 0.5 - Math.random());
  const win = shuffled.slice(0, gw.winners);
  const ch = interaction.guild.channels.cache.get(gw.channelId);
  if (ch) {
    const msg = await ch.messages.fetch(messageId).catch(() => null);
    if (msg) await msg.edit({ embeds: [new EmbedBuilder().setTitle('🎉 سحبية خلصت!').setDescription(`**الجائزة:** ${gw.prize}\n**الفائزون:** ${win.map(id => `<@${id}>`).join(', ')}`).setColor(0x2ECC71).setTimestamp()], components: [] }).catch(() => {});
    await ch.send(`🎉 مبروك لـ ${win.map(id => `<@${id}>`).join(' ')}! كسبوا بـ **${gw.prize}**!`).catch(() => {});
  }
  await interaction.reply({ content: '✅ تم إنهاء السحبية', ephemeral: true });
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: STATS
// ══════════════════════════════════════════════════════════════
async function cmdStats(interaction) {
  const orders = getOrders(), reviews = getReviews(), services = getServices();
  const completed = orders.filter(o => o.status === 'completed').length;
  const pending = orders.filter(o => o.status === 'pending' || o.status === 'open').length;
  const inProgress = orders.filter(o => o.status === 'progress').length;
  const closed = orders.filter(o => o.status === 'closed').length;
  const avgRating = reviews.length ? (reviews.reduce((s, r) => s + r.rating, 0) / reviews.length).toFixed(1) : '0';
  const embed = new EmbedBuilder()
    .setTitle('📊 إحصائيات البوت')
    .setDescription('**إحصائيات شاملة للبوت والطلبات**')
    .addFields(
      { name: '🎫 الطلبات', value: `**إجمالي:** ${orders.length}\n**مكتملة (مسلّمة):** ✅ ${completed}\n**قيد التنفيذ:** 🔄 ${inProgress}\n**بانتظار القبول:** ⏳ ${pending}\n**مغلقة:** 🔒 ${closed}`, inline: true },
      { name: '⭐ التقييمات', value: `**إجمالي:** ${reviews.length}\n**متوسط التقييم:** ⭐ ${avgRating}/5`, inline: true },
      { name: '🛒 الخدمات', value: `**إجمالي:** ${services.length}`, inline: true },
      { name: '👥 الأعضاء', value: `**${interaction.guild.memberCount}** عضو`, inline: true },
      { name: '🎫 السحبيات', value: `**${getGiveaways().length}** سحبية`, inline: true },
      { name: '📈 معدل التسليم', value: orders.length ? `**${((completed / orders.length) * 100).toFixed(0)}%**` : '**0%**', inline: true },
    )
    .setColor(0x3498DB).setTimestamp()
    .setFooter({ text: `📊 ${interaction.guild.name}`, iconURL: interaction.guild.iconURL({ dynamic: true }) });
  await interaction.reply({ embeds: [embed] });
}

async function cmdTicketStats(interaction) {
  const orders = getOrders();
  const byStatus = {};
  for (const o of orders) { const s = o.status || 'unknown'; byStatus[s] = (byStatus[s] || 0) + 1; }
  const statusNames = { pending: '⏳ مستنية قبول', open: '📂 مفتوحة', progress: '🔄 بيتنفذ', completed: '✅ اتسلّمت', closed: '🔒 اتقفلت' };
  const total = orders.length;
  const completed = byStatus.completed || 0;
  const deliveryRate = total ? ((completed / total) * 100).toFixed(0) : 0;
  const desc = Object.entries(byStatus).map(([s, c]) => `${statusNames[s] || s}: **${c}**`).join('\n');
  const embed = new EmbedBuilder()
    .setTitle('🎫 إحصائيات التذاكر')
    .setDescription(desc || 'مفيش تذاكر')
    .addFields(
      { name: '📈 الإجمالي', value: `**${total}** تذكرة`, inline: true },
      { name: '✅ اتسلّمت', value: `**${completed}** تذكرة`, inline: true },
      { name: '📊 معدل التسليم', value: `**${deliveryRate}%**`, inline: true },
    )
    .setColor(0x9B59B6).setTimestamp()
    .setFooter({ text: `🎫 ${interaction.guild.name}`, iconURL: interaction.guild.iconURL({ dynamic: true }) });
  await interaction.reply({ embeds: [embed] });
}

async function cmdTopCustomers(interaction) {
  const orders = getOrders().filter(o => o.status === 'completed');
  if (!orders.length) return interaction.reply({ content: '📭 مفيش طلبات اتسلّمت', ephemeral: true });
  const cust = {};
  for (const o of orders) { const u = o.username || o.userId; if (!cust[u]) cust[u] = { userId: o.userId, count: 0 }; cust[u].count++; }
  const entries = Object.values(cust).sort((a, b) => b.count - a.count).slice(0, 10);
  const medals = ['🥇', '🥈', '🥉'];
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('👑 أفضل الزبائن').setDescription(entries.map((e, i) => `${medals[i] || `**${i + 1}.**`} <@${e.userId}> — **${e.count}** طلب`).join('\n')).setColor(0xFFD700).setTimestamp()] });
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: AUTO-ROLE / SET-LOGS / AUTOMOD / ANNOUNCE
// ══════════════════════════════════════════════════════════════
async function cmdAutoRole(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') { const role = interaction.options.getRole('role'); if (CFG.autoRoles.includes(role.id)) return interaction.reply({ content: '❌ موجود أصلاً', ephemeral: true }); CFG.autoRoles.push(role.id); save('config.json', CFG); return interaction.reply({ content: `✅ الرول <@&${role.id}> تلقائي`, ephemeral: true }); }
  if (sub === 'remove') { const role = interaction.options.getRole('role'); CFG.autoRoles = CFG.autoRoles.filter(id => id !== role.id); save('config.json', CFG); return interaction.reply({ content: '✅ تم الحذف', ephemeral: true }); }
  if (sub === 'list') { if (!CFG.autoRoles.length) return interaction.reply({ content: '📭 فاضية', ephemeral: true }); return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🎭 رولات تلقائية').setDescription(CFG.autoRoles.map(id => `• <@&${id}>`).join('\n')).setColor(0x3498DB)], ephemeral: true }); }
  if (sub === 'clear') { CFG.autoRoles = []; save('config.json', CFG); return interaction.reply({ content: '✅ تم المسح', ephemeral: true }); }
}

async function cmdSetLogs(interaction) {
  const ch = interaction.options.getChannel('channel');
  CFG.logsChannel = ch.id; save('config.json', CFG);
  await interaction.reply({ content: `✅ قناة السجلات: ${ch}`, ephemeral: true });
}

async function cmdAutomod(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'antispam') { const state = interaction.options.getString('state') === 'on'; CFG.automod.antispam = state; save('config.json', CFG); return interaction.reply({ content: `✅ منع السبام: ${state ? 'شغّل' : 'وقف'}`, ephemeral: true }); }
  if (sub === 'badwords') { const state = interaction.options.getString('state') === 'on'; CFG.automod.badwords = state; save('config.json', CFG); return interaction.reply({ content: `✅ فلتر الكلمات: ${state ? 'شغّل' : 'وقف'}`, ephemeral: true }); }
  if (sub === 'add-word') { const word = interaction.options.getString('word'); if (!CFG.automod.badwordsList.includes(word)) { CFG.automod.badwordsList.push(word); save('config.json', CFG); } return interaction.reply({ content: `✅ تم الإضافة: \`${word}\``, ephemeral: true }); }
  if (sub === 'remove-word') { const word = interaction.options.getString('word'); CFG.automod.badwordsList = CFG.automod.badwordsList.filter(w => w !== word); save('config.json', CFG); return interaction.reply({ content: `✅ تم الإزالة: \`${word}\``, ephemeral: true }); }
  if (sub === 'list') {
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🛡️ إعدادات الحماية').addFields({ name: '🚫 Anti-Spam', value: CFG.automod.antispam ? `✅ شغّل (${CFG.automod.antispamLimit} رسائل / ${CFG.automod.antispamTime} ثانية)` : '❌ وقف' }, { name: '🔤 Bad Words', value: CFG.automod.badwords ? `✅ شغّل (${CFG.automod.badwordsList.length} كلمة)` : '❌ وقف', }, { name: '📝 الكلمات الممنوعة', value: CFG.automod.badwordsList.map(w => `\`${w}\``).join(', ') || '—' }).setColor(0x3498DB).setTimestamp()], ephemeral: true });
  }
}

async function cmdAnnounce(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const title = interaction.options.getString('title'), content = interaction.options.getString('content'), emoji = interaction.options.getString('emoji') || '📣';
  const ch = interaction.guild.channels.cache.find(c => c.name.includes('الإعلانات') && c.isTextBased());
  if (!ch) return interaction.editReply('❌ قناة الإعلانات مش موجودة');
  await ch.send({ embeds: [new EmbedBuilder().setTitle(`${emoji} ${safe(title, 200)}`).setDescription(safe(content, 4000)).setColor(0xFF0000).setTimestamp().setFooter({ text: `📢 ${interaction.user.username}` })] });
  await interaction.editReply(`✅ تم الإرسال في ${ch}`);
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: INFO
// ══════════════════════════════════════════════════════════════
async function cmdServerInfo(interaction) {
  const g = interaction.guild; await g.members.fetch().catch(() => {});
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`📊 ${g.name}`).setThumbnail(g.iconURL({ dynamic: true, size: 256 })).addFields({ name: '👑 المالك', value: `<@${g.ownerId}>`, inline: true }, { name: '👥 الأعضاء', value: `${g.memberCount}`, inline: true }, { name: '💬 القنوات', value: `${g.channels.cache.size}`, inline: true }, { name: '🎭 الرولات', value: `${g.roles.cache.size}`, inline: true }, { name: '💎 Boosts', value: `${g.premiumSubscriptionCount || 0}`, inline: true }, { name: '📅 الإنشاء', value: `<t:${Math.floor(g.createdAt.getTime() / 1000)}:F>`, inline: false }).setColor(0x3498DB).setTimestamp()] });
}

async function cmdUserInfo(interaction) {
  const user = interaction.options.getUser('user') || interaction.user, member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const warns = getWarnings().filter(w => w.userId === user.id).length;
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`👤 ${user.username}`).setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 })).addFields({ name: '🆔 ID', value: user.id, inline: true }, { name: '📅 الحساب', value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`, inline: true }, { name: '📥 دخل', value: member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : '—', inline: true },     { name: '⚠️ تحذيرات', value: `${warns}`, inline: true }).setColor(0x3498DB).setTimestamp()] });
}

async function cmdHelp(interaction) {
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🤖 أوامر البوت').addFields(
    { name: '📦 عامة', value: '`/services` `/order` `/support` `/close` `/review` `/leaderboard` `/server-info` `/user-info` `/stats` `/ticket-stats` `/top-customers` `/help`' },
    { name: '🛡️ إدارية', value: '`/setup` `/banners` `/add-service` `/edit-service` `/remove-service` `/add-category` `/remove-category` `/list-categories` `/announce` `/auto-role` `/set-logs` `/automod` `/giveaway` `/end-giveaway`' },
        { name: '🔨 الإدارة والضبط', value: '`/ban` `/kick` `/mute` `/unmute` `/warn` `/warnings` `/clear-warnings` `/purge`' },
  ).setColor(0xFF0000).setTimestamp()], ephemeral: true });
}

async function cmdBanners(interaction) {
  if (!Canvas) return interaction.reply({ content: '❌ مكتبة `canvas` مش متوفرة — البانرات مش هتتولّد', ephemeral: true });
  await interaction.deferReply();
  const g = interaction.guild;
  let sent = 0, skipped = 0, failed = 0;
  for (const [, ch] of g.channels.cache) {
    if (!ch.isTextBased()) continue;
    const theme = getBannerForChannel(ch.name);
    if (!theme) { skipped++; continue; }
    try {
      const buf = generateBanner(ch.name, null, theme.c1, theme.c2, theme.accent);
      if (!buf) { skipped++; continue; }
      const { AttachmentBuilder } = require('discord.js');
      const attachment = new AttachmentBuilder(buf, { name: `banner-${theme.name || 'ch'}.png` });
      await ch.send({ files: [attachment] });
      sent++;
    } catch (e) { console.error('❌ Banner failed for', ch.name, ':', e.message); failed++; }
    await sleep(800);
  }
  await interaction.editReply(`✅ تم إرسال **${sent}** بانر${skipped ? ` — تم تخطي ${skipped}` : ''}${failed ? ` — فشل ${failed}` : ''}`);
}

// ══════════════════════════════════════════════════════════════
//  MAIN INTERACTION ROUTER
// ══════════════════════════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const map = {
        setup: cmdSetup, services: cmdServices,
        review: cmdReview, leaderboard: cmdLeaderboard,
        help: cmdHelp, banners: cmdBanners, 'add-service': cmdAddService, 'edit-service': cmdEditService, 'remove-service': cmdRemoveService,
        'auto-role': cmdAutoRole, 'set-logs': cmdSetLogs, automod: cmdAutomod, announce: cmdAnnounce,
        'add-category': cmdAddCategory, 'remove-category': cmdRemoveCategory, 'list-categories': cmdListCategories,
        order: cmdOrder, support: cmdSupport, close: cmdClose,
        ban: cmdBan, kick: cmdKick, mute: cmdMute, unmute: cmdUnmute,
        warn: cmdWarn, warnings: cmdWarnings, 'clear-warnings': cmdClearWarnings, purge: cmdPurge,
        'server-info': cmdServerInfo, 'user-info': cmdUserInfo, stats: cmdStats, 'ticket-stats': cmdTicketStats,
        'top-customers': cmdTopCustomers, giveaway: cmdGiveaway, 'end-giveaway': cmdEndGiveaway,
      };
      const handler = map[interaction.commandName];
      if (handler) return await handler(interaction);
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'category_menu') {
      const catId = interaction.values[0];
      const cats = getCategories(), cat = cats.find(c => c.id === catId);
      const services = getServices().filter(s => s.category === catId && s.active);
      if (!services.length) return interaction.reply({ content: `❌ مفيش خدمات في التصنيف ده`, ephemeral: true });

      const embed = new EmbedBuilder()
        .setTitle(`${cat?.emoji || '📂'} ${cat?.name || catId}`)
        .setDescription(`**${services.length} خدمة متاحة**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`)
        .setColor(0x3498DB)
        .setTimestamp()
        .setFooter({ text: '🛍️ اختار الخدمة اللي عايزها من القائمة تحت' });

      const svcSelect = new StringSelectMenuBuilder()
        .setCustomId('cat_svc_menu')
        .setPlaceholder('🛒 اختار الخدمة...')
        .addOptions(services.slice(0, 25).map(s => ({
          label: `${s.emoji || '🛒'} ${s.name}`.substring(0, 100),
          description: `${fmt(s.price)} كريديت`.substring(0, 100),
          value: String(s.id),
        })));

      const backBtn = new ButtonBuilder()
        .setCustomId('back_to_categories')
        .setLabel('🔙 رجوع للتصنيفات')
        .setStyle(ButtonStyle.Secondary);

      const row1 = new ActionRowBuilder().addComponents(svcSelect);
      const row2 = new ActionRowBuilder().addComponents(backBtn);
      await interaction.reply({ embeds: [embed], components: [row1, row2], ephemeral: true });
      return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'cat_svc_menu') {
      const id = parseInt(interaction.values[0]), services = getServices(), svc = services.find(s => s.id === id);
      if (!svc) return interaction.reply({ content: '❌ الخدمة مش موجودة', ephemeral: true });
      const embed = new EmbedBuilder()
        .setTitle(`${svc.emoji || '🛒'} ${svc.name}`)
        .setDescription(svc.description || 'مفيش وصف')
        .addFields(
          { name: '💰 السعر', value: `\`${fmt(svc.price)} كريديت\``, inline: true },
          { name: '📂 التصنيف', value: svc.category || 'مش محدد', inline: true },
          { name: '🌐 اطلب من المتجر', value: `[🛒 المتجر الإلكتروني](https://ai-shop-bot-production.up.railway.app/shop)`, inline: true },
        )
        .setColor(0x3498DB)
        .setTimestamp()
        .setFooter({ text: '🛍️ اضغط الزر تحت عشان تطلب الخدمة دي' });
      const orderBtn = new ButtonBuilder()
        .setCustomId(`svc_order_${svc.id}`)
        .setLabel(`🛒 اطلب — ${svc.name}`)
        .setStyle(ButtonStyle.Success);
      const shopBtn = new ButtonBuilder()
        .setLabel('🌐 زيارة المتجر')
        .setStyle(ButtonStyle.Link)
        .setURL('https://ai-shop-bot-production.up.railway.app/shop');
      const backBtn = new ButtonBuilder()
        .setCustomId('back_to_categories')
        .setLabel('🔙 رجوع للتصنيفات')
        .setStyle(ButtonStyle.Secondary);
      const row = new ActionRowBuilder().addComponents(orderBtn, shopBtn, backBtn);
      await interaction.reply({ embeds: [embed], components: [row], ephemeral: true });
      return;
    }

    if (interaction.isButton() && interaction.customId === 'back_to_categories') {
      const cats = getCategories();
      const services = getServices();
      const embed = new EmbedBuilder()
        .setTitle('📂 اختار التصنيف')
        .setDescription('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n**اختار التصنيف اللي فيه الخدمة اللي عايزها**\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
        .setColor(0x3498DB)
        .setTimestamp()
        .setFooter({ text: '🛍️ اختار التصنيف من القائمة تحت' });
      const catSelect = new StringSelectMenuBuilder()
        .setCustomId('category_menu')
        .setPlaceholder('📂 اختار التصنيف...')
        .addOptions(cats.map(c => {
          const count = services.filter(s => s.category === c.id && s.active).length;
          return {
            label: `${c.emoji} ${c.name}`.substring(0, 100),
            description: `${count} خدمة متاحة`.substring(0, 100),
            value: c.id,
          };
        }));
      const row1 = new ActionRowBuilder().addComponents(catSelect);
      const row2 = new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId('open_ticket_support').setLabel('🛠️ دعم فني').setStyle(ButtonStyle.Secondary),
      );
      await interaction.update({ embeds: [embed], components: [row1, row2] });
      return;
    }

    if (interaction.isButton()) {
      const cid = interaction.customId;

      if (cid.startsWith('svc_order_')) {
        await interaction.deferReply({ ephemeral: true });
        const svcId = parseInt(cid.replace('svc_order_', ''));
        const services = getServices();
        const svc = services.find(s => s.id === svcId);
        if (!svc) return interaction.editReply('❌ الخدمة مش موجودة');

        const g = interaction.guild;
        const orderId = Date.now().toString(36).toUpperCase();
        const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));

        const ow = [
          { id: g.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
        ];
        if (staffRole) ow.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });

        const channel = await g.channels.create({
          name: `order-${orderId}-${interaction.user.username}`.substring(0, 100),
          type: ChannelType.GuildText,
          parent: getTicketCat(g)?.id,
          permissionOverwrites: ow,
        });

        const e = new EmbedBuilder()
          .setTitle(`🛒 طلب خدمة — ${svc.emoji || '🛒'} ${svc.name}`)
          .setDescription(
            `# طلب خدمة جديد\n\n` +
            `**العميل:** ${interaction.user}\n` +
            `**الخدمة:** ${svc.emoji || '🛒'} **${svc.name}**\n` +
            `**السعر:** \`${fmt(svc.price)} كريديت\`\n` +
            `**رقم الطلب:** \`${orderId}\`\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `## 📝 وصف الخدمة\n\n` +
            `${svc.description || 'مفيش وصف'}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `## 💬 اكتب تفاصيل طلبك هنا\n\n` +
            `الستاف هيساعدك إن شاء الله`
          )
          .setColor(0x2ECC71)
          .setTimestamp()
          .setFooter({ text: `🛒 ${g.name} — الطلبات`, iconURL: g.iconURL({ dynamic: true }) });

        await channel.send({ embeds: [e], content: `${interaction.user} ${staffRole ? `— ${staffRole}` : ''}`,
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`order_accept_${orderId}`).setLabel('🔄 قبول الطلب').setStyle(ButtonStyle.Primary),
            new ButtonBuilder().setCustomId(`order_complete_${orderId}`).setLabel('✅ تم الاستلام').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ اقفل').setStyle(ButtonStyle.Danger),
          )]
        });
        await interaction.editReply(`✅ تم فتح تذكرة طلبك: ${channel}`);
        sendLog(g, `🛒 طلب خدمة جديد — ${svc.name} — ${interaction.user.tag}`);
        return;
      }

      if (cid === 'open_ticket_order') {
        return interaction.reply({ content: '❌ استخدم المتجر لطلب الخدمات: https://ai-shop-bot-production.up.railway.app/shop', ephemeral: true });
      }

      if (cid === 'ticket_service_select') {
        return;
      }

      if (cid === 'open_ticket_support') {
        await interaction.deferReply({ ephemeral: true });
        const g = interaction.guild, orders = getOrders(), orderId = nextId(orders);
        const channel = await g.channels.create({ name: `support-${orderId}-${interaction.user.username}`.substring(0, 100), type: ChannelType.GuildText, parent: getTicketCat(g)?.id, permissionOverwrites: getTicketOverwrites(g, interaction.user.id) });
        orders.push({ id: orderId, type: 'support', serviceName: 'دعم فني', serviceEmoji: '🛠️', userId: interaction.user.id, username: interaction.user.username, channelId: channel.id, status: 'open', createdAt: Date.now() });
        save('orders.json', orders);
        const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
        await channel.send({ embeds: [new EmbedBuilder()
          .setTitle(`🛠️ تذكرة دعم #${orderId}`)
          .setDescription(
            `# أهلاً بيك في التذكرة بتاعتك!\n\n` +
            `**العميل:** ${interaction.user}\n` +
            `**رقم التذكرة:** \`${orderId}\`\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `## 💬 اكتب مشكلتك هنا\n\n` +
            `وصف مشكلتك بالتفصيل عشان نقدر نساعدك بسرعة\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          )
          .setColor(0x3498DB)
          .setTimestamp()
          .setFooter({ text: `🎫 ${g.name} — التذاكر`, iconURL: g.iconURL({ dynamic: true }) })],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_complete_${orderId}`).setLabel('✅ تم الاستلام').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ticket_close_${orderId}`).setLabel('🗑️ اقفل التذكرة').setStyle(ButtonStyle.Danger),
          )]
        });
        await interaction.editReply(`✅ تم فتح تذكرة الدعم: ${channel}`);
        return;
      }

      if (cid.startsWith('order_accept_')) {
        const orderId = parseInt(cid.replace('order_accept_', '')), orders = getOrders(), order = orders.find(o => o.id === orderId);
        if (!order) return interaction.reply({ content: '❌ مش موجود', ephemeral: true });
        if (order.status !== 'pending') return interaction.reply({ content: '❌ تم التعامل معاه', ephemeral: true });
        order.status = 'progress'; order.acceptedBy = interaction.user.id; order.acceptedAt = Date.now();
        save('orders.json', orders);
        await interaction.update({ embeds: [new EmbedBuilder().setTitle(`🎫 طلب #${orderId} — بيتتنفيذ`).setDescription(`**العميل:** <@${order.userId}>\n**الخدمة:** ${order.serviceEmoji} ${order.serviceName}\n**السعر:** \`${fmt(order.servicePrice || 0)}\`\n**الستاف:** ${interaction.user}\n\n━━━━━━━━━━━━━━━━━━━━━\n🔄 **جاري التنفيذ...**`).setColor(0x3498DB).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`order_complete_${orderId}`).setLabel('🏁 إتمام').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
        try { const u = await interaction.guild.members.fetch(order.userId); await u.send(`🔄 طلبك **#${orderId}** (${order.serviceName}) بيتنفذ!`).catch(() => {}); } catch {}
        return;
      }

      if (cid.startsWith('order_complete_')) {
        const orderId = parseInt(cid.replace('order_complete_', '')), orders = getOrders(), order = orders.find(o => o.id === orderId);
        if (!order) return interaction.reply({ content: '❌ مش موجود', ephemeral: true });
        if (order.status !== 'progress') return interaction.reply({ content: '❌ مينفعش يتنفّذ', ephemeral: true });
        order.status = 'completed'; order.completedAt = Date.now(); order.completedBy = interaction.user.id;
        save('orders.json', orders);
        await interaction.update({ embeds: [new EmbedBuilder().setTitle(`✅ طلب #${orderId} — اتسلّم`).setDescription(`**العميل:** <@${order.userId}>\n**الخدمة:** ${order.serviceEmoji} ${order.serviceName}\n**الستاف:** ${interaction.user}\n\n━━━━━━━━━━━━━━━━━━━━━\n✅ **تم التسليم!**\n<@${order.userId}> استخدم \`/review\` عشان تقيّم الخدمة`).setColor(0x2ECC71).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
        try { const u = await interaction.guild.members.fetch(order.userId); await u.send(`✅ طلبك **#${orderId}** (${order.serviceName}) اتسلّم! استخدم \`/review\` عشان تقيّم الخدمة`).catch(() => {}); } catch {}
        return;
      }

      if (cid.startsWith('ticket_complete_')) {
        const orderId = parseInt(cid.replace('ticket_complete_', ''));
        const orders = getOrders(), order = orders.find(o => o.id === orderId);
        if (!order) return interaction.reply({ content: '❌ مش موجودة', ephemeral: true });
        if (order.status === 'completed') return interaction.reply({ content: '✅ اتسلّم أصلاً', ephemeral: true });
        order.status = 'completed'; order.completedAt = Date.now(); order.completedBy = interaction.user.id;
        save('orders.json', orders);
        await interaction.update({ embeds: [new EmbedBuilder()
          .setTitle(`✅ تم التسليم — تذكرة #${orderId}`)
          .setDescription(
            `# اتسلّم بنجاح!\n\n` +
            `**العميل:** <@${order.userId}>\n` +
            `**الخدمة:** ${order.serviceEmoji || '🛒'} ${order.serviceName}\n` +
            `**الستاف:** ${interaction.user}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `## ✅ اتسلّم بنجاح!\n\n` +
            `<@${order.userId}> استخدم \`/review\` عشان تقيّم الخدمة\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          )
          .setColor(0x2ECC71)
          .setTimestamp()
          .setFooter({ text: `✅ ${g.name} — التسليمات`, iconURL: g.iconURL({ dynamic: true }) })],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_close_${orderId}`).setLabel('🗑️ اقفل التذكرة').setStyle(ButtonStyle.Danger),
          )]
        });
        try { const u = await interaction.guild.members.fetch(order.userId); await u.send(`✅ طلبك **#${orderId}** (${order.serviceName}) اتسلّم! استخدم \`/review\` عشان تقيّم الخدمة`).catch(() => {}); } catch {}
        await sendLog(interaction.guild, new EmbedBuilder().setTitle('✅ تم التسليم').setDescription(`**العميل:** <@${order.userId}>\n**الخدمة:** ${order.serviceName}\n**الستاف:** ${interaction.user}`).setColor(0x2ECC71).setTimestamp());
        return;
      }

      if (cid.startsWith('order_close_') || cid.startsWith('ticket_close_')) {
        const orderId = parseInt(cid.replace('order_close_', '').replace('ticket_close_', ''));
        const orders = getOrders(), order = orders.find(o => o.id === orderId);
        if (!order) return interaction.reply({ content: '❌ مش موجودة', ephemeral: true });
        order.status = 'closed'; order.closedAt = Date.now(); order.closedBy = interaction.user.id;
        save('orders.json', orders);
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔒 تذكرة اتقفلت').setDescription(`**اقفلها:** ${interaction.user}`).setColor(0xE74C3C).setTimestamp()] });
        await sleep(3000); try { await interaction.channel.delete(); } catch {}
        return;
      }

      // ── 📝 تقديم للادارة — زر + مودال ──
      if (cid === 'apply_staff') {
        const g = interaction.guild;
        const member = await g.members.fetch(interaction.user.id).catch(() => null);
        const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
        const trialRole = g.roles.cache.find(r => r.name.includes('Trial'));
        if (staffRole && member?.roles.cache.has(staffRole.id)) return interaction.reply({ content: '❌ أنت ستاف أصلاً!', ephemeral: true });
        if (trialRole && member?.roles.cache.has(trialRole.id)) return interaction.reply({ content: '❌ أنت في فترة التجربة أصلاً!', ephemeral: true });

        const modal = new ModalBuilder()
          .setCustomId('apply_staff_modal_p1')
          .setTitle('📝 طلب انضمام للادارة — الجزء 1');

        modal.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q1_name').setLabel('1. إسمك الكامل').setPlaceholder('اكتب اسمك الكامل').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q2_age').setLabel('2. عمرك كام سنة؟').setPlaceholder('اكتب عمرك بالعدد').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q3_username').setLabel('3. اليوزر نيم بتاعك').setPlaceholder('مثال: yassinx').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q4_experience').setLabel('4. عندك خبرة في الستاف قبل كده؟').setPlaceholder('اكتب خبرتك أو اكتب مفيش').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q5_why').setLabel('5. ليه عايز تنضم للادارة؟').setPlaceholder('اكتب أسبابك باختصار').setStyle(TextInputStyle.Paragraph).setRequired(true)),
        );

        await interaction.showModal(modal);
        return;
      }

      if (cid === 'giveaway_join') {
        const giveaways = getGiveaways();
        const gw = giveaways.find(g => g.id === interaction.message.id);
        if (!gw || gw.ended) return interaction.reply({ content: '❌ السحبية خلصت', ephemeral: true });
        const idx = gw.participants.indexOf(interaction.user.id);
        if (idx >= 0) { gw.participants.splice(idx, 1); save('giveaways.json', giveaways); await interaction.update({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('giveaway_join').setLabel(`✅ ت participate (${gw.participants.length})`).setStyle(ButtonStyle.Success))] }); return; }
        gw.participants.push(interaction.user.id);
        save('giveaways.json', giveaways);
        await interaction.update({ components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId('giveaway_join').setLabel(`✅ ت participate (${gw.participants.length})`).setStyle(ButtonStyle.Success))] });
        return;
      }
    }

    // ── 📝 مودال تقديم للادارة ──
    if (interaction.isModalSubmit()) {
      if (interaction.customId === 'apply_staff_modal_p1') {
        const g = interaction.guild;
        const answers1 = {};
        for (const ac of interaction.components) {
          for (const comp of ac.components) {
            answers1[comp.customId] = comp.value;
          }
        }
        await interaction.deferReply({ ephemeral: true });

        const modal2 = new ModalBuilder()
          .setCustomId('apply_staff_modal_p2')
          .setTitle('📝 طلب انضمام للادارة — الجزء 2');
        modal2.addComponents(
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q6_skills').setLabel('6. إيه المهارات اللي عندك؟').setPlaceholder('مونتاج - تصميم - برمجة - أي حاجة').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q7_available').setLabel('7. أوقات فراغك إيه في اليوم؟').setPlaceholder('من 4 لـ 8 مثلاً').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q8_commitment').setLabel('8. تقدر تلتزم كل يوم في السيرفر؟').setPlaceholder('اكتب اه أو لا ولماذا').setStyle(TextInputStyle.Short).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q9_conflict').setLabel('9. لو عضو بيشتكي منك هتعمل إيه؟').setPlaceholder('اكتب ردة فعلك باختصار').setStyle(TextInputStyle.Paragraph).setRequired(true)),
          new ActionRowBuilder().addComponents(new TextInputBuilder().setCustomId('q10_extra').setLabel('10. أي حاجة عايز تضيفها؟').setPlaceholder('اكتب أي حاجة إضافية أو اكتب لا').setStyle(TextInputStyle.Paragraph).setRequired(true)),
        );

        interaction._tempApplyAnswers = answers1;
        applyTempData.set(interaction.user.id, answers1);
        await interaction.showModal(modal2);
        return;
      }

      if (interaction.customId === 'apply_staff_modal_p2') {
        const g = interaction.guild;
        const answers2 = {};
        for (const ac of interaction.components) {
          for (const comp of ac.components) {
            answers2[comp.customId] = comp.value;
          }
        }

        const answers1 = applyTempData.get(interaction.user.id) || {};
        applyTempData.delete(interaction.user.id);
        if (!answers1.q1_name) {
          await interaction.reply({ content: '❌ حصل خطأ، جرب تاني', ephemeral: true });
          return;
        }

        // ── حساب نسبة النجاح ──
        let score = 0;
        const maxScore = 100;
        const positives = [];
        const negatives = [];

        // السؤال 2: العمر (15 نقطة)
        const age = parseInt(answers1.q2_age) || 0;
        if (age >= 18) { score += 15; positives.push('✅ عمره فوق 18 — ناضج');
        } else if (age >= 16) { score += 10; positives.push('⚠️ عمره 16-17 — مقبول');
        } else { negatives.push('❌ عمره تحت 16 — صغير أوي'); }

        // السؤال 4: الخبرة (20 نقطة)
        const exp = (answers1.q4_experience || '').toLowerCase();
        if (exp.includes('خبرة') || exp.includes('عملت') || exp.includes('كنت') || exp.includes('ادارة') || exp.includes('ستاف')) {
          score += 20; positives.push('✅ عنده خبرة سابقة في الستاف/الإدارة');
        } else if (exp.includes('مفيش') || exp.includes('لا') || exp.includes('مش')) {
          score += 8; negatives.push('⚠️ مفيش خبرة سابقة — هيحتاج تدريب');
        } else { score += 12; positives.push('💡 ذكر خبرة سابقة'); }

        // السؤال 5: الدافع (15 نقطة)
        const why = (answers1.q5_why || '').toLowerCase();
        if (why.length > 50) { score += 15; positives.push('✅ الدافع واضح ومفصّل'); }
        else if (why.length > 20) { score += 10; positives.push('💡 الدافع موجود بس محتاج تفصيل'); }
        else { score += 5; negatives.push('⚠️ الدافع قصير ومحتاج تفصيل'); }

        // السؤال 6: المهارات (15 نقطة)
        const skills = (answers2.q6_skills || '').toLowerCase();
        if (skills.length > 30) { score += 15; positives.push('✅ عنده مهارات متنوعة ومفصّلة'); }
        else if (skills.length > 10) { score += 10; positives.push('💡 عنده مهارات أساسية'); }
        else { score += 5; negatives.push('⚠️ المهارات قليلة'); }

        // السؤال 7: الوقت (10 نقطة)
        const avail = (answers2.q7_available || '').toLowerCase();
        if (avail.includes('ساع') || avail.includes('من') || avail.length > 10) { score += 10; positives.push('✅ وقته واضح ومتاح'); }
        else { score += 5; negatives.push('⚠️ الوقت مش واضح'); }

        // السؤال 8: الالتزام (10 نقطة)
        const commit = (answers2.q8_commitment || '').toLowerCase();
        if (commit.includes('اه') || commit.includes('اي') || commit.includes('ايوة') || commit.includes('نعم')) { score += 10; positives.push('✅ ملتزم ويقدر يشتغل كل يوم'); }
        else { score += 3; negatives.push('⚠️ الالتزام مش واضح'); }

        // السؤال 9: التعامل مع المشاكل (15 نقطة)
        const conflict = (answers2.q9_conflict || '').toLowerCase();
        if (conflict.includes('هسمع') || conflict.includes('هساعد') || conflict.includes('هحل') || conflict.includes('صبور') || conflict.includes('محترم')) {
          score += 15; positives.push('✅ بيتعامل بصبر واتزان مع المشاكل');
        } else if (conflict.includes('هكتمه') || conflict.includes('هطرده') || conflict.includes('هحظره')) {
          score += 5; negatives.push('⚠️ ردة فعل عنيفة — محتاج يتعلم التعامل');
        } else { score += 10; positives.push('💡 ردة فعل مقبولة'); }

        const percentage = Math.min(score, maxScore);

        let verdictEmoji, verdictText;
        if (percentage >= 75) { verdictEmoji = '🟢'; verdictText = 'مقبول — جاهز للانضمام'; }
        else if (percentage >= 50) { verdictEmoji = '🟡'; verdictText = 'مقبول شرطي — يحتاج مراجعة'; }
        else { verdictEmoji = '🔴'; verdictText = 'مرفوض — يحتاج تطوير'; }

        // ── إرسال للباتнер (المالك) ──
        const ownerUser = await client.users.fetch(g.ownerId).catch(() => null);
        if (ownerUser) {
          await ownerUser.send({ embeds: [new EmbedBuilder()
            .setTitle(`📝 طلب انضمام جديد — ${answers1.q1_name}`)
            .setDescription(
              `# 📋 بيانات المتقدم\n\n` +
              `**الاسم:** ${answers1.q1_name}\n` +
              `**العمر:** ${answers1.q2_age} سنة\n` +
              `**اليوزر نيم:** ${answers1.q3_username}\n` +
              `**الديسكورد:** <@${interaction.user.id}>\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `# 📝 إجاباته\n\n` +
              `**4. الخبرة:**\n${answers1.q4_experience}\n\n` +
              `**5. ليه عايز ينضم:**\n${answers1.q5_why}\n\n` +
              `**6. المهارات:**\n${answers2.q6_skills}\n\n` +
              `**7. أوقات الفراغ:**\n${answers2.q7_available}\n\n` +
              `**8. الالتزام:**\n${answers2.q8_commitment}\n\n` +
              `**9. التعامل مع المشاكل:**\n${answers2.q9_conflict}\n\n` +
              `**10. إضافات:**\n${answers2.q10_extra}\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
              `# ${verdictEmoji} نتيجة التقييم\n\n` +
              `**نسبة النجاح:** \`${percentage}%\`\n` +
              `**النتيجة:** ${verdictText}\n\n` +
              `# ✅ الإيجابيات\n${positives.join('\n') || 'مفيش'}\n\n` +
              `# ❌ السلبيات\n${negatives.join('\n') || 'مفيش'}\n\n` +
              `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
              `استخدم زر القبول أو الرفض من لوحة التحكم`
            )
            .setColor(percentage >= 75 ? 0x2ECC71 : percentage >= 50 ? 0xF1C40F : 0xE74C3C)
            .setTimestamp()
            .setFooter({ text: `📝 تقديم للادارة — ${g.name}` })],
            components: [new ActionRowBuilder().addComponents(
              new ButtonBuilder().setCustomId(`apply_accept_${interaction.user.id}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success),
              new ButtonBuilder().setCustomId(`apply_reject_${interaction.user.id}`).setLabel('❌ رفض').setStyle(ButtonStyle.Danger),
            )]
          }).catch(() => {});
        }

        // ── رد على المتقدم ──
        await interaction.editReply({ embeds: [new EmbedBuilder()
          .setTitle('✅ تم إرسال طلبك!')
          .setDescription(
            '# شكرًا لتقديمك! 🎉\n\n' +
            `**النتيجة:** ${verdictEmoji} \`${percentage}%\` — ${verdictText}\n\n` +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '# 📋 إجاباتك\n\n' +
            `**1. الاسم:** ${answers1.q1_name}\n` +
            `**2. العمر:** ${answers1.q2_age}\n` +
            `**3. اليوزر نيم:** ${answers1.q3_username}\n` +
            `**4. الخبرة:** ${answers1.q4_experience.substring(0, 100)}...\n` +
            `**5. الدافع:** ${answers1.q5_why.substring(0, 100)}...\n` +
            `**6. المهارات:** ${answers2.q6_skills.substring(0, 100)}...\n\n` +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '# ✅ الإيجابيات\n' + (positives.join('\n') || 'مفيش') + '\n\n' +
            '# ❌ الملاحظات\n' + (negatives.join('\n') || 'مفيش') + '\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '> هنتواصل معاك في أقرب وقت إن شاء الله!'
          )
          .setColor(percentage >= 75 ? 0x2ECC71 : percentage >= 50 ? 0xF1C40F : 0xE74C3C)
          .setTimestamp()
          .setFooter({ text: '📝 تقديم للادارة' })
        ], ephemeral: true });

        // ── إرسال في قناة التقديمات ──
        const applyCh = g.channels.cache.find(c => c.name.includes('تقديم-للادارة') && c.isTextBased());
        if (applyCh) {
          await applyCh.send({ embeds: [new EmbedBuilder()
            .setTitle(`📝 تقديم جديد — ${answers1.q1_name}`)
            .setDescription(
              `**المتقدم:** <@${interaction.user.id}>\n` +
              `**الاسم:** ${answers1.q1_name}\n` +
              `**العمر:** ${answers1.q2_age}\n` +
              `**النتيجة:** ${verdictEmoji} \`${percentage}%\` — ${verdictText}`
            )
            .setColor(percentage >= 75 ? 0x2ECC71 : percentage >= 50 ? 0xF1C40F : 0xE74C3C)
            .setTimestamp()
          ] });
        }

        // ── سجل ──
        const applications = load('applications.json', []);
        applications.push({ userId: interaction.user.id, name: answers1.q1_name, age: answers1.q2_age, username: answers1.q3_username, score: percentage, verdict: verdictText, answers: { ...answers1, ...answers2 }, positives, negatives, createdAt: Date.now() });
        save('applications.json', applications);
        return;
      }

      // ── قبول/رفض تقديم ──
      if (interaction.customId.startsWith('apply_accept_') || interaction.customId.startsWith('apply_reject_')) {
        const targetUserId = interaction.customId.replace('apply_accept_', '').replace('apply_reject_', '');
        const isAccept = interaction.customId.startsWith('apply_accept_');
        const g = interaction.guild;
        const targetMember = await g.members.fetch(targetUserId).catch(() => null);
        if (!targetMember) return interaction.reply({ content: '❌ العضو مش موجود في السيرفر', ephemeral: true });

        if (isAccept) {
          const trialRole = g.roles.cache.find(r => r.name.includes('Trial'));
          if (trialRole) {
            await targetMember.roles.add(trialRole).catch(() => {});
          }
          await interaction.update({ embeds: [new EmbedBuilder().setTitle('✅ تم القبول!').setDescription(`**المتقدم:** <@${targetUserId}>\n**بواسطة:** ${interaction.user}\n\n🎉 **تم قبوله في فترة التجربة!**`).setColor(0x2ECC71).setTimestamp()], components: [] });
          try { await targetMember.send(`🎉 تم قبولك في فريق الستاف!\n\nأنت الآن في فترة التجربة — حظ سعيد! 🚀`).catch(() => {}); } catch {}
        } else {
          await interaction.update({ embeds: [new EmbedBuilder().setTitle('❌ تم الرفض').setDescription(`**المتقدم:** <@${targetUserId}>\n**بواسطة:** ${interaction.user}\n\nمرفوض — يقدر يقدّم تاني بعد أسبوع`).setColor(0xE74C3C).setTimestamp()], components: [] });
          try { await targetMember.send(`❌ للأسف تم رفض طلبك.\n\nممكن تقدّم تاني بعد أسبوع — استمر! 💪`).catch(() => {}); } catch {}
        }
        return;
      }
    }
  } catch (err) {
    console.error('❌ Error:', err.message);
    try {
      if (interaction.replied || interaction.deferred) {
        await interaction.followUp({ content: `❌ خطأ: ${err.message}`, ephemeral: true }).catch(() => {});
      } else {
        await interaction.reply({ content: `❌ خطأ: ${err.message}`, ephemeral: true }).catch(() => {});
      }
    } catch {}
  }
});

// ══════════════════════════════════════════════════════════════
//  EVENTS
// ══════════════════════════════════════════════════════════════
client.on('clientReady', () => {
  console.log(`✅ Bot: ${client.user.tag} | ${client.guilds.cache.size} servers`);
  client.user.setActivity('AI Shop — متجر الذكاء الاصطناعي', { type: ActivityType.Watching });
});

client.on('guildMemberAdd', async (member) => {
  // Auto-roles
  if (CFG.autoRoles?.length) {
    for (const roleId of CFG.autoRoles) {
      try { const role = member.guild.roles.cache.get(roleId); if (role) await member.roles.add(role); } catch {}
    }
  }

  // Anti-raid
  const guildId = member.guild.id;
  const raidData = getRaidData();
  if (!raidData[guildId]) raidData[guildId] = { joins: [] };
  const now = Date.now();
  raidData[guildId].joins.push(now);
  raidData[guildId].joins = raidData[guildId].joins.filter(t => now - t < 60000);
  save('raid.json', raidData);

  if (raidData[guildId].joins.length >= 10) {
    try {
      const ch = member.guild.systemChannel || member.guild.channels.cache.find(c => c.isTextBased());
      if (ch) await ch.send({ embeds: [new EmbedBuilder().setTitle('🚨 تنبيه: هجوم محتمل!').setDescription(`**${raidData[guildId].joins.length}** أعضاء دخلوا في دقيقة واحدة! ممكن يكون هجوم.`).setColor(0xFF0000).setTimestamp()] });
    } catch {}
    await sendLog(member.guild, new EmbedBuilder().setTitle('🚨 RAID DETECTED').setDescription(`${raidData[guildId].joins.length} joins in 1 minute!`).setColor(0xFF0000).setTimestamp());
  }

  // Welcome
  try {
    const g = member.guild;
    const ch = g.channels.cache.find(c => c.name.includes('الترحيب') && c.isTextBased());
    if (!ch) return;
    const embed = new EmbedBuilder()
      .setTitle(`أهلاً ${member.user.username}! 🎉`)
      .setDescription(`━━━━━━━━━━━━━━━━━━━━━\n\n**أهلاً وسهلاً بيك في ${g.name}!** 🚀\n\nأنت العضو رقم **${g.memberCount}**\n\n━━━━━━━━━━━━━━━━━━━━━\n\n**📦 ابدأ هنا:**\n> 🛒 اختار خدمة من القائمة\n> ⭐ قيّم بـ \`/review\`\n\n━━━━━━━━━━━━━━━━━━━━━`)
      .setColor(0x2ECC71).setTimestamp().setFooter({ text: `${g.name} • ${g.memberCount} عضو` });
    try { const av = member.user.displayAvatarURL({ dynamic: true, size: 256 }); if (av) embed.setThumbnail(av); } catch {}
    await ch.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
  } catch {}
});

client.on('guildMemberRemove', async (member) => {
  await sendLog(member.guild, new EmbedBuilder().setTitle('👋 عضو مشي').setDescription(`**${member.user.tag}** (${member.user.id})`).setColor(0xF39C12).setTimestamp());
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // Anti-spam
  if (checkSpam(message.author.id)) {
    try { await message.delete(); } catch {}
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member?.moderatable) {
      await member.timeout(60000, 'Spam');
      await message.channel.send({ content: `🔇 ${message.author} اتكتم لمدة دقيقة (سبام)` }).catch(() => {});
      await sendLog(message.guild, new EmbedBuilder().setTitle('🔇 Auto-Mute: Spam').setDescription(`**العضو:** ${message.author}\n**القناة:** ${message.channel}`).setColor(0x9B59B6).setTimestamp());
    }
    return;
  }

  // Bad words
  if (checkBadWords(message.content)) {
    try { await message.delete(); } catch {}
    await message.channel.send({ content: `🚫 ${message.author} الرسالة فيها كلمة ممنوعة` }).catch(() => {});
    await sendLog(message.guild, new EmbedBuilder().setTitle('🚫 Bad Word Detected').setDescription(`**العضو:** ${message.author}\n**القناة:** ${message.channel}\n**المحتوى:** ${safe(message.content, 200)}`).setColor(0xE74C3C).setTimestamp());
  }
});

client.on('messageDelete', async (message) => {
  if (message.author?.bot || !message.guild) return;
  await sendLog(message.guild, new EmbedBuilder().setTitle('🗑️ رسالة اتمسحت').setDescription(`**الكاتب:** ${message.author}\n**القناة:** ${message.channel}\n**المحتوى:** ${safe(message.content, 500)}`).setColor(0xF39C12).setTimestamp());
});

client.on('messageUpdate', async (old, newMsg) => {
  if (old.author?.bot || !old.guild || !old.content) return;
  if (old.content === newMsg.content) return;
  await sendLog(old.guild, new EmbedBuilder().setTitle('✏️ رسالة اتغيّرت').setDescription(`**الكاتب:** ${old.author}\n**القناة:** ${old.channel}\n**قبل:** ${safe(old.content, 300)}\n**بعد:** ${safe(newMsg.content, 300)}`).setColor(0x3498DB).setTimestamp());
});

client.on('guildBanAdd', async (ban) => {
  await sendLog(ban.guild, new EmbedBuilder().setTitle('🔨 حظر').setDescription(`**العضو:** ${ban.user}\n**السبب:** ${ban.reason || '—'}`).setColor(0xE74C3C).setTimestamp());
});

// ══════════════════════════════════════════════════════════════
//  HTTP API (Full Management)
// ══════════════════════════════════════════════════════════════
const API_PORT = process.env.PORT || process.env.BOT_API_PORT || 3001;
function parseBody(req) { return new Promise(r => { let b = ''; req.on('data', c => b += c); req.on('end', () => { try { r(JSON.parse(b || '{}')); } catch { r({}); } }); }); }
function jsonRes(res, code, data) { res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' }); res.end(JSON.stringify(data)); }

const apiServer = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }
  const url = new URL(req.url, 'http://localhost'), p = url.pathname;
  try {
    if (req.method === 'GET' && (p === '/api/health' || p === '/')) return jsonRes(res, 200, { status: 'ok', uptime: process.uptime(), canvas: !!Canvas, arabicFont: arabicFontRegistered });
    const guild = client.guilds.cache.first();
    if (!guild && p !== '/api/health' && p !== '/api/bot') return jsonRes(res, 500, { error: 'No guild' });

    // ── GET ──
    if (req.method === 'GET' && p === '/api/bot') return jsonRes(res, 200, { id: client.user?.id, username: client.user?.username, avatar: client.user?.displayAvatarURL({ dynamic: true, size: 256 }) });
    if (req.method === 'GET' && p === '/api/guild') return jsonRes(res, 200, { id: guild.id, name: guild.name, icon: guild.iconURL({ dynamic: true, size: 256 }), memberCount: guild.memberCount, ownerId: guild.ownerId, boostCount: guild.premiumSubscriptionCount || 0, createdAt: guild.createdAt?.toISOString() });
    if (req.method === 'GET' && p === '/api/stats') return jsonRes(res, 200, { orders: getOrders().length, completed: getOrders().filter(o => o.status === 'completed').length, reviews: getReviews().length, services: getServices().filter(s => s.active).length, members: guild?.memberCount || 0, giveaways: getGiveaways().length });

    // ── GET: Sales stats for dashboard charts ──
    if (req.method === 'GET' && p === '/api/sales-stats') {
      const orders = getOrders();
      const shopOrders = orders.filter(o => o.source === 'shop');
      const now = Date.now();
      const DAY = 86400000;

      // Revenue by day (last 30 days)
      const dailyRevenue = [];
      for (let i = 29; i >= 0; i--) {
        const dayStart = now - (i + 1) * DAY;
        const dayEnd = now - i * DAY;
        const dayOrders = shopOrders.filter(o => o.createdAt >= dayStart && o.createdAt < dayEnd && (o.status === 'completed' || o.status === 'accepted'));
        const revenue = dayOrders.reduce((sum, o) => sum + (o.servicePrice || 0) * (o.qty || 1), 0);
        const date = new Date(dayEnd);
        dailyRevenue.push({ date: `${date.getMonth() + 1}/${date.getDate()}`, revenue, count: dayOrders.length });
      }

      // Revenue by month (last 6 months)
      const monthlyRevenue = [];
      for (let i = 5; i >= 0; i--) {
        const d = new Date(now);
        d.setMonth(d.getMonth() - i, 1);
        const monthStart = d.getTime();
        d.setMonth(d.getMonth() + 1);
        const monthEnd = d.getTime();
        const monthOrders = shopOrders.filter(o => o.createdAt >= monthStart && o.createdAt < monthEnd && (o.status === 'completed' || o.status === 'accepted'));
        const revenue = monthOrders.reduce((sum, o) => sum + (o.servicePrice || 0) * (o.qty || 1), 0);
        monthlyRevenue.push({ month: d.toLocaleDateString('ar', { month: 'short' }), revenue, count: monthOrders.length });
      }

      // Orders by status
      const statusCounts = {};
      shopOrders.forEach(o => { statusCounts[o.status] = (statusCounts[o.status] || 0) + 1; });

      // Top services by revenue
      const svcRevenue = {};
      shopOrders.filter(o => o.status === 'completed' || o.status === 'accepted').forEach(o => {
        const key = o.serviceName || 'Unknown';
        if (!svcRevenue[key]) svcRevenue[key] = { name: key, emoji: o.serviceEmoji || '🛒', revenue: 0, count: 0 };
        svcRevenue[key].revenue += (o.servicePrice || 0) * (o.qty || 1);
        svcRevenue[key].count++;
      });
      const topServices = Object.values(svcRevenue).sort((a, b) => b.revenue - a.revenue).slice(0, 8);

      // Total stats
      const completedOrders = shopOrders.filter(o => o.status === 'completed');
      const totalRevenue = shopOrders.reduce((sum, o) => sum + (o.servicePrice || 0) * (o.qty || 1), 0);
      const completedRevenue = completedOrders.reduce((sum, o) => sum + (o.servicePrice || 0) * (o.qty || 1), 0);
      const avgOrderValue = shopOrders.length ? Math.round(totalRevenue / shopOrders.length) : 0;
      const todayStart = now - DAY;
      const todayOrders = shopOrders.filter(o => o.createdAt >= todayStart);
      const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.servicePrice || 0) * (o.qty || 1), 0);

      return jsonRes(res, 200, {
        dailyRevenue,
        monthlyRevenue,
        statusCounts,
        topServices,
        totals: {
          totalOrders: shopOrders.length,
          totalRevenue,
          completedRevenue,
          avgOrderValue,
          todayOrders: todayOrders.length,
          todayRevenue,
          deliveryRate: shopOrders.length ? Math.round((completedOrders.length / shopOrders.length) * 100) : 0
        }
      });
    }
    if (req.method === 'GET' && p === '/api/services') return jsonRes(res, 200, getServices());
    if (req.method === 'GET' && p === '/api/categories') return jsonRes(res, 200, getCategories());
    if (req.method === 'GET' && p === '/api/tickets') return jsonRes(res, 200, getOrders());
    if (req.method === 'GET' && p === '/api/reviews') return jsonRes(res, 200, getReviews());

    // ── POST: Add review with image support ──
    if (req.method === 'POST' && p === '/api/reviews') {
      const d = await parseBody(req);
      if (!d.serviceId || !d.rating) return jsonRes(res, 400, { error: 'Missing serviceId or rating' });
      const rating = parseInt(d.rating);
      if (rating < 1 || rating > 5) return jsonRes(res, 400, { error: 'Rating must be 1-5' });
      const services = getServices(), svc = services.find(s => s.id === parseInt(d.serviceId));
      if (!svc) return jsonRes(res, 404, { error: 'Service not found' });
      const reviews = getReviews();
      const review = { id: nextId(reviews), serviceId: svc.id, serviceName: svc.name, serviceEmoji: svc.emoji || '🛒', userId: d.userId || '0', username: d.username || 'Anonymous', rating, comment: d.comment || '', images: Array.isArray(d.images) ? d.images.slice(0, 5) : [], createdAt: Date.now() };
      reviews.push(review);
      save('reviews.json', reviews);

      // Post to Discord reviews channel
      try {
        const g = client.guilds.cache.first();
        if (g) {
          const reviewCh = g.channels.cache.find(c => c.name.includes('التقييمات') && c.isTextBased());
          if (reviewCh) {
            const embed = new EmbedBuilder()
              .setTitle(`⭐ تقييم جديد — ${svc.emoji} ${svc.name}`)
              .setDescription(`**المستخدم:** ${review.username}\n**التقييم:** ${'★'.repeat(rating) + '☆'.repeat(5 - rating)}\n**التعليق:** ${review.comment || '—'}`)
              .setColor(0xF1C40F).setTimestamp();
            await reviewCh.send({ embeds: [embed] });
          }
        }
      } catch (e) { console.error('Review post error:', e.message); }

      return jsonRes(res, 200, { ok: true, id: review.id });
    }
    if (req.method === 'GET' && p === '/api/warnings') return jsonRes(res, 200, getWarnings());
    if (req.method === 'GET' && p === '/api/giveaways') return jsonRes(res, 200, getGiveaways());
    if (req.method === 'GET' && p === '/api/config') return jsonRes(res, 200, { autoRoles: CFG.autoRoles, logsChannel: CFG.logsChannel, automod: CFG.automod, primaryCurrency: CFG.primaryCurrency || 'usd', welcomeMessage: CFG.welcomeMessage || '', welcomeChannel: CFG.welcomeChannel || '' });
    if (req.method === 'GET' && p === '/api/channels') {
      const channels = [];
      for (const [, c] of guild.channels.cache) channels.push({ id: c.id, name: c.name, type: c.type });
      return jsonRes(res, 200, channels);
    }
    if (req.method === 'GET' && p === '/api/roles') {
      const roles = [];
      for (const [, r] of guild.roles.cache) roles.push({ id: r.id, name: r.name, color: r.hexColor, members: r.members?.size || 0 });
      return jsonRes(res, 200, roles);
    }
    if (req.method === 'GET' && p === '/api/members') {
      try { await guild.members.fetch(); } catch {}
      const members = [];
      for (const [, m] of guild.members.cache) {
        const roleIds = []; for (const [, r] of m.roles.cache) { if (r.id !== guild.id) roleIds.push(r.id); }
        members.push({ id: m.id, username: m.user.username, displayName: m.displayName, avatar: m.user.displayAvatarURL({ dynamic: true, size: 64 }), roles: roleIds, joinedAt: m.joinedAt?.toISOString(), banned: m.banned, timeout: m.isCommunicationDisabledUntil?.toISOString() || null });
      }
      return jsonRes(res, 200, members);
    }

    // ── POST: Send message ──
    if (req.method === 'POST' && p === '/api/send-message') {
      const d = await parseBody(req);
      const ch = guild.channels.cache.get(d.channelId);
      if (!ch) return jsonRes(res, 404, { error: 'Channel not found' });
      const embed = d.title ? new EmbedBuilder().setTitle(d.title).setDescription(d.content || '').setColor(d.color || 0x3498DB).setTimestamp() : null;
      await ch.send({ content: d.content || undefined, embeds: embed ? [embed] : undefined });
      return jsonRes(res, 200, { ok: true });
    }

    // ── POST: Reply to ticket ──
    if (req.method === 'POST' && p.match(/^\/api\/tickets\/\d+\/reply$/)) {
      const id = parseInt(p.split('/')[3]);
      const order = getOrders().find(o => o.id === id);
      if (!order) return jsonRes(res, 404, { error: 'Ticket not found' });
      const ch = guild.channels.cache.get(order.channelId);
      if (!ch) return jsonRes(res, 404, { error: 'Channel not found' });
      const d = await parseBody(req);
      const embed = new EmbedBuilder().setTitle('💬 رد من لوحة التحكم').setDescription(d.message).setColor(0x3498DB).setTimestamp().setFooter({ text: '🌐 Dashboard' });
      await ch.send({ embeds: [embed] });
      return jsonRes(res, 200, { ok: true });
    }

    // ── POST: Close ticket ──
    if (req.method === 'POST' && p.match(/^\/api\/tickets\/\d+\/close$/)) {
      const id = parseInt(p.split('/')[3]);
      const orders = getOrders();
      const order = orders.find(o => o.id === id);
      if (!order) return jsonRes(res, 404, { error: 'Ticket not found' });
      order.status = 'closed'; order.closedAt = Date.now(); order.closedBy = 'dashboard';
      save('orders.json', orders);
      const ch = guild.channels.cache.get(order.channelId);
      if (ch) { try { await ch.send({ embeds: [new EmbedBuilder().setTitle('🔒 تم الإغلاق من لوحة التحكم').setColor(0xE74C3C).setTimestamp()] }); await sleep(2000); await ch.delete(); } catch {} }
      return jsonRes(res, 200, { ok: true });
    }

    // ── POST: Announce ──
    if (req.method === 'POST' && p === '/api/announce') {
      const d = await parseBody(req);
      let ch = guild.channels.cache.find(c => c.name.includes('الإعلانات') && c.isTextBased());
      if (!ch) return jsonRes(res, 404, { error: 'No announcements channel' });
      const embed = new EmbedBuilder().setTitle(`${d.emoji || '📣'} ${safe(d.title, 200)}`).setDescription(safe(d.content, 4000)).setColor(0xFF0000).setTimestamp().setFooter({ text: '📢 من لوحة التحكم' });
      await ch.send({ embeds: [embed] });
      return jsonRes(res, 200, { ok: true });
    }

    // ── POST: Mod actions ──
    if (req.method === 'POST' && p === '/api/mod/ban') {
      const d = await parseBody(req);
      const member = await guild.members.fetch(d.userId).catch(() => null);
      if (!member) return jsonRes(res, 404, { error: 'Member not found' });
      await member.ban({ reason: d.reason || 'Dashboard ban' });
      return jsonRes(res, 200, { ok: true });
    }
    if (req.method === 'POST' && p === '/api/mod/kick') {
      const d = await parseBody(req);
      const member = await guild.members.fetch(d.userId).catch(() => null);
      if (!member) return jsonRes(res, 404, { error: 'Member not found' });
      await member.kick(d.reason || 'Dashboard kick');
      return jsonRes(res, 200, { ok: true });
    }
    if (req.method === 'POST' && p === '/api/mod/mute') {
      const d = await parseBody(req);
      const member = await guild.members.fetch(d.userId).catch(() => null);
      if (!member) return jsonRes(res, 404, { error: 'Member not found' });
      await member.timeout((d.minutes || 5) * 60 * 1000, d.reason || 'Dashboard mute');
      return jsonRes(res, 200, { ok: true });
    }
    if (req.method === 'POST' && p === '/api/mod/warn') {
      const d = await parseBody(req);
      const warnings = getWarnings();
      warnings.push({ id: nextId(warnings), userId: d.userId, username: d.username || d.userId, reason: d.reason || 'Dashboard warn', issuedBy: 'dashboard', issuedByName: 'Dashboard', createdAt: Date.now() });
      save('warnings.json', warnings);
      return jsonRes(res, 200, { ok: true });
    }

    // ── PUT: Update service ──
    if (req.method === 'PUT' && p.match(/^\/api\/services\/\d+$/)) {
      const id = parseInt(p.split('/').pop());
      const services = getServices();
      const svc = services.find(s => s.id === id);
      if (!svc) return jsonRes(res, 404, { error: 'Not found' });
      const d = await parseBody(req);
      Object.assign(svc, d, { id: svc.id });
      save('services.json', services);
      return jsonRes(res, 200, { ok: true });
    }

    // ── POST: Add service ──
    if (req.method === 'POST' && p === '/api/services') {
      const d = await parseBody(req);
      const services = getServices();
      const id = nextId(services);
      services.push({ id, name: d.name, description: d.description, price: d.price, category: d.category, emoji: d.emoji || '🛒', active: true, createdAt: Date.now() });
      save('services.json', services);
      return jsonRes(res, 200, { ok: true, id });
    }

    // ── DELETE: Remove service ──
    if (req.method === 'DELETE' && p.match(/^\/api\/services\/\d+$/)) {
      const id = parseInt(p.split('/').pop());
      const services = getServices().filter(s => s.id !== id);
      save('services.json', services);
      return jsonRes(res, 200, { ok: true });
    }

    // ── POST: Add category ──
    if (req.method === 'POST' && p === '/api/categories') {
      const d = await parseBody(req);
      const cats = getCategories();
      if (cats.find(c => c.id === d.id)) return jsonRes(res, 400, { error: 'Category exists' });
      cats.push({ id: d.id, name: d.name, emoji: d.emoji || '📁' });
      saveCategories(cats);
      return jsonRes(res, 200, { ok: true });
    }

    // ── PUT: Update category ──
    if (req.method === 'PUT' && p.match(/^\/api\/categories\/.+$/)) {
      const id = decodeURIComponent(p.split('/').pop());
      const cats = getCategories();
      const cat = cats.find(c => c.id === id);
      if (!cat) return jsonRes(res, 404, { error: 'Not found' });
      const d = await parseBody(req);
      Object.assign(cat, d, { id: cat.id });
      saveCategories(cats);
      if (d.id && d.id !== id) {
        const services = getServices();
        services.forEach(s => { if (s.category === id) s.category = d.id; });
        save('services.json', services);
      }
      return jsonRes(res, 200, { ok: true });
    }

    // ── DELETE: Remove category ──
    if (req.method === 'DELETE' && p.match(/^\/api\/categories\/.+$/)) {
      const id = decodeURIComponent(p.split('/').pop());
      const servicesUsing = getServices().filter(s => s.category === id);
      if (servicesUsing.length) return jsonRes(res, 400, { error: `Category has ${servicesUsing.length} services` });
      saveCategories(getCategories().filter(c => c.id !== id));
      return jsonRes(res, 200, { ok: true });
    }

    // ── PUT: Update config ──
    if (req.method === 'PUT' && p === '/api/config') {
      const d = await parseBody(req);
      if (d.autoRoles !== undefined) CFG.autoRoles = d.autoRoles;
      if (d.logsChannel !== undefined) CFG.logsChannel = d.logsChannel;
      if (d.automod !== undefined) CFG.automod = { ...CFG.automod, ...d.automod };
      if (d.primaryCurrency !== undefined) CFG.primaryCurrency = d.primaryCurrency;
      if (d.welcomeMessage !== undefined) CFG.welcomeMessage = d.welcomeMessage;
      if (d.welcomeChannel !== undefined) CFG.welcomeChannel = d.welcomeChannel;
      save('config.json', CFG);
      return jsonRes(res, 200, { ok: true });
    }

    // ── POST: Send to channel ──
    if (req.method === 'POST' && p === '/api/channels/send') {
      const d = await parseBody(req);
      const ch = guild.channels.cache.get(d.channelId);
      if (!ch) return jsonRes(res, 404, { error: 'Channel not found' });
      await ch.send({ content: d.content });
      return jsonRes(res, 200, { ok: true });
    }

    // ── PUT: Change bot username ──
    if (req.method === 'PUT' && p === '/api/bot/username') {
      const d = await parseBody(req);
      if (!d.username) return jsonRes(res, 400, { error: 'Missing username' });
      const r = await fetch('https://discord.com/api/v10/users/@me', {
        method: 'PATCH',
        headers: { 'Authorization': `Bot ${CFG.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: d.username }),
      });
      if (!r.ok) { const err = await r.text(); return jsonRes(res, r.status, { error: err }); }
      return jsonRes(res, 200, { ok: true });
    }

    // ── PUT: Change bot avatar ──
    if (req.method === 'PUT' && p === '/api/bot/avatar') {
      const d = await parseBody(req);
      if (!d.image) return jsonRes(res, 400, { error: 'Missing image (base64 data URL)' });
      const r = await fetch('https://discord.com/api/v10/users/@me', {
        method: 'PATCH',
        headers: { 'Authorization': `Bot ${CFG.token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ avatar: d.image }),
      });
      if (!r.ok) { const err = await r.text(); return jsonRes(res, r.status, { error: err }); }
      return jsonRes(res, 200, { ok: true });
    }

    // ── PUT: Change guild name ──
    if (req.method === 'PUT' && p === '/api/guild/name') {
      const d = await parseBody(req);
      if (!d.name) return jsonRes(res, 400, { error: 'Missing name' });
      await guild.setName(d.name);
      return jsonRes(res, 200, { ok: true });
    }

    // ── PUT: Change guild icon ──
    if (req.method === 'PUT' && p === '/api/guild/icon') {
      const d = await parseBody(req);
      if (!d.image) return jsonRes(res, 400, { error: 'Missing image (base64 data URL)' });
      const buffer = Buffer.from(d.image.replace(/^data:image\/\w+;base64,/, ''), 'base64');
      await guild.setIcon(buffer);
      return jsonRes(res, 200, { ok: true });
    }

    // ── GET: Dashboard HTML ──
    if (req.method === 'GET' && p === '/dashboard') {
      const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    // ── GET: Shop HTML ──
    if (req.method === 'GET' && p === '/shop') {
      const html = fs.readFileSync(path.join(__dirname, 'shop.html'), 'utf8');
      res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
      return res.end(html);
    }

    // ── GET: Shop orders ──
    if (req.method === 'GET' && p === '/api/shop-orders') {
      const orders = getOrders().filter(o => o.source === 'shop').sort((a, b) => b.createdAt - a.createdAt);
      return jsonRes(res, 200, orders);
    }

    // ── POST: Update shop order status ──
    if (req.method === 'POST' && p.match(/^\/api\/shop-orders\/\d+\/status$/)) {
      const id = parseInt(p.split('/')[3]);
      const d = await parseBody(req);
      const orders = getOrders();
      const order = orders.find(o => o.id === id);
      if (!order) return jsonRes(res, 404, { error: 'Order not found' });
      order.status = d.status;
      order.updatedAt = Date.now();
      save('orders.json', orders);
      if (d.status === 'accepted' && order.channelId) {
        const g = client.guilds.cache.get(CFG.guildId);
        if (g) {
          const ch = g.channels.cache.get(order.channelId);
          if (ch) {
            const invite = await ch.createInvite({ maxAge: 86400 * 7, reason: `Order #${id} accepted` }).catch(() => null);
            const inviteUrl = invite ? `https://discord.gg/${invite.code}` : 'https://discord.gg/a85fhmx4X';
            await ch.send({ content: `✅ **تم قبول الطلب!**\n\n🎯 انضم للسيرفر عشان تكمل طلبك:\n${inviteUrl}\n\n💡 ادخل التذكرة وتابع طلبك` }).catch(() => {});
          }
        }
      }
      return jsonRes(res, 200, { ok: true });
    }

    // ── POST: Shop order ──
    if (req.method === 'POST' && p === '/api/shop/order') {
      const d = await parseBody(req);
      if (!d.serviceId || !d.name || !d.discord) return jsonRes(res, 400, { error: 'Missing required fields' });
      const services = getServices(), svc = services.find(s => s.id === parseInt(d.serviceId));
      if (!svc) return jsonRes(res, 404, { error: 'Service not found' });
      const g = client.guilds.cache.get(CFG.guildId);
      if (!g) return jsonRes(res, 500, { error: 'Guild not found' });
      const orders = getOrders(), orderId = nextId(orders);
      const order = { id: orderId, type: 'order', serviceId: svc.id, serviceName: svc.name, serviceEmoji: svc.emoji || '🛒', servicePrice: svc.price || 0, userId: '0', username: d.discord, channelId: '', status: 'pending', source: 'shop', customerName: d.name, contactType: d.contactType || 'discord', contact: d.contact || '', qty: parseInt(d.qty) || 1, notes: d.notes || '', createdAt: Date.now() };
      orders.push(order); save('orders.json', orders);

      jsonRes(res, 200, { ok: true, orderId });

      // Create ticket in background (non-blocking)
      (async () => {
        try {
          const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
          const ow = [{ id: g.id, deny: [PermissionFlagsBits.SendMessages], allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] }];
          if (staffRole) ow.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
          const channel = await g.channels.create({ name: `shop-${orderId}-${d.name}`.substring(0, 100), type: ChannelType.GuildText, parent: getTicketCat(g)?.id, permissionOverwrites: ow });
          const freshOrders = getOrders(); const freshOrder = freshOrders.find(o => o.id === orderId);
          if (freshOrder) { freshOrder.channelId = channel.id; save('orders.json', freshOrders); }
          const total = svc.price * (parseInt(d.qty) || 1);
          const contactLabels = { discord: 'Discord', whatsapp: 'WhatsApp', telegram: 'Telegram', email: 'إيميل' };
          const embed = new EmbedBuilder()
            .setTitle(`🛒 طلب من المتجر #${orderId}`)
            .setDescription(`**العميل:** ${d.name}\n**Discord:** ${d.discord}\n**التواصل:** ${contactLabels[d.contactType] || d.contactType}: ${d.contact}\n**الخدمة:** ${svc.emoji} ${svc.name}\n**الكمية:** ${parseInt(d.qty) || 1}\n**السعر:** \`${fmt(svc.price)}\` × ${parseInt(d.qty) || 1} = \`${fmt(total)}\`\n**الوصف:** ${svc.description || '—'}\n${d.notes ? `**ملاحظات:** ${d.notes}\n` : ''}━━━━━━━━━━━━━━━━━━━━━\n⏳ **مستنية قبول الستاف...**`)
            .setColor(0xF1C40F).setTimestamp();
          await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`order_accept_${orderId}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ اقفل').setStyle(ButtonStyle.Danger))] });
          const invite = await channel.createInvite({ maxAge: 86400 * 7, reason: `Shop order #${orderId}` }).catch(() => null);
          const inviteUrl = invite ? `https://discord.gg/${invite.code}` : 'https://discord.gg/a85fhmx4X';
          await channel.send({ content: `👋 **أهلاً ${d.name}!**\n\n🎯 انضم للسيرفر عشان تتابع طلبك:\n${inviteUrl}\n\n💡 اكتب في التذكرة وأي حد من الستاف هيرد عليك` }).catch(() => {});
          await sendLog(g, new EmbedBuilder().setTitle('🛒 طلب من المتجر').setDescription(`**العميل:** ${d.name} (${d.discord})\n**الخدمة:** ${svc.name}\n**المبلغ:** ${fmt(total)}\n**القناة:** ${channel}`).setColor(0xF1C40F).setTimestamp());
        } catch (e) { console.error('Shop order background error:', e.message); }
      })();
    }

    jsonRes(res, 404, { error: 'Not found' });
  } catch (e) { console.error('API Error:', e.message); jsonRes(res, 500, { error: e.message }); }
});
apiServer.on('error', (err) => { if (err.code === 'EADDRINUSE') console.error(`❌ Port ${API_PORT} in use`); });
apiServer.listen(API_PORT, '0.0.0.0', () => console.log(`📡 Bot API: http://0.0.0.0:${API_PORT}`));

// ══════════════════════════════════════════════════════════════
//  START
// ══════════════════════════════════════════════════════════════
async function start() {
  if (!CFG.token || !CFG.clientId || !CFG.guildId) {
    console.log('❌ Missing config! Set BOT_TOKEN, CLIENT_ID, GUILD_ID');
    return;
  }
  console.log('🚀 Starting bot...');
  console.log(`📋 Config: clientId=${CFG.clientId ? 'OK' : 'MISSING'} guildId=${CFG.guildId ? 'OK' : 'MISSING'} token=${CFG.token ? 'OK' : 'MISSING'}`);

  client.once('clientReady', async () => {
    console.log(`✅ Bot: ${client.user.tag} | ${client.guilds.cache.size} servers`);

    // Make logs channel private (staff + owner only)
    try {
      if (CFG.logsChannel) {
        const g = client.guilds.cache.get(CFG.guildId);
        if (g) {
          const logsCh = g.channels.cache.get(CFG.logsChannel);
          if (logsCh) {
            const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
            const ow = [{ id: g.id, deny: [PermissionFlagsBits.ViewChannel] }];
            if (staffRole) ow.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] });
            if (g.ownerId) ow.push({ id: g.ownerId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory] });
            await logsCh.permissionOverwrites.set(ow);
            console.log('🔒 Logs channel locked to staff + owner');
          }
        }
      }
    } catch (e) { console.error('Logs channel setup error:', e.message); }

    try {
      const url = `https://discord.com/api/v10/applications/${CFG.clientId}/guilds/${CFG.guildId}/commands`;
      const listRes = await fetch(url, { headers: { 'Authorization': `Bot ${CFG.token}` } });
      if (!listRes.ok) { console.error(`❌ List commands failed: ${listRes.status}`); return; }
      const existing = await listRes.json();
      const existingNames = new Set(existing.map(c => c.name));
      const needed = COMMANDS.filter(c => !existingNames.has(c.toJSON().name));
      if (needed.length === 0) { console.log(`✅ ${existing.length} commands already registered`); return; }

      const all = [...existing.map(c => ({ name: c.name, description: c.description, options: c.options || [] })), ...needed.map(c => c.toJSON())];
      console.log(`📡 ${existing.length} exist + ${needed.length} new = ${all.length} total`);
      const putRes = await fetch(url, { method: 'PUT', headers: { 'Authorization': `Bot ${CFG.token}`, 'Content-Type': 'application/json' }, body: JSON.stringify(all) });
      if (putRes.ok) { const data = await putRes.json(); console.log(`✅ ${data.length} commands registered!`); }
      else { const body = await putRes.text(); console.error(`❌ ${putRes.status}: ${body}`); }
    } catch (err) { console.error('❌ Command registration failed:', err.message); }
  });

  try { await client.login(CFG.token); } catch (err) { console.error('❌ Login failed:', err.message); }
}

start();
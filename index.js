const {
  Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits,
  SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, ActivityType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');
const { connectDB, seedDefaults, loadFromCache, saveToCache, scheduleFlush } = require('./db');

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
const BANNER_W = 1200, BANNER_H = 350;
const BANNER_SCALE = 2;
const BANNER_THEMES = {
  'الخدمات':          { emoji: '🛒', c1: '#0a4', c2: '#0f6', accent: '#0fa' },
  'التخفيضات':       { emoji: '🎁', c1: '#f06', c2: '#f0a', accent: '#f6a' },
  'التقييمات':       { emoji: '⭐', c1: '#fa0', c2: '#fc0', accent: '#fd0' },
  'التواصل':         { emoji: '💬', c1: '#06f', c2: '#08f', accent: '#0af' },
  'الاعلانات':       { emoji: '📣', c1: '#a0f', c2: '#c0f', accent: '#d0f' },
  'الاخبار':         { emoji: '📣', c1: '#a0f', c2: '#c0f', accent: '#d0f' },
  'القوانين':        { emoji: '📋', c1: '#80f', c2: '#a0f', accent: '#b0f' },
  'القواعد':         { emoji: '📋', c1: '#80f', c2: '#a0f', accent: '#b0f' },
  'العام':           { emoji: '💬', c1: '#08f', c2: '#0af', accent: '#0cf' },
  'الشات':           { emoji: '💬', c1: '#08f', c2: '#0af', accent: '#0cf' },
  'اوامر':           { emoji: '🤖', c1: '#06f', c2: '#09f', accent: '#0bf' },
  'الذكاء':          { emoji: '🤖', c1: '#60a', c2: '#80c', accent: '#a0f' },
  'السيرفر':         { emoji: '📊', c1: '#08c', c2: '#0ac', accent: '#0cf' },
  'الترحيب':         { emoji: '👋', c1: '#0c6', c2: '#0f6', accent: '#0f9' },
  'من نحن':           { emoji: '👋', c1: '#d4af37', c2: '#ffe9a0', accent: '#fff5d0' },
  'فتح':             { emoji: '🎫', c1: '#fa0', c2: '#fc0', accent: '#fe0' },
  'تذكرة':           { emoji: '🎫', c1: '#fa0', c2: '#fc0', accent: '#fe0' },
  'الطلبات':         { emoji: '📦', c1: '#0a6', c2: '#0c6', accent: '#0f6' },
  'التوصيل':         { emoji: '📦', c1: '#0a6', c2: '#0c6', accent: '#0f6' },
  'التسليمات':       { emoji: '📦', c1: '#0a6', c2: '#0c6', accent: '#0f6' },
  'شات':             { emoji: '💼', c1: '#a0f', c2: '#c0f', accent: '#d0f' },
  'الستاف':          { emoji: '💼', c1: '#a0f', c2: '#c0f', accent: '#d0f' },
  'ملاحظات':         { emoji: '📋', c1: '#80f', c2: '#a0f', accent: '#b0f' },
  'تقديم':           { emoji: '📝', c1: '#06f', c2: '#08f', accent: '#0af' },
  'الادارة':         { emoji: '📝', c1: '#06f', c2: '#08f', accent: '#0af' },
  'السجلات':         { emoji: '📝', c1: '#668', c2: '#88a', accent: '#99b' },
  'التحكم':          { emoji: '🔧', c1: '#f33', c2: '#f66', accent: '#f88' },
  'لوحة':            { emoji: '🔧', c1: '#f33', c2: '#f66', accent: '#f88' },
  'كيف':             { emoji: '📖', c1: '#0a6', c2: '#0c6', accent: '#0f6' },
  'السحوبات':         { emoji: '🎁', c1: '#f06', c2: '#f0a', accent: '#f6a' },
  'الحالة':          { emoji: '📊', c1: '#08c', c2: '#0ac', accent: '#0cf' },
  // ═══════════════ كاتيجوري الخدم ═══════════════
  'التصميم':          { emoji: '🎨', c1: '#a06', c2: '#c0a', accent: '#e0f' },
  'المونتاج':         { emoji: '🎬', c1: '#c00', c2: '#f22', accent: '#f44' },
  'البرمجة والتطوير': { emoji: '💻', c1: '#064', c2: '#0a6', accent: '#0f8' },
  'الأكاديمية':       { emoji: '📚', c1: '#640', c2: '#a60', accent: '#c80' },
  'عامة':             { emoji: '⚡', c1: '#a60', c2: '#c80', accent: '#fa0' },
  'بالطلب':           { emoji: '🏗️', c1: '#446', c2: '#668', accent: '#88a' },
  'الرقمية':          { emoji: '🔑', c1: '#064', c2: '#0a4', accent: '#0f6' },
  'السوشيال':         { emoji: '📢', c1: '#60a', c2: '#80c', accent: '#a0f' },
  'جاهزة':            { emoji: '📦', c1: '#066', c2: '#088', accent: '#0aa' },
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

  const cleanName = (channelName || '').replace(/^.*〢\s*/, '').replace(/^.+?[・·]\s*/, '').replace(/-/g, ' ').trim();
  const GOLD = '#d4af37';
  const GOLD_LIGHT = '#f4e5b0';
  const GOLD_DARK = '#aa8c2c';
  const BG_DARK = '#0a0a0a';

  ctx.fillStyle = BG_DARK;
  ctx.fillRect(0, 0, BANNER_W, BANNER_H);

  const grad = ctx.createRadialGradient(BANNER_W / 2, BANNER_H / 2, 0, BANNER_W / 2, BANNER_H / 2, 350);
  grad.addColorStop(0, 'rgba(212,175,55,0.06)');
  grad.addColorStop(0.5, 'rgba(212,175,55,0.02)');
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, BANNER_W, BANNER_H);

  ctx.save();
  ctx.globalAlpha = 0.04;
  for (let y = 30; y < BANNER_H; y += 30) {
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 0.3;
    ctx.beginPath(); ctx.moveTo(40, y); ctx.lineTo(BANNER_W - 40, y); ctx.stroke();
  }
  ctx.restore();

  const drawCorner = (cx, cy, dx, dy) => {
    ctx.save();
    ctx.strokeStyle = GOLD;
    ctx.lineWidth = 1.5;
    ctx.shadowColor = GOLD; ctx.shadowBlur = 8;
    ctx.beginPath();
    ctx.moveTo(cx, cy + dy * 25);
    ctx.lineTo(cx, cy);
    ctx.lineTo(cx + dx * 25, cy);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + dx * 6, cy + dy * 6);
    ctx.lineTo(cx + dx * 6, cy + dy * 18);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(cx + dx * 6, cy + dy * 6);
    ctx.lineTo(cx + dx * 18, cy + dy * 6);
    ctx.stroke();
    ctx.restore();
  };
  drawCorner(30, 30, 1, 1);
  drawCorner(BANNER_W - 30, 30, -1, 1);
  drawCorner(30, BANNER_H - 30, 1, -1);
  drawCorner(BANNER_W - 30, BANNER_H - 30, -1, -1);

  const goldLine = (y, width) => {
    const g = ctx.createLinearGradient(BANNER_W / 2 - width, 0, BANNER_W / 2 + width, 0);
    g.addColorStop(0, 'transparent');
    g.addColorStop(0.2, 'rgba(212,175,55,0.3)');
    g.addColorStop(0.5, GOLD);
    g.addColorStop(0.8, 'rgba(212,175,55,0.3)');
    g.addColorStop(1, 'transparent');
    ctx.fillStyle = g;
    ctx.fillRect(BANNER_W / 2 - width, y, width * 2, 1);
  };
  goldLine(8, 300);
  goldLine(BANNER_H - 8, 300);

  const displayName = cleanName || channelName || '';
  if (displayName) {
    const isArabic = /[\u0600-\u06FF]/.test(displayName);
    const fontName = isArabic && arabicFontRegistered
      ? 'bold 72px "Arabic", "Cairo", sans-serif'
      : 'bold 74px "Playfair Display", serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const textX = BANNER_W / 2;
    const textY = BANNER_H / 2;

    ctx.save();
    ctx.shadowColor = '#ffe9a0'; ctx.shadowBlur = 20;
    const goldGrad = ctx.createLinearGradient(textX - 180, textY - 12, textX + 180, textY + 44);
    goldGrad.addColorStop(0, GOLD_DARK);
    goldGrad.addColorStop(0.2, GOLD_LIGHT);
    goldGrad.addColorStop(0.4, '#ffe9a0');
    goldGrad.addColorStop(0.5, '#fff5d0');
    goldGrad.addColorStop(0.6, '#ffe9a0');
    goldGrad.addColorStop(0.8, GOLD_LIGHT);
    goldGrad.addColorStop(1, GOLD_DARK);
    ctx.fillStyle = goldGrad;
    ctx.font = fontName;
    ctx.fillText(displayName, textX, textY + 8);
    ctx.restore();
  }

  return Buffer.from(c.toBuffer('image/png'));
}

const BANNER_FILES_DIR = path.join(__dirname, 'data', 'banners');

const CHANNEL_BANNER_MAP = {
  'من نحن': 'الترحيب.png',
  'الخدمات': 'الخدمات.png',
  'كيف تطلب': 'كيف تطلب.png',
  'التقييمات': 'التقييمات.png',
  'تواصل مع الستاف': 'تواصل مع الستاف.png',
  'القوانين': 'القوانين.png',
  'السحوبات': 'السحوبات.png',
  'الشات العام': 'الشات.png',
  'اوامر البوت': 'اوامر.png',
  'الطلبات': 'الطلبات.png',
  'حالة التوصيل': 'حالة التوصيل.png',
  'التسليمات': 'التسليمات.png',
  'شات الستاف': 'شات الستاف.png',
  'ملاحظات': 'ملاحظات.png',
  'تقديم': 'تقديم ادارة.png',
  'السجلات': 'السجلات.png',
  'لوحة التحكم': 'لوحة التحكم.png',
  'التصميم': 'التصميم.png',
  'المونتاج': 'المونتاج.png',
  'البرمجة': 'البرمجة.png',
  'الأكاديمية': 'الخدمات الاكاديمية.png',
  'خدمات عامة': 'الخدمات العامة.png',
  'بروجيكتات': 'بروجيكتات.png',
  'الرقمية': 'حسابات واشتراكات رقمية.png',
  'السوشيال': 'خدمات السوشيال ميديا.png',
  'جاهزة': 'منتجات رقمية جاهزة.png',
};

function getBannerFile(channelName) {
  for (const [key, file] of Object.entries(CHANNEL_BANNER_MAP)) {
    if (channelName.includes(key)) {
      const filePath = path.join(BANNER_FILES_DIR, file);
      if (fs.existsSync(filePath)) return filePath;
    }
  }
  return null;
}

async function sendBannerToChannel(channel) {
  try {
    const bannerPath = getBannerFile(channel.name);
    if (!bannerPath) return false;
    const { AttachmentBuilder } = require('discord.js');
    const buf = fs.readFileSync(bannerPath);
    const fileName = path.basename(bannerPath);
    const attachment = new AttachmentBuilder(buf, { name: fileName });
    await channel.setBanner({ attachment });
    console.log('✅ Banner set for', channel.name);
    return true;
  } catch (e) { console.log('❌ Banner failed for', channel.name, ':', e.message); return false; }
}

// ══════════════════════════════════════════════════════════════
//  CONFIG & DATA
// ══════════════════════════════════════════════════════════════
const DATA = path.join(__dirname, 'data');
if (!fs.existsSync(DATA)) fs.mkdirSync(DATA, { recursive: true });

const load = (file, fb) => {
  const cached = loadFromCache(file, undefined);
  if (cached !== undefined) return cached;
  try { return JSON.parse(fs.readFileSync(path.join(DATA, file), 'utf8')); }
  catch { return fb; }
};
const save = (file, d) => {
  saveToCache(file, d);
  try { fs.writeFileSync(path.join(DATA, file), JSON.stringify(d, null, 2), 'utf8'); } catch {}
  scheduleFlush();
};

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
const getCredits   = () => load('credits.json', {});
const getInviteTracking = () => load('invite_tracking.json', {});
const INVITE_REWARD = 1000000;

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

function getCreditsFor(userId) {
  const credits = getCredits();
  return credits[userId] || 0;
}
function addCredits(userId, amount) {
  const credits = getCredits();
  credits[userId] = (credits[userId] || 0) + amount;
  save('credits.json', credits);
  return credits[userId];
}
function removeCredits(userId, amount) {
  const credits = getCredits();
  if ((credits[userId] || 0) < amount) return false;
  credits[userId] -= amount;
  save('credits.json', credits);
  return true;
}
function setCredits(userId, amount) {
  const credits = getCredits();
  credits[userId] = amount;
  save('credits.json', credits);
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
  new SlashCommandBuilder().setName('clear').setDescription('مسح متقدم للرسائل')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addNumberOption(o => o.setName('amount').setDescription('عدد الرسائل (1-200)').setRequired(false))
    .addUserOption(o => o.setName('user').setDescription('مسح رسائل عضو معين').setRequired(false)),

  // ── Shortcuts ──
  new SlashCommandBuilder().setName('shortcut').setDescription('نفّذ اختصار')
    .addStringOption(o => o.setName('name').setDescription('اسم الاختصار').setRequired(true).setAutocomplete(true))
    .addUserOption(o => o.setName('target').setDescription('العضو المستهدف (للإجراءات)')),
  new SlashCommandBuilder().setName('shortcuts').setDescription('قائمة الاختصارات المتاحة'),

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

  // ── Credits & Invites ──
  new SlashCommandBuilder().setName('balance').setDescription('شوف رصيدك من الكريديت'),
  new SlashCommandBuilder().setName('invite-link').setDescription('احصل على رابط الانفايت بتاعك'),
  new SlashCommandBuilder().setName('invites').setDescription('شوف عدد الانفايتات بتاعتك')
    .addUserOption(o => o.setName('user').setDescription('عضو معين')),
  new SlashCommandBuilder().setName('give-credits').setDescription('اعطي كريديت لعضو (ادمن)')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addNumberOption(o => o.setName('amount').setDescription('المبلغ').setRequired(true)),
  new SlashCommandBuilder().setName('credits-leaderboard').setDescription('ترتيب الكريديت'),

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
  new SlashCommandBuilder().setName('enable-community').setDescription('فعّل وضع Community في السيرفر')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('hide-all').setDescription('اخفاء جميع القنوات والكاتيجوري من الجميع')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('show-all').setDescription('إظهار جميع القنوات والكاتيجوري للجميع')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
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
    { k: 'owner', n: '👑 ┃ Owner', c: '#FFD700', p: [PermissionFlagsBits.Administrator] },
    { k: 'admin', n: '💎 ┃ Admin', c: '#E74C3C', p: [PermissionFlagsBits.Administrator] },
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
    { n: '═════════ 👋 ═════════', chs: [
      { display: '👋•〢من نحن', p: noSend, topic: 'تعرف على Codex Zone ومميزاتنا' },
    ]},
    { n: '═════════ 🛍️ ═════════', chs: [
      { display: '🛒•〢الخدمات', p: full, topic: 'تصفح جميع الخدمات المتاحة في السيرفر' },
      { display: '📖•〢كيف تطلب', p: noSend, topic: 'شرح كيفية طلب أي خدمة خطوة بخطوة' },
      { display: '⭐•〢التقييمات', p: [{ id: g.id, deny: [PermissionFlagsBits.SendMessages] }, ...(roles.customer ? [{ id: roles.customer.id, allow: [PermissionFlagsBits.SendMessages] }] : [])], topic: 'شارك تجربتك وقيّم الخدمات التي حصلت عليها' },
      { display: '💬•〢تواصل مع الستاف', p: full, topic: 'للتواصل مع فريق العمل للاستفسار أو المساعدة' },
    ]},
    { n: '═════════ 📢 ═════════', chs: [
      { display: '📣•〢الاخبار والاعلانات', p: noSend, topic: 'تابع أحدث الأخبار والعروض والتحديثات' },
      { display: '📋•〢القوانين', p: noSend, topic: 'قوانين السيرفر - يُرجى قراءتها والالتزام بها' },
      { display: '🎁•〢السحوبات', p: noSend, topic: 'العروض والخصومات وال崌ابط المتاحة' },
    ]},
    { n: '═════════ 💬 ═════════', chs: [
      { display: '💬•〢الشات العام', p: full, topic: 'دردشة عامة مع جميع أعضاء السيرفر' },
      { display: '🤖•〢اوامر البوت', p: full, topic: 'استخدم أوامر البوت من هنا - اكتب / لعرض الأوامر' },
    ]},
    { n: '═════════ 🎫 ═════════', chs: [
      { display: '🎫•〢فتح تذكرة', p: full, topic: 'اضغط الزر لفتح تذكرة دعم فني' },
      { display: '📦•〢الطلبات', p: full, topic: 'إدارة طلباتك ومتابعة حالتها' },
    ]},
    { n: '═════════ 📦 ═════════', chs: [
      { display: '🚚•〢حالة التوصيل', p: noSend, topic: 'متابعة حالة التوصيل والشحن' },
      { display: '📦•〢التسليمات', p: noSend, topic: 'قائمة التسليمات المكتملة' },
    ]},
    { n: '═════════ 👑 ═════════', chs: [
      { display: '💼•〢شات الستاف', p: staffOnly, topic: 'قناة خاصة بفريق العمل للتنسيق وال讨论' },
      { display: '📋•〢ملاحظات', p: staffOnly, topic: 'ملاحظات الفريق على الطلبات والعملاء' },
      { display: '📝•〢تقديم للادارة', p: full, topic: 'قدّم للانضمام لفريق العمل - اكتب /apply' },
    ]},
    { n: '═════════ 🛡️ ═════════', chs: [
      { display: '📝•〢السجلات', p: noSend, topic: 'سجلات النشاطات والأوامر في السيرفر' },
    ]},
    { n: '═════════ ⚙️ ═════════', chs: [
      { display: '🔧•〢لوحة التحكم', p: adminOnly, topic: 'لوحة تحكم البوت - للمشرفين فقط' },
    ]},
  ];

  const catChannels = DEFAULT_CATEGORIES.map(cat => ({
    display: `${cat.emoji}〢 ${cat.name}`,
    n: `${cat.emoji}・${cat.name.replace(/\s+/g, '-')}`,
    p: full,
  }));
  if (catChannels.length > 0) {
    structure.push({
      n: '═════════ 🛍️ ═════════',
      chs: catChannels,
    });
  }

  for (const cat of structure) {
    try {
      const c = await g.channels.create({ name: cat.n, type: ChannelType.GuildCategory });
      log.push(`✅ ${cat.n}`);
      for (const ch of cat.chs) {
        const chName = ch.display || ch.n;
        try { await g.channels.create({ name: chName, type: ChannelType.GuildText, parent: c.id, permissionOverwrites: ch.p }); log.push(`✅ ${chName}`); } catch { log.push(`❌ ${chName}`); }
        await sleep(600);
      }
    } catch { log.push(`❌ كاتيقوري`); }
    await sleep(600);
  }

  await sleep(1500);
  try { await g.channels.fetch(); } catch {}

  console.log('🎨 Sending banners...');
  let bannerCount = 0;
  for (const [, ch] of g.channels.cache) {
    if (!ch.isTextBased()) continue;
    const ok = await sendBannerToChannel(ch);
    if (ok) bannerCount++;
    await sleep(800);
  }
  console.log(`🎨 Banners done: ${bannerCount} sent`);

  const logsCh = g.channels.cache.find(c => c.name.includes('السجلات') && c.isTextBased());
  if (logsCh) { CFG.logsChannel = logsCh.id; save('config.json', CFG); }

  if (!getServices() || (Array.isArray(getServices()) && getServices().length === 0)) {
    const defaultServices = DEFAULT_SERVICES.map(s => ({ ...s, createdAt: Date.now() }));
    save('services.json', defaultServices);
  }
  if (!getCategories() || (Array.isArray(getCategories()) && getCategories().length === 0)) {
    saveCategories(DEFAULT_CATEGORIES);
  }

  // ── 🎫 تكتات كل قناة خدمات ──
  const cats = getCategories();
  const allServices = getServices();
  for (const cat of cats) {
    const catNameDashed = cat.name.replace(/\s+/g, '-');
    const catCh = g.channels.cache.find(c =>
      c.isTextBased() && (
        c.name.includes(cat.name) ||
        c.name.includes(catNameDashed) ||
        c.name.includes(cat.emoji)
      ) && c.parent?.name?.includes('🛍️')
    );
    if (!catCh) continue;
    const catServices = allServices.filter(s => s.category === cat.id && s.active);
    const svcCount = catServices.length;
    const svcEmbed = new EmbedBuilder()
      .setTitle(`${cat.emoji || '📂'} ${cat.name}`)
      .setDescription(
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `## ${cat.emoji || '📂'} ${cat.name}\n\n` +
        `**${svcCount}** خدمة متاحة في التصنيف ده\n\n` +
        `كل الخدمات احترافية وتم تقديمها بأعلى جودة\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `## 🎫 افتح تذكرة\n\n` +
        `اضغط الزر **🎫 افتح تذكرة** عشان نبدأ نكلمك\n\n` +
        `الستاف هيرد عليك في أقرب وقت ويساعدك تختار الخدمة المناسبة\n\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
      )
      .setColor(0xd4af37)
      .setTimestamp()
      .setFooter({ text: `${cat.emoji} ${cat.name} — Codex Zone`, iconURL: g.iconURL({ dynamic: true }) });
    await catCh.send({
      embeds: [svcEmbed],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder().setCustomId(`category_ticket_${cat.id}`).setLabel(`🎫 افتح تذكرة`).setStyle(ButtonStyle.Success),
      )]
    }).catch(() => {});
    await sleep(500);
  }

  // ── 🛒 الخدمات — Embed + Select Menu (تصنيفات أولاً) ──
  const svcCh = g.channels.cache.find(c => c.name.includes('الخدمات') && c.isTextBased());
  if (svcCh) {
    const e = new EmbedBuilder()
      .setTitle('🔥 Codex Zone 🔥')
      .setDescription(
        '## 🔥 أهلاً بيك في Codex Zone — كل الخدمات الاحترافية في مكان واحد\n\n' +
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
      .setFooter({ text: `🛍️ ${g.name} — Codex Zone`, iconURL: g.iconURL({ dynamic: true }) });
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

  // ── 👋 من نحن ──
  const aboutCh = g.channels.cache.find(c => (c.name.includes('من نحن') || c.name.includes('من-نحن')) && c.isTextBased());
  console.log('👋 من نحن channel found:', aboutCh ? aboutCh.name : 'NOT FOUND');
  if (aboutCh) {
    try {
      await aboutCh.send({ embeds: [
        new EmbedBuilder()
          .setTitle('━━━━━━━━━━ 👋 مرحباً بيك في Codex Zone ━━━━━━━━━━')
          .setDescription(
            '## 👋 مرحباً بيك في Codex Zone\n\n' +
            'احنا فريق متخصص في تقديم أفضل الخدمات الرقمية بأسعار منافسة وجودة عالية\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '## 🏪 من نحن؟\n\n' +
            'ابدأنا المغامرة عشان نوفرلك كل اللي محتاجه في مكان واحد\n' +
            'فريق متخصص عنده خبرة كبيرة في كل خدمة بنقدمها\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
          )
          .setColor(0xD4AF37)
          .setTimestamp()
          .setFooter({ text: `👑 ${g.name}`, iconURL: g.iconURL({ dynamic: true }) }),
        new EmbedBuilder()
          .setTitle('━━━━━━━━━━ 🎯 ليه تختارنا؟ ━━━━━━━━━━')
          .setDescription(
            '✅ **جودة عالية** — كل خدمة بتتنفذ باحترافية عالية\n' +
            '✅ **أسعار منافسة** — أحلى الأسعار في السوق\n' +
            '✅ **تسليم سريع** — بنسلمك طلبك في أسرع وقت ممكن\n' +
            '✅ **دعم مستمر** — معاك من أول طلب لآخر طلب\n' +
            '✅ **ضمان كامل** — لو الخدمة مش كويسة، بنرجعلك فلوسك\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '## 💎 ليه تشتري منا؟\n\n' +
            '🔥 **فريق محترف** — عندها خبرة كبيرة في كل خدمة\n' +
            '🔥 **دقة عالية** — بنتأكد من كل تفصيلة قبل ما نسلملك\n' +
            '🔥 **تواصل سهل** — تقدر تتواصل معانا من أي قناة\n' +
            '🔥 **سرعة استجابة** — بنتعامل مع طلبك فوراً\n' +
            '🔥 **أمان كامل** — بياناتك عندنا آمنة 100%'
          )
          .setColor(0xD4AF37)
          .setTimestamp()
          .setFooter({ text: `👑 ${g.name}`, iconURL: g.iconURL({ dynamic: true }) }),
        new EmbedBuilder()
          .setTitle('━━━━━━━━━━ 🌟 مميزاتنا ━━━━━━━━━━')
          .setDescription(
            '📊 **+1000 طلب مُنفّذ** — خبرة واسعة في التعامل مع الزباين\n' +
            '⭐ **تقييمات ممتازة** — الزباين بيثقوا فينا وفي شغلنا\n' +
            '🚀 **تحديث مستمر** — بنضيف خدمات جديدة كل يوم\n' +
            '💰 **عروض وخصومات** — عروض مستمرة على كل الخدمات\n' +
            '🎁 **نظام كريديت** — اكسب كريديت مع كل دعوة واطلب بيه\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '## 📋 خدماتنا\n\n' +
            '🎨 **التصميم** — لوجو، بانر، هوية بصرية، UI/UX\n' +
            '🎬 **المونتاج** — فيديو، مونتاج، موشن جرافيك\n' +
            '💻 **البرمجة** — مواقع، تطبيقات، بوتات\n' +
            '📚 **الأكاديمية** — مشاريع تخرج، أبحاث، شروحات\n' +
            '🔑 **حسابات رقمية** — اشتراكات، حسابات، ألعاب\n' +
            '📢 **السوشيال ميديا** — إدارة، تسويق، محتوى\n' +
            '📦 **منتجات رقمية** — قوالب، تصاميم، أدوات\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '## 🚀 جاهز تبدأ؟\n\n' +
            'روح قناة **🛒•〢الخدمات** واختار الخدمة اللي عايزها\n' +
            'واضغط زر **🎫 اطلب دلوقتي** عشان تفتح تذكرة\n\n' +
            '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
            '## 💬 رأي الزباين\n\n' +
            '> *"أحلى سيرفر خدمات لقيته — أسعار كويسة وتسليم سريع"* ⭐⭐⭐⭐⭐\n' +
            '> *"الستاف محترم وبيساعدك في أي حاجة محتاجها"* ⭐⭐⭐⭐⭐\n' +
            '> *"من أول طلب وانا عميل دائم — شغلهم ممتاز"* ⭐⭐⭐⭐⭐'
          )
          .setColor(0xD4AF37)
          .setTimestamp()
          .setFooter({ text: `👑 ${g.name}`, iconURL: g.iconURL({ dynamic: true }) })
      ] });
      console.log('✅ من نحن embeds sent');
    } catch (e) { console.error('❌ من نحن embed failed:', e.message); }
  }

  // ── 📝 كيف تطلب — Embed محسّن ──
  const howCh = g.channels.cache.find(c => c.name.includes('كيف تطلب') && c.isTextBased());
  if (howCh) {
    await howCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 📝 كيف تطلب ━━━━━━━━━━')
      .setDescription(
        '## 📝 دليل طلب الخدمة من Codex Zone\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🛒 الخطوة الأولى — اختار الخدمة\n\n' +
        'روح قناة **🛒•〢الخدمات** وشوف كل الخدمات المتاحة\n' +
        'فيه categorii كتير — اختار اللي يناسبك\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📋 الخطوة التانية — شوف التفاصيل\n\n' +
        'كل خدمة ليها وصف كامل وسعر واضح\n' +
        'اقرأ التفاصيل كويس قبل ما تطلب\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🎫 الخطوة التالتة — افتح تذكرة\n\n' +
        'اضغط زر **🎫 افتح تذكرة** اللي تحت كل خدمة\n' +
        'هيفتحلك تذكرة خاصة بيك مع الستاف\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💰 الخطوة الرابعة — ادفع\n\n' +
        'الدفع بيكون من خلال التذكرة\n' +
        'طرق الدفع: **فودافون كاش / إيزي باي / تحويل بنكي**\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ⏳ الخطوة الخامسة — استنى\n\n' +
        'الستاف هينفّذ طلبك في أسرع وقت ممكن\n' +
        'هتتتبع حالة طلبك من قناة **📋•〢الطلبات**\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ✅ الخطوة السادسة — استلم\n\n' +
        'بعد ما يتنفّذ الطلب، هيوصلك التسليم\n' +
        'تقدر تتبعه من قناة **🚚•〢حالة التوصيل**\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ⭐ الخطوة السابعة — قيّم\n\n' +
        'استخدم الأمر **`/review`** عشان تكتب رأيك\n' +
        'تقييمك بيساعدنا نتحسن ويساعد الزباين الجداد\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 نصايح مهمة\n\n' +
        '• تأكد إنك اختارت الخدمة الصح قبل ما تطلب\n' +
        '• احتفظ بإيصال الدفع\n' +
        '• لو عندك أي سؤال، افتح تذكرة من **🎫•〢فتح تذكرة**\n' +
        '• لو عندك مشكلة، تواصل مع الستاف من **📞•〢تواصل مع الستاف**\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🔒 ضماناتك مع Codex Zone\n\n' +
        '✅ **دفع آمن** — بياناتك محمية 100%\n' +
        '✅ **تسليم سريع** — في أسرع وقت ممكن\n' +
        '✅ **دعم مستمر** — معاك من الأول للآخر\n' +
        '✅ **جودة عالية** — دايماً بنقدم الأفضل'
      )
      .setColor(0x2ECC71)
      .setTimestamp()
      .setFooter({ text: `🛍️ ${g.name} — كيف تطلب`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── 📋 القواعد ──
  const rulesCh = g.channels.cache.find(c => c.name.includes('القوانين') && c.isTextBased());
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
        '**10.** 👑 **اط服从 الستاف** — أوامر الستاف نهائية\n' +
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
  const ticketCh = g.channels.cache.find(c => c.name.includes('فتح تذكرة') && c.isTextBased());
  if (ticketCh) {
    const btnSupport = new ButtonBuilder().setCustomId('open_ticket_support').setLabel('🛠️ دعم فني').setStyle(ButtonStyle.Primary);
    const btnBuy = new ButtonBuilder().setCustomId('open_ticket_buy').setLabel('🛒 شراء خدمة').setStyle(ButtonStyle.Success);
    const btnAsk = new ButtonBuilder().setCustomId('open_ticket_ask').setLabel('❓ سؤال واستفسار').setStyle(ButtonStyle.Secondary);
    await ticketCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 🎫 افتح تذكرة ━━━━━━━━━━')
      .setDescription(
        '## 🎫 محتاج مساعدة؟ افتح تذكرة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🛠️ دعم فني\n' +
        '• عندك مشكلة في طلبك؟\n' +
        '• محتاج مساعدة في شيء؟\n' +
        '• عندك شكوى أو اقتراح؟\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🛒 شراء خدمة\n' +
        '• عايز تطلب خدمة جديدة؟\n' +
        '• عندك سؤال عن سعر أو تفاصيل؟\n' +
        '• عايز تتأكد من الخدمة قبل ما تشتري؟\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ❓ سؤال واستفسار\n' +
        '• عندك سؤال عن السيرفر؟\n' +
        '• عايز تعرف حاجة عن الخدمات؟\n' +
        '• محتاج معلومات عن طريقة الدفع؟\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ⏰ وقت الاستجابة\n' +
        '**من 5 لـ 15 دقيقة** — فريقنا جاهز يساعدك\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 نصيحة\n\n' +
        'قبل ما تفتح تذكرة، تأكد إن الإجابة موجودة في:\n' +
        '• قناة **👋•〢من نحن** — عشان تعرف عن السيرفر\n' +
        '• قناة **📖•〢كيف تطلب** — عشان تعرف تطلب إزاي\n' +
        '• قناة **🤖•〢اوامر البوت** — عشان تشوف كل الأوامر\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━'
      )
      .setColor(0x9B59B6)
      .setTimestamp()
      .setFooter({ text: `🎫 ${g.name} — فتح تذكرة`, iconURL: g.iconURL({ dynamic: true }) })
    ], components: [new ActionRowBuilder().addComponents(btnSupport, btnBuy, btnAsk)] }).catch(() => {});
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
  // ── 📱 اوامر البوت ──
  const cmdsCh = g.channels.cache.find(c => c.name.includes('اوامر البوت') && c.isTextBased());
  if (cmdsCh) {
    await cmdsCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 📱 أوامر البوت ━━━━━━━━━━')
      .setDescription(
        '## 📱 أوامر البوت\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🛒 أوامر الطلبات والخدمات\n\n' +
        '`/services` — عرض كل الخدمات المتاحة\n' +
        '`/balance` — شوف رصيدك من الكريديت\n' +
        '`/order` — اطلب خدمة مباشرة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🎁 أوامر الدعوات والكريدت\n\n' +
        '`/invite-link` — احصل على رابط دعوة خاص بيك\n' +
        '`/invites` — شوف عدد الدعوات بتاعتك\n' +
        '`/credits-leaderboard` — أقوى الناس بالكريديت\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ⭐ أوامر التقييمات\n\n' +
        '`/review` — قيّم تجربتك بعد ما تاخد الخدمة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🎫 أوامر التذاكر\n\n' +
        '`/close` — اقفل التذكرة بتاعتك\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ⚠️ ملاحظات مهمة\n\n' +
        '• الأوامر دي للستاف والمشترين بس\n' +
        '• لو عندك مشكلة، افتح تذكرة من قناة **🎫 افتح تذكرة**'
      )
      .setColor(0x3498DB)
      .setTimestamp()
      .setFooter({ text: `📱 ${g.name} — أوامر البوت`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── 📢 الاخبار والاعلانات ──
  const newsCh = g.channels.cache.find(c => c.name.includes('الاخبار والاعلانات') && c.isTextBased());
  if (newsCh) {
    await newsCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 📢 الأخبار والإعلانات ━━━━━━━━━━')
      .setDescription(
        '## 📢 الأخبار والإعلانات\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🎉 مرحباً بيك في Codex Zone!\n\n' +
        'هنا هتلاقى كل أخبار السيرفر والإعلانات الجديدة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📌 نوع الإعلانات اللي هتلاقيها هنا:\n\n' +
        '🆕 **خدمات جديدة** — لما بنضيف خدمة جديدة\n' +
        '💰 **عروض وخصومات** — عروض محدودة للأسعار\n' +
        '🔧 **تحديثات** — تحسينات وتطوير السيرفر\n' +
        '🎉 **فعاليات** — أنشطة ومسابقات حصرية\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 نصيحة\n\n' +
        'فعّل الإشعارات عشان ما تفوتك أي إعلان مهم!'
      )
      .setColor(0xF39C12)
      .setTimestamp()
      .setFooter({ text: `📢 ${g.name} — الأخبار والإعلانات`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── ⭐ التقييمات ──
  const reviewCh = g.channels.cache.find(c => c.name.includes('التقييمات') && c.isTextBased());
  if (reviewCh) {
    await reviewCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ ⭐ التقييمات ━━━━━━━━━━')
      .setDescription(
        '## ⭐ تقييمات العملاء\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💬 رأي العملاء يهمنا\n\n' +
        'هنا بتتجمع تقييمات الناس اللي استخدمت خدماتنا\n' +
        'كل تجربة مهمة وتساعدنا نتحسن\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ✍️ عايز تكتب تقييم؟\n\n' +
        'استخدم الأمر `/review` بعد ما تاخد الخدمة\n' +
        'والتقييم بتاعك هيظهر هنا\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📊 معايير التقييم\n\n' +
        '⭐ — ضعيف\n' +
        '⭐⭐ — مقبول\n' +
        '⭐⭐⭐ — كويس\n' +
        '⭐⭐⭐⭐ — ممتاز\n' +
        '⭐⭐⭐⭐⭐ — استثنائي\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 نصيحة\n\n' +
        'كن صادق في تقييمك — التقييمات الصادقة بتساعدنا وتساعد الزباين!'
      )
      .setColor(0xFFD700)
      .setTimestamp()
      .setFooter({ text: `⭐ ${g.name} — التقييمات`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── 💸 السحوبات ──
  const withdrawCh = g.channels.cache.find(c => c.name.includes('السحوبات') && c.isTextBased());

  // ── 📞 تواصل مع الستاف ──
  const contactCh = g.channels.cache.find(c => c.name.includes('تواصل مع الستاف') && c.isTextBased());
  if (contactCh) {
    await contactCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 📞 تواصل مع الستاف ━━━━━━━━━━')
      .setDescription(
        '## 📞 تواصل مع فريق الستاف\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🛠️ محتاج مساعدة؟\n\n' +
        'لو عندك سؤال أو مشكلة، ممكن تفتح تذكرة دعم فني\n' +
        'فريق الستاف جاهز يساعدك\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📋 إزاي تتواصل معانا\n\n' +
        '**1️⃣** افتح تذكرة من قناة **🎫 افتح تذكرة**\n' +
        '**2️⃣** اختار نوع المشكلة\n' +
        '**3️⃣** اكتب وصف مفصل للمشكلة\n' +
        '**4️⃣** استنى رد الستاف\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ⏰ أوقات العمل\n\n' +
        '⏰ **من السبت لـ الخميس:** 10 صباحاً - 12 بالليل\n' +
        '⏰ **الجمعة:** من 2 ظهراً - 12 بالليل\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 نصايح\n\n' +
        '• اكتب وصف واضح للمشكلة\n' +
        '• متخليش التذكرة مفتوحة من غير رد\n' +
        '• لو مشاكلتك عاجلة، اكتب **⚠️ عاجل** في التذكرة'
      )
      .setColor(0x9B59B6)
      .setTimestamp()
      .setFooter({ text: `📞 ${g.name} — تواصل مع الستاف`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── 🔧 لوحة التحكم ──
  const adminPanelCh = g.channels.cache.find(c => c.name.includes('لوحة التحكم') && c.isTextBased());
  if (adminPanelCh) {
    await adminPanelCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 🔧 لوحة التحكم ━━━━━━━━━━')
      .setDescription(
        '## 🔧 لوحة تحكم الادارة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📊 معلومات السيرفر\n\n' +
        'هتلاقى هنا كل الأدوات اللي تحتاجها كستاف\n' +
        'للتحكم في الخدمات والطلبات والزباين\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🛠️ أوامر الادارة\n\n' +
        '`/add-service` — إضافة خدمة جديدة\n' +
        '`/edit-service` — تعديل خدمة موجودة\n' +
        '`/remove-service` — حذف خدمة\n' +
        '`/add-category` — إضافة تصنيف جديد\n' +
        '`/remove-category` — حذف تصنيف\n' +
        '`/hide-all` — إخفاء كل القنوات\n' +
        '`/show-all` — إظهار كل القنوات\n' +
        '`/give-credits` — إضافة كريديت لحد\n' +
        '`/ban` — حظر عضو\n' +
        '`/kick` — طرد عضو\n' +
        '`/timeout` — كتم عضو\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ⚠️ تحذير\n\n' +
        'الأوامر دي للادارة فقط — مشاركش الصلاحيات مع حد!'
      )
      .setColor(0xE74C3C)
      .setTimestamp()
      .setFooter({ text: `🔧 ${g.name} — لوحة التحكم`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── 💬 الشات العام ──
  const chatCh = g.channels.cache.find(c => c.name.includes('الشات العام') && c.isTextBased());
  if (chatCh) {
    await chatCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 💬 الشات العام ━━━━━━━━━━')
      .setDescription(
        '## 💬 الشات العام\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🎉 مرحباً بيك في الشات العام!\n\n' +
        'هنا تقدر تتكلم مع الناس وتسامر\n' +
        'استمتع بوقتك معانا\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📋 القواعد\n\n' +
        '🤝 **الاحترام** — احترم كل الناس\n' +
        '🚫 **ممنوع السبام** — ممنوع تكرار الرسائل\n' +
        '🗣️ **العربية** — الأفضل تتكلم عربي\n' +
        '🔞 **ممنوع 18+** — أي محتوى للبالغين ممنوع\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 نصيحة\n\n' +
        'لو عايز تطلب خدمة، روح قناة **🛒 الخدمات**\n' +
        'ولو عندك سؤال، استخدم قناة **📞 تواصل مع الستاف**'
      )
      .setColor(0x1ABC9C)
      .setTimestamp()
      .setFooter({ text: `💬 ${g.name} — الشات العام`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── 📋 الطلبات ──
  const ordersCh = g.channels.cache.find(c => c.name.includes('الطلبات') && c.isTextBased());
  if (ordersCh) {
    await ordersCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 📋 الطلبات ━━━━━━━━━━')
      .setDescription(
        '## 📋 سجل الطلبات\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📊 هنا بتظهر حالة كل الطلبات\n\n' +
        'كل طلب جديد بيظهر هنا تلقائياً\n' +
        'تقدر تتابع حالة طلبك من هنا\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🎨 ألوان الحالات\n\n' +
        '🟡 **قيد المعالجة** — الستاف بيشتغل على طلبك\n' +
        '🟢 **تم التسليم** — تم تسليم الخدمة بنجاح\n' +
        '🔴 **ملغي** — تم إلغاء الطلب\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 ملاحظة\n\n' +
        'لو عندك سؤال عن طلبك، افتح تذكرة من قناة **🎫 افتح تذكرة**'
      )
      .setColor(0x3498DB)
      .setTimestamp()
      .setFooter({ text: `📋 ${g.name} — الطلبات`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── 🚚 حالة التوصيل ──
  const deliveryCh = g.channels.cache.find(c => c.name.includes('حالة التوصيل') && c.isTextBased());
  if (deliveryCh) {
    await deliveryCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 🚚 حالة التوصيل ━━━━━━━━━━')
      .setDescription(
        '## 🚚 تتبع حالة التوصيل\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📦 هنا بتتجمع تحديثات التوصيل\n\n' +
        'كل ما طلبك يتحرك، هتلاقي تحديث هنا\n' +
        'من لحظة التأكيد لحد ما يوصلك\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🎨 مراحل التوصيل\n\n' +
        '1️⃣ **تم تأكيد الطلب** — تم استلام طلبك بنجاح\n' +
        '2️⃣ **قيد التجهيز** — الستاف بيجهز طلبك\n' +
        '3️⃣ **جاهز للتوصيل** — طلبك جاهز ومستني التوصيل\n' +
        '4️⃣ **تم التوصيل** — وصلك طلبك!\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 نصيحة\n\n' +
        'فعّل الإشعارات عشان ما تفوتك أي تحديث!'
      )
      .setColor(0xE67E22)
      .setTimestamp()
      .setFooter({ text: `🚚 ${g.name} — حالة التوصيل`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── ✅ التسليمات ──
  const deliveredCh = g.channels.cache.find(c => c.name.includes('التسليمات') && c.isTextBased());
  if (deliveredCh) {
    await deliveredCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ ✅ التسليمات ━━━━━━━━━━')
      .setDescription(
        '## ✅ آخر التسليمات\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🎉 مبروك على الخدمة!\n\n' +
        'هنا بتتجمع كل الطلبات اللي تم تسليمها بنجاح\n' +
        'تقدر تشوف تقييمات الزباين على كل خدمة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🌟 ليه تطلب منا؟\n\n' +
        '✅ **سرعة التسليم** — في أسرع وقت ممكن\n' +
        '✅ **جودة عالية** — دايماً بنقدم الأفضل\n' +
        '✅ **دعم مستمر** — معاك من الأول للآخر\n' +
        '✅ **أسعار منافسة** — أحلى الأسعار في السوق\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 عايز تطلب؟\n\n' +
        'روح قناة **🛒 الخدمات** واختار الخدمة اللي عايزها'
      )
      .setColor(0x27AE60)
      .setTimestamp()
      .setFooter({ text: `✅ ${g.name} — التسليمات`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── 🔒 شات الستاف ──
  const staffCh = g.channels.cache.find(c => c.name.includes('شات الستاف') && c.isTextBased());
  if (staffCh) {
    await staffCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 🔒 شات الستاف ━━━━━━━━━━')
      .setDescription(
        '## 🔒 شات الستاف السري\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🎯 مرحباً يا ستاف\n\n' +
        'هنا المكان بتاعكم للتنسيق والتواصل\n' +
        'ممنوع أي حد غير الستاف يدخل هنا\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📋 مهام الستاف\n\n' +
        '🛒 **معالجة الطلبات** — تنفيذ طلبات الزباين\n' +
        '🎫 **فتح التذاكر** — الرد على طلبات الدعم\n' +
        '📋 **متابعة الحالة** — تحديث حالة الطلبات\n' +
        '💬 **الرد على الزباين** — مساعدتهم في أي سؤال\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ⚠️ قواعد خاصة بالشات\n\n' +
        '🔒 **السرية** — ممنوع مشاركة معلومات الشات\n' +
        '🤝 **التعاون** — ساعد زملائك في الشغل\n' +
        '📝 **التوثيق** — سجّل كل حاجة مهمة'
      )
      .setColor(0x2C3E50)
      .setTimestamp()
      .setFooter({ text: `🔒 ${g.name} — شات الستاف`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── 📝 ملاحظات ──
  const notesCh = g.channels.cache.find(c => c.name.includes('ملاحظات') && c.isTextBased());
  if (notesCh) {
    await notesCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 📝 ملاحظات ━━━━━━━━━━')
      .setDescription(
        '## 📝 ملاحظات وإشعارات مهمة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📌 هنا بتتجمع الملاحظات المهمة\n\n' +
        'كل ما فيه تحديث أو معلومة مهمة هنقولها هنا\n' +
        'تابع القناة عشان ما تفوتكش حاجة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📋 نوع الملاحظات\n\n' +
        '🔄 **تحديثات** — أي تغيير في الخدمات أو القوانين\n' +
        '⚠️ **تنبيهات** — ملاحظات مهمة للزباين\n' +
        '💡 **نصايح** — نصايح لاستخدام الخدمات\n' +
        '📢 **إعلانات** — إعلانات عاجلة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 💡 نصيحة\n\n' +
        'فعّل الإشعارات على القناة دي عشان ما تفوتكش أي ملاحظة مهمة!'
      )
      .setColor(0xF39C12)
      .setTimestamp()
      .setFooter({ text: `📝 ${g.name} — ملاحظات`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

  // ── 📜 السجلات ──
  if (logsCh) {
    await logsCh.send({ embeds: [new EmbedBuilder()
      .setTitle('━━━━━━━━━━ 📜 السجلات ━━━━━━━━━━')
      .setDescription(
        '## 📜 سجلات السيرفر\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 🔍 هنا بتتجمع كل السجلات\n\n' +
        'كل حاجة بتحصل في السيرفر بتتسجل هنا تلقائياً\n' +
        'عشان نقدر نتتبع أي مشكلة\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## 📋 نوع السجلات\n\n' +
        '🚪 **دخول وخروج** — مين دخل ومين طلع\n' +
        '📝 **تعديلات** — أي تعديل على القنوات أو الأدوار\n' +
        '🗑️ **حذف** — أي رسالة اتمسحت\n' +
        '🔐 **أمان** — أي نشاط مشبوه\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '## ⚠️ ملاحظة\n\n' +
        'القناة دي للادارة فقط — ممنوع حد يمسح منها أي حاجة'
      )
      .setColor(0x95A5A6)
      .setTimestamp()
      .setFooter({ text: `📜 ${g.name} — السجلات`, iconURL: g.iconURL({ dynamic: true }) })
    ] }).catch(() => {});
  }

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
//  HANDLERS: CLEAR (advanced purge)
// ══════════════════════════════════════════════════════════════
async function cmdClear(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const amount = interaction.options.getNumber('amount') || 50;
  const user = interaction.options.getUser('user');
  if (amount < 1 || amount > 200) return interaction.editReply('❌ العدد من 1 لـ 200');
  const ch = interaction.channel;
  let deleted = 0, fetched;
  let remaining = Math.min(amount, 200);
  while (remaining > 0) {
    const limit = Math.min(remaining, 100);
    fetched = await ch.messages.fetch({ limit });
    if (user) fetched = fetched.filter(m => m.author.id === user.id);
    if (fetched.size === 0) break;
    const twoWeeksAgo = Date.now() - 14 * 24 * 60 * 60 * 1000;
    const deletable = fetched.filter(m => m.createdTimestamp > twoWeeksAgo);
    if (deletable.size > 0) {
      const r = await ch.bulkDelete(deletable, true);
      deleted += r.size;
    }
    remaining -= fetched.size;
    if (fetched.size < limit) break;
  }
  const desc = user ? `تم مسح **${deleted}** رسالة${user ? ` من ${user}` : ''}` : `تم مسح **${deleted}** رسالة`;
  await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🧹 مسح متقدم').setDescription(desc).setColor(0x8b5cf6).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🧹 مسح متقدم').setDescription(`**بواسطة:** ${interaction.user}\n**القناة:** ${ch}\n**العدد:** ${deleted}${user ? `\n**العضو:** ${user}` : ''}`).setColor(0x8b5cf6).setTimestamp());
}

// ══════════════════════════════════════════════════════════════
//  SHORTCUTS SYSTEM
// ══════════════════════════════════════════════════════════════
function loadShortcuts() {
  const data = load('shortcuts.json', { shortcuts: [], allowedRoles: [], deniedRoles: [], allowedChannels: [], deniedChannels: [] });
  if (!data.shortcuts) data.shortcuts = [];
  if (!Array.isArray(data.allowedRoles)) data.allowedRoles = [];
  if (!Array.isArray(data.deniedRoles)) data.deniedRoles = [];
  if (!Array.isArray(data.allowedChannels)) data.allowedChannels = [];
  if (!Array.isArray(data.deniedChannels)) data.deniedChannels = [];
  return data;
}
function saveShortcuts(data) {
  save('shortcuts.json', data);
}

function canUseShortcut(interaction, scData) {
  if (scData.allowedRoles?.length > 0 && !interaction.member.roles.cache.some(r => scData.allowedRoles.includes(r.id))) return false;
  if (scData.deniedRoles?.length > 0 && interaction.member.roles.cache.some(r => scData.deniedRoles.includes(r.id))) return false;
  if (scData.allowedChannels?.length > 0 && !scData.allowedChannels.includes(interaction.channel.id)) return false;
  if (scData.deniedChannels?.length > 0 && scData.deniedChannels.includes(interaction.channel.id)) return false;
  return true;
}

async function cmdShortcut(interaction) {
  const name = interaction.options.getString('name');
  const targetUser = interaction.options.getUser('target');
  const targetMember = targetUser ? await interaction.guild.members.fetch(targetUser.id).catch(() => null) : null;
  const scData = loadShortcuts();
  const sc = scData.shortcuts.find(s => s.name === name || s.id === name);
  if (!sc) return interaction.reply({ content: '❌ الاختصار مش موجود', ephemeral: true });
  if (!canUseShortcut(interaction, scData)) return interaction.reply({ content: '❌ مسمحلكش تستخدم الاختصار ده', ephemeral: true });
  await interaction.reply({ content: '⏳ جاري تنفيذ الاختصار...', ephemeral: true });
  if (sc.type === 'message') {
    const ch = interaction.guild.channels.cache.get(sc.targetChannel || interaction.channel.id);
    if (ch) await ch.send({ content: sc.content || '—' });
  } else if (sc.type === 'embed') {
    const ch = interaction.guild.channels.cache.get(sc.targetChannel || interaction.channel.id);
    if (ch) {
      const embed = new EmbedBuilder().setTitle(sc.title || '').setDescription(sc.content || '').setColor(sc.color || 0x8b5cf6).setTimestamp();
      await ch.send({ embeds: [embed] });
    }
  } else if (sc.type === 'announce') {
    const ch = interaction.guild.channels.cache.get(sc.targetChannel || interaction.channel.id);
    if (ch) {
      const embed = new EmbedBuilder().setTitle(`${sc.emoji || '📣'} ${sc.title || ''}`).setDescription(sc.content || '').setColor(sc.color || 0x8b5cf6).setTimestamp();
      const pingRole = sc.pingRole ? `<@&${sc.pingRole}>` : '';
      await ch.send({ content: pingRole || undefined, embeds: [embed] });
    }
  } else if (sc.type === 'action') {
    if (sc.action === 'clear') {
      const amt = sc.amount || 50;
      const deleted = await interaction.channel.bulkDelete(amt, true);
      await interaction.editReply({ content: `🧹 تم مسح ${deleted.size} رسالة` });
      return;
    }
    const member = targetMember;
    if (!member) { await interaction.editReply({ content: '❌ حدد عضو مع `/shortcut name:${sc.name} @user`' }); return; }
    const ms = (sc.amount || 60) * 60000;
    const reason = sc.content || 'اختصار سريع';
    if (sc.action === 'ban') {
      await member.ban({ reason });
      await interaction.editReply({ content: `🔨 تم حظر **${member.user.username}**` });
    } else if (sc.action === 'kick') {
      await member.kick(reason);
      await interaction.editReply({ content: `👢 تم طرد **${member.user.username}**` });
    } else if (sc.action === 'mute') {
      await member.timeout(ms, reason);
      await interaction.editReply({ content: `🔇 تم كتم **${member.user.username}** لمدة ${sc.amount || 60} دقيقة` });
    } else if (sc.action === 'unmute') {
      await member.timeout(null, reason);
      await interaction.editReply({ content: `🔊 تم فك الكتم عن **${member.user.username}**` });
    } else if (sc.action === 'warn') {
      const warnings = getWarnings();
      const warnId = nextId(warnings);
      warnings.push({ id: warnId, userId: member.id, username: member.user.username, reason, moderator: interaction.user.id, createdAt: Date.now() });
      save('warnings.json', warnings);
      await interaction.editReply({ content: `⚠️ تم تحذير **${member.user.username}** — السبب: ${reason}` });
    } else if (sc.action === 'slowmode') {
      await interaction.channel.setRateLimitPerUser(Math.floor(ms / 60000), reason);
      await interaction.editReply({ content: `🐌 تم تعيين السلو مود على **${Math.floor(ms / 60000)}** دقيقة` });
    }
    return;
  }
  await interaction.editReply({ content: `✅ تم تنفيذ الاختصار **${sc.name}**` }).catch(() => {});
}

async function cmdShortcuts(interaction) {
  const scData = loadShortcuts();
  const available = scData.shortcuts.filter(sc => canUseShortcut(interaction, scData));
  if (!available.length) return interaction.reply({ content: '📋 لا توجد اختصارات متاحة لك', ephemeral: true });
  const embed = new EmbedBuilder().setTitle('⚡ الاختصارات المتاحة').setDescription(available.map(sc => `**${sc.emoji || '⚡'} ${sc.name}** — ${sc.description || sc.type}`).join('\n\n')).setColor(0x8b5cf6).setTimestamp();
  await interaction.reply({ embeds: [embed], ephemeral: true });
}
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
      { name: '🎫 السحوبات', value: `**${getGiveaways().length}** سحبية`, inline: true },
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

// ═══════════════ CREDITS & INVITES ═══════════════
async function cmdBalance(interaction) {
  const bal = getCreditsFor(interaction.user.id);
  const inviteData = getInviteTracking();
  const myInvites = inviteData[interaction.user.id]?.invites || 0;
  const embed = new EmbedBuilder()
    .setTitle('💰 رصيدك')
    .setDescription(`**الكريديت:** \`${fmt(bal)}\`\n**الانفايتات:** \`${myInvites}\`\n**مكافأة كل انفايت:** \`${fmt(INVITE_REWARD)}\``)
    .setColor(0xF1C40F).setTimestamp()
    .setFooter({ text: '💰 Codex Zone — الرصيد' });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function cmdInviteLink(interaction) {
  const g = interaction.guild;
  const invite = await g.invites.create(g.id, { maxAge: 0, reason: `Invite link for ${interaction.user.tag}` }).catch(() => null);
  if (!invite) return interaction.reply({ content: '❌ مقدرش أعمل رابط دلوقتي', ephemeral: true });
  const embed = new EmbedBuilder()
    .setTitle('🔗 رابط الانفايت بتاعك')
    .setDescription(`**شارك الرابط ده مع أصحابك:**\n\nhttps://discord.gg/${invite.code}\n\n**كل ما حد ينضم بالرابط ده، هتكسب \`${fmt(INVITE_REWARD)}\` كريديت!**`)
    .setColor(0x2ECC71).setTimestamp()
    .setFooter({ text: '🔗 Codex Zone — Invite' });
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function cmdInvites(interaction) {
  const target = interaction.options.getUser('user') || interaction.user;
  const inviteData = getInviteTracking();
  const data = inviteData[target.id] || { invites: 0, rewarded: 0 };
  const embed = new EmbedBuilder()
    .setTitle(`🔗 انفايتات ${target.username}`)
    .setDescription(`**عدد الانفايتات:** \`${data.invites}\`\n**مكافآت مستلمة:** \`${fmt(data.rewarded)}\``)
    .setColor(0x3498DB).setTimestamp()
    .setFooter({ text: '🔗 Codex Zone — Invites' });
  await interaction.reply({ embeds: [embed] });
}

async function cmdGiveCredits(interaction) {
  const target = interaction.options.getUser('user');
  const amount = interaction.options.getNumber('amount');
  if (amount <= 0) return interaction.reply({ content: '❌ المبلغ لازم يكون أكبر من 0', ephemeral: true });
  addCredits(target.id, amount);
  const bal = getCreditsFor(target.id);
  await interaction.reply({ content: `✅ تم إعطاء **${fmt(amount)}** كريديت لـ ${target}. الرصيد الجديد: **${fmt(bal)}**`, ephemeral: true });
  sendLog(interaction.guild, `💰 ${interaction.user.tag} gave ${fmt(amount)} credits to ${target.tag}`);
}

async function cmdCreditsLeaderboard(interaction) {
  const credits = getCredits();
  const sorted = Object.entries(credits).sort((a, b) => b[1] - a[1]).slice(0, 15);
  if (!sorted.length) return interaction.reply({ content: '📭 مفيش كريديت لسه', ephemeral: true });
  const medals = ['🥇', '🥈', '🥉'];
  const lines = sorted.map(([id, bal], i) => `${medals[i] || `**${i + 1}.**`} <@${id}> — \`${fmt(bal)}\``).join('\n');
  const embed = new EmbedBuilder()
    .setTitle('💰 ترتيب الكريديت')
    .setDescription(lines)
    .setColor(0xF1C40F).setTimestamp()
    .setFooter({ text: '💰 Codex Zone — Top Credits' });
  await interaction.reply({ embeds: [embed] });
}

// ═══════════════ HELP ═══════════════
async function cmdHelp(interaction) {
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🤖 أوامر البوت').addFields(
    { name: '📦 عامة', value: '`/services` `/order` `/support` `/close` `/review` `/leaderboard` `/server-info` `/user-info` `/stats` `/ticket-stats` `/top-customers` `/help`' },
    { name: '🛡️ إدارية', value: '`/setup` `/banners` `/add-service` `/edit-service` `/remove-service` `/add-category` `/remove-category` `/list-categories` `/announce` `/auto-role` `/set-logs` `/automod` `/giveaway` `/end-giveaway`' },
        { name: '🔨 الإدارة والضبط', value: '`/ban` `/kick` `/mute` `/unmute` `/warn` `/warnings` `/clear-warnings` `/purge` `/clear`' },
        { name: '⚡ الاختصارات', value: '`/shortcut` `/shortcuts` — اختصارات مخصصة من البانل' },
  ).setColor(0x7c3aed).setTimestamp()], ephemeral: true });
}

async function cmdBanners(interaction) {
  await interaction.deferReply();
  const g = interaction.guild;
  let sent = 0, skipped = 0, failed = 0;
  for (const [, ch] of g.channels.cache) {
    if (!ch.isTextBased()) continue;
    const bannerPath = getBannerFile(ch.name);
    if (!bannerPath) { skipped++; continue; }
    try {
      const { AttachmentBuilder } = require('discord.js');
      const buf = fs.readFileSync(bannerPath);
      const fileName = path.basename(bannerPath);
      const attachment = new AttachmentBuilder(buf, { name: fileName });
      await ch.setBanner({ attachment });
      sent++;
    } catch (e) { console.error('❌ Banner failed for', ch.name, ':', e.message); failed++; }
    await sleep(800);
  }
  await interaction.editReply(`✅ تم تغيير **${sent}** بانر${skipped ? ` — تم تخطي ${skipped}` : ''}${failed ? ` — فشل ${failed}` : ''}`);
}

async function cmdEnableCommunity(interaction) {
  if (!interaction.memberPermissions.has(PermissionFlagsBits.Administrator)) {
    return interaction.reply({ content: '❌ محتاج صلاحيات Admin', ephemeral: true });
  }
  await interaction.deferReply({ ephemeral: true });
  const g = interaction.guild;

  const log = [];

  // 1. Check member count
  if (g.memberCount < 1000) {
    log.push(`⚠️ السيرفر عنده **${g.memberCount}** عضو بس — Discord بيطلب 1000 عضو على الأقل عشان تفعّل Community.\nلو السيرفر فيه 7 أيام اشتراك أو أكتر، ممكن تقدّم طلب استثناء من Discord.`);
  }

  // 2. Check if already community
  const features = g.features || [];
  if (features.includes('COMMUNITY')) {
    return interaction.editReply('✅ السيرفر Community بالفعل!');
  }

  // 3. Create community channels if missing
  try {
    let rulesChannel = g.channels.cache.find(c => c.name.includes('القوانين') && c.type === ChannelType.GuildText);
    let updatesChannel = g.channels.cache.find(c => c.name.includes('الإعلانات') && c.type === ChannelType.GuildText);

    if (!rulesChannel) {
      const cat = g.channels.cache.find(c => c.name.includes('الإعلانات') && c.type === ChannelType.GuildCategory);
      rulesChannel = await g.channels.create({ name: '📋・القواعد', type: ChannelType.GuildText, parent: cat?.id, topic: 'قوانين السيرفر — يُرجى قراءتها قبل أي شيء' });
      log.push('✅ قناة **القواعد** اتعملت');
      await sleep(600);
    }

    if (!updatesChannel) {
      const cat = g.channels.cache.find(c => c.name.includes('الإعلانات') && c.type === ChannelType.GuildCategory);
      updatesChannel = await g.channels.create({ name: '📣・إعلانات-المجتمع', type: ChannelType.GuildText, parent: cat?.id, topic: 'إعلانات المجتمع والتحديثات' });
      log.push('✅ قناة **إعلانات المجتمع** اتعملت');
      await sleep(600);
    }

    // 4. Set rules and updates channels via API
    try {
      await g.edit({ rulesChannelId: rulesChannel.id });
      log.push(`✅ تم ربط **${rulesChannel.name}** كقناة القواعد`);
    } catch (e) { log.push(`❌ ما قدرش يربط القواعد: ${e.message}`); }

    try {
      await g.edit({ publicUpdatesChannelId: updatesChannel.id });
      log.push(`✅ تم ربط **${updatesChannel.name}** كقناة تحديثات المجتمع`);
    } catch (e) { log.push(`❌ ما قدرش يربط تحديثات المجتمع: ${e.message}`); }

  } catch (e) { log.push(`❌ خطأ: ${e.message}`); }

  // 5. Send instructions
  const embed = new EmbedBuilder()
    .setTitle('🌍 تفعيل Community')
    .setDescription(
      (log.length ? log.join('\n') + '\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' : '') +
      '**الخطوات الباقية (لازم تفعلها يدوياً):**\n\n' +
      '**`1️⃣`** ادخل **Server Settings** ⚙️\n' +
      '**`2️⃣`** اختار **Enable Community** من القائمة\n' +
      '**`3️⃣`** اضغط **Get Started**\n' +
      '**`4️⃣`** اختار **القواعد** كقناة القواعد الإلزامية\n' +
      '**`5️⃣`** اختار **إعلانات المجتمع** كقناة التحديثات\n' +
      '**`6️⃣`** فعّل **Default Notifications** لو عايز\n' +
      '**`7️⃣`** اضغط **I agree** لتفعيل Community\n\n' +
      '━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n' +
      '💡 **ملاحظة:** لازم السيرفر يكون عنده **1000 عضو** على الأقل أو **7 أيام** عشان Discord يقبل التفعيل.\n\n' +
      '🔗 أو ادخل من هنا مباشرة: https://discord.com/guilds/' + g.id + '/onboarding'
    )
    .setColor(0x57F287)
    .setFooter({ text: 'Codex Zone' })
    .setTimestamp();

  await interaction.editReply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: HIDE / SHOW ALL
// ══════════════════════════════════════════════════════════════
async function cmdHideAll(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const g = interaction.guild;
  let hidden = 0, failed = 0;

  for (const [, ch] of g.channels.cache) {
    try {
      await ch.permissionOverwrites.edit(g.id, { ViewChannel: false });
      hidden++;
    } catch { failed++; }
  }
  for (const [, cat] of g.channels.cache) {
    if (cat.type === ChannelType.GuildCategory) {
      try {
        await cat.permissionOverwrites.edit(g.id, { ViewChannel: false });
      } catch {}
    }
  }

  const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
  const adminRole = g.roles.cache.find(r => r.name.includes('Admin'));
  const ownerRole = g.roles.cache.find(r => r.name.includes('Owner'));

  for (const [, ch] of g.channels.cache) {
    try {
      const ow = [{ id: g.id, deny: [PermissionFlagsBits.ViewChannel] }];
      if (staffRole) ow.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
      if (adminRole) ow.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
      if (ownerRole) ow.push({ id: ownerRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
      await ch.permissionOverwrites.set(ow);
    } catch {}
  }
  for (const [, cat] of g.channels.cache) {
    if (cat.type === ChannelType.GuildCategory) {
      try {
        const ow = [{ id: g.id, deny: [PermissionFlagsBits.ViewChannel] }];
        if (staffRole) ow.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel] });
        if (adminRole) ow.push({ id: adminRole.id, allow: [PermissionFlagsBits.ViewChannel] });
        if (ownerRole) ow.push({ id: ownerRole.id, allow: [PermissionFlagsBits.ViewChannel] });
        await cat.permissionOverwrites.set(ow);
      } catch {}
    }
  }

  await interaction.editReply(`✅ تم إخفاء **${hidden}** قناة${failed ? ` — فشل ${failed}` : ''}\n🔒 الآن كل القنوات مخفية عن الأعضاء العاديين\n💡 الستاف والادمن بس هيشوفوها`);
  await sendLog(g, new EmbedBuilder().setTitle('🔒 تم إخفاء جميع القنوات').setDescription(`**بواسطة:** ${interaction.user}\n**القنوات:** ${hidden}`).setColor(0xE74C3C).setTimestamp());
}

async function cmdShowAll(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const g = interaction.guild;
  let shown = 0;

  for (const [, ch] of g.channels.cache) {
    try {
      await ch.permissionOverwrites.edit(g.id, { ViewChannel: true });
      shown++;
    } catch {}
  }
  for (const [, cat] of g.channels.cache) {
    if (cat.type === ChannelType.GuildCategory) {
      try {
        await cat.permissionOverwrites.edit(g.id, { ViewChannel: true });
      } catch {}
    }
  }

  await interaction.editReply(`✅ تم إظهار **${shown}** قناة\n🔓 الآن كل القنوات ظاهرة للجميع`);
  await sendLog(g, new EmbedBuilder().setTitle('🔓 تم إظهار جميع القنوات').setDescription(`**بواسطة:** ${interaction.user}\n**القنوات:** ${shown}`).setColor(0x2ECC71).setTimestamp());
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
        'enable-community': cmdEnableCommunity,
        'hide-all': cmdHideAll, 'show-all': cmdShowAll,
        clear: cmdClear, shortcut: cmdShortcut, shortcuts: cmdShortcuts,
      };
      const handler = map[interaction.commandName];
      if (handler) return await handler(interaction);
    }

    if (interaction.isAutocomplete()) {
      const scData = loadShortcuts();
      const focused = interaction.options.getFocused();
      const filtered = (scData.shortcuts || []).filter(s => s.name.toLowerCase().includes(focused.toLowerCase())).slice(0, 25);
      return interaction.respond(filtered.map(s => ({ name: `${s.emoji || '⚡'} ${s.name}`, value: s.name })));
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

    if (interaction.isStringSelectMenu() && interaction.customId === 'category_svc_select') {
      const id = parseInt(interaction.values[0]), services = getServices(), svc = services.find(s => s.id === id);
      if (!svc) return interaction.reply({ content: '❌ الخدمة مش موجودة', ephemeral: true });
      const embed = new EmbedBuilder()
        .setTitle(`${svc.emoji || '🛒'} ${svc.name}`)
        .setDescription(svc.description || 'مفيش وصف')
        .addFields(
          { name: '💰 السعر', value: `\`${fmt(svc.price)} كريديت\``, inline: true },
          { name: '📂 التصنيف', value: svc.category || 'مش محدد', inline: true },
        )
        .setColor(0x2ECC71)
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
      const row = new ActionRowBuilder().addComponents(orderBtn, shopBtn);
      await interaction.update({ embeds: [embed], components: [row] });
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

      if (cid.startsWith('category_order_')) {
        const catId = cid.replace('category_order_', '');
        const cats = getCategories();
        const cat = cats.find(c => c.id === catId);
        const services = getServices().filter(s => s.category === catId && s.active);
        if (!services.length) return interaction.reply({ content: '📭 مفيش خدمات في التصنيف ده حالياً', ephemeral: true });
        const catSelect = new StringSelectMenuBuilder()
          .setCustomId('category_svc_select')
          .setPlaceholder(`📂 اختار خدمة من ${cat?.name || catId}...`)
          .addOptions(services.map(s => ({
            label: `${s.emoji || '🛒'} ${s.name}`.substring(0, 100),
            description: `💰 ${fmt(s.price)}`.substring(0, 100),
            value: String(s.id),
          })));
        const row = new ActionRowBuilder().addComponents(catSelect);
        await interaction.reply({ components: [row], ephemeral: true });
        return;
      }

      if (cid.startsWith('category_ticket_')) {
        const catId = cid.replace('category_ticket_', '');
        const cats = getCategories();
        const cat = cats.find(c => c.id === catId);
        await interaction.deferReply({ ephemeral: true });
        const g = interaction.guild, orders = getOrders(), orderId = nextId(orders);
        const channel = await g.channels.create({
          name: `${cat?.name || catId} #${orderId}`.substring(0, 100),
          type: ChannelType.GuildText,
          parent: getTicketCat(g)?.id,
          permissionOverwrites: getTicketOverwrites(g, interaction.user.id)
        });
        orders.push({ id: orderId, type: 'support', serviceName: cat?.name || catId, serviceEmoji: cat?.emoji || '🎫', userId: interaction.user.id, username: interaction.user.username, channelId: channel.id, status: 'open', createdAt: Date.now() });
        save('orders.json', orders);
        const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
        await channel.send({ embeds: [new EmbedBuilder()
          .setTitle(`${cat?.emoji || '🎫'} تذكرة ${cat?.name || catId} #${orderId}`)
          .setDescription(
            `# أهلاً بيك في تذكرة **${cat?.name || catId}**!\n\n` +
            `**العميل:** ${interaction.user}\n` +
            `**رقم التذكرة:** \`${orderId}\`\n` +
            `**التصنيف:** ${cat?.emoji || ''} ${cat?.name || catId}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `## 💬 اكتب طلبك هنا\n\n` +
            `وصف طلبك بالتفصيل عشان نقدر نساعدك بسرعة\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          )
          .setColor(0xd4af37)
          .setTimestamp()
          .setFooter({ text: `🎫 ${g.name} — التذاكر`, iconURL: g.iconURL({ dynamic: true }) })],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_complete_${orderId}`).setLabel('✅ تم الاستلام').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ticket_close_${orderId}`).setLabel('🗑️ اقفل التذكرة').setStyle(ButtonStyle.Danger),
          )]
        });
        await interaction.editReply(`✅ تم فتح تذكرة **${cat?.name || catId}**: ${channel}`);
        return;
      }

      if (cid === 'svc_order_') {
        await interaction.deferReply({ ephemeral: true });
        const svcId = parseInt(cid.replace('svc_order_', ''));
        const services = getServices();
        const svc = services.find(s => s.id === svcId);
        if (!svc) return interaction.editReply('❌ الخدمة مش موجودة');

        const g = interaction.guild;
        const orders = getOrders();
        const orderId = nextId(orders);
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

        orders.push({ id: orderId, type: 'order', serviceId: svc.id, serviceName: svc.name, serviceEmoji: svc.emoji || '🛒', servicePrice: svc.price || 0, userId: interaction.user.id, username: interaction.user.username, channelId: channel.id, status: 'pending', createdAt: Date.now() });
        save('orders.json', orders);

        const e = new EmbedBuilder()
          .setTitle(`🛒 طلب خدمة — ${svc.emoji || '🛒'} ${svc.name}`)
          .setDescription(
            `# طلب خدمة جديد\n\n` +
            `**العميل:** ${interaction.user}\n` +
            `**الخدمة:** ${svc.emoji || '🛒'} **${svc.name}**\n` +
            `**السعر:** \`${fmt(svc.price)}\`\n` +
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

      if (cid === 'open_ticket_buy') {
        await interaction.deferReply({ ephemeral: true });
        const g = interaction.guild, orders = getOrders(), orderId = nextId(orders);
        const channel = await g.channels.create({ name: `buy-${orderId}-${interaction.user.username}`.substring(0, 100), type: ChannelType.GuildText, parent: getTicketCat(g)?.id, permissionOverwrites: getTicketOverwrites(g, interaction.user.id) });
        orders.push({ id: orderId, type: 'buy', serviceName: 'شراء خدمة', serviceEmoji: '🛒', userId: interaction.user.id, username: interaction.user.username, channelId: channel.id, status: 'open', createdAt: Date.now() });
        save('orders.json', orders);
        await channel.send({ embeds: [new EmbedBuilder()
          .setTitle(`🛒 تذكرة شراء #${orderId}`)
          .setDescription(
            `# أهلاً بيك! عايز تشتري خدمة؟\n\n` +
            `**العميل:** ${interaction.user}\n` +
            `**رقم التذكرة:** \`${orderId}\`\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `## 📝 اكتب اسم الخدمة اللي عايزها\n\n` +
            `قولنا إيه الخدمة اللي محتاجها وهنرد عليك في أسرع وقت\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          )
          .setColor(0x2ECC71)
          .setTimestamp()
          .setFooter({ text: `🎫 ${g.name} — التذاكر`, iconURL: g.iconURL({ dynamic: true }) })],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_complete_${orderId}`).setLabel('✅ تم الاستلام').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ticket_close_${orderId}`).setLabel('🗑️ اقفل التذكرة').setStyle(ButtonStyle.Danger),
          )]
        });
        await interaction.editReply(`✅ تم فتح تذكرة الشراء: ${channel}`);
        return;
      }

      if (cid === 'open_ticket_ask') {
        await interaction.deferReply({ ephemeral: true });
        const g = interaction.guild, orders = getOrders(), orderId = nextId(orders);
        const channel = await g.channels.create({ name: `ask-${orderId}-${interaction.user.username}`.substring(0, 100), type: ChannelType.GuildText, parent: getTicketCat(g)?.id, permissionOverwrites: getTicketOverwrites(g, interaction.user.id) });
        orders.push({ id: orderId, type: 'ask', serviceName: 'سؤال واستفسار', serviceEmoji: '❓', userId: interaction.user.id, username: interaction.user.username, channelId: channel.id, status: 'open', createdAt: Date.now() });
        save('orders.json', orders);
        await channel.send({ embeds: [new EmbedBuilder()
          .setTitle(`❓ تذكرة استفسار #${orderId}`)
          .setDescription(
            `# أهلاً بيك! عندك سؤال؟\n\n` +
            `**العميل:** ${interaction.user}\n` +
            `**رقم التذكرة:** \`${orderId}\`\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
            `## 💬 اكتب سؤالك هنا\n\n` +
            `قولنا إيه سؤالك وهنرد عليك في أسرع وقت\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━`
          )
          .setColor(0xF39C12)
          .setTimestamp()
          .setFooter({ text: `🎫 ${g.name} — التذاكر`, iconURL: g.iconURL({ dynamic: true }) })],
          components: [new ActionRowBuilder().addComponents(
            new ButtonBuilder().setCustomId(`ticket_complete_${orderId}`).setLabel('✅ تم الاستلام').setStyle(ButtonStyle.Success),
            new ButtonBuilder().setCustomId(`ticket_close_${orderId}`).setLabel('🗑️ اقفل التذكرة').setStyle(ButtonStyle.Danger),
          )]
        });
        await interaction.editReply(`✅ تم فتح تذكرة الاستفسار: ${channel}`);
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
let botReady = false;
client.on('clientReady', async () => {
  botReady = true;
  console.log(`✅ Bot: ${client.user.tag} | ${client.guilds.cache.size} servers`);
  client.user.setActivity('Codex Zone — خدمات احترافية', { type: ActivityType.Watching });
  for (const [, g] of client.guilds.cache) {
    try {
      const invites = await g.invites.fetch();
      inviteCache[g.id] = new Map(invites.map(i => [i.code, i.uses]));
    } catch {}
  }
  console.log(`📡 Cached invites for ${Object.keys(inviteCache).length} guilds`);
});

const inviteCache = {};

client.on('inviteCreate', (invite) => {
  if (!inviteCache[invite.guild?.id]) inviteCache[invite.guild.id] = new Map();
  inviteCache[invite.guild.id].set(invite.code, invite.uses);
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

  // Invite tracking + credit reward
  try {
    const g = member.guild;
    const currentInvites = await g.invites.fetch();
    const cached = inviteCache[g.id] || new Map();
    let usedInvite = null;
    for (const [code, uses] of currentInvites) {
      const oldUses = cached.get(code) || 0;
      if (uses > oldUses) { usedInvite = currentInvites.get(code); break; }
    }
    inviteCache[g.id] = new Map(currentInvites.map(i => [i.code, i.uses]));

    if (usedInvite && usedInvite.inviterId) {
      const inviterId = usedInvite.inviterId;
      if (inviterId !== member.id) {
        const newBal = addCredits(inviterId, INVITE_REWARD);
        try {
          const inviter = await g.members.fetch(inviterId);
          await inviter.send(`👑 دعوت عضو جديد (**${member.user.username}**) واخدت **${fmt(INVITE_REWARD)} كريديت**! رصيدك الحالي: **${fmt(newBal)}**`).catch(() => {});
        } catch {}
        await sendLog(g, new EmbedBuilder()
          .setTitle('🎁 دعوة جديدة')
          .setDescription(`**الداعي:** <@${inviterId}>\n**العضو الجديد:** ${member}\n**الكريدت:** +${fmt(INVITE_REWARD)}\n**الرصيد:** ${fmt(newBal)}`)
          .setColor(0xd4af37).setTimestamp());
      }
    }
  } catch {}

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
    if (req.method === 'GET' && (p === '/api/health' || p === '/')) {
      if (p === '/') {
        const html = fs.readFileSync(path.join(__dirname, 'dashboard.html'), 'utf8');
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        return res.end(html);
      }
      return jsonRes(res, 200, { status: 'ok', uptime: process.uptime(), canvas: !!Canvas, arabicFont: arabicFontRegistered });
    }

    // ── GET: Favicon ──
    if (req.method === 'GET' && p === '/favicon.png') {
      try {
        const fav = fs.readFileSync(path.join(__dirname, 'favicon.png'));
        res.writeHead(200, { 'Content-Type': 'image/png', 'Cache-Control': 'public, max-age=86400' });
        return res.end(fav);
      } catch { res.writeHead(404); return res.end(); }
    }

    const guild = (CFG.guildId && client.guilds.cache.get(CFG.guildId)) || client.guilds.cache.first();
    if (!guild && p !== '/api/health' && p !== '/api/bot') return jsonRes(res, 500, { error: 'No guild — bot not connected yet' });

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
      const msgPayload = { content: d.content || undefined };
      if (d.file) {
        const { AttachmentBuilder } = require('discord.js');
        const base64Data = d.file.replace(/^data:[^;]+;base64,/, '');
        const buf = Buffer.from(base64Data, 'base64');
        const attachment = new AttachmentBuilder(buf, { name: d.fileName || 'file.png' });
        msgPayload.files = [attachment];
      }
      const embed = d.title ? new EmbedBuilder().setTitle(d.title).setDescription(d.content || '').setColor(d.color || 0x3498DB).setTimestamp() : null;
      if (embed) msgPayload.embeds = [embed];
      await ch.send(msgPayload);
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

    // ═══ SHORTCUTS API ═══
    if (req.method === 'GET' && p === '/api/shortcuts') {
      return jsonRes(res, 200, loadShortcuts());
    }
    if (req.method === 'PUT' && p === '/api/shortcuts') {
      const d = await parseBody(req);
      const scData = loadShortcuts();
      if (d.shortcuts !== undefined) scData.shortcuts = d.shortcuts;
      if (d.allowedRoles !== undefined) scData.allowedRoles = d.allowedRoles;
      if (d.deniedRoles !== undefined) scData.deniedRoles = d.deniedRoles;
      if (d.allowedChannels !== undefined) scData.allowedChannels = d.allowedChannels;
      if (d.deniedChannels !== undefined) scData.deniedChannels = d.deniedChannels;
      saveShortcuts(scData);
      return jsonRes(res, 200, { ok: true });
    }
    if (req.method === 'POST' && p === '/api/shortcuts') {
      const d = await parseBody(req);
      const scData = loadShortcuts();
      const id = Date.now().toString(36);
      const sc = { id, name: d.name, emoji: d.emoji || '⚡', type: d.type || 'message', description: d.description || '', content: d.content || '', title: d.title || '', color: d.color || 0x8b5cf6, targetChannel: d.targetChannel || '', pingRole: d.pingRole || '', action: d.action || '', amount: d.amount || 50, createdAt: Date.now() };
      scData.shortcuts.push(sc);
      saveShortcuts(scData);
      return jsonRes(res, 200, { ok: true, shortcut: sc });
    }
    if (req.method === 'DELETE' && p.match(/^\/api\/shortcuts\/.+$/)) {
      const id = decodeURIComponent(p.split('/').pop());
      const scData = loadShortcuts();
      scData.shortcuts = scData.shortcuts.filter(s => s.id !== id && s.name !== id);
      saveShortcuts(scData);
      return jsonRes(res, 200, { ok: true });
    }
    if (req.method === 'PUT' && p.match(/^\/api\/shortcuts\/.+$/)) {
      const id = decodeURIComponent(p.split('/').pop());
      const d = await parseBody(req);
      const scData = loadShortcuts();
      const sc = scData.shortcuts.find(s => s.id === id || s.name === id);
      if (!sc) return jsonRes(res, 404, { error: 'Not found' });
      Object.assign(sc, { name: d.name ?? sc.name, emoji: d.emoji ?? sc.emoji, type: d.type ?? sc.type, description: d.description ?? sc.description, content: d.content ?? sc.content, title: d.title ?? sc.title, color: d.color ?? sc.color, targetChannel: d.targetChannel ?? sc.targetChannel, pingRole: d.pingRole ?? sc.pingRole, action: d.action ?? sc.action, amount: d.amount ?? sc.amount });
      saveShortcuts(scData);
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

  const dbOk = await connectDB();
  if (dbOk) {
    await seedDefaults(DEFAULT_SERVICES, DEFAULT_CATEGORIES);
    const scData = loadShortcuts();
    if (!scData.shortcuts || scData.shortcuts.length === 0) {
      const defaults = [
        { id: 'd-clear', name: 'مسح', emoji: '🧹', type: 'action', action: 'clear', amount: 50, content: '', description: 'مسح 50 رسالة من القناة', createdAt: Date.now() },
        { id: 'd-ban', name: 'حظر', emoji: '🔨', type: 'action', action: 'ban', amount: 0, content: 'حظر عبر اختصار', description: 'حظر عضو من السيرفر', createdAt: Date.now() },
        { id: 'd-kick', name: 'طرد', emoji: '👢', type: 'action', action: 'kick', amount: 0, content: 'طرد عبر اختصار', description: 'طرد عضو من السيرفر', createdAt: Date.now() },
        { id: 'd-mute', name: 'كتم', emoji: '🔇', type: 'action', action: 'mute', amount: 60, content: 'كتم عبر اختصار', description: 'كتم عضو لمدة 60 دقيقة', createdAt: Date.now() },
        { id: 'd-unmute', name: 'فك-كتم', emoji: '🔊', type: 'action', action: 'unmute', amount: 0, content: 'فك كتم عبر اختصار', description: 'فك الكتم عن عضو', createdAt: Date.now() },
        { id: 'd-warn', name: 'تحذير', emoji: '⚠️', type: 'action', action: 'warn', amount: 0, content: 'تحذير عبر اختصار', description: 'تحذير عضو', createdAt: Date.now() },
        { id: 'd-slowmode', name: 'سلومود', emoji: '🐌', type: 'action', action: 'slowmode', amount: 5, content: 'سلومود عبر اختصار', description: 'تفعيل سلو مود 5 دقائق', createdAt: Date.now() },
      ];
      scData.shortcuts = defaults;
      saveShortcuts(scData);
      console.log(`⚡ Seeded ${defaults.length} default shortcuts`);
    }
    const mongoCfg = load('config.json', null);
    if (mongoCfg) {
      Object.assign(CFG, mongoCfg);
      if (process.env.BOT_TOKEN) CFG.token = process.env.BOT_TOKEN;
      if (process.env.CLIENT_ID) CFG.clientId = process.env.CLIENT_ID;
      if (process.env.GUILD_ID) CFG.guildId = process.env.GUILD_ID;
      if (!CFG.autoRoles) CFG.autoRoles = [];
      if (!CFG.logsChannel) CFG.logsChannel = '';
      if (!CFG.automod) CFG.automod = { antispam: true, badwords: true, badwordsList: ['كسم', 'نكت', 'xnxx', 'porn', 'sex', 'incest'], antispamLimit: 5, antispamTime: 10 };
      if (!CFG.welcomeChannel) CFG.welcomeChannel = '';
      if (!CFG.primaryCurrency) CFG.primaryCurrency = 'usd';
      if (!CFG.welcomeMessage) CFG.welcomeMessage = 'مرحباً بك {user} في السيرفر! 👋';
    }
  }

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
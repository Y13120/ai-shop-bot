const {
  Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits,
  SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder, ActivityType,
} = require('discord.js');
const fs = require('fs');
const path = require('path');
const http = require('http');

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
save('config.json', CFG);

const getCategories = () => load('categories.json', DEFAULT_CATEGORIES);
const saveCategories = (cats) => save('categories.json', cats);
const DEFAULT_SERVICES = [
  { id: 1, name: 'ChatGPT Plus 4o', description: 'وصول ChatGPT Plus 4o لمدة شهر', price: 22500000, category: 'chatgpt', emoji: '🤖', active: true },
  { id: 2, name: 'ChatGPT Plus + DALL-E', description: 'ChatGPT Plus مع DALL-E', price: 27000000, category: 'chatgpt', emoji: '🎨', active: true },
  { id: 3, name: 'شات Claude Pro', description: 'وصول Claude Pro لمدة شهر', price: 19800000, category: 'chatgpt', emoji: '🧠', active: true },
  { id: 4, name: 'شات Gemini Advanced', description: 'وصول Gemini Advanced', price: 18000000, category: 'chatgpt', emoji: '💎', active: true },
  { id: 5, name: 'Midjourney Pro', description: 'اشتراك Midjourney Pro', price: 25200000, category: 'chatgpt', emoji: '🖼️', active: true },
  { id: 6, name: 'تطبيق موبايل', description: 'تطوير تطبيق موبايل بالذكاء الاصطناعي', price: 27000000, category: 'chatgpt', emoji: '📱', active: true },
  { id: 7, name: 'تطوير موقع كامل', description: 'تصميم وتطوير موقع احترافي', price: 24300000, category: 'chatgpt', emoji: '🌐', active: true },
  { id: 8, name: 'إنشاء فيديو AI', description: 'إنشاء فيديوهات بالذكاء الاصطناعي', price: 18000000, category: 'chatgpt', emoji: '🎬', active: true },
  { id: 9, name: 'إنشاء بوت Discord', description: 'إنشاء بوت Discord مخصص', price: 13500000, category: 'chatgpt', emoji: '🤖', active: true },
  { id: 10, name: 'تحليل بيانات', description: 'تحليل بيانات وتقارير', price: 10800000, category: 'chatgpt', emoji: '📊', active: true },
  { id: 11, name: 'مساعدة برمجية', description: 'مساعدة في البرمجة', price: 8500000, category: 'chatgpt', emoji: '💻', active: true },
  { id: 12, name: 'تصميم لوجو AI', description: 'تصميم لوجو بالذكاء الاصطناعي', price: 8500000, category: 'chatgpt', emoji: '✏️', active: true },
  { id: 13, name: 'كتابة مقالات ونصوص', description: 'كتابة مقالات ونصوص', price: 8500000, category: 'chatgpt', emoji: '📝', active: true },
  { id: 14, name: 'إعداد سيرفر Discord', description: 'إعداد سيرفر Discord كامل', price: 8500000, category: 'chatgpt', emoji: '🎮', active: true },
  { id: 15, name: 'ترجمة احترافية', description: 'ترجمة نصوص بأكثر من لغة', price: 8500000, category: 'chatgpt', emoji: '🌐', active: true },
  { id: 16, name: 'صوت AI — نص لكلام', description: 'تحويل النص إلى صوت', price: 8500000, category: 'chatgpt', emoji: '🔊', active: true },
  { id: 17, name: 'صوت AI — كلام لنص', description: 'تحويل الصوت إلى نص', price: 8500000, category: 'chatgpt', emoji: '🎙️', active: true },
  { id: 18, name: 'توليد صور AI', description: 'توليد صور بالذكاء الاصطناعي', price: 8500000, category: 'chatgpt', emoji: '📸', active: true },
  { id: 19, name: 'retouch صور', description: 'retouch احترافي — تنعيم — إزالة عيouns — تحسين ألوان', price: 8500000, category: 'photoshop', emoji: '🖌️', active: true },
  { id: 20, name: 'تصميم بوستر', description: 'تصميم بوستر إعلاني أو ترويجي', price: 8500000, category: 'photoshop', emoji: '🖼️', active: true },
  { id: 21, name: 'تصميم بانر', description: 'تصميم بانر لسوشيال ميديا أو ويب', price: 8500000, category: 'photoshop', emoji: '🎨', active: true },
  { id: 22, name: 'تصميم UI/UX', description: 'تصميم واجهة مستخدم احترافية', price: 21600000, category: 'photoshop', emoji: '📱', active: true },
  { id: 23, name: 'إزالة الخلفية', description: 'إزالة خلفية الصورة بدقة', price: 3000000, category: 'photoshop', emoji: '✂️', active: true },
  { id: 24, name: 'Photo Manipulation', description: 'تلاعب فني بالصور — دمج — تأثيرات', price: 9600000, category: 'photoshop', emoji: '🎭', active: true },
  { id: 25, name: 'تصميم هوية بصرية', description: 'تصميم هوية بصرية كاملة', price: 26400000, category: 'photoshop', emoji: '💼', active: true },
  { id: 26, name: 'مونتاج فيديو', description: 'مونتاج فيديو احترافي — قص + ترتيب + انتقالات', price: 10200000, category: 'montage', emoji: '🎬', active: true },
  { id: 27, name: 'تصميم إنтро/أوترو', description: 'تصميم مقدمة ونهاية للفيديوهات', price: 7200000, category: 'montage', emoji: '✨', active: true },
  { id: 28, name: 'تصحيح ألوان', description: 'تصحيح وضبط ألوان الفيديو', price: 5400000, category: 'montage', emoji: '🎨', active: true },
  { id: 29, name: 'موشن جرافيك', description: 'تصميم موشن جرافيك — أنيميشن — إعلانات متحركة', price: 26400000, category: 'montage', emoji: '🎭', active: true },
  { id: 30, name: 'ترجمة فيديو', description: 'إضافة ترجمة للفيديو — جميع اللغات', price: 4800000, category: 'montage', emoji: '📝', active: true },
  { id: 31, name: 'مونتاج يوتيوب', description: 'مونتاج فيديو يوتيوب كامل', price: 14400000, category: 'montage', emoji: '📺', active: true },
  { id: 32, name: 'Reels / تيك توك', description: 'مونتاج ريلز أو تيك توك', price: 6000000, category: 'montage', emoji: '📱', active: true },
  { id: 33, name: 'تطوير موقع كامل (برمجة)', description: 'تطوير موقع ويب كامل — تصميم + كود', price: 33600000, category: 'code', emoji: '🌐', active: true },
  { id: 34, name: 'Landing Page', description: 'تصميم صفحة هبوط احترافية', price: 16800000, category: 'code', emoji: '📄', active: true },
  { id: 35, name: 'بوت Discord مخصص', description: 'إنشاء بوت Discord مخصص — أوامر + أتمتة', price: 19200000, category: 'code', emoji: '🤖', active: true },
  { id: 36, name: 'سكربت / بوت أتمتة', description: 'كتابة سكربت أو بوت لأتمتة أي مهمة', price: 10800000, category: 'code', emoji: '⚙️', active: true },
  { id: 37, name: 'إعداد WordPress', description: 'إعداد و تخصيص موقع WordPress', price: 24000000, category: 'code', emoji: '🔧', active: true },
  { id: 38, name: 'ربط API', description: 'ربط أي API مع مشروعك', price: 18000000, category: 'code', emoji: '🔗', active: true },
  { id: 39, name: 'إصلاح مشكلة برمجية', description: 'إصلاح أي bug أو مشكلة في الكود', price: 6600000, category: 'code', emoji: '🐛', active: true },
  { id: 40, name: 'تطبيق ويب كامل', description: 'تطوير تطبيق ويب كامل — Frontend + Backend', price: 42000000, category: 'code', emoji: '💻', active: true },
];
const DEFAULT_CATEGORIES = [
  { id: 'chatgpt', name: 'ChatGPT & AI', emoji: '🤖' },
  { id: 'photoshop', name: 'فوتوشوب', emoji: '🖌️' },
  { id: 'montage', name: 'مونتاج', emoji: '🎬' },
  { id: 'code', name: 'برمجة', emoji: '💻' },
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
  new SlashCommandBuilder().setName('setup').setDescription('إعداد السيرفر بالكامل')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder().setName('add-service').setDescription('إضافة خدمة جديدة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('name').setDescription('اسم الخدمة').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('الوصف').setRequired(true))
    .addNumberOption(o => o.setName('price').setDescription('السعر').setRequired(true))
    .addStringOption(o => o.setName('category').setDescription('معرف التصنيف (اكتب /list-categories)').setRequired(true))
    .addStringOption(o => o.setName('emoji').setDescription('إيموجي')),
  new SlashCommandBuilder().setName('remove-service').setDescription('حذف خدمة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('id').setDescription('رقم الخدمة').setRequired(true)),
  new SlashCommandBuilder().setName('edit-service').setDescription('تعديل خدمة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('id').setDescription('رقم الخدمة').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('اسم جديد'))
    .addNumberOption(o => o.setName('price').setDescription('سعر جديد'))
    .addStringOption(o => o.setName('description').setDescription('وصف جديد')),
  new SlashCommandBuilder().setName('announce').setDescription('إرسال إعلان')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('title').setDescription('العنوان').setRequired(true))
    .addStringOption(o => o.setName('content').setDescription('المحتوى').setRequired(true))
    .addStringOption(o => o.setName('emoji').setDescription('إيموجي')),
  new SlashCommandBuilder().setName('auto-role').setDescription('إدارة الرولات التلقائية')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('add').setDescription('إضافة رول').addRoleOption(o => o.setName('role').setDescription('الرول').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('حذف رول').addRoleOption(o => o.setName('role').setDescription('الرول').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('عرض القائمة'))
    .addSubcommand(sub => sub.setName('clear').setDescription('مسح كل الرولات')),
  new SlashCommandBuilder().setName('set-logs').setDescription('ضبط قناة السجلات')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addChannelOption(o => o.setName('channel').setDescription('القناة').setRequired(true)),
  new SlashCommandBuilder().setName('automod').setDescription('إعداد الحماية التلقائية')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('antispam').setDescription('تفعيل/تعطيل منع السبام')
      .addStringOption(o => o.setName('state').setDescription('on/off').setRequired(true)
        .addChoices({ name: 'تفعيل', value: 'on' }, { name: 'تعطيل', value: 'off' })))
    .addSubcommand(sub => sub.setName('badwords').setDescription('تفعيل/تعطيل فلتر الكلمات')
      .addStringOption(o => o.setName('state').setDescription('on/off').setRequired(true)
        .addChoices({ name: 'تفعيل', value: 'on' }, { name: 'تعطيل', value: 'off' })))
    .addSubcommand(sub => sub.setName('add-word').setDescription('إضافة كلمة ممنوعة')
      .addStringOption(o => o.setName('word').setDescription('الكلمة').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove-word').setDescription('حذف كلمة ممنوعة')
      .addStringOption(o => o.setName('word').setDescription('الكلمة').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('عرض الإعدادات')),
  new SlashCommandBuilder().setName('add-category').setDescription('إضافة تصنيف جديد')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('id').setDescription('معرف التصنيف (انجليزي)').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('اسم التصنيف بالعربي').setRequired(true))
    .addStringOption(o => o.setName('emoji').setDescription('إيموجي التصنيف')),
  new SlashCommandBuilder().setName('remove-category').setDescription('حذف تصنيف')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('id').setDescription('معرف التصنيف').setRequired(true)),
  new SlashCommandBuilder().setName('list-categories').setDescription('عرض التصنيفات'),

  // ── Moderation ──
  new SlashCommandBuilder().setName('ban').setDescription('حظر عضو')
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
  new SlashCommandBuilder().setName('unmute').setDescription('إلغاء كتم')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),
  new SlashCommandBuilder().setName('warn').setDescription('تحذير عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب').setRequired(true)),
  new SlashCommandBuilder().setName('warnings').setDescription('عرض تحذيرات عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),
  new SlashCommandBuilder().setName('clear-warnings').setDescription('مسح تحذيرات')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),
  new SlashCommandBuilder().setName('purge').setDescription('مسح رسائل')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addNumberOption(o => o.setName('amount').setDescription('العدد').setRequired(true)),

  // ── Shop ──
  new SlashCommandBuilder().setName('services').setDescription('عرض الخدمات'),
  new SlashCommandBuilder().setName('order').setDescription('طلب خدمة')
    .addStringOption(o => o.setName('service').setDescription('رقم الخدمة').setRequired(true)),
  new SlashCommandBuilder().setName('support').setDescription('فتح تذكرة دعم فني'),
  new SlashCommandBuilder().setName('close').setDescription('إغلاق التذكرة'),

  // ── Giveaway ──
  new SlashCommandBuilder().setName('giveaway'). setDescription('إنشاء سحبية')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('prize').setDescription('الجائزة').setRequired(true))
    .addNumberOption(o => o.setName('winners').setDescription('عدد الفائزين').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('المدة (مثلاً 1h, 30m, 1d)').setRequired(true)),
  new SlashCommandBuilder().setName('end-giveaway').setDescription('إنهاء السحبية')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('message-id').setDescription('رسالة السحبية').setRequired(true)),

  // ── General ──
  new SlashCommandBuilder().setName('review').setDescription('تقييم خدمة')
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
  new SlashCommandBuilder().setName('help').setDescription('عرض كل الأوامر'),
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
    { k: 'admin', n: '⚡⚡⚡ ┃ Admin', c: '#E74C3C', p: [PermissionFlagsBits.Administrator] },
    { k: 'staff', n: '⭐⭐⭐ ┃ Staff', c: '#F1C40F', p: [PermissionFlagsBits.ManageChannels, PermissionFlagsBits.ManageRoles, PermissionFlagsBits.SendMessages] },
    { k: 'customer', n: '🛒 ┃ Customer', c: '#1ABC9C', p: [] },
    { k: 'vip', n: '💎 ┃ VIP', c: '#9B59B6', p: [] },
  ];
  for (const rd of roleDefs) {
    try { roles[rd.k] = await g.roles.create({ name: rd.n, color: rd.c, permissions: rd.p }); log.push(`✅ ${rd.n}`); } catch { log.push(`❌ ${rd.n}`); }
    await sleep(600);
  }

  const noSend = [{ id: g.id, deny: [PermissionFlagsBits.SendMessages] }];
  const full = [{ id: g.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }];

  const structure = [
    { n: '╔════════ 🏪 المتجر ════════', chs: [
      { n: '🛒・الخدمات', p: full }, { n: '📝・كيف-تطلب', p: noSend },
      { n: '⭐・التقييمات', p: [{ id: g.id, deny: [PermissionFlagsBits.SendMessages] }, ...(roles.customer ? [{ id: roles.customer.id, allow: [PermissionFlagsBits.SendMessages] }] : [])] },
    ]},
    { n: '╔════════ 📢 الإعلانات ════════', chs: [
      { n: '📣・الإعلانات', p: noSend }, { n: '📋・القواعد', p: noSend },
    ]},
    { n: '╔════════ 💬 الدردشة ════════', chs: [
      { n: '💬・العامة', p: full }, { n: '🤖・اوامر-البوت', p: full },
    ]},
    { n: '╔════════ 📌 معلومات ════════', chs: [
      { n: '📊・حالة-السيرفر', p: noSend }, { n: '👋・الترحيب', p: noSend },
    ]},
    { n: '╔════════ 🎫 التذاكر ════════', chs: [
      { n: '🎫・فتح-تذكرة', p: full },
    ]},
    { n: '╔════════ 🛡️ السجلات ════════', chs: [
      { n: '📝・السجلات', p: noSend },
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

  const logsCh = g.channels.cache.find(c => c.name.includes('السجلات') && c.isTextBased());
  if (logsCh) { CFG.logsChannel = logsCh.id; save('config.json', CFG); }

  const defaultServices = DEFAULT_SERVICES.map(s => ({ ...s, createdAt: Date.now() }));
  save('services.json', defaultServices);
  saveCategories(DEFAULT_CATEGORIES);

  const svcCh = g.channels.cache.find(c => c.name.includes('الخدمات') && c.isTextBased());
  if (svcCh) {
    const e = new EmbedBuilder().setTitle('🤖 مرحباً بك في متجر الذكاء الاصطناعي').setDescription('━━━━━━━━━━━━━━━━━━━━━\n\n**مرحباً بك في أفضل متجر لخدمات الذكاء الاصطناعي!** 🚀\n\n━━━━━━━━━━━━━━━━━━━━━\n\n**💡 كيف تطلب؟**\n\n> `1️⃣` اختر الخدمة من القائمة\n> `2️⃣` الستاف هيساعدك\n> `3️⃣` ادفع واستلم\n\n━━━━━━━━━━━━━━━━━━━━━').setColor(0xFF0000).setTimestamp().setFooter({ text: '🛍️ AI Shop Bot' });
    const select = new StringSelectMenuBuilder().setCustomId('services_menu').setPlaceholder('🛒 اختر خدمة...').addOptions(getServices().filter(s => s.active).slice(0, 25).map(s => ({ label: `${s.emoji || '🛒'} ${s.name}`.substring(0, 100), description: `${fmt(s.price)} كريديت`.substring(0, 100), value: String(s.id) })));
    const row = new ActionRowBuilder().addComponents(select);
    await svcCh.send({ embeds: [e], components: [row] }).catch(() => {});
  }

  const rulesCh = g.channels.cache.find(c => c.name.includes('القواعد') && c.isTextBased());
  if (rulesCh) {
    await rulesCh.send({ embeds: [new EmbedBuilder().setTitle('📋 قواعد السيرفر').setDescription('━━━━━━━━━━━━━━━━━━━━━\n\n**1.** 🤝 احترام الجميع\n**2.** 🚫 لا محتوى مخالف\n**3.** 💰 الدفع مقدماً\n**4.** 🔒 لا تشارك حساباتك\n**5.** 👑 اتبع الادمن\n\n━━━━━━━━━━━━━━━━━━━━━').setColor(0xFFB900).setTimestamp()] }).catch(() => {});
  }

  const howCh = g.channels.cache.find(c => c.name.includes('كيف-تطلب') && c.isTextBased());
  if (howCh) {
    await howCh.send({ embeds: [new EmbedBuilder().setTitle('📝 دليل طلب الخدمة').setDescription('**Step 1** 🛒 اختر خدمة من القائمة\n**Step 2** 📋 راجع الأسعار\n**Step 3** 💬 تواصل مع الستاف\n**Step 4** 💰 ادفع\n**Step 5** ✅ استلم وقيّم بـ `/review`').setColor(0x2ECC71).setTimestamp()] }).catch(() => {});
  }

  const ticketCh = g.channels.cache.find(c => c.name.includes('فتح-تذكرة') && c.isTextBased());
  if (ticketCh) {
    const btn2 = new ButtonBuilder().setCustomId('open_ticket_support').setLabel('🛠️ دعم فني').setStyle(ButtonStyle.Primary);
    await ticketCh.send({ embeds: [new EmbedBuilder().setTitle('🎫 فتح تذكرة').setDescription('━━━━━━━━━━━━━━━━━━━━━\n\n**اضغط الزر لفتح تذكرة دعم فني:**\n\n🛠️ **دعم فني** — للمساعدة والدعم\n\n━━━━━━━━━━━━━━━━━━━━━').setColor(0x9B59B6).setTimestamp()], components: [new ActionRowBuilder().addComponents(btn2)] }).catch(() => {});
  }

  await interaction.editReply(`✅ تم الإعداد!\n\n${log.join('\n')}`);
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: SHOP
// ══════════════════════════════════════════════════════════════
async function cmdServices(interaction) {
  const services = getServices().filter(s => s.active);
  if (!services.length) return interaction.reply({ content: '📭 لا توجد خدمات', ephemeral: true });
  const cats = getCategories();
  const catMap = {};
  for (const c of cats) catMap[c.id] = c;
  const grouped = {};
  for (const s of services) { const cat = s.category || 'other'; if (!grouped[cat]) grouped[cat] = []; grouped[cat].push(s); }
  const embed = new EmbedBuilder().setTitle('🛒 الخدمات المتاحة').setDescription('اختر خدمة من القائمة').setColor(0xFF0000).setTimestamp().setFooter({ text: `${services.length} خدمة` });
  for (const [catId, items] of Object.entries(grouped)) {
    const catInfo = catMap[catId] || { name: catId, emoji: '📁' };
    embed.addFields({ name: `${catInfo.emoji} ${catInfo.name}`, value: items.map(s => `${s.emoji || '🛒'} **${safe(s.name, 40)}** — \`${fmt(s.price)}\``).join('\n') });
  }
  const select = new StringSelectMenuBuilder().setCustomId('services_menu').setPlaceholder('🛒 اختر خدمة...').addOptions(services.slice(0, 25).map(s => ({ label: `${s.emoji || '🛒'} ${s.name}`.substring(0, 100), description: `${fmt(s.price)} كريديت`.substring(0, 100), value: String(s.id) })));
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
  if (!svc) return interaction.reply({ content: '❌ خدمة غير موجودة', ephemeral: true });
  const name = interaction.options.getString('name'), price = interaction.options.getNumber('price'), desc = interaction.options.getString('description');
  if (name) svc.name = name; if (price) svc.price = price; if (desc) svc.description = desc;
  save('services.json', services);
  await interaction.reply({ content: `✅ تم تعديل: ${svc.emoji} ${svc.name} — \`${fmt(svc.price)}\``, ephemeral: true });
}

async function cmdRemoveService(interaction) {
  const id = parseInt(interaction.options.getString('id')), services = getServices(), svc = services.find(s => s.id === id);
  if (!svc) return interaction.reply({ content: '❌ غير موجودة', ephemeral: true });
  save('services.json', services.filter(s => s.id !== id));
  await interaction.reply({ content: `✅ تم حذف: ${svc.emoji} ${svc.name}`, ephemeral: true });
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
  await interaction.reply({ content: `✅ تمت إضافة التصنيف: ${emoji} ${name} (\`${id}\`)`, ephemeral: true });
}

async function cmdRemoveCategory(interaction) {
  const id = interaction.options.getString('id');
  let cats = getCategories();
  const cat = cats.find(c => c.id === id);
  if (!cat) return interaction.reply({ content: `❌ التصنيف \`${id}\` غير موجود`, ephemeral: true });
  const servicesUsing = getServices().filter(s => s.category === id);
  if (servicesUsing.length) return interaction.reply({ content: `❌ فيه ${servicesUsing.length} خدمة في هذا التصنيف. احذفها أول`, ephemeral: true });
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
  await interaction.reply({ content: '🛒 **اطلب من المتجر:**\nhttps://ai-shop-bot-production.up.railway.app/shop\n\nهناك تقدر تشوف كل الخدمات بالأسعار وتعمل طلب مباشر.', ephemeral: true });
}

async function cmdSupport(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const g = interaction.guild, orders = getOrders(), orderId = nextId(orders);
  const channel = await g.channels.create({ name: `support-${orderId}-${interaction.user.username}`.substring(0, 100), type: ChannelType.GuildText, parent: getTicketCat(g)?.id, permissionOverwrites: getTicketOverwrites(g, interaction.user.id) });
  orders.push({ id: orderId, type: 'support', serviceName: 'دعم فني', serviceEmoji: '🛠️', userId: interaction.user.id, username: interaction.user.username, channelId: channel.id, status: 'open', createdAt: Date.now() });
  save('orders.json', orders);
  const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
  await channel.send({ embeds: [new EmbedBuilder().setTitle(`🛠️ تذكرة دعم #${orderId}`).setDescription(`**المستخدم:** ${interaction.user}\n\n━━━━━━━━━━━━━━━━━━━━━\n💬 **اكتب مشكلتك هنا**\n━━━━━━━━━━━━━━━━━━━━━`).setColor(0x3498DB).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
  await interaction.editReply(`✅ تم فتح تذكرة الدعم: ${channel}`);
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🛠️ تذكرة دعم جديدة').setDescription(`**المستخدم:** ${interaction.user}\n**القناة:** ${channel}`).setColor(0x3498DB).setTimestamp());
}

async function cmdClose(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const orders = getOrders(), order = orders.find(o => o.channelId === interaction.channel.id);
  if (!order) return interaction.editReply('❌ هذا ليس تذكرة');
  order.status = 'closed'; order.closedAt = Date.now(); order.closedBy = interaction.user.id;
  save('orders.json', orders);
  await interaction.editReply({ embeds: [new EmbedBuilder().setTitle('🔒 تذكرة مغلقة').setDescription(`**أغلقها:** ${interaction.user}`).setColor(0xE74C3C).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🔒 تذكرة مغلقة').setDescription(`**أغلقها:** ${interaction.user}\n**التذكرة:** #${order.id}`).setColor(0xE74C3C).setTimestamp());
  await sleep(3000); try { await interaction.channel.delete(); } catch {}
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: MODERATION
// ══════════════════════════════════════════════════════════════
async function cmdBan(interaction) {
  const user = interaction.options.getUser('user'), reason = interaction.options.getString('reason') || 'بدون سبب';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ غير موجود', ephemeral: true });
  if (!member.bannable) return interaction.reply({ content: '❌ لا أقدر أحظره', ephemeral: true });
  await member.ban({ reason });
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔨 تم الحظر').setDescription(`**العضو:** ${user}\n**بواسطة:** ${interaction.user}\n**السبب:** ${reason}`).setColor(0xE74C3C).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🔨 عضو محظور').setDescription(`**العضو:** ${user.tag} (${user.id})\n**بواسطة:** ${interaction.user}\n**السبب:** ${reason}`).setColor(0xE74C3C).setTimestamp());
}

async function cmdKick(interaction) {
  const user = interaction.options.getUser('user'), reason = interaction.options.getString('reason') || 'بدون سبب';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ غير موجود', ephemeral: true });
  if (!member.kickable) return interaction.reply({ content: '❌ لا أقدر أطرده', ephemeral: true });
  await member.kick(reason);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🚪 تم الطرد').setDescription(`**العضو:** ${user}\n**بواسطة:** ${interaction.user}\n**السبب:** ${reason}`).setColor(0xF39C12).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🚪 عضو مطرود').setDescription(`**العضو:** ${user.tag} (${user.id})\n**بواسطة:** ${interaction.user}\n**السبب:** ${reason}`).setColor(0xF39C12).setTimestamp());
}

async function cmdMute(interaction) {
  const user = interaction.options.getUser('user'), minutes = interaction.options.getNumber('minutes'), reason = interaction.options.getString('reason') || 'بدون سبب';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ غير موجود', ephemeral: true });
  if (!member.moderatable) return interaction.reply({ content: '❌ لا أقدر أكتمه', ephemeral: true });
  await member.timeout(minutes * 60 * 1000, reason);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔇 تم الكتم').setDescription(`**العضو:** ${user}\n**المدة:** ${minutes} دقيقة\n**السبب:** ${reason}`).setColor(0x9B59B6).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🔇 عضو مكتوم').setDescription(`**العضو:** ${user.tag}\n**المدة:** ${minutes} دقيقة\n**بواسطة:** ${interaction.user}`).setColor(0x9B59B6).setTimestamp());
}

async function cmdUnmute(interaction) {
  const user = interaction.options.getUser('user');
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ غير موجود', ephemeral: true });
  await member.timeout(null);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔊 إلغاء الكتم').setDescription(`**العضو:** ${user}`).setColor(0x2ECC71).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🔊 إلغاء كتم').setDescription(`**العضو:** ${user.tag}\n**بواسطة:** ${interaction.user}`).setColor(0x2ECC71).setTimestamp());
}

async function cmdWarn(interaction) {
  const user = interaction.options.getUser('user'), reason = interaction.options.getString('reason');
  const warnings = getWarnings();
  warnings.push({ id: nextId(warnings), userId: user.id, username: user.username, reason, issuedBy: interaction.user.id, issuedByName: interaction.user.username, createdAt: Date.now() });
  save('warnings.json', warnings);
  const count = warnings.filter(w => w.userId === user.id).length;
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('⚠️ تحذير').setDescription(`**العضو:** ${user}\n**السبب:** ${reason}\n**التحذيرات:** ${count}`).setColor(0xF1C40F).setTimestamp()] });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('⚠️ تحذير جديد').setDescription(`**العضو:** ${user.tag}\n**السبب:** ${reason}\n**بواسطة:** ${interaction.user}\n**الإجمالي:** ${count}`).setColor(0xF1C40F).setTimestamp());
  if (count >= 3) { try { await user.send(`⚠️ وصلت ${count} تحذيرات في ${interaction.guild.name}. قد يتم حظرك.`); } catch {} }
}

async function cmdWarnings(interaction) {
  const user = interaction.options.getUser('user'), warnings = getWarnings().filter(w => w.userId === user.id);
  if (!warnings.length) return interaction.reply({ content: `✅ ${user} بدون تحذيرات`, ephemeral: true });
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`⚠️ تحذيرات ${user.username}`).setDescription(warnings.map((w, i) => `**${i + 1}.** ${w.reason} — بواسطة ${w.issuedByName} <t:${Math.floor(w.createdAt / 1000)}:R>`).join('\n')).setColor(0xF1C40F).setTimestamp()], ephemeral: true });
}

async function cmdClearWarnings(interaction) {
  const user = interaction.options.getUser('user');
  let warnings = getWarnings(); const before = warnings.filter(w => w.userId === user.id).length;
  warnings = warnings.filter(w => w.userId !== user.id); save('warnings.json', warnings);
  await interaction.reply({ content: `✅ مسح ${before} تحذيرات من ${user}`, ephemeral: true });
}

async function cmdPurge(interaction) {
  const amount = interaction.options.getNumber('amount');
  if (amount < 1 || amount > 100) return interaction.reply({ content: '❌ من 1 لـ 100', ephemeral: true });
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
  if (!svc) return interaction.reply({ content: '❌ خدمة غير موجودة', ephemeral: true });
  if (rating < 1 || rating > 5) return interaction.reply({ content: '❌ التقييم من 1 لـ 5', ephemeral: true });
  const reviews = getReviews();
  reviews.push({ id: nextId(reviews), serviceId: id, serviceName: svc.name, userId: interaction.user.id, username: interaction.user.username, rating, comment, createdAt: Date.now() });
  save('reviews.json', reviews);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('⭐ تم التقييم').setDescription(`**الخدمة:** ${svc.emoji} ${svc.name}\n**التقييم:** ${'★'.repeat(rating) + '☆'.repeat(5 - rating)}\n**التعليق:** ${comment || '—'}`).setColor(0xF1C40F).setTimestamp()] });
}

async function cmdLeaderboard(interaction) {
  const reviews = getReviews();
  if (!reviews.length) return interaction.reply({ content: '📭 لا توجد تقييمات', ephemeral: true });
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
  if (!duration) return interaction.reply({ content: '❌ صيغة المدة خاطئة. استخدم مثل: `1h`, `30m`, `1d`', ephemeral: true });

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
      try { await msg.edit({ embeds: [new EmbedBuilder().setTitle('🎉 سحبية منتهية').setDescription(`**الجائزة:** ${prize}\n\n❌ لا يوجد مشاركين`).setColor(0x808080).setTimestamp()], components: [] }); } catch {}
      return;
    }

    const shuffled = gw.participants.sort(() => 0.5 - Math.random());
    const win = shuffled.slice(0, winners);
    try { await msg.edit({ embeds: [new EmbedBuilder().setTitle('🎉 سحبية منتهية!').setDescription(`**الجائزة:** ${prize}\n**الفائزون:** ${win.map(id => `<@${id}>`).join(', ')}\n\n!هنيئاً`).setColor(0x2ECC71).setTimestamp()], components: [] }); } catch {}
    try { await interaction.channel.send(`🎉 مبروك ${win.map(id => `<@${id}>`).join(' ')}! فازوا بـ **${prize}**!`); } catch {}
  }, duration);
}

async function cmdEndGiveaway(interaction) {
  const messageId = interaction.options.getString('message-id');
  const giveaways = getGiveaways();
  const gw = giveaways.find(g => g.id === messageId);
  if (!gw) return interaction.reply({ content: '❌ سحبية غير موجودة', ephemeral: true });
  if (gw.ended) return interaction.reply({ content: '❌ السحبية خلصت أصلاً', ephemeral: true });
  gw.ended = true; save('giveaways.json', giveaways);
  if (!gw.participants.length) {
    const ch = interaction.guild.channels.cache.get(gw.channelId);
    if (ch) { const msg = await ch.messages.fetch(messageId).catch(() => null); if (msg) await msg.edit({ embeds: [new EmbedBuilder().setTitle('🎉 سحبية منتهية').setDescription(`**الجائزة:** ${gw.prize}\n\n❌ لا يوجد مشاركين`).setColor(0x808080).setTimestamp()], components: [] }).catch(() => {}); }
    return interaction.reply({ content: '✅ تم إنهاء السحبية', ephemeral: true });
  }
  const shuffled = gw.participants.sort(() => 0.5 - Math.random());
  const win = shuffled.slice(0, gw.winners);
  const ch = interaction.guild.channels.cache.get(gw.channelId);
  if (ch) {
    const msg = await ch.messages.fetch(messageId).catch(() => null);
    if (msg) await msg.edit({ embeds: [new EmbedBuilder().setTitle('🎉 سحبية منتهية!').setDescription(`**الجائزة:** ${gw.prize}\n**الفائزون:** ${win.map(id => `<@${id}>`).join(', ')}`).setColor(0x2ECC71).setTimestamp()], components: [] }).catch(() => {});
    await ch.send(`🎉 مبروك ${win.map(id => `<@${id}>`).join(' ')}! فازوا بـ **${gw.prize}**!`).catch(() => {});
  }
  await interaction.reply({ content: '✅ تم إنهاء السحبية', ephemeral: true });
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: STATS
// ══════════════════════════════════════════════════════════════
async function cmdStats(interaction) {
  const orders = getOrders(), reviews = getReviews(), services = getServices();
  const completed = orders.filter(o => o.status === 'completed').length;
  const pending = orders.filter(o => o.status === 'pending' || o.status === 'open' || o.status === 'progress').length;
  const embed = new EmbedBuilder()
    .setTitle('📊 إحصائيات البوت')
    .addFields(
      { name: '🎫 الطلبات', value: `**إجمالي:** ${orders.length}\n**مكتملة:** ${completed}\n**قيد التنفيذ:** ${pending}`, inline: true },
      { name: '⭐ التقييمات', value: `**إجمالي:** ${reviews.length}`, inline: true },
      { name: '🛒 الخدمات', value: `**إجمالي:** ${services.length}`, inline: true },
      { name: '👥 الأعضاء', value: `**${interaction.guild.memberCount}**`, inline: true },
      { name: '🎫 السحبيات', value: `**${getGiveaways().length}**`, inline: true },
    )
    .setColor(0x3498DB).setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function cmdTicketStats(interaction) {
  const orders = getOrders();
  const byStatus = {};
  for (const o of orders) { const s = o.status || 'unknown'; byStatus[s] = (byStatus[s] || 0) + 1; }
  const statusNames = { pending: '⏳ بانتظار القبول', open: '📂 مفتوحة', progress: '🔄 قيد التنفيذ', completed: '✅ مكتملة', closed: '🔒 مغلقة' };
  const desc = Object.entries(byStatus).map(([s, c]) => `${statusNames[s] || s}: **${c}**`).join('\n');
  const embed = new EmbedBuilder().setTitle('🎫 إحصائيات التذاكر').setDescription(desc || 'لا توجد تذاكر').setColor(0x9B59B6).setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function cmdTopCustomers(interaction) {
  const orders = getOrders().filter(o => o.status === 'completed');
  if (!orders.length) return interaction.reply({ content: '📭 لا توجد طلبات مكتملة', ephemeral: true });
  const cust = {};
  for (const o of orders) { const u = o.username || o.userId; if (!cust[u]) cust[u] = { userId: o.userId, count: 0 }; cust[u].count++; }
  const entries = Object.values(cust).sort((a, b) => b.count - a.count).slice(0, 10);
  const medals = ['🥇', '🥈', '🥉'];
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('👑 أفضل الزبائن').setDescription(entries.map((e, i) => `${medals[i] || `**${i + 1}.**`} <@${e.userId}> — **${e.count}** طلبات`).join('\n')).setColor(0xFFD700).setTimestamp()] });
}

// ══════════════════════════════════════════════════════════════
//  HANDLERS: AUTO-ROLE / SET-LOGS / AUTOMOD / ANNOUNCE
// ══════════════════════════════════════════════════════════════
async function cmdAutoRole(interaction) {
  const sub = interaction.options.getSubcommand();
  if (sub === 'add') { const role = interaction.options.getRole('role'); if (CFG.autoRoles.includes(role.id)) return interaction.reply({ content: '❌ مضاف أصلاً', ephemeral: true }); CFG.autoRoles.push(role.id); save('config.json', CFG); return interaction.reply({ content: `✅ الرول <@&${role.id}> تلقائي`, ephemeral: true }); }
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
  if (sub === 'antispam') { const state = interaction.options.getString('state') === 'on'; CFG.automod.antispam = state; save('config.json', CFG); return interaction.reply({ content: `✅ منع السبام: ${state ? 'مفعّل' : 'معطّل'}`, ephemeral: true }); }
  if (sub === 'badwords') { const state = interaction.options.getString('state') === 'on'; CFG.automod.badwords = state; save('config.json', CFG); return interaction.reply({ content: `✅ فلتر الكلمات: ${state ? 'مفعّل' : 'معطّل'}`, ephemeral: true }); }
  if (sub === 'add-word') { const word = interaction.options.getString('word'); if (!CFG.automod.badwordsList.includes(word)) { CFG.automod.badwordsList.push(word); save('config.json', CFG); } return interaction.reply({ content: `✅ تمت إضافة: \`${word}\``, ephemeral: true }); }
  if (sub === 'remove-word') { const word = interaction.options.getString('word'); CFG.automod.badwordsList = CFG.automod.badwordsList.filter(w => w !== word); save('config.json', CFG); return interaction.reply({ content: `✅ تمت إزالة: \`${word}\``, ephemeral: true }); }
  if (sub === 'list') {
    return interaction.reply({ embeds: [new EmbedBuilder().setTitle('🛡️ إعدادات الحماية').addFields({ name: '🚫 Anti-Spam', value: CFG.automod.antispam ? `✅ مفعّل (${CFG.automod.antispamLimit} رسائل / ${CFG.automod.antispamTime} ثانية)` : '❌ معطّل' }, { name: '🔤 Bad Words', value: CFG.automod.badwords ? `✅ مفعّل (${CFG.automod.badwordsList.length} كلمة)` : '❌ معطّل', }, { name: '📝 الكلمات الممنوعة', value: CFG.automod.badwordsList.map(w => `\`${w}\``).join(', ') || '—' }).setColor(0x3498DB).setTimestamp()], ephemeral: true });
  }
}

async function cmdAnnounce(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const title = interaction.options.getString('title'), content = interaction.options.getString('content'), emoji = interaction.options.getString('emoji') || '📣';
  const ch = interaction.guild.channels.cache.find(c => c.name.includes('الإعلانات') && c.isTextBased());
  if (!ch) return interaction.editReply('❌ قناة الإعلانات غير موجودة');
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
    { name: '🛡️ إدارية', value: '`/setup` `/add-service` `/edit-service` `/remove-service` `/add-category` `/remove-category` `/list-categories` `/announce` `/auto-role` `/set-logs` `/automod` `/giveaway` `/end-giveaway`' },
    { name: '🔨 moderation', value: '`/ban` `/kick` `/mute` `/unmute` `/warn` `/warnings` `/clear-warnings` `/purge`' },
  ).setColor(0xFF0000).setTimestamp()], ephemeral: true });
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
        help: cmdHelp, 'add-service': cmdAddService, 'edit-service': cmdEditService, 'remove-service': cmdRemoveService,
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

    if (interaction.isStringSelectMenu() && interaction.customId === 'services_menu') {
      const id = parseInt(interaction.values[0]), services = getServices(), svc = services.find(s => s.id === id);
      if (!svc) return interaction.reply({ content: '❌ خدمة غير موجودة', ephemeral: true });
      const embed = new EmbedBuilder().setTitle(`${svc.emoji || '🛒'} ${svc.name}`).setDescription(svc.description).addFields({ name: '💰 السعر', value: `\`${fmt(svc.price)}\``, inline: true }, { name: '📂 التصنيف', value: svc.category, inline: true }, { name: '🌐 اطلب من المتجر', value: '[AI Shop](https://ai-shop-bot-production.up.railway.app/shop)', inline: true }).setColor(0x3498DB).setTimestamp();
      await interaction.reply({ embeds: [embed], ephemeral: true });
      return;
    }

    if (interaction.isButton()) {
      const cid = interaction.customId;

      if (cid.startsWith('svc_order_')) {
        return interaction.reply({ content: '❌ هذه الخدمة غير متاحة حالياً', ephemeral: true });
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
        await channel.send({ embeds: [new EmbedBuilder().setTitle(`🛠️ تذكرة دعم #${orderId}`).setDescription(`**المستخدم:** ${interaction.user}\n\n💬 **اكتب مشكلتك هنا**`).setColor(0x3498DB).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
        await interaction.editReply(`✅ تم فتح تذكرة الدعم: ${channel}`);
        return;
      }

      if (cid.startsWith('order_accept_')) {
        const orderId = parseInt(cid.replace('order_accept_', '')), orders = getOrders(), order = orders.find(o => o.id === orderId);
        if (!order) return interaction.reply({ content: '❌ غير موجود', ephemeral: true });
        if (order.status !== 'pending') return interaction.reply({ content: '❌ تم التعامل معه', ephemeral: true });
        order.status = 'progress'; order.acceptedBy = interaction.user.id; order.acceptedAt = Date.now();
        save('orders.json', orders);
        await interaction.update({ embeds: [new EmbedBuilder().setTitle(`🎫 طلب #${orderId} — قيد التنفيذ`).setDescription(`**العميل:** <@${order.userId}>\n**الخدمة:** ${order.serviceEmoji} ${order.serviceName}\n**السعر:** \`${fmt(order.servicePrice || 0)}\`\n**الستاف:** ${interaction.user}\n\n━━━━━━━━━━━━━━━━━━━━━\n🔄 **جاري التنفيذ...**`).setColor(0x3498DB).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`order_complete_${orderId}`).setLabel('🏁 إتمام').setStyle(ButtonStyle.Primary), new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
        try { const u = await interaction.guild.members.fetch(order.userId); await u.send(`🔄 طلبك **#${orderId}** (${order.serviceName}) قيد التنفيذ!`).catch(() => {}); } catch {}
        return;
      }

      if (cid.startsWith('order_complete_')) {
        const orderId = parseInt(cid.replace('order_complete_', '')), orders = getOrders(), order = orders.find(o => o.id === orderId);
        if (!order) return interaction.reply({ content: '❌ غير موجود', ephemeral: true });
        if (order.status !== 'progress') return interaction.reply({ content: '❌ لا يمكن الإتمام', ephemeral: true });
        order.status = 'completed'; order.completedAt = Date.now(); order.completedBy = interaction.user.id;
        save('orders.json', orders);
        await interaction.update({ embeds: [new EmbedBuilder().setTitle(`✅ طلب #${orderId} — مكتمل`).setDescription(`**العميل:** <@${order.userId}>\n**الخدمة:** ${order.serviceEmoji} ${order.serviceName}\n**الستاف:** ${interaction.user}\n\n━━━━━━━━━━━━━━━━━━━━━\n✅ **تم الإتمام!**\n<@${order.userId}> استخدم \`/review\` لتقييم الخدمة`).setColor(0x2ECC71).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
        try { const u = await interaction.guild.members.fetch(order.userId); await u.send(`✅ طلبك **#${orderId}** (${order.serviceName}) اتسلم! استخدم \`/review\` لتقييم الخدمة`).catch(() => {}); } catch {}
        return;
      }

      if (cid.startsWith('order_close_') || cid.startsWith('ticket_close_')) {
        const orderId = parseInt(cid.replace('order_close_', '').replace('ticket_close_', ''));
        const orders = getOrders(), order = orders.find(o => o.id === orderId);
        if (!order) return interaction.reply({ content: '❌ غير موجودة', ephemeral: true });
        order.status = 'closed'; order.closedAt = Date.now(); order.closedBy = interaction.user.id;
        save('orders.json', orders);
        await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔒 تذكرة مغلقة').setDescription(`**أغلقها:** ${interaction.user}`).setColor(0xE74C3C).setTimestamp()] });
        await sleep(3000); try { await interaction.channel.delete(); } catch {}
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
  client.user.setActivity('AI Services Shop', { type: ActivityType.Watching });
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
      if (ch) await ch.send({ embeds: [new EmbedBuilder().setTitle('🚨 تنبيه: هجوم محتمل!').setDescription(`**${raidData[guildId].joins.length}** أعضاء دخلوا في دقيقة واحدة! قد يكون raid.`).setColor(0xFF0000).setTimestamp()] });
    } catch {}
    await sendLog(member.guild, new EmbedBuilder().setTitle('🚨 RAID DETECTED').setDescription(`${raidData[guildId].joins.length} joins in 1 minute!`).setColor(0xFF0000).setTimestamp());
  }

  // Welcome
  try {
    const g = member.guild;
    const ch = g.channels.cache.find(c => c.name.includes('الترحيب') && c.isTextBased());
    if (!ch) return;
    const embed = new EmbedBuilder()
      .setTitle(`مرحباً ${member.user.username}! 🎉`)
      .setDescription(`━━━━━━━━━━━━━━━━━━━━━\n\n**اهلاً وسهلاً بك في ${g.name}!** 🚀\n\nأنت العضو رقم **${g.memberCount}**\n\n━━━━━━━━━━━━━━━━━━━━━\n\n**📦 ابدأ هنا:**\n> 🛒 اختر خدمة من القائمة\n> ⭐ قيّم بـ \`/review\`\n\n━━━━━━━━━━━━━━━━━━━━━`)
      .setColor(0x2ECC71).setTimestamp().setFooter({ text: `${g.name} • ${g.memberCount} عضو` });
    try { const av = member.user.displayAvatarURL({ dynamic: true, size: 256 }); if (av) embed.setThumbnail(av); } catch {}
    await ch.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
  } catch {}
});

client.on('guildMemberRemove', async (member) => {
  await sendLog(member.guild, new EmbedBuilder().setTitle('👋 عضو غادر').setDescription(`**${member.user.tag}** (${member.user.id})`).setColor(0xF39C12).setTimestamp());
});

client.on('messageCreate', async (message) => {
  if (message.author.bot || !message.guild) return;

  // Anti-spam
  if (checkSpam(message.author.id)) {
    try { await message.delete(); } catch {}
    const member = await message.guild.members.fetch(message.author.id).catch(() => null);
    if (member?.moderatable) {
      await member.timeout(60000, 'Spam');
      await message.channel.send({ content: `🔇 ${message.author} تم كتمه لمدة دقيقة (سبام)` }).catch(() => {});
      await sendLog(message.guild, new EmbedBuilder().setTitle('🔇 Auto-Mute: Spam').setDescription(`**العضو:** ${message.author}\n**القناة:** ${message.channel}`).setColor(0x9B59B6).setTimestamp());
    }
    return;
  }

  // Bad words
  if (checkBadWords(message.content)) {
    try { await message.delete(); } catch {}
    await message.channel.send({ content: `🚫 ${message.author} الرسالة تحتوي على كلمة ممنوعة` }).catch(() => {});
    await sendLog(message.guild, new EmbedBuilder().setTitle('🚫 Bad Word Detected').setDescription(`**العضو:** ${message.author}\n**القناة:** ${message.channel}\n**المحتوى:** ${safe(message.content, 200)}`).setColor(0xE74C3C).setTimestamp());
  }
});

client.on('messageDelete', async (message) => {
  if (message.author?.bot || !message.guild) return;
  await sendLog(message.guild, new EmbedBuilder().setTitle('🗑️ رسالة محذوفة').setDescription(`**الكاتب:** ${message.author}\n**القناة:** ${message.channel}\n**المحتوى:** ${safe(message.content, 500)}`).setColor(0xF39C12).setTimestamp());
});

client.on('messageUpdate', async (old, newMsg) => {
  if (old.author?.bot || !old.guild || !old.content) return;
  if (old.content === newMsg.content) return;
  await sendLog(old.guild, new EmbedBuilder().setTitle('✏️ رسالة عُدّلت').setDescription(`**الكاتب:** ${old.author}\n**القناة:** ${old.channel}\n**قبل:** ${safe(old.content, 300)}\n**بعد:** ${safe(newMsg.content, 300)}`).setColor(0x3498DB).setTimestamp());
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
    if (req.method === 'GET' && (p === '/api/health' || p === '/')) return jsonRes(res, 200, { status: 'ok', uptime: process.uptime() });
    const guild = client.guilds.cache.first();
    if (!guild && p !== '/api/health' && p !== '/api/bot') return jsonRes(res, 500, { error: 'No guild' });

    // ── GET ──
    if (req.method === 'GET' && p === '/api/bot') return jsonRes(res, 200, { id: client.user?.id, username: client.user?.username, avatar: client.user?.displayAvatarURL({ dynamic: true, size: 256 }) });
    if (req.method === 'GET' && p === '/api/guild') return jsonRes(res, 200, { id: guild.id, name: guild.name, icon: guild.iconURL({ dynamic: true, size: 256 }), memberCount: guild.memberCount, ownerId: guild.ownerId, boostCount: guild.premiumSubscriptionCount || 0, createdAt: guild.createdAt?.toISOString() });
    if (req.method === 'GET' && p === '/api/stats') return jsonRes(res, 200, { orders: getOrders().length, completed: getOrders().filter(o => o.status === 'completed').length, reviews: getReviews().length, services: getServices().filter(s => s.active).length, members: guild?.memberCount || 0, giveaways: getGiveaways().length });
    if (req.method === 'GET' && p === '/api/services') return jsonRes(res, 200, getServices());
    if (req.method === 'GET' && p === '/api/categories') return jsonRes(res, 200, getCategories());
    if (req.method === 'GET' && p === '/api/tickets') return jsonRes(res, 200, getOrders());
    if (req.method === 'GET' && p === '/api/reviews') return jsonRes(res, 200, getReviews());
    if (req.method === 'GET' && p === '/api/warnings') return jsonRes(res, 200, getWarnings());
    if (req.method === 'GET' && p === '/api/giveaways') return jsonRes(res, 200, getGiveaways());
    if (req.method === 'GET' && p === '/api/config') return jsonRes(res, 200, { autoRoles: CFG.autoRoles, logsChannel: CFG.logsChannel, automod: CFG.automod });
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
          const contactLabels = { discord: 'Discord', whatsapp: 'WhatsApp', telegram: 'Telegram', email: 'بريد إلكتروني' };
          const embed = new EmbedBuilder()
            .setTitle(`🛒 طلب من المتجر #${orderId}`)
            .setDescription(`**العميل:** ${d.name}\n**Discord:** ${d.discord}\n**طريقة التواصل:** ${contactLabels[d.contactType] || d.contactType}: ${d.contact}\n**الخدمة:** ${svc.emoji} ${svc.name}\n**الكمية:** ${parseInt(d.qty) || 1}\n**السعر:** \`${fmt(svc.price)}\` × ${parseInt(d.qty) || 1} = \`${fmt(total)}\`\n**الوصف:** ${svc.description || '—'}\n${d.notes ? `**ملاحظات:** ${d.notes}\n` : ''}━━━━━━━━━━━━━━━━━━━━━\n⏳ **في انتظار قبول الستاف...**`)
            .setColor(0xF1C40F).setTimestamp();
          await channel.send({ embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`order_accept_${orderId}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
          const invite = await channel.createInvite({ maxAge: 86400 * 7, reason: `Shop order #${orderId}` }).catch(() => null);
          const inviteUrl = invite ? `https://discord.gg/${invite.code}` : 'https://discord.gg/a85fhmx4X';
          await channel.send({ content: `👋 **مرحباً ${d.name}!**\n\n🎯 انضم للسيرفر عشان تتابع طلبك:\n${inviteUrl}\n\n💡 اكتب في التذكرة وأي حد من الستاف هيرد عليك` }).catch(() => {});
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

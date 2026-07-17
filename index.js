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

const getCategories = () => load('categories.json', [
  { id: 'chatgpt', name: '🤖 ChatGPT & AI', emoji: '🤖' },
  { id: 'image', name: '🎨 صور وتصميم', emoji: '🎨' },
  { id: 'photoshop', name: '🖌️ فوتوشوب', emoji: '🖌️' },
  { id: 'montage', name: '🎬 مونتاج', emoji: '🎬' },
  { id: 'repair', name: '🔧 تصليح وصيانة', emoji: '🔧' },
  { id: 'voice', name: '🔊 صوت', emoji: '🔊' },
  { id: 'code', name: '💻 برمجة', emoji: '💻' },
  { id: 'writing', name: '📝 كتابة', emoji: '📝' },
  { id: 'data', name: '📊 بيانات', emoji: '📊' },
  { id: 'other', name: '📦 أخرى', emoji: '📦' },
]);
const saveCategories = (cats) => save('categories.json', cats);
const getServices  = () => load('services.json', []);
const getReviews   = () => load('reviews.json', []);
const getOrders    = () => load('orders.json', []);
const getWarnings  = () => load('warnings.json', []);
const getCoins     = () => load('coins.json', []);
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

function addCoins(userId, amount) {
  const coins = getCoins();
  let entry = coins.find(c => c.userId === userId);
  if (!entry) { entry = { userId, username: '', coins: 0, totalEarned: 0 }; coins.push(entry); }
  entry.coins += amount;
  entry.totalEarned += amount;
  save('coins.json', coins);
  return entry.coins;
}

function removeCoins(userId, amount) {
  const coins = getCoins();
  let entry = coins.find(c => c.userId === userId);
  if (!entry || entry.coins < amount) return false;
  entry.coins -= amount;
  save('coins.json', coins);
  return true;
}

function getCoinsOf(userId) {
  const entry = getCoins().find(c => c.userId === userId);
  return entry ? entry.coins : 0;
}

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

  // ── Coins / Giveaway ──
  new SlashCommandBuilder().setName('coins').setDescription('عرض رصيدك')
    .addUserOption(o => o.setName('user').setDescription('عضو')),
  new SlashCommandBuilder().setName('givecoins').setDescription('إعطاء كريديت لعضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addNumberOption(o => o.setName('amount').setDescription('المبلغ').setRequired(true)),
  new SlashCommandBuilder().setName('giveaway'). setDescription('إنشاء سحبية')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('prize').setDescription('الجائزة').setRequired(true))
    .addNumberOption(o => o.setName('winners').setDescription('عدد الفائزين').setRequired(true))
    .addStringOption(o => o.setName('duration').setDescription('المدة (مثلاً 1h, 30m, 1d)').setRequired(true)),
  new SlashCommandBuilder().setName('end-giveaway').setDescription('إنهاء السحبية')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('message-id').setDescription('رسالة السحبية').setRequired(true)),

  // ── General ──
  new SlashCommandBuilder().setName('credits').setDescription('عرض أو إرسال كريديت')
    .addUserOption(o => o.setName('user').setDescription('المستخدم'))
    .addNumberOption(o => o.setName('amount').setDescription('المبلغ')),
  new SlashCommandBuilder().setName('review').setDescription('تقييم خدمة')
    .addStringOption(o => o.setName('service').setDescription('رقم الخدمة').setRequired(true))
    .addNumberOption(o => o.setName('rating').setDescription('التقييم 1-5').setRequired(true))
    .addStringOption(o => o.setName('comment').setDescription('تعليق')),
  new SlashCommandBuilder().setName('leaderboard').setDescription('ترتيب التقييمات'),
  new SlashCommandBuilder().setName('leaderboard-coins').setDescription('ترتيب الكريديت'),
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

  const defaultServices = [
    { id: 1, name: 'ChatGPT Plus 4o', description: 'وصول ChatGPT Plus 4o لمدة شهر', price: 18800000, category: 'chatgpt', emoji: '🤖', active: true, createdAt: Date.now() },
    { id: 2, name: 'ChatGPT Plus + DALL-E', description: 'ChatGPT Plus مع DALL-E', price: 22500000, category: 'chatgpt', emoji: '🎨', active: true, createdAt: Date.now() },
    { id: 3, name: 'شات Claude Pro', description: 'وصول Claude Pro لمدة شهر', price: 16500000, category: 'chatgpt', emoji: '🧠', active: true, createdAt: Date.now() },
    { id: 4, name: 'شات Gemini Advanced', description: 'وصول Gemini Advanced', price: 15000000, category: 'chatgpt', emoji: '💎', active: true, createdAt: Date.now() },
    { id: 5, name: 'Midjourney Pro', description: 'اشتراك Midjourney Pro', price: 21000000, category: 'image', emoji: '🖼️', active: true, createdAt: Date.now() },
    { id: 6, name: 'تطبيق موبايل', description: 'تطوير تطبيق موبايل بالذكاء الاصطناعي', price: 22500000, category: 'code', emoji: '📱', active: true, createdAt: Date.now() },
    { id: 7, name: 'تطوير موقع كامل', description: 'تصميم وتطوير موقع احترافي', price: 20300000, category: 'code', emoji: '🌐', active: true, createdAt: Date.now() },
    { id: 8, name: 'إنشاء فيديو AI', description: 'إنشاء فيديوهات بالذكاء الاصطناعي', price: 15000000, category: 'other', emoji: '🎬', active: true, createdAt: Date.now() },
    { id: 9, name: 'إنشاء بوت Discord', description: 'إنشاء بوت Discord مخصص', price: 11300000, category: 'code', emoji: '🤖', active: true, createdAt: Date.now() },
    { id: 10, name: 'تحليل بيانات', description: 'تحليل بيانات وتقارير', price: 9000000, category: 'data', emoji: '📊', active: true, createdAt: Date.now() },
    { id: 11, name: 'مساعدة برمجية', description: 'مساعدة في البرمجة', price: 6000000, category: 'code', emoji: '💻', active: true, createdAt: Date.now() },
    { id: 12, name: 'تصميم لوجو AI', description: 'تصميم لوجو بالذكاء الاصطناعي', price: 5300000, category: 'image', emoji: '✏️', active: true, createdAt: Date.now() },
    { id: 13, name: 'كتابة مقالات ونصوص', description: 'كتابة مقالات ونصوص', price: 4500000, category: 'writing', emoji: '📝', active: true, createdAt: Date.now() },
    { id: 14, name: 'إعداد سيرفر Discord', description: 'إعداد سيرفر Discord كامل', price: 6000000, category: 'other', emoji: '🎮', active: true, createdAt: Date.now() },
    { id: 15, name: 'ترجمة احترافية', description: 'ترجمة نصوص بأكثر من لغة', price: 3800000, category: 'writing', emoji: '🌐', active: true, createdAt: Date.now() },
    { id: 16, name: 'صوت AI — نص لكلام', description: 'تحويل النص إلى صوت', price: 3000000, category: 'voice', emoji: '🔊', active: true, createdAt: Date.now() },
    { id: 17, name: 'صوت AI — كلام لنص', description: 'تحويل الصوت إلى نص', price: 3000000, category: 'voice', emoji: '🎙️', active: true, createdAt: Date.now() },
    { id: 18, name: 'توليد صور AI', description: 'توليد صور بالذكاء الاصطناعي', price: 1500000, category: 'image', emoji: '📸', active: true, createdAt: Date.now() },
  ];
  save('services.json', defaultServices);

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
    const btn1 = new ButtonBuilder().setCustomId('open_ticket_order').setLabel('🛒 طلب خدمة').setStyle(ButtonStyle.Success);
    const btn2 = new ButtonBuilder().setCustomId('open_ticket_support').setLabel('🛠️ دعم فني').setStyle(ButtonStyle.Primary);
    await ticketCh.send({ embeds: [new EmbedBuilder().setTitle('🎫 فتح تذكرة').setDescription('━━━━━━━━━━━━━━━━━━━━━\n\n**اختر نوع التذكرة:**\n\n🛒 **طلب خدمة** — لطلب أي خدمة\n🛠️ **دعم فني** — للمساعدة والدعم\n\n━━━━━━━━━━━━━━━━━━━━━').setColor(0x9B59B6).setTimestamp()], components: [new ActionRowBuilder().addComponents(btn1, btn2)] }).catch(() => {});
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
  const id = parseInt(interaction.options.getString('service')), services = getServices(), svc = services.find(s => s.id === id);
  if (!svc) return interaction.reply({ content: '❌ خدمة غير موجودة. استخدم `/services`', ephemeral: true });
  const g = interaction.guild, orders = getOrders(), orderId = nextId(orders);
  const channel = await g.channels.create({ name: `ticket-${orderId}-${interaction.user.username}`.substring(0, 100), type: ChannelType.GuildText, parent: getTicketCat(g)?.id, permissionOverwrites: getTicketOverwrites(g, interaction.user.id) });
  const order = { id: orderId, type: 'order', serviceId: svc.id, serviceName: svc.name, serviceEmoji: svc.emoji || '🛒', servicePrice: svc.price || 0, userId: interaction.user.id, username: interaction.user.username, channelId: channel.id, status: 'pending', createdAt: Date.now() };
  orders.push(order); save('orders.json', orders);
  const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
  const embed = new EmbedBuilder().setTitle(`🎫 طلب جديد #${orderId}`).setDescription(`**العميل:** ${interaction.user}\n**الخدمة:** ${svc.emoji} ${svc.name}\n**السعر:** \`${fmt(svc.price)}\`\n**الوصف:** ${svc.description || '—'}\n\n━━━━━━━━━━━━━━━━━━━━━\n⏳ **في انتظار قبول الستاف...**`).setColor(0xF1C40F).setTimestamp();
  await channel.send({ content: `${interaction.user} | ${staffRole || ''}`, embeds: [embed], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`order_accept_${orderId}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
  await interaction.reply({ content: `✅ تم فتح التذكرة: ${channel}`, ephemeral: true });

  await sendLog(g, new EmbedBuilder().setTitle('🎫 تذكرة جديدة').setDescription(`**العميل:** ${interaction.user}\n**الخدمة:** ${svc.name}\n**القناة:** ${channel}`).setColor(0xF1C40F).setTimestamp());
}

async function cmdSupport(interaction) {
  const g = interaction.guild, orders = getOrders(), orderId = nextId(orders);
  const channel = await g.channels.create({ name: `support-${orderId}-${interaction.user.username}`.substring(0, 100), type: ChannelType.GuildText, parent: getTicketCat(g)?.id, permissionOverwrites: getTicketOverwrites(g, interaction.user.id) });
  orders.push({ id: orderId, type: 'support', serviceName: 'دعم فني', serviceEmoji: '🛠️', userId: interaction.user.id, username: interaction.user.username, channelId: channel.id, status: 'open', createdAt: Date.now() });
  save('orders.json', orders);
  const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
  await channel.send({ content: `${interaction.user} | ${staffRole || ''}`, embeds: [new EmbedBuilder().setTitle(`🛠️ تذكرة دعم #${orderId}`).setDescription(`**المستخدم:** ${interaction.user}\n\n━━━━━━━━━━━━━━━━━━━━━\n💬 **اكتب مشكلتك هنا**\n━━━━━━━━━━━━━━━━━━━━━`).setColor(0x3498DB).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
  await interaction.reply({ content: `✅ تم فتح تذكرة الدعم: ${channel}`, ephemeral: true });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('🛠️ تذكرة دعم جديدة').setDescription(`**المستخدم:** ${interaction.user}\n**القناة:** ${channel}`).setColor(0x3498DB).setTimestamp());
}

async function cmdClose(interaction) {
  const orders = getOrders(), order = orders.find(o => o.channelId === interaction.channel.id);
  if (!order) return interaction.reply({ content: '❌ هذا ليس تذكرة', ephemeral: true });
  order.status = 'closed'; order.closedAt = Date.now(); order.closedBy = interaction.user.id;
  save('orders.json', orders);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🔒 تذكرة مغلقة').setDescription(`**أغلقها:** ${interaction.user}`).setColor(0xE74C3C).setTimestamp()] });
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
//  HANDLERS: CREDITS / COINS / REVIEW / LEADERBOARD
// ══════════════════════════════════════════════════════════════
async function cmdCredits(interaction) {
  const user = interaction.options.getUser('user') || interaction.user, amount = interaction.options.getNumber('amount');
  if (amount && interaction.user.id === user.id) return interaction.reply({ content: '❌ لا تقدر تبعت لنفسك', ephemeral: true });
  if (amount) {
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('💰 تحويل كريديت').setDescription(`استخدم:\n\`/credits ${user} ${amount}\``).setColor(0x3498DB).setTimestamp()], ephemeral: true });
  } else {
    await interaction.reply({ embeds: [new EmbedBuilder().setTitle('💰 الكريديت').setDescription(`**${user.username}** — استخدم أمر **ProBot**:\n\`/credits\``).setColor(0x2ECC71).setTimestamp()], ephemeral: true });
  }
}

async function cmdCoins(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const coins = getCoinsOf(user.id);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('💰 الكريديت').setDescription(`**${user.username}** — \`${fmt(coins)}\` كريديت`).setColor(0xF1C40F).setTimestamp()], ephemeral: true });
}

async function cmdGiveCoins(interaction) {
  const user = interaction.options.getUser('user'), amount = interaction.options.getNumber('amount');
  addCoins(user.id, amount);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('💰 تم الإعطاء').setDescription(`**${user}** حصل على \`${fmt(amount)}\` كريديت`).setColor(0x2ECC71).setTimestamp()], ephemeral: true });
  await sendLog(interaction.guild, new EmbedBuilder().setTitle('💰 كريديت جديد').setDescription(`**بواسطة:** ${interaction.user}\n**لـ:** ${user}\n**المبلغ:** \`${fmt(amount)}\``).setColor(0x2ECC71).setTimestamp());
}

async function cmdLeaderboardCoins(interaction) {
  const coins = getCoins().filter(c => c.coins > 0).sort((a, b) => b.coins - a.coins).slice(0, 10);
  if (!coins.length) return interaction.reply({ content: '📭 لا يوجد كريديت بعد', ephemeral: true });
  const medals = ['🥇', '🥈', '🥉'];
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('💰 ترتيب الكريديت').setDescription(coins.map((c, i) => `${medals[i] || `**${i + 1}.**`} <@${c.userId}> — \`${fmt(c.coins)}\``).join('\n')).setColor(0xFFD700).setTimestamp()] });
}

async function cmdReview(interaction) {
  const id = parseInt(interaction.options.getString('service')), rating = interaction.options.getNumber('rating'), comment = interaction.options.getString('comment') || '';
  const services = getServices(), svc = services.find(s => s.id === id);
  if (!svc) return interaction.reply({ content: '❌ خدمة غير موجودة', ephemeral: true });
  if (rating < 1 || rating > 5) return interaction.reply({ content: '❌ التقييم من 1 لـ 5', ephemeral: true });
  const reviews = getReviews();
  reviews.push({ id: nextId(reviews), serviceId: id, serviceName: svc.name, userId: interaction.user.id, username: interaction.user.username, rating, comment, createdAt: Date.now() });
  save('reviews.json', reviews);
  addCoins(interaction.user.id, 10);
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('⭐ تم التقييم').setDescription(`**الخدمة:** ${svc.emoji} ${svc.name}\n**التقييم:** ${'★'.repeat(rating) + '☆'.repeat(5 - rating)}\n**التعليق:** ${comment || '—'}\n\n💰 حصلت على **10 كريديت**`).setColor(0xF1C40F).setTimestamp()] });
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
  const orders = getOrders(), reviews = getReviews(), coins = getCoins(), services = getServices();
  const completed = orders.filter(o => o.status === 'completed').length;
  const pending = orders.filter(o => o.status === 'pending' || o.status === 'open' || o.status === 'progress').length;
  const totalRevenue = coins.reduce((sum, c) => sum + (c.totalEarned || 0), 0);
  const embed = new EmbedBuilder()
    .setTitle('📊 إحصائيات البوت')
    .addFields(
      { name: '🎫 الطلبات', value: `**إجمالي:** ${orders.length}\n**مكتملة:** ${completed}\n**قيد التنفيذ:** ${pending}`, inline: true },
      { name: '⭐ التقييمات', value: `**إجمالي:** ${reviews.length}`, inline: true },
      { name: '🛒 الخدمات', value: `**إجمالي:** ${services.length}`, inline: true },
      { name: '💰 الكريديت', value: `**إجمالي:** \`${fmt(totalRevenue)}\``, inline: true },
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
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle(`👤 ${user.username}`).setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 })).addFields({ name: '🆔 ID', value: user.id, inline: true }, { name: '📅 الحساب', value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`, inline: true }, { name: '📥 دخل', value: member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : '—', inline: true }, { name: '⚠️ تحذيرات', value: `${warns}`, inline: true }, { name: '💰 كريديت', value: `\`${fmt(getCoinsOf(user.id))}\``, inline: true }).setColor(0x3498DB).setTimestamp()] });
}

async function cmdHelp(interaction) {
  await interaction.reply({ embeds: [new EmbedBuilder().setTitle('🤖 أوامر البوت').addFields(
    { name: '📦 عامة', value: '`/services` `/order` `/support` `/close` `/credits` `/coins` `/review` `/leaderboard` `/leaderboard-coins` `/server-info` `/user-info` `/stats` `/ticket-stats` `/top-customers` `/help`' },
    { name: '🛡️ إدارية', value: '`/setup` `/add-service` `/edit-service` `/remove-service` `/add-category` `/remove-category` `/list-categories` `/announce` `/auto-role` `/set-logs` `/automod` `/givecoins` `/giveaway` `/end-giveaway`' },
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
        setup: cmdSetup, services: cmdServices, credits: cmdCredits, coins: cmdCoins, givecoins: cmdGiveCoins,
        review: cmdReview, leaderboard: cmdLeaderboard, 'leaderboard-coins': cmdLeaderboardCoins,
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
      const embed = new EmbedBuilder().setTitle(`${svc.emoji || '🛒'} ${svc.name}`).setDescription(svc.description).addFields({ name: '💰 السعر', value: `\`${fmt(svc.price)}\``, inline: true }, { name: '📂 التصنيف', value: svc.category, inline: true }).setColor(0x3498DB).setTimestamp();
      const btn = new ButtonBuilder().setCustomId(`svc_order_${svc.id}`).setLabel('🛒 اطلب الآن').setStyle(ButtonStyle.Success);
      await interaction.reply({ embeds: [embed], components: [new ActionRowBuilder().addComponents(btn)], ephemeral: true });
      return;
    }

    if (interaction.isButton()) {
      const cid = interaction.customId;

      if (cid.startsWith('svc_order_')) {
        const id = parseInt(cid.replace('svc_order_', ''));
        await interaction.deferReply({ ephemeral: true });
        const services = getServices(), svc = services.find(s => s.id === id);
        if (!svc) return interaction.editReply('❌ خدمة غير موجودة');
        const g = interaction.guild, orders = getOrders(), orderId = nextId(orders);
        const channel = await g.channels.create({ name: `ticket-${orderId}-${interaction.user.username}`.substring(0, 100), type: ChannelType.GuildText, parent: getTicketCat(g)?.id, permissionOverwrites: getTicketOverwrites(g, interaction.user.id) });
        orders.push({ id: orderId, type: 'order', serviceId: svc.id, serviceName: svc.name, serviceEmoji: svc.emoji || '🛒', servicePrice: svc.price || 0, userId: interaction.user.id, username: interaction.user.username, channelId: channel.id, status: 'pending', createdAt: Date.now() });
        save('orders.json', orders);
        const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
        await channel.send({ content: `${interaction.user} | ${staffRole || ''}`, embeds: [new EmbedBuilder().setTitle(`🎫 طلب جديد #${orderId}`).setDescription(`**العميل:** ${interaction.user}\n**الخدمة:** ${svc.emoji} ${svc.name}\n**السعر:** \`${fmt(svc.price)}\`\n\n━━━━━━━━━━━━━━━━━━━━━\n⏳ **في انتظار قبول الستاف...**`).setColor(0xF1C40F).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`order_accept_${orderId}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
        await interaction.editReply(`✅ تم فتح التذكرة: ${channel}`);
        await sendLog(g, new EmbedBuilder().setTitle('🎫 طلب جديد').setDescription(`**العميل:** ${interaction.user}\n**الخدمة:** ${svc.name}\n**القناة:** ${channel}`).setColor(0xF1C40F).setTimestamp());
        const staffCh = g.channels.cache.find(c => c.name.includes('العامة') && c.isTextBased());
        if (staffCh) await staffCh.send({ content: `${staffRole || ''} — طلب جديد: **${svc.name}** من ${interaction.user}` }).catch(() => {});
        return;
      }

      if (cid === 'open_ticket_order') {
        const g = interaction.guild, services = getServices().filter(s => s.active);
        if (!services.length) return interaction.reply({ content: '📭 لا توجد خدمات', ephemeral: true });
        const select = new StringSelectMenuBuilder().setCustomId('ticket_service_select').setPlaceholder('🛒 اختر الخدمة...').addOptions(services.slice(0, 25).map(s => ({ label: `${s.emoji || '🛒'} ${s.name}`.substring(0, 100), description: `${fmt(s.price)} كريديت`.substring(0, 100), value: String(s.id) })));
        await interaction.reply({ content: '🛒 **اختر الخدمة:**', components: [new ActionRowBuilder().addComponents(select)], ephemeral: true });
        return;
      }

      if (cid === 'ticket_service_select') {
        const id = parseInt(interaction.values[0]);
        const services = getServices(), svc = services.find(s => s.id === id);
        if (!svc) return interaction.reply({ content: '❌ غير موجودة', ephemeral: true });
        await interaction.deferReply({ ephemeral: true });
        const g = interaction.guild, orders = getOrders(), orderId = nextId(orders);
        const channel = await g.channels.create({ name: `ticket-${orderId}-${interaction.user.username}`.substring(0, 100), type: ChannelType.GuildText, parent: getTicketCat(g)?.id, permissionOverwrites: getTicketOverwrites(g, interaction.user.id) });
        orders.push({ id: orderId, type: 'order', serviceId: svc.id, serviceName: svc.name, serviceEmoji: svc.emoji || '🛒', servicePrice: svc.price || 0, userId: interaction.user.id, username: interaction.user.username, channelId: channel.id, status: 'pending', createdAt: Date.now() });
        save('orders.json', orders);
        const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
        await channel.send({ content: `${interaction.user} | ${staffRole || ''}`, embeds: [new EmbedBuilder().setTitle(`🎫 طلب #${orderId}`).setDescription(`**العميل:** ${interaction.user}\n**الخدمة:** ${svc.emoji} ${svc.name}\n**السعر:** \`${fmt(svc.price)}\`\n\n⏳ **في انتظار القبول...**`).setColor(0xF1C40F).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`order_accept_${orderId}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success), new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
        await interaction.editReply(`✅ تم فتح التذكرة: ${channel}`);
        return;
      }

      if (cid === 'open_ticket_support') {
        await interaction.deferReply({ ephemeral: true });
        const g = interaction.guild, orders = getOrders(), orderId = nextId(orders);
        const channel = await g.channels.create({ name: `support-${orderId}-${interaction.user.username}`.substring(0, 100), type: ChannelType.GuildText, parent: getTicketCat(g)?.id, permissionOverwrites: getTicketOverwrites(g, interaction.user.id) });
        orders.push({ id: orderId, type: 'support', serviceName: 'دعم فني', serviceEmoji: '🛠️', userId: interaction.user.id, username: interaction.user.username, channelId: channel.id, status: 'open', createdAt: Date.now() });
        save('orders.json', orders);
        const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
        await channel.send({ content: `${interaction.user} | ${staffRole || ''}`, embeds: [new EmbedBuilder().setTitle(`🛠️ تذكرة دعم #${orderId}`).setDescription(`**المستخدم:** ${interaction.user}\n\n💬 **اكتب مشكلتك هنا**`).setColor(0x3498DB).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`ticket_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
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
        addCoins(order.userId, 50);
        await interaction.update({ embeds: [new EmbedBuilder().setTitle(`✅ طلب #${orderId} — مكتمل`).setDescription(`**العميل:** <@${order.userId}>\n**الخدمة:** ${order.serviceEmoji} ${order.serviceName}\n**الستاف:** ${interaction.user}\n\n━━━━━━━━━━━━━━━━━━━━━\n✅ **تم الإتمام!**\n<@${order.userId}> استخدم \`/review\` + حصلت على **50 كريديت**`).setColor(0x2ECC71).setTimestamp()], components: [new ActionRowBuilder().addComponents(new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger))] });
        try { const u = await interaction.guild.members.fetch(order.userId); await u.send(`✅ طلبك **#${orderId}** (${order.serviceName}) اتسلم! استخدم \`/review\` لتقييم الخدمة + حصلت على **50 كريديت**`).catch(() => {}); } catch {}
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
      .setDescription(`━━━━━━━━━━━━━━━━━━━━━\n\n**اهلاً وسهلاً بك في ${g.name}!** 🚀\n\nأنت العضو رقم **${g.memberCount}**\n\n━━━━━━━━━━━━━━━━━━━━━\n\n**📦 ابدأ هنا:**\n> 🛒 اختر خدمة من القائمة\n> 💰 رصيدك: \`${fmt(getCoinsOf(member.user.id))}\`\n> ⭐ قيّم بـ \`/review\`\n\n━━━━━━━━━━━━━━━━━━━━━`)
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

  // Coins for activity
  if (message.content.length > 5) {
    addCoins(message.author.id, 1);
  }

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
//  HTTP API
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

    if (req.method === 'GET' && p === '/api/bot') return jsonRes(res, 200, { id: client.user?.id, username: client.user?.username, avatar: client.user?.displayAvatarURL({ dynamic: true, size: 256 }) });
    if (req.method === 'GET' && p === '/api/guild') return jsonRes(res, 200, { id: guild.id, name: guild.name, icon: guild.iconURL({ dynamic: true, size: 256 }), memberCount: guild.memberCount, ownerId: guild.ownerId, boostCount: guild.premiumSubscriptionCount || 0 });
    if (req.method === 'GET' && p === '/api/stats') return jsonRes(res, 200, { orders: getOrders().length, completed: getOrders().filter(o => o.status === 'completed').length, reviews: getReviews().length, services: getServices().filter(s => s.active).length, coins: getCoins().reduce((s, c) => s + (c.coins || 0), 0), members: guild?.memberCount || 0, giveaways: getGiveaways().length });
    if (req.method === 'GET' && p === '/api/services') return jsonRes(res, 200, getServices());
    if (req.method === 'GET' && p === '/api/tickets') return jsonRes(res, 200, getOrders());
    if (req.method === 'GET' && p === '/api/reviews') return jsonRes(res, 200, getReviews());
    if (req.method === 'GET' && p === '/api/coins') return jsonRes(res, 200, getCoins());
    if (req.method === 'GET' && p === '/api/warnings') return jsonRes(res, 200, getWarnings());

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

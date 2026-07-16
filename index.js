const {
  Client, GatewayIntentBits, Partials, EmbedBuilder, ActionRowBuilder,
  ButtonBuilder, ButtonStyle, ChannelType, PermissionFlagsBits,
  SlashCommandBuilder, ModalBuilder, TextInputBuilder, TextInputStyle,
  StringSelectMenuBuilder,
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
if (!CFG.welcomeMessage) CFG.welcomeMessage = '';
if (!CFG.welcomeChannel) CFG.welcomeChannel = '';
save('config.json', CFG);

const getServices = () => load('services.json', []);
const getReviews  = () => load('reviews.json', []);
const getOrders   = () => load('orders.json', []);
const getWarnings = () => load('warnings.json', []);

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
  for (const item of arr) {
    const id = Number(item.id) || 0;
    if (id > mx) mx = id;
  }
  return mx + 1;
}

function timestamp() {
  return `<t:${Math.floor(Date.now() / 1000)}:R>`;
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
//  SLASH COMMANDS
// ══════════════════════════════════════════════════════════════
const COMMANDS = [
  // ── Admin ──
  new SlashCommandBuilder()
    .setName('setup').setDescription('إعداد السيرفر بالكامل')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
  new SlashCommandBuilder()
    .setName('add-service').setDescription('إضافة خدمة جديدة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('name').setDescription('اسم الخدمة').setRequired(true))
    .addStringOption(o => o.setName('description').setDescription('الوصف').setRequired(true))
    .addNumberOption(o => o.setName('price').setDescription('السعر').setRequired(true))
    .addStringOption(o => o.setName('category').setDescription('التصنيف').setRequired(true)
      .addChoices(
        { name: 'ChatGPT', value: 'chatgpt' },
        { name: 'Image', value: 'image' },
        { name: 'Voice', value: 'voice' },
        { name: 'Code', value: 'code' },
        { name: 'Writing', value: 'writing' },
        { name: 'Data', value: 'data' },
        { name: 'Other', value: 'other' },
      ))
    .addStringOption(o => o.setName('emoji').setDescription('إيموجي')),
  new SlashCommandBuilder()
    .setName('remove-service').setDescription('حذف خدمة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('id').setDescription('رقم الخدمة').setRequired(true)),
  new SlashCommandBuilder()
    .setName('edit-service').setDescription('تعديل خدمة')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('id').setDescription('رقم الخدمة').setRequired(true))
    .addStringOption(o => o.setName('name').setDescription('اسم جديد'))
    .addNumberOption(o => o.setName('price').setDescription('سعر جديد'))
    .addStringOption(o => o.setName('description').setDescription('وصف جديد')),
  new SlashCommandBuilder()
    .setName('announce').setDescription('إرسال إعلان')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addStringOption(o => o.setName('title').setDescription('العنوان').setRequired(true))
    .addStringOption(o => o.setName('content').setDescription('المحتوى').setRequired(true))
    .addStringOption(o => o.setName('emoji').setDescription('إيموجي')),
  new SlashCommandBuilder()
    .setName('auto-role').setDescription('إدارة الرولات التلقائية')
    .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
    .addSubcommand(sub => sub.setName('add').setDescription('إضافة رول تلقائي')
      .addRoleOption(o => o.setName('role').setDescription('الرول').setRequired(true)))
    .addSubcommand(sub => sub.setName('remove').setDescription('حذف رول تلقائي')
      .addRoleOption(o => o.setName('role').setDescription('الرول').setRequired(true)))
    .addSubcommand(sub => sub.setName('list').setDescription('عرض القائمة'))
    .addSubcommand(sub => sub.setName('clear').setDescription('مسح كل الرولات')),

  // ── Moderation ──
  new SlashCommandBuilder()
    .setName('ban').setDescription('حظر عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.BanMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب')),
  new SlashCommandBuilder()
    .setName('kick').setDescription('طرد عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.KickMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب')),
  new SlashCommandBuilder()
    .setName('mute').setDescription('كتم عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addNumberOption(o => o.setName('minutes').setDescription('المدة بالدقائق').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب')),
  new SlashCommandBuilder()
    .setName('unmute').setDescription('إلغاء كتم عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),
  new SlashCommandBuilder()
    .setName('warn').setDescription('تحذير عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true))
    .addStringOption(o => o.setName('reason').setDescription('السبب').setRequired(true)),
  new SlashCommandBuilder()
    .setName('warnings').setDescription('عرض تحذيرات عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),
  new SlashCommandBuilder()
    .setName('clear-warnings').setDescription('مسح تحذيرات عضو')
    .setDefaultMemberPermissions(PermissionFlagsBits.ModerateMembers)
    .addUserOption(o => o.setName('user').setDescription('العضو').setRequired(true)),
  new SlashCommandBuilder()
    .setName('purge').setDescription('مسح رسائل')
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageMessages)
    .addNumberOption(o => o.setName('amount').setDescription('عدد الرسائل').setRequired(true)),

  // ── Shop ──
  new SlashCommandBuilder()
    .setName('services').setDescription('عرض كل الخدمات'),
  new SlashCommandBuilder()
    .setName('order').setDescription('طلب خدمة')
    .addStringOption(o => o.setName('service').setDescription('رقم الخدمة').setRequired(true)),
  new SlashCommandBuilder()
    .setName('support').setDescription('فتح تذكرة دعم فني'),
  new SlashCommandBuilder()
    .setName('close').setDescription('إغلاق التذكرة الحالية'),

  // ── General ──
  new SlashCommandBuilder()
    .setName('credits').setDescription('عرض أو إرسال كريديت')
    .addUserOption(o => o.setName('user').setDescription('المستخدم'))
    .addNumberOption(o => o.setName('amount').setDescription('المبلغ')),
  new SlashCommandBuilder()
    .setName('review').setDescription('تقييم خدمة')
    .addStringOption(o => o.setName('service').setDescription('رقم الخدمة').setRequired(true))
    .addNumberOption(o => o.setName('rating').setDescription('التقييم 1-5').setRequired(true))
    .addStringOption(o => o.setName('comment').setDescription('تعليق')),
  new SlashCommandBuilder()
    .setName('leaderboard').setDescription('ترتيب أعلى المستخدمين'),
  new SlashCommandBuilder()
    .setName('server-info').setDescription('معلومات السيرفر'),
  new SlashCommandBuilder()
    .setName('user-info').setDescription('معلومات عضو')
    .addUserOption(o => o.setName('user').setDescription('العضو')),
  new SlashCommandBuilder()
    .setName('help').setDescription('عرض كل الأوامر'),
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
    try {
      roles[rd.k] = await g.roles.create({ name: rd.n, color: rd.c, permissions: rd.p });
      log.push(`✅ ${rd.n}`);
    } catch { log.push(`❌ ${rd.n}`); }
    await sleep(600);
  }

  const noSend = [{ id: g.id, deny: [PermissionFlagsBits.SendMessages] }];
  const full   = [{ id: g.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] }];

  const structure = [
    { n: '╔════════ 🏪 المتجر ════════', chs: [
      { n: '🛒・الخدمات', p: full },
      { n: '📝・كيف-تطلب', p: noSend },
      { n: '⭐・التقييمات', p: [{ id: g.id, deny: [PermissionFlagsBits.SendMessages] }, ...(roles.customer ? [{ id: roles.customer.id, allow: [PermissionFlagsBits.SendMessages] }] : [])] },
    ]},
    { n: '╔════════ 📢 الإعلانات ════════', chs: [
      { n: '📣・الإعلانات', p: noSend },
      { n: '📋・القواعد', p: noSend },
    ]},
    { n: '╔════════ 💬 الدردشة ════════', chs: [
      { n: '💬・العامة', p: full },
      { n: '🤖・اوامر-البوت', p: full },
    ]},
    { n: '╔════════ 📌 معلومات ════════', chs: [
      { n: '📊・حالة-السيرفر', p: noSend },
      { n: '👋・الترحيب', p: noSend },
    ]},
    { n: '╔════════ 🎫 التذاكر ════════', chs: [
      { n: '🎫・فتح-تذكرة', p: full },
    ]},
  ];

  for (const cat of structure) {
    try {
      const c = await g.channels.create({ name: cat.n, type: ChannelType.GuildCategory });
      log.push(`✅ ${cat.n}`);
      for (const ch of cat.chs) {
        try {
          await g.channels.create({ name: ch.n, type: ChannelType.GuildText, parent: c.id, permissionOverwrites: ch.p });
          log.push(`✅ ${ch.n}`);
        } catch { log.push(`❌ ${ch.n}`); }
        await sleep(600);
      }
    } catch { log.push(`❌ كاتيقوري`); }
    await sleep(600);
  }

  await sleep(1500);
  try { await g.channels.fetch(); } catch {}

  const defaultServices = [
    { id: 1, name: 'ChatGPT Plus 4o', description: 'وصول ChatGPT Plus 4o لمدة شهر', price: 18800000, category: 'chatgpt', emoji: '🤖', active: true, createdAt: Date.now() },
    { id: 2, name: 'ChatGPT Plus + DALL-E', description: 'ChatGPT Plus مع DALL-E', price: 22500000, category: 'chatgpt', emoji: '🎨', active: true, createdAt: Date.now() },
    { id: 3, name: 'شات Claude Pro', description: 'وصول Claude Pro لمدة شهر', price: 16500000, category: 'chatgpt', emoji: '🧠', active: true, createdAt: Date.now() },
    { id: 4, name: 'شات Gemini Advanced', description: 'وصول Gemini Advanced لمدة شهر', price: 15000000, category: 'chatgpt', emoji: '💎', active: true, createdAt: Date.now() },
    { id: 5, name: 'Midjourney Pro', description: 'اشتراك Midjourney Pro', price: 21000000, category: 'image', emoji: '🖼️', active: true, createdAt: Date.now() },
    { id: 6, name: 'تطبيق موبايل', description: 'تطوير تطبيق موبايل بالذكاء الاصطناعي', price: 22500000, category: 'code', emoji: '📱', active: true, createdAt: Date.now() },
    { id: 7, name: 'تطوير موقع كامل', description: 'تصميم وتطوير موقع احترافي', price: 20300000, category: 'code', emoji: '🌐', active: true, createdAt: Date.now() },
    { id: 8, name: 'إنشاء فيديو AI', description: 'إنشاء فيديوهات بالذكاء الاصطناعي', price: 15000000, category: 'other', emoji: '🎬', active: true, createdAt: Date.now() },
    { id: 9, name: 'إنشاء بوت Discord', description: 'إنشاء بوت Discord مخصص', price: 11300000, category: 'code', emoji: '🤖', active: true, createdAt: Date.now() },
    { id: 10, name: 'تحليل بيانات', description: 'تحليل بيانات وتقارير', price: 9000000, category: 'data', emoji: '📊', active: true, createdAt: Date.now() },
    { id: 11, name: 'مساعدة برمجية', description: 'مساعدة في البرمجة', price: 6000000, category: 'code', emoji: '💻', active: true, createdAt: Date.now() },
    { id: 12, name: 'تصميم لوجو AI', description: 'تصميم لوجو بالذكاء الاصطناعي', price: 5300000, category: 'image', emoji: '✏️', active: true, createdAt: Date.now() },
    { id: 13, name: 'كتابة مقالات ونصوص', description: 'كتابة مقالات ونصوص احترافية', price: 4500000, category: 'writing', emoji: '📝', active: true, createdAt: Date.now() },
    { id: 14, name: 'إعداد سيرفر Discord', description: 'إعداد سيرفر Discord كامل', price: 6000000, category: 'other', emoji: '🎮', active: true, createdAt: Date.now() },
    { id: 15, name: 'ترجمة احترافية', description: 'ترجمة نصوص بأكثر من لغة', price: 3800000, category: 'writing', emoji: '🌐', active: true, createdAt: Date.now() },
    { id: 16, name: 'صوت AI — نص لكلام', description: 'تحويل النص إلى صوت', price: 3000000, category: 'voice', emoji: '🔊', active: true, createdAt: Date.now() },
    { id: 17, name: 'صوت AI — كلام لنص', description: 'تحويل الصوت إلى نص', price: 3000000, category: 'voice', emoji: '🎙️', active: true, createdAt: Date.now() },
    { id: 18, name: 'توليد صور AI', description: 'توليد صور بالذكاء الاصطناعي', price: 1500000, category: 'image', emoji: '📸', active: true, createdAt: Date.now() },
  ];
  save('services.json', defaultServices);

  const svcCh = g.channels.cache.find(c => c.name.includes('الخدمات') && c.isTextBased());
  if (svcCh) {
    const e = new EmbedBuilder()
      .setTitle('🤖 مرحباً بك في متجر الذكاء الاصطناعي')
      .setDescription(
        '━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '**مرحباً بك في أفضل متجر لخدمات الذكاء الاصطناعي!** 🚀\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '**💡 كيف تطلب؟**\n\n' +
        '> `1️⃣` اضغط الزر أسفله لفتح تذكرة\n' +
        '> `2️⃣` اختر الخدمة اللي تبيها\n' +
        '> `3️⃣` الستاف هيساعدك\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━'
      )
      .setColor(0xFF0000)
      .setTimestamp()
      .setFooter({ text: '🛍️ AI Shop Bot' });
    const btn = new ButtonBuilder().setCustomId('open_ticket').setLabel('🎫 افتح تذكرة').setStyle(ButtonStyle.Success);
    await svcCh.send({ embeds: [e], components: [new ActionRowBuilder().addComponents(btn)] }).catch(() => {});
  }

  const rulesCh = g.channels.cache.find(c => c.name.includes('القواعد') && c.isTextBased());
  if (rulesCh) {
    const e = new EmbedBuilder()
      .setTitle('📋 قواعد السيرفر')
      .setDescription('━━━━━━━━━━━━━━━━━━━━━\n\n**1.** 🤝 احترام الجميع\n**2.** 🚫 لا محتوى مخالف\n**3.** 💰 الدفع مقدماً\n**4.** 🔒 لا تشارك حساباتك\n**5.** 👑 اتبع الادمن\n\n━━━━━━━━━━━━━━━━━━━━━')
      .setColor(0xFFB900).setTimestamp();
    await rulesCh.send({ embeds: [e] }).catch(() => {});
  }

  const howCh = g.channels.cache.find(c => c.name.includes('كيف-تطلب') && c.isTextBased());
  if (howCh) {
    const e = new EmbedBuilder()
      .setTitle('📝 دليل طلب الخدمة')
      .setDescription('**Step 1** 🛒 اكتب `/services` لعرض الخدمات\n**Step 2** 📋 راجع الخدمات والأسعار\n**Step 3** 💬 تواصل مع الستاف\n**Step 4** 💰 ادفع\n**Step 5** ✅ استلم وقيّم بـ `/review`')
      .setColor(0x2ECC71).setTimestamp();
    await howCh.send({ embeds: [e] }).catch(() => {});
  }

  const ticketCh = g.channels.cache.find(c => c.name.includes('فتح-تذكرة') && c.isTextBased());
  if (ticketCh) {
    const e = new EmbedBuilder()
      .setTitle('🎫 فتح تذكرة')
      .setDescription('━━━━━━━━━━━━━━━━━━━━━\n\n**لطلب خدمة:** اكتب `/order رقم-الخدمة`\n**للدعم الفني:** اكتب `/support`\n\n━━━━━━━━━━━━━━━━━━━━━\n\n**💡 ملاحظة:** كل تذكرة خاصة بك فقط\n\n━━━━━━━━━━━━━━━━━━━━━')
      .setColor(0x9B59B6).setTimestamp().setFooter({ text: '🎫 Ticket System' });
    await ticketCh.send({ embeds: [e] }).catch(() => {});
  }

  await interaction.editReply(`✅ تم الإعداد!\n\n${log.join('\n')}`);
}

// ══════════════════════════════════════════════════════════════
//  HANDLER: SERVICES
// ══════════════════════════════════════════════════════════════
async function cmdServices(interaction) {
  const services = getServices().filter(s => s.active);
  if (!services.length) return interaction.reply({ content: '📭 لا توجد خدمات حالياً', ephemeral: true });

  const cats = {};
  const catNames = {
    chatgpt: '🤖 ChatGPT & AI', image: '🎨 صور', voice: '🔊 صوت',
    code: '💻 برمجة', writing: '📝 كتابة', data: '📊 بيانات', other: '📦 أخرى',
  };
  for (const s of services) {
    const cat = s.category || 'other';
    if (!cats[cat]) cats[cat] = [];
    cats[cat].push(s);
  }

  const embed = new EmbedBuilder()
    .setTitle('🛒 الخدمات المتاحة')
    .setDescription('تواصل مع الستاف لطلب أي خدمة')
    .setColor(0xFF0000).setTimestamp()
    .setFooter({ text: `${services.length} خدمة متاحة` });

  for (const [cat, items] of Object.entries(cats)) {
    const val = items.map(s => `${s.emoji || '🛒'} **${safe(s.name, 40)}** — \`${fmt(s.price)}\``).join('\n');
    embed.addFields({ name: catNames[cat] || cat, value: val || '—' });
  }

  await interaction.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════════
//  HANDLER: ADD / EDIT / REMOVE SERVICE
// ══════════════════════════════════════════════════════════════
async function cmdAddService(interaction) {
  const name     = interaction.options.getString('name');
  const desc     = interaction.options.getString('description');
  const price    = interaction.options.getNumber('price');
  const category = interaction.options.getString('category');
  const emoji    = interaction.options.getString('emoji') || '🛒';

  const services = getServices();
  const id = nextId(services);
  services.push({ id, name, description: desc, price, category, emoji, active: true, createdAt: Date.now() });
  save('services.json', services);

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${name}`)
    .setDescription(desc)
    .addFields(
      { name: '💰 السعر', value: `\`${fmt(price)}\``, inline: true },
      { name: '📂 التصنيف', value: category, inline: true },
      { name: '🆔 الرقم', value: `${id}`, inline: true },
    )
    .setColor(0x2ECC71).setTimestamp();
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function cmdEditService(interaction) {
  const id = parseInt(interaction.options.getString('id'));
  const services = getServices();
  const svc = services.find(s => s.id === id);
  if (!svc) return interaction.reply({ content: '❌ خدمة غير موجودة', ephemeral: true });

  const name = interaction.options.getString('name');
  const price = interaction.options.getNumber('price');
  const desc = interaction.options.getString('description');
  if (name) svc.name = name;
  if (price) svc.price = price;
  if (desc) svc.description = desc;
  save('services.json', services);

  await interaction.reply({ content: `✅ تم تعديل: ${svc.emoji} ${svc.name} — \`${fmt(svc.price)}\``, ephemeral: true });
}

async function cmdRemoveService(interaction) {
  const id = parseInt(interaction.options.getString('id'));
  let services = getServices();
  const svc = services.find(s => s.id === id);
  if (!svc) return interaction.reply({ content: '❌ خدمة غير موجودة', ephemeral: true });
  services = services.filter(s => s.id !== id);
  save('services.json', services);
  await interaction.reply({ content: `✅ تم حذف: ${svc.emoji || '🛒'} ${svc.name}`, ephemeral: true });
}

// ══════════════════════════════════════════════════════════════
//  HANDLER: ORDER / SUPPORT / CLOSE (Ticket System)
// ══════════════════════════════════════════════════════════════
function getTicketCategory(g) {
  let cat = g.channels.cache.find(c => c.name.includes('التذاكر') && c.type === ChannelType.GuildCategory);
  if (!cat) {
    cat = g.channels.cache.find(c => c.type === ChannelType.GuildCategory);
  }
  return cat;
}

function getTicketOverwrites(g, userId) {
  const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
  const overwrites = [
    { id: g.id, deny: [PermissionFlagsBits.ViewChannel] },
    { id: userId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] },
  ];
  if (staffRole) overwrites.push({ id: staffRole.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory] });
  return overwrites;
}

async function cmdOrder(interaction) {
  const id = parseInt(interaction.options.getString('service'));
  const services = getServices();
  const svc = services.find(s => s.id === id);
  if (!svc) return interaction.reply({ content: '❌ خدمة غير موجودة. استخدم `/services` لعرض الخدمات', ephemeral: true });

  const g = interaction.guild;
  const ticketCat = getTicketCategory(g);
  const orders = getOrders();
  const orderId = nextId(orders);

  const channel = await g.channels.create({
    name: `ticket-${orderId}-${interaction.user.username}`.substring(0, 100),
    type: ChannelType.GuildText,
    parent: ticketCat ? ticketCat.id : undefined,
    permissionOverwrites: getTicketOverwrites(g, interaction.user.id),
  });

  const order = {
    id: orderId, type: 'order', serviceId: svc.id, serviceName: svc.name,
    serviceEmoji: svc.emoji || '🛒', servicePrice: svc.price || 0,
    userId: interaction.user.id, username: interaction.user.username,
    channelId: channel.id, status: 'pending', createdAt: Date.now(),
  };
  orders.push(order);
  save('orders.json', orders);

  const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
  const embed = new EmbedBuilder()
    .setTitle(`🎫 طلب جديد #${orderId}`)
    .setDescription(
      `**العميل:** ${interaction.user}\n` +
      `**الخدمة:** ${svc.emoji || '🛒'} ${svc.name}\n` +
      `**السعر:** \`${fmt(svc.price)}\` كريديت\n` +
      `**الوصف:** ${svc.description || 'بدون وصف'}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⏳ **في انتظار قبول الستاف...**`
    )
    .setColor(0xF1C40F).setTimestamp().setFooter({ text: `Order #${orderId}` });

  const acceptBtn = new ButtonBuilder().setCustomId(`order_accept_${orderId}`).setLabel('✅ قبول').setStyle(ButtonStyle.Success);
  const closeBtn = new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger);
  const row = new ActionRowBuilder().addComponents(acceptBtn, closeBtn);
  await channel.send({ content: `${interaction.user} | ${staffRole || '@everyone'}`, embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ تم إنشاء التذكرة: ${channel}`, ephemeral: true });
}

async function cmdSupport(interaction) {
  const g = interaction.guild;
  const ticketCat = getTicketCategory(g);
  const orders = getOrders();
  const orderId = nextId(orders);

  const channel = await g.channels.create({
    name: `support-${orderId}-${interaction.user.username}`.substring(0, 100),
    type: ChannelType.GuildText,
    parent: ticketCat ? ticketCat.id : undefined,
    permissionOverwrites: getTicketOverwrites(g, interaction.user.id),
  });

  const order = {
    id: orderId, type: 'support', serviceName: 'دعم فني', serviceEmoji: '🛠️',
    userId: interaction.user.id, username: interaction.user.username,
    channelId: channel.id, status: 'open', createdAt: Date.now(),
  };
  orders.push(order);
  save('orders.json', orders);

  const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
  const embed = new EmbedBuilder()
    .setTitle(`🛠️ تذكرة دعم فني #${orderId}`)
    .setDescription(
      `**المستخدم:** ${interaction.user}\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💬 **اكتب مشكلتك هنا** وسيساعدك الستاف\n\n` +
      `━━━━━━━━━━━━━━━━━━━━━`
    )
    .setColor(0x3498DB).setTimestamp().setFooter({ text: `Support #${orderId}` });

  const closeBtn = new ButtonBuilder().setCustomId(`ticket_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger);
  const row = new ActionRowBuilder().addComponents(closeBtn);
  await channel.send({ content: `${interaction.user} | ${staffRole || '@everyone'}`, embeds: [embed], components: [row] });
  await interaction.reply({ content: `✅ تم إنشاء تذكرة الدعم: ${channel}`, ephemeral: true });
}

async function cmdClose(interaction) {
  const orders = getOrders();
  const order = orders.find(o => o.channelId === interaction.channel.id);
  if (!order) return interaction.reply({ content: '❌ هذا ليس تذكرة', ephemeral: true });

  order.status = 'closed';
  order.closedAt = Date.now();
  order.closedBy = interaction.user.id;
  save('orders.json', orders);

  const embed = new EmbedBuilder()
    .setTitle('🔒 تذكرة مغلقة')
    .setDescription(`**أغلقها:** ${interaction.user}\n**الوقت:** ${timestamp()}`)
    .setColor(0xE74C3C).setTimestamp();
  await interaction.reply({ embeds: [embed] });
  await sleep(3000);
  try { await interaction.channel.delete(); } catch {}
}

// ══════════════════════════════════════════════════════════════
//  HANDLER: MODERATION
// ══════════════════════════════════════════════════════════════
async function cmdBan(interaction) {
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'بدون سبب';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ العضو غير موجود في السيرفر', ephemeral: true });
  if (!member.bannable) return interaction.reply({ content: '❌ لا أقدر أحظر هذا العضو', ephemeral: true });

  await member.ban({ reason });
  const embed = new EmbedBuilder()
    .setTitle('🔨 تم الحظر')
    .setDescription(`**العضو:** ${user}\n**بواسطة:** ${interaction.user}\n**السبب:** ${reason}`)
    .setColor(0xE74C3C).setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function cmdKick(interaction) {
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason') || 'بدون سبب';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ العضو غير موجود', ephemeral: true });
  if (!member.kickable) return interaction.reply({ content: '❌ لا أقدر أطرد هذا العضو', ephemeral: true });

  await member.kick(reason);
  const embed = new EmbedBuilder()
    .setTitle('🚪 تم الطرد')
    .setDescription(`**العضو:** ${user}\n**بواسطة:** ${interaction.user}\n**السبب:** ${reason}`)
    .setColor(0xF39C12).setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function cmdMute(interaction) {
  const user = interaction.options.getUser('user');
  const minutes = interaction.options.getNumber('minutes');
  const reason = interaction.options.getString('reason') || 'بدون سبب';
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ العضو غير موجود', ephemeral: true });
  if (!member.moderatable) return interaction.reply({ content: '❌ لا أقدر أكتم هذا العضو', ephemeral: true });

  await member.timeout(minutes * 60 * 1000, reason);
  const embed = new EmbedBuilder()
    .setTitle('🔇 تم الكتم')
    .setDescription(`**العضو:** ${user}\n**المدة:** ${minutes} دقيقة\n**بواسطة:** ${interaction.user}\n**السبب:** ${reason}`)
    .setColor(0x9B59B6).setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function cmdUnmute(interaction) {
  const user = interaction.options.getUser('user');
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  if (!member) return interaction.reply({ content: '❌ العضو غير موجود', ephemeral: true });

  await member.timeout(null);
  const embed = new EmbedBuilder()
    .setTitle('🔊 تم إلغاء الكتم')
    .setDescription(`**العضو:** ${user}\n**بواسطة:** ${interaction.user}`)
    .setColor(0x2ECC71).setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function cmdWarn(interaction) {
  const user = interaction.options.getUser('user');
  const reason = interaction.options.getString('reason');
  const warnings = getWarnings();
  warnings.push({
    id: nextId(warnings), userId: user.id, username: user.username,
    reason, issuedBy: interaction.user.id, issuedByName: interaction.user.username,
    createdAt: Date.now(),
  });
  save('warnings.json', warnings);

  const userWarnings = warnings.filter(w => w.userId === user.id);
  const embed = new EmbedBuilder()
    .setTitle('⚠️ تم التحذير')
    .setDescription(`**العضو:** ${user}\n**السبب:** ${reason}\n**عدد التحذيرات:** ${userWarnings.length}`)
    .setColor(0xF1C40F).setTimestamp();
  await interaction.reply({ embeds: [embed] });

  if (userWarnings.length >= 3) {
    try { await user.send(`⚠️ لقد وصلت إلى ${userWarnings.length} تحذيرات في سيرفر ${interaction.guild.name}. قد يتم حظرك قريباً.`); } catch {}
  }
}

async function cmdWarnings(interaction) {
  const user = interaction.options.getUser('user');
  const warnings = getWarnings().filter(w => w.userId === user.id);
  if (!warnings.length) return interaction.reply({ content: `✅ ${user} ليس لديه تحذيرات`, ephemeral: true });

  const desc = warnings.map((w, i) =>
    `**${i + 1}.** ${w.reason}\n> بواسطة ${w.issuedByName} — <t:${Math.floor(w.createdAt / 1000)}:R>`
  ).join('\n\n');

  const embed = new EmbedBuilder()
    .setTitle(`⚠️ تحذيرات ${user.username}`)
    .setDescription(desc)
    .setColor(0xF1C40F).setTimestamp();
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

async function cmdClearWarnings(interaction) {
  const user = interaction.options.getUser('user');
  let warnings = getWarnings();
  const before = warnings.filter(w => w.userId === user.id).length;
  warnings = warnings.filter(w => w.userId !== user.id);
  save('warnings.json', warnings);
  await interaction.reply({ content: `✅ تم مسح ${before} تحذيرات من ${user}`, ephemeral: true });
}

async function cmdPurge(interaction) {
  const amount = interaction.options.getNumber('amount');
  if (amount < 1 || amount > 100) return interaction.reply({ content: '❌ العدد من 1 لـ 100', ephemeral: true });

  const deleted = await interaction.channel.bulkDelete(amount, true);
  const embed = new EmbedBuilder()
    .setTitle('🗑️ تم المسح')
    .setDescription(`**تم مسح** ${deleted.size} رسالة`)
    .setColor(0xE74C3C).setTimestamp();
  await interaction.reply({ embeds: [embed], ephemeral: true });
  await sleep(3000);
  try { await interaction.deleteReply(); } catch {}
}

// ══════════════════════════════════════════════════════════════
//  HANDLER: CREDITS / REVIEW / LEADERBOARD
// ══════════════════════════════════════════════════════════════
async function cmdCredits(interaction) {
  const user   = interaction.options.getUser('user') || interaction.user;
  const amount = interaction.options.getNumber('amount');

  if (amount && interaction.user.id === user.id) {
    return interaction.reply({ content: '❌ لا تقدر تبعت كريديت لنفسك', ephemeral: true });
  }

  if (amount) {
    const embed = new EmbedBuilder()
      .setTitle('💰 تحويل كريديت')
      .setDescription(`استخدم أمر ProBot:\n\n\`/credits ${user} ${amount}\``)
      .setColor(0x3498DB).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  } else {
    const embed = new EmbedBuilder()
      .setTitle('💰 الكريديت')
      .setDescription(`**${user.username}** — استخدم أمر **ProBot** لعرض رصيدك:\n\n\`/credits\``)
      .setColor(0x2ECC71).setTimestamp();
    await interaction.reply({ embeds: [embed], ephemeral: true });
  }
}

async function cmdReview(interaction) {
  const id      = parseInt(interaction.options.getString('service'));
  const rating  = interaction.options.getNumber('rating');
  const comment = interaction.options.getString('comment') || '';
  const services = getServices();
  const svc = services.find(s => s.id === id);
  if (!svc) return interaction.reply({ content: '❌ خدمة غير موجودة', ephemeral: true });
  if (rating < 1 || rating > 5) return interaction.reply({ content: '❌ التقييم من 1 لـ 5', ephemeral: true });

  const reviews = getReviews();
  reviews.push({
    id: nextId(reviews), serviceId: id, serviceName: svc.name,
    userId: interaction.user.id, username: interaction.user.username,
    rating, comment, createdAt: Date.now(),
  });
  save('reviews.json', reviews);

  const stars = '★'.repeat(Math.floor(rating)) + '☆'.repeat(5 - Math.floor(rating));
  const embed = new EmbedBuilder()
    .setTitle('⭐ تم التقييم')
    .setDescription(`**الخدمة:** ${svc.emoji || '🤖'} ${svc.name}\n**التقييم:** ${stars}\n**التعليق:** ${comment || 'بدون'}`)
    .setColor(0xF1C40F).setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function cmdLeaderboard(interaction) {
  const reviews = getReviews();
  if (!reviews.length) return interaction.reply({ content: '📭 لا توجد تقييمات بعد', ephemeral: true });

  const userStats = {};
  for (const r of reviews) {
    const name = r.username || 'unknown';
    if (!userStats[name]) userStats[name] = { total: 0, count: 0 };
    userStats[name].total += Number(r.rating) || 0;
    userStats[name].count += 1;
  }

  const entries = Object.entries(userStats)
    .map(([name, s]) => ({ name, avg: s.total / s.count, count: s.count }))
    .sort((a, b) => b.avg - a.avg || b.count - a.count)
    .slice(0, 10);

  const medals = ['🥇', '🥈', '🥉'];
  const desc = entries.map((e, i) =>
    `${medals[i] || `**${i + 1}.**`} ${e.name} — ⭐ ${e.avg.toFixed(1)} (${e.count} تقييم)`
  ).join('\n');

  const embed = new EmbedBuilder()
    .setTitle('🏆 أكثر المستخدمين تقييماتاً')
    .setDescription(desc).setColor(0xFFD700).setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

// ══════════════════════════════════════════════════════════════
//  HANDLER: SERVER INFO / USER INFO / HELP
// ══════════════════════════════════════════════════════════════
async function cmdServerInfo(interaction) {
  const g = interaction.guild;
  await g.members.fetch().catch(() => {});
  const embed = new EmbedBuilder()
    .setTitle(`📊 ${g.name}`)
    .setThumbnail(g.iconURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: '👑 المالك', value: `<@${g.ownerId}>`, inline: true },
      { name: '👥 الأعضاء', value: `${g.memberCount}`, inline: true },
      { name: '💬 القنوات', value: `${g.channels.cache.size}`, inline: true },
      { name: '🎭 الرولات', value: `${g.roles.cache.size}`, inline: true },
      { name: 'boosts', value: `${g.premiumSubscriptionCount || 0}`, inline: true },
      { name: '📅 تاريخ الإنشاء', value: `<t:${Math.floor(g.createdAt.getTime() / 1000)}:F>`, inline: false },
    )
    .setColor(0x3498DB).setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function cmdUserInfo(interaction) {
  const user = interaction.options.getUser('user') || interaction.user;
  const member = await interaction.guild.members.fetch(user.id).catch(() => null);
  const warnings = getWarnings().filter(w => w.userId === user.id);
  const reviews = getReviews().filter(r => r.userId === user.id);

  const embed = new EmbedBuilder()
    .setTitle(`👤 ${user.username}`)
    .setThumbnail(user.displayAvatarURL({ dynamic: true, size: 256 }))
    .addFields(
      { name: '🆔 ID', value: user.id, inline: true },
      { name: '📅 حساب تم الإنشاء', value: `<t:${Math.floor(user.createdAt.getTime() / 1000)}:R>`, inline: true },
      { name: '📥 دخل السيرفر', value: member?.joinedAt ? `<t:${Math.floor(member.joinedAt.getTime() / 1000)}:R>` : 'غير معروف', inline: true },
      { name: '⚠️ التحذيرات', value: `${warnings.length}`, inline: true },
      { name: '⭐ التقييمات', value: `${reviews.length}`, inline: true },
    )
    .setColor(0x3498DB).setTimestamp();
  await interaction.reply({ embeds: [embed] });
}

async function cmdHelp(interaction) {
  const embed = new EmbedBuilder()
    .setTitle('🤖 أوامر البوت')
    .addFields(
      { name: '📦 عامة', value: [
        '`/services` عرض الخدمات',
        '`/order` طلب خدمة',
        '`/support` دعم فني',
        '`/close` إغلاق تذكرة',
        '`/credits` الكريديت',
        '`/review` تقييم خدمة',
        '`/leaderboard` الترتيب',
        '`/server-info` معلومات السيرفر',
        '`/user-info` معلومات عضو',
        '`/help` المساعدة',
      ].join('\n') },
      { name: '🛡️ إدارية', value: [
        '`/setup` إعداد السيرفر',
        '`/add-service` إضافة خدمة',
        '`/edit-service` تعديل خدمة',
        '`/remove-service` حذف خدمة',
        '`/announce` إعلان',
        '`/auto-role` رولات تلقائية',
      ].join('\n') },
      { name: '🔨 مoderation', value: [
        '`/ban` حظر عضو',
        '`/kick` طرد عضو',
        '`/mute` كتم عضو',
        '`/unmute` إلغاء كتم',
        '`/warn` تحذير عضو',
        '`/warnings` عرض التحذيرات',
        '`/clear-warnings` مسح التحذيرات',
        '`/purge` مسح رسائل',
      ].join('\n') },
    )
    .setColor(0xFF0000).setTimestamp();
  await interaction.reply({ embeds: [embed], ephemeral: true });
}

// ══════════════════════════════════════════════════════════════
//  HANDLER: AUTO-ROLE
// ══════════════════════════════════════════════════════════════
async function cmdAutoRole(interaction) {
  const sub = interaction.options.getSubcommand();

  if (sub === 'add') {
    const role = interaction.options.getRole('role');
    if (CFG.autoRoles.includes(role.id)) return interaction.reply({ content: `❌ الرول <@&${role.id}> مضاف أصلاً`, ephemeral: true });
    CFG.autoRoles.push(role.id);
    save('config.json', CFG);
    return interaction.reply({ content: `✅ الرول <@&${role.id}> صار ينضاف تلقائياً`, ephemeral: true });
  }

  if (sub === 'remove') {
    const role = interaction.options.getRole('role');
    if (!CFG.autoRoles.includes(role.id)) return interaction.reply({ content: `❌ الرول غير موجود في القائمة`, ephemeral: true });
    CFG.autoRoles = CFG.autoRoles.filter(id => id !== role.id);
    save('config.json', CFG);
    return interaction.reply({ content: `✅ تم حذف الرول`, ephemeral: true });
  }

  if (sub === 'list') {
    if (!CFG.autoRoles.length) return interaction.reply({ content: '📭 ما في أي رول تلقائي', ephemeral: true });
    const list = CFG.autoRoles.map(id => `• <@&${id}>`).join('\n');
    const embed = new EmbedBuilder().setTitle('🎭 الأدوات التلقائية').setDescription(list).setColor(0x3498DB).setTimestamp();
    return interaction.reply({ embeds: [embed], ephemeral: true });
  }

  if (sub === 'clear') {
    CFG.autoRoles = [];
    save('config.json', CFG);
    return interaction.reply({ content: '✅ تم مسح كل الرولات التلقائية', ephemeral: true });
  }
}

// ══════════════════════════════════════════════════════════════
//  HANDLER: ANNOUNCE
// ══════════════════════════════════════════════════════════════
async function cmdAnnounce(interaction) {
  await interaction.deferReply({ ephemeral: true });
  const title = interaction.options.getString('title');
  const content = interaction.options.getString('content');
  const emoji = interaction.options.getString('emoji') || '📣';

  let ch = interaction.guild.channels.cache.find(c => c.name.includes('الإعلانات') && c.isTextBased());
  if (!ch) return interaction.editReply('❌ قناة الإعلانات غير موجودة');

  const embed = new EmbedBuilder()
    .setTitle(`${emoji} ${safe(title, 200)}`)
    .setDescription(safe(content, 4000))
    .setColor(0xFF0000).setTimestamp()
    .setFooter({ text: `📢 إعلان من ${interaction.user.username}` });
  await ch.send({ embeds: [embed] });
  await interaction.editReply(`✅ تم الإرسال في ${ch}`);
}

// ══════════════════════════════════════════════════════════════
//  MAIN INTERACTION ROUTER
// ══════════════════════════════════════════════════════════════
client.on('interactionCreate', async (interaction) => {
  try {
    if (interaction.isChatInputCommand()) {
      const map = {
        setup: cmdSetup, services: cmdServices, credits: cmdCredits,
        review: cmdReview, leaderboard: cmdLeaderboard, help: cmdHelp,
        'add-service': cmdAddService, 'edit-service': cmdEditService,
        'remove-service': cmdRemoveService, 'auto-role': cmdAutoRole,
        announce: cmdAnnounce, order: cmdOrder, support: cmdSupport, close: cmdClose,
        ban: cmdBan, kick: cmdKick, mute: cmdMute, unmute: cmdUnmute,
        warn: cmdWarn, warnings: cmdWarnings, 'clear-warnings': cmdClearWarnings,
        purge: cmdPurge, 'server-info': cmdServerInfo, 'user-info': cmdUserInfo,
      };
      const handler = map[interaction.commandName];
      if (handler) return await handler(interaction);
    }

    if (interaction.isButton()) {
      const cid = interaction.customId || '';

      // Order accept
      if (cid.startsWith('order_accept_')) {
        const orderId = parseInt(cid.replace('order_accept_', ''));
        const orders = getOrders();
        const order = orders.find(o => o.id === orderId);
        if (!order) return interaction.reply({ content: '❌ الطلب غير موجود', ephemeral: true });
        if (order.status !== 'pending') return interaction.reply({ content: '❌ الطلب تم التعامل معه', ephemeral: true });

        order.status = 'progress';
        order.acceptedBy = interaction.user.id;
        order.acceptedAt = Date.now();
        save('orders.json', orders);

        const embed = new EmbedBuilder()
          .setTitle(`🎫 طلب #${orderId} — قيد التنفيذ`)
          .setDescription(
            `**العميل:** <@${order.userId}>\n` +
            `**الخدمة:** ${order.serviceEmoji || '🛒'} ${order.serviceName}\n` +
            `**السعر:** \`${fmt(order.servicePrice || 0)}\`\n` +
            `**الستاف:** ${interaction.user}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n🔄 **جاري التنفيذ...**\n━━━━━━━━━━━━━━━━━━━━━`
          )
          .setColor(0x3498DB).setTimestamp().setFooter({ text: `Order #${orderId}` });

        const completeBtn = new ButtonBuilder().setCustomId(`order_complete_${orderId}`).setLabel('🏁 إتمام').setStyle(ButtonStyle.Primary);
        const closeBtn = new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(completeBtn, closeBtn);
        await interaction.update({ embeds: [embed], components: [row] });
        return;
      }

      // Order complete
      if (cid.startsWith('order_complete_')) {
        const orderId = parseInt(cid.replace('order_complete_', ''));
        const orders = getOrders();
        const order = orders.find(o => o.id === orderId);
        if (!order) return interaction.reply({ content: '❌ الطلب غير موجود', ephemeral: true });
        if (order.status !== 'progress') return interaction.reply({ content: '❌ لا يمكن إتمام هذا الطلب', ephemeral: true });

        order.status = 'completed';
        order.completedAt = Date.now();
        order.completedBy = interaction.user.id;
        save('orders.json', orders);

        const embed = new EmbedBuilder()
          .setTitle(`✅ طلب #${orderId} — مكتمل`)
          .setDescription(
            `**العميل:** <@${order.userId}>\n` +
            `**الخدمة:** ${order.serviceEmoji || '🛒'} ${order.serviceName}\n` +
            `**الستاف:** ${interaction.user}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n✅ **تم الإتمام!**\n<@${order.userId}> استخدم \`/review\` لتقييم الخدمة\n━━━━━━━━━━━━━━━━━━━━━`
          )
          .setColor(0x2ECC71).setTimestamp().setFooter({ text: `Order #${orderId}` });

        const closeBtn = new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(closeBtn);
        await interaction.update({ embeds: [embed], components: [row] });
        return;
      }

      // Close ticket (order or support)
      if (cid.startsWith('order_close_') || cid.startsWith('ticket_close_')) {
        const orderId = parseInt(cid.replace('order_close_', '').replace('ticket_close_', ''));
        const orders = getOrders();
        const order = orders.find(o => o.id === orderId);
        if (!order) return interaction.reply({ content: '❌ التذكرة غير موجودة', ephemeral: true });

        order.status = 'closed';
        order.closedAt = Date.now();
        order.closedBy = interaction.user.id;
        save('orders.json', orders);

        const embed = new EmbedBuilder()
          .setTitle('🔒 تذكرة مغلقة')
          .setDescription(`**أغلقها:** ${interaction.user}`)
          .setColor(0xE74C3C).setTimestamp();
        await interaction.reply({ embeds: [embed] });
        await sleep(3000);
        try { await interaction.channel.delete(); } catch {}
        return;
      }

      // Open ticket button
      if (cid === 'open_ticket') {
        const g = interaction.guild;
        const ticketCat = getTicketCategory(g);
        const orders = getOrders();
        const orderId = nextId(orders);

        const channel = await g.channels.create({
          name: `order-${orderId}-${interaction.user.username}`.substring(0, 100),
          type: ChannelType.GuildText,
          parent: ticketCat ? ticketCat.id : undefined,
          permissionOverwrites: getTicketOverwrites(g, interaction.user.id),
        });

        const services = getServices().filter(s => s.active);
        const svcList = services.map(s => `${s.emoji || '🛒'} **${s.name}** — \`${fmt(s.price)}\``).join('\n');

        const order = {
          id: orderId, type: 'order', serviceName: 'طلب جديد', serviceEmoji: '🎫',
          userId: interaction.user.id, username: interaction.user.username,
          channelId: channel.id, status: 'open', createdAt: Date.now(),
        };
        orders.push(order);
        save('orders.json', orders);

        const staffRole = g.roles.cache.find(r => r.name.includes('Staff'));
        const embed = new EmbedBuilder()
          .setTitle(`🎫 طلب جديد #${orderId}`)
          .setDescription(
            `**العميل:** ${interaction.user}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n**🛒 الخدمات:**\n\n${svcList}\n\n` +
            `━━━━━━━━━━━━━━━━━━━━━\n\n💬 **اكتب الخدمة اللي تبيها**\n\n━━━━━━━━━━━━━━━━━━━━━`
          )
          .setColor(0xF1C40F).setTimestamp().setFooter({ text: `Order #${orderId}` });

        const closeBtn = new ButtonBuilder().setCustomId(`order_close_${orderId}`).setLabel('🗑️ إغلاق').setStyle(ButtonStyle.Danger);
        const row = new ActionRowBuilder().addComponents(closeBtn);
        await channel.send({ content: `${interaction.user} | ${staffRole || '@everyone'}`, embeds: [embed], components: [row] });
        await interaction.reply({ content: `✅ تم فتح التذكرة: ${channel}`, ephemeral: true });
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
  client.user.setActivity('AI Services Shop', { type: 3 });
});

client.on('guildMemberAdd', async (member) => {
  if (CFG.autoRoles && CFG.autoRoles.length) {
    for (const roleId of CFG.autoRoles) {
      try {
        const role = member.guild.roles.cache.get(roleId);
        if (role) await member.roles.add(role);
      } catch {}
    }
  }

  try {
    const g = member.guild;
    let ch = g.channels.cache.find(c => c.name.includes('الترحيب') && c.isTextBased());
    if (!ch) return;

    const embed = new EmbedBuilder()
      .setTitle(`مرحباً ${member.user.username}! 🎉`)
      .setDescription(
        '━━━━━━━━━━━━━━━━━━━━━\n\n' +
        `**اهلاً وسهلاً بك في ${g.name}!** 🚀\n\n` +
        `أنت العضو رقم **${g.memberCount}**\n\n` +
        '━━━━━━━━━━━━━━━━━━━━━\n\n' +
        '**📦 ابدأ بالخطوات:**\n\n' +
        '> 🛒 كتابة `/services` لعرض الخدمات\n' +
        '> 💰 استخدام `/credits` لعرض رصيدك\n' +
        '> ⭐ تقييم الخدمة بـ `/review`\n\n' +
        '━━━━━━━━━━━━━━━━━━━━━'
      )
      .setColor(0x2ECC71).setTimestamp()
      .setFooter({ text: `${g.name} • ${g.memberCount} عضو` });

    try {
      const avatar = member.user.displayAvatarURL({ dynamic: true, size: 256 });
      if (avatar) embed.setThumbnail(avatar);
    } catch {}

    await ch.send({ content: `${member}`, embeds: [embed] }).catch(() => {});
  } catch {}
});

// ══════════════════════════════════════════════════════════════
//  HTTP API (for web panel)
// ══════════════════════════════════════════════════════════════
const API_PORT = process.env.PORT || process.env.BOT_API_PORT || 3001;

function parseBody(req) {
  return new Promise((resolve) => {
    let body = '';
    req.on('data', chunk => { body += chunk; });
    req.on('end', () => { try { resolve(JSON.parse(body || '{}')); } catch { resolve({}); } });
  });
}

function jsonRes(res, code, data) {
  res.writeHead(code, { 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
}

const apiServer = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, PATCH, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  if (req.method === 'OPTIONS') { res.writeHead(200); return res.end(); }

  const url = new URL(req.url, 'http://localhost');
  const p = url.pathname;

  try {
    if (req.method === 'GET' && (p === '/api/health' || p === '/')) {
      return jsonRes(res, 200, { status: 'ok', uptime: process.uptime() });
    }

    const guild = client.guilds.cache.first();
    if (!guild && !p.startsWith('/api/bot') && p !== '/api/health') return jsonRes(res, 500, { error: 'Bot not in guild' });

    if (req.method === 'GET' && p === '/api/bot') {
      return jsonRes(res, 200, {
        id: client.user.id, username: client.user.username,
        avatar: client.user.displayAvatarURL({ dynamic: true, size: 256 }),
      });
    }

    if (req.method === 'GET' && p === '/api/guild') {
      return jsonRes(res, 200, {
        id: guild.id, name: guild.name,
        icon: guild.iconURL({ dynamic: true, size: 256 }) || null,
        memberCount: guild.memberCount, ownerId: guild.ownerId,
        createdAt: guild.createdAt ? guild.createdAt.toISOString() : null,
        boostCount: guild.premiumSubscriptionCount || 0,
      });
    }

    if (req.method === 'GET' && p === '/api/channels') {
      const channels = [];
      for (const [, c] of guild.channels.cache) {
        channels.push({ id: c.id, name: c.name, type: c.type, parent: c.parentId || null, position: c.position || 0, topic: c.topic || '' });
      }
      channels.sort((a, b) => a.position - b.position);
      return jsonRes(res, 200, channels);
    }

    if (req.method === 'GET' && p === '/api/roles') {
      const roles = [];
      for (const [, r] of guild.roles.cache) {
        roles.push({ id: r.id, name: r.name, color: r.hexColor, mentionable: r.mentionable, hoist: r.hoist, members: r.members ? r.members.size : 0, managed: r.managed });
      }
      return jsonRes(res, 200, roles);
    }

    if (req.method === 'GET' && p === '/api/members') {
      try { await guild.members.fetch(); } catch {}
      const members = [];
      for (const [, m] of guild.members.cache) {
        const roleIds = [];
        for (const [, r] of m.roles.cache) { if (r.id !== guild.id) roleIds.push(r.id); }
        members.push({
          id: m.id, username: m.user.username, displayName: m.displayName || m.user.username,
          avatar: m.user.displayAvatarURL({ dynamic: true, size: 64 }),
          roles: roleIds, joinedAt: m.joinedAt ? m.joinedAt.toISOString() : null,
        });
      }
      return jsonRes(res, 200, members);
    }

    if (req.method === 'GET' && p === '/api/services') return jsonRes(res, 200, getServices());
    if (req.method === 'PUT' && p === '/api/services') {
      const d = await parseBody(req);
      save('services.json', d);
      return jsonRes(res, 200, { ok: true });
    }

    if (req.method === 'GET' && p === '/api/reviews') return jsonRes(res, 200, getReviews());
    if (req.method === 'GET' && p === '/api/tickets') return jsonRes(res, 200, getOrders());
    if (req.method === 'PUT' && p === '/api/tickets') {
      const d = await parseBody(req);
      save('orders.json', d);
      return jsonRes(res, 200, { ok: true });
    }
    if (req.method === 'GET' && p.match(/^\/api\/tickets\/\d+$/)) {
      const id = parseInt(p.split('/').pop());
      const order = getOrders().find(o => o.id === id);
      if (!order) return jsonRes(res, 404, { error: 'Not found' });
      return jsonRes(res, 200, order);
    }
    if (req.method === 'PUT' && p.match(/^\/api\/tickets\/\d+$/)) {
      const id = parseInt(p.split('/').pop());
      const orders = getOrders();
      const idx = orders.findIndex(o => o.id === id);
      if (idx === -1) return jsonRes(res, 404, { error: 'Not found' });
      const d = await parseBody(req);
      orders[idx] = { ...orders[idx], ...d, id: orders[idx].id };
      save('orders.json', orders);
      return jsonRes(res, 200, { ok: true });
    }

    if (req.method === 'POST' && p === '/api/announce') {
      const d = await parseBody(req);
      let ch = guild.channels.cache.find(c => c.name.includes('الإعلانات') && c.isTextBased() && !c.isThread());
      if (!ch) return jsonRes(res, 404, { error: 'قناة الإعلانات غير موجودة' });
      const embed = new EmbedBuilder()
        .setTitle(`${d.emoji || '📣'} ${safe(d.title, 200)}`)
        .setDescription(safe(d.content, 4000))
        .setColor(d.color || '#FF0000').setTimestamp()
        .setFooter({ text: '📢 إعلان من لوحة التحكم' });
      await ch.send({ embeds: [embed] });
      return jsonRes(res, 200, { ok: true });
    }

    jsonRes(res, 404, { error: 'Not found' });
  } catch (e) {
    console.error('API Error:', e.message);
    jsonRes(res, 500, { error: e.message });
  }
});

apiServer.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`❌ Port ${API_PORT} is already in use`);
  } else {
    console.error('API Server Error:', err.message);
  }
});

apiServer.listen(API_PORT, '0.0.0.0', () => {
  console.log(`📡 Bot API: http://0.0.0.0:${API_PORT}`);
});

// ══════════════════════════════════════════════════════════════
//  START — Smart command registration
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
    client.user.setActivity('AI Services Shop', { type: 3 });

    try {
      const url = `https://discord.com/api/v10/applications/${CFG.clientId}/guilds/${CFG.guildId}/commands`;

      const listRes = await fetch(url, {
        headers: { 'Authorization': `Bot ${CFG.token}` },
      });

      if (!listRes.ok) {
        console.error(`❌ Failed to list commands: ${listRes.status}`);
        return;
      }

      const existing = await listRes.json();
      const existingNames = new Set(existing.map(c => c.name));
      const needed = COMMANDS.filter(c => !existingNames.has(c.toJSON().name));

      if (needed.length === 0) {
        console.log(`✅ ${existing.length} commands already registered, skipping`);
        return;
      }

      const allCommands = [...existing.map(c => ({ name: c.name, description: c.description, options: c.options || [] })), ...needed.map(c => c.toJSON())];

      console.log(`📡 ${existing.length} exist, adding ${needed.length} new (${allCommands.length} total)...`);

      const putRes = await fetch(url, {
        method: 'PUT',
        headers: {
          'Authorization': `Bot ${CFG.token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(allCommands),
      });

      if (putRes.ok) {
        const data = await putRes.json();
        console.log(`✅ ${data.length} commands registered!`);
      } else {
        const body = await putRes.text();
        console.error(`❌ ${putRes.status}: ${body}`);
      }
    } catch (err) {
      console.error('❌ Command registration FAILED:', err.message);
    }
  });

  try {
    await client.login(CFG.token);
  } catch (err) {
    console.error('❌ Discord login failed:', err.message);
  }
}

start();
